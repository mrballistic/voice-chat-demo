// openai-realtime-proxy.js
// Node.js WebSocket proxy for OpenAI's real-time voice-to-voice API
// Usage: node openai-realtime-proxy.js

import 'dotenv/config';
import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';
const OPENAI_MODEL = 'gpt-4o-realtime-preview-2025-02-01';
const PORT = process.env.PORT || 8080;

if (!OPENAI_API_KEY) {
  console.error('Missing OpenAI API key. Set NEXT_PUBLIC_OPENAI_API_KEY or OPENAI_API_KEY.');
  process.exit(1);
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (clientWs) => {
  console.log('[Proxy] Client connected');
  // Connect to OpenAI's realtime endpoint
  const openaiWs = new WebSocket(`${OPENAI_REALTIME_URL}?model=${OPENAI_MODEL}`, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'openai-beta': 'realtime=v1',
    },
  });

  const openaiMsgQueue = [];
  let openaiReady = false;

  // Relay messages from client to OpenAI
  clientWs.on('message', async (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'conversation.item.create' && parsed.item && Array.isArray(parsed.item.content)) {
        const audioObj = parsed.item.content.find(c => c.type === 'input_audio');
        if (audioObj && audioObj.audio) {
          const audioLength = audioObj.audio.length;
          const audioSample = audioObj.audio.slice(0, 64) + (audioObj.audio.length > 64 ? '...' : '');
          console.log('[PROXY] Forwarding conversation.item.create: audio length', audioLength, 'sample', audioSample);
        } else {
          console.log('[PROXY] Forwarding conversation.item.create: NO AUDIO PAYLOAD');
        }
      } else if (parsed.type === 'response.create') {
        console.log('[PROXY] Forwarding response.create:', JSON.stringify(parsed));
      } else {
        console.log('[PROXY] Forwarding client message to OpenAI:', parsed);
      }
    } catch {
      console.error('[PROXY] Invalid JSON from client');
    }
    if (openaiReady && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(msg);
    } else {
      openaiMsgQueue.push(msg);
    }
  });

  // Relay messages from OpenAI to client
  openaiWs.on('message', (data, isBinary) => {
    // Always try to parse as JSON first
    let isJson = false;
    let jsonStr = null;
    if (!isBinary && typeof data !== 'string') {
      // Buffer, try toString
      try {
        jsonStr = data.toString();
        JSON.parse(jsonStr); // Only to check if it's valid JSON
        isJson = true;
      } catch {}
    } else if (typeof data === 'string') {
      jsonStr = data;
      try {
        JSON.parse(jsonStr); // Only to check if it's valid JSON
        isJson = true;
      } catch {}
    }
    if (isJson && jsonStr) {
      // Enhanced: Log full JSON from OpenAI
      console.log('[Proxy] [FULL JSON from OpenAI]:', jsonStr);
      clientWs.send(jsonStr);
      try {
        const msg = JSON.parse(jsonStr);
        const msgType = msg.type || 'unknown';
        if (msg.error) {
          console.error('[Proxy] OpenAI ERROR:', msg.error);
          // Forward error to client
          clientWs.send(JSON.stringify({ type: 'openai.error', error: msg.error }));
        }
        if (msgType === 'response.audio.delta') {
          console.log('[Proxy] >>> RECEIVED AUDIO DELTA from OpenAI');
        }
        if (msgType === 'response.text.delta') {
          console.log('[Proxy] >>> RECEIVED TEXT DELTA from OpenAI:', msg.delta);
        }
        if (msgType === 'response.audio.delta' && msg.delta) {
          // Also send audio as binary
          const audioBuffer = Buffer.from(msg.delta, 'base64');
          // Log first 32 bytes of audioBuffer as hex
          const hex = Array.from(audioBuffer.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          console.log('[Proxy] [AUDIO DELTA] First 32 bytes (hex):', hex, '| Total bytes:', audioBuffer.length);
          clientWs.send(audioBuffer);
        }
      } catch {
        // Ignore parse errors in logging
      }
      return;
    }
    // If not JSON, treat as binary audio
    if (isBinary || Buffer.isBuffer(data)) {
      // Log first 32 bytes of binary as hex
      const hex = Array.from(data.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log('[Proxy] Received binary message from OpenAI (audio chunk,', data.length, 'bytes). First 32 bytes (hex):', hex);
      clientWs.send(data);
      return;
    }
    // Ignore keepalive or non-JSON messages (e.g., '.')
    if (typeof data === 'string' && (data.trim() === '.' || data.trim() === '')) {
      return;
    }
    // Fallback: log and ignore
    console.log('[Proxy] Received unknown message from OpenAI:', data);
  });

  openaiWs.on('open', () => {
    openaiReady = true;
    console.log('[Proxy] Connected to OpenAI realtime API');
    // Flush queued messages
    while (openaiMsgQueue.length > 0) {
      const queuedMsg = openaiMsgQueue.shift();
      openaiWs.send(queuedMsg);
    }
  });
  openaiWs.on('close', (code, reason) => {
    // Enhanced: Log close code and reason in detail
    let reasonStr = '';
    if (Buffer.isBuffer(reason)) {
      reasonStr = reason.toString('utf8');
    } else if (typeof reason === 'string') {
      reasonStr = reason;
    } else {
      reasonStr = JSON.stringify(reason);
    }
    console.log('[Proxy] OpenAI connection closed:', code, '| Reason:', reasonStr);
  });
  openaiWs.on('error', (err) => {
    console.error('[Proxy] OpenAI WS error:', err);
  });
  clientWs.on('message', (data, isBinary) => {
    if (isBinary) {
      console.log('[Proxy] Received binary message from client (', data.length, 'bytes)');
    } else {
      try {
        const msg = JSON.parse(data.toString());
        console.log('[Proxy] Received JSON from client:', msg);
      } catch {
        console.log('[Proxy] Received non-JSON text from client:', data.toString());
      }
    }
  });
  clientWs.on('close', (code, reason) => {
    console.log('[Proxy] Client connection closed:', code, reason.toString());
  });
  clientWs.on('error', (err) => {
    console.error('[Proxy] Client WS error:', err);
  });
});

server.listen(PORT, () => {
  console.log(`OpenAI Realtime Proxy listening on ws://localhost:${PORT}`);
});
