// openai-realtime-proxy.js
// Node.js WebSocket proxy for OpenAI's real-time voice-to-voice API
// Usage: node openai-realtime-proxy.js

import 'dotenv/config';
import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';
const OPENAI_MODEL = 'gpt-4o-realtime-preview-2025-02-01';
const PORT = process.env.PORT || 8080;

// --- WebRTC signaling support for OpenAI Realtime API with session token ---
// This proxy now creates a session, obtains a token, and uses it for all WebRTC signaling requests.
const OPENAI_CREATE_SESSION_URL = 'https://api.openai.com/v1/realtime/sessions';
// PATCH: Use session-specific WebRTC signaling URLs per OpenAI docs
const OPENAI_WEBRTC_SIGNAL_URL = (sessionId) => `https://api.openai.com/v1/realtime/sessions/${sessionId}/webrtc/sdp-offer`;
const OPENAI_WEBRTC_ICE_URL = (sessionId) => `https://api.openai.com/v1/realtime/sessions/${sessionId}/webrtc/ice-candidate`;

if (!OPENAI_API_KEY) {
  console.error('Missing OpenAI API key. Set NEXT_PUBLIC_OPENAI_API_KEY or OPENAI_API_KEY.');
  process.exit(1);
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (clientWs) => {
  console.log('[Proxy] Client connected (WebRTC signaling mode)');

  // Store session info for this client
  let openaiSessionId = null;
  let openaiSessionToken = null;

  clientWs.on('message', async (msg) => {
    try {
      // Patch: handle Buffer or string
      let msgStr;
      if (Buffer.isBuffer(msg)) {
        msgStr = msg.toString('utf8');
      } else if (typeof msg === 'string') {
        msgStr = msg;
      } else {
        console.error('[PROXY] Unknown message type from client:', typeof msg);
        return;
      }
      console.log('[PROXY] Received message from client (decoded):', msgStr.slice(0, 200));
      let parsed;
      try {
        parsed = JSON.parse(msgStr);
      } catch {
        console.error('[PROXY] Invalid JSON from client');
        return;
      }
      if (parsed.type === 'webrtc-signal') {
        // Handle WebRTC signaling
        if (parsed.signalType === 'offer') {
          // Step 1: Create session if not already created
          if (!openaiSessionToken) {
            try {
              const sessionResp = await axios.post(
                OPENAI_CREATE_SESSION_URL,
                {
                  model: OPENAI_MODEL,
                  modalities: ['audio', 'text'],
                  voice: 'alloy',
                  output_audio_format: 'pcm16',
                  turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5, // default per OpenAI docs
                    prefix_padding_ms: 300,
                    silence_duration_ms: 200,
                    create_response: true,
                    interrupt_response: true
                  }
                },
                {
                  headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                    'openai-beta': 'realtime=v1',
                  },
                }
              );
              console.log('[PROXY] OpenAI session creation response:', sessionResp.data);
              // PATCH: OpenAI session response is top-level, not nested under .session
              if (!sessionResp.data.id || !sessionResp.data.client_secret?.value) {
                clientWs.send(JSON.stringify({ type: 'error', error: 'OpenAI session creation failed: ' + JSON.stringify(sessionResp.data) }));
                return;
              }
              openaiSessionId = sessionResp.data.id;
              openaiSessionToken = sessionResp.data.client_secret.value;
              console.log('[PROXY] Created OpenAI session:', openaiSessionId);
            } catch (err) {
              console.error('[PROXY] Error creating OpenAI session:', err?.response?.data || err);
              clientWs.send(JSON.stringify({ type: 'error', error: 'Failed to create OpenAI session.' }));
              return;
            }
          }
          // Log after session creation, before POST
          console.log('[PROXY] About to POST SDP offer to OpenAI...');
          // Step 2: Send SDP offer to OpenAI using session token
          // Log full POST URL and body
          const sdpOfferUrl = OPENAI_WEBRTC_SIGNAL_URL(openaiSessionId);
          const sdpOfferBody = { sdp: parsed.data.sdp, modalities: ['audio', 'text'] };
          console.log('[PROXY] SDP offer POST URL:', sdpOfferUrl);
          console.log('[PROXY] SDP offer POST body:', JSON.stringify(sdpOfferBody));
          try {
            console.log('[PROXY] Sending SDP offer POST to OpenAI...');
            const resp = await axios.post(
              sdpOfferUrl,
              sdpOfferBody,
              {
                headers: {
                  'Authorization': `Bearer ${openaiSessionToken}`,
                  'Content-Type': 'application/json',
                  'openai-beta': 'realtime=v1',
                },
                timeout: 10000, // 10 seconds
              }
            );
            console.log('[PROXY] SDP offer POST response:', JSON.stringify(resp.data, null, 2));
            if (!resp.data.sdp) {
              console.error('[PROXY] No SDP answer in OpenAI response:', JSON.stringify(resp.data));
              clientWs.send(JSON.stringify({ type: 'error', error: 'No SDP answer in OpenAI response: ' + JSON.stringify(resp.data) }));
              return;
            }
            // Relay OpenAI's SDP answer to the browser
            clientWs.send(JSON.stringify({ type: 'webrtc-signal', signalType: 'answer', data: { sdp: resp.data.sdp } }));
          } catch (err) {
            if (err.code === 'ECONNABORTED') {
              console.error('[PROXY] SDP offer POST to OpenAI timed out');
              clientWs.send(JSON.stringify({ type: 'error', error: 'SDP offer POST to OpenAI timed out.' }));
            } else {
              console.error('[PROXY] Error sending SDP offer to OpenAI:', err?.response?.data || err);
              clientWs.send(JSON.stringify({ type: 'error', error: 'Failed to negotiate WebRTC with OpenAI.' }));
            }
          }
        } else if (parsed.signalType === 'ice') {
          // Relay ICE candidate to OpenAI
          if (!openaiSessionId || !openaiSessionToken) {
            clientWs.send(JSON.stringify({ type: 'error', error: 'No OpenAI session yet for ICE.' }));
            return;
          }
          try {
            await axios.post(
              OPENAI_WEBRTC_ICE_URL(openaiSessionId),
              { candidate: parsed.data.candidate },
              {
                headers: {
                  'Authorization': `Bearer ${openaiSessionToken}`,
                  'Content-Type': 'application/json',
                  'openai-beta': 'realtime=v1',
                },
              }
            );
          } catch (err) {
            console.error('[PROXY] Error sending ICE candidate to OpenAI:', err?.response?.data || err);
          }
        }
        return;
      }
    } catch (err) {
      console.error('[PROXY] Uncaught error in message handler:', err);
    }
  });
});

server.listen(PORT, () => {
  console.log(`OpenAI Realtime Proxy listening on ws://localhost:${PORT}`);
});
