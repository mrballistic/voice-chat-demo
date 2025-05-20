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
  // Connect to OpenAI's realtime endpoint
  const openaiWs = new WebSocket(`${OPENAI_REALTIME_URL}?model=${OPENAI_MODEL}`, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'openai-beta': 'realtime=v1',
    },
  });

  let previousResponseId = null;

  // Relay messages from client to OpenAI
  clientWs.on('message', async (msg) => {
    // Expecting a JSON message: { audio: <base64 PCM16>, systemPrompt?: string }
    let parsed;
    try {
      parsed = JSON.parse(msg);
    } catch (e) {
      console.error('[PROXY] Invalid JSON from client:', e);
      return;
    }
    if (parsed.audio) {
      // 1. Send conversation.item.create
      const itemMsg = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_audio', audio: parsed.audio }]
        }
      };
      openaiWs.send(JSON.stringify(itemMsg));
      console.log('[PROXY] Sent conversation.item.create to OpenAI');
      // 2. Send response.create
      const responseMsg = {
        type: 'response.create',
        response: {
          modalities: ['audio', 'text'],
          instructions: parsed.systemPrompt || 'You are an assistant that answers briefly and politely.',
          previous_response_id: previousResponseId
        }
      };
      openaiWs.send(JSON.stringify(responseMsg));
      console.log('[PROXY] Sent response.create to OpenAI');
    }
  });

  // Relay messages from OpenAI to client
  openaiWs.on('message', (msg) => {
    if (typeof msg === 'string') {
      // Ignore keepalive or non-JSON messages (e.g., '.')
      if (msg.trim() === '.' || msg.trim() === '') {
        return;
      }
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'response.done' && parsed.response && parsed.response.id) {
          previousResponseId = parsed.response.id;
        }
        if (parsed.type === 'response.audio.delta' && parsed.delta) {
          // Decode base64 audio and send as binary
          const audioBuffer = Buffer.from(parsed.delta, 'base64');
          clientWs.send(audioBuffer);
          return;
        }
      } catch {
        // Not valid JSON, ignore
        return;
      }
    }
    // For all other messages, send as-is (JSON string)
    clientWs.send(msg);
  });

  openaiWs.on('error', (err) => {
    console.error('[PROXY] OpenAI WebSocket error:', err);
    clientWs.close();
  });
  clientWs.on('close', () => openaiWs.close());
});

server.listen(PORT, () => {
  console.log(`OpenAI Realtime Proxy listening on ws://localhost:${PORT}`);
});
