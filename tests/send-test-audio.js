// send-test-audio.js
// Usage: node send-test-audio.js [base64file]
// Connects to local OpenAI proxy, waits for session.created, sends test audio, and logs responses.

import fs from 'fs';
import WebSocket from 'ws';

const BASE64_FILE = process.argv[2] || 'test-4s.pcm16.b64.txt';
const PROXY_URL = 'ws://localhost:8080';

const audioBase64 = fs.readFileSync(BASE64_FILE, 'utf8').trim();

const ws = new WebSocket(PROXY_URL);


ws.on('open', () => {
  console.log('[Test] Connected to proxy');
});

ws.on('message', (data, isBinary) => {
  if (isBinary) {
    console.log('[Test] Received binary audio chunk,', data.length, 'bytes');
    return;
  }
  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch {
    console.log('[Test] Received non-JSON text:', data.toString());
    return;
  }
  console.log('[Test] Received JSON:', msg.type || 'unknown', JSON.stringify(msg).slice(0, 200));
  if (msg.type === 'session.created') {
    sessionReady = true;
    // Send conversation.item.create with test audio
    const itemMsg = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_audio',
            audio: audioBase64,
            encoding: 'pcm16',
            sample_rate: 16000,
            channels: 1
          }
        ]
      }
    };
    ws.send(JSON.stringify(itemMsg));
    console.log('[Test] Sent conversation.item.create with test audio');
    // DO NOT send response.create (minimal protocol test)
  }
  if (msg.type === 'response.audio.delta') {
    console.log('[Test] Got response.audio.delta (JSON)');
  }
  if (msg.type === 'response.text.delta') {
    console.log('[Test] Got response.text.delta:', msg.delta);
  }
  if (msg.type === 'openai.error' || msg.error) {
    console.error('[Test] ERROR:', msg.error || msg);
  }
});

ws.on('close', (code, reason) => {
  let reasonStr = Buffer.isBuffer(reason) ? reason.toString('utf8') : (typeof reason === 'string' ? reason : JSON.stringify(reason));
  console.log('[Test] Proxy connection closed:', code, '| Reason:', reasonStr);
});

ws.on('error', (err) => {
  console.error('[Test] Proxy WS error:', err);
});
