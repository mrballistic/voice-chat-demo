# Tech Context

- **Framework**: Next.js (React, TypeScript)
- **UI**: shadcn/ui, Tailwind CSS
- **API**: OpenAI Whisper API for speech-to-text, OpenAI GPT-4o for chat completions, OpenAI GPT-4o Realtime (WebSocket) for voice-to-voice
- **Voice**: Web Audio API, AudioWorklet, MediaRecorder
- **Env Vars**: NEXT_PUBLIC_OPENAI_API_KEY in .env.local
- **Dependencies**: tailwindcss, postcss, autoprefixer, node-fetch, dotenv, ws
- **Setup**: Standard Next.js project with shadcn/ui and Tailwind initialized, all AI calls via serverless API endpoints or local Node.js WebSocket proxy

## OpenAI Realtime API (WebSocket) Sample

**Connect:**
```js
const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-02-01', {
  headers: {
    'Authorization': `Bearer <OPENAI_API_KEY>`,
    'OpenAI-Beta': 'realtime=v1',
  },
});
```

**Send user audio:**
```js
ws.send(JSON.stringify({
  type: 'conversation.item.create',
  item: {
    type: 'message',
    role: 'user',
    content: [{ type: 'input_audio', audio: '<base64-encoded-PCM16>' }]
  }
}));

ws.send(JSON.stringify({
  type: 'response.create',
  response: {
    modalities: ['audio', 'text'],
    instructions: 'You are an assistant that answers briefly and politely.'
  }
}));
```

**Handle responses:**
```js
ws.on('message', (msg) => {
  const data = JSON.parse(msg);
  if (data.type === 'response.audio.delta') {
    // data.delta is base64-encoded PCM16 audio
    // decode and play
  } else if (data.type === 'response.text.delta') {
    // data.delta is text
  }
});
```

**Notes:**
- Audio must be 16kHz, 16-bit PCM, mono, base64-encoded.
- The session is stateless per connection; send both `conversation.item.create` and `response.create` for each turn.
- See https://platform.openai.com/docs/api-reference/realtime for full protocol and message types.

## OpenAI Realtime API: WebRTC Signaling (2025-05)

### Session Creation
```js
POST https://api.openai.com/v1/realtime/sessions
{
  model: 'gpt-4o-realtime-preview-2025-02-01',
  modalities: ['audio', 'text'],
  voice: 'alloy',
  output_audio_format: 'pcm16'
}
// Response: { id, client_secret: { value }, ... }
```

### WebRTC Signaling Endpoints
- **SDP Offer:**
  ```js
  POST https://api.openai.com/v1/realtime/sessions/{session_id}/webrtc/sdp-offer
  Headers: { Authorization: 'Bearer <client_secret.value>', 'openai-beta': 'realtime=v1' }
  Body: { sdp: <browser-offer-sdp>, modalities: ['audio', 'text'] }
  // Response: { sdp: <openai-answer-sdp> }
  ```
- **ICE Candidate:**
  ```js
  POST https://api.openai.com/v1/realtime/sessions/{session_id}/webrtc/ice-candidate
  Headers: { Authorization: 'Bearer <client_secret.value>', 'openai-beta': 'realtime=v1' }
  Body: { candidate: <ice-candidate> }
  // Response: 200 OK
  ```

### Protocol Notes
- Use the session-specific endpoints for all signaling after session creation.
- The `client_secret.value` from session creation is used as the Bearer token for all signaling requests.
- The `modalities` field is required in the SDP offer POST body.
- All requests must include `'openai-beta': 'realtime=v1'` header.
- See https://platform.openai.com/docs/guides/realtime#connect-with-webrtc for full details.

### Example Proxy Snippet
```js
const OPENAI_WEBRTC_SIGNAL_URL = (sessionId) => `https://api.openai.com/v1/realtime/sessions/${sessionId}/webrtc/sdp-offer`;
const OPENAI_WEBRTC_ICE_URL = (sessionId) => `https://api.openai.com/v1/realtime/sessions/${sessionId}/webrtc/ice-candidate`;

// SDP Offer
await axios.post(
  OPENAI_WEBRTC_SIGNAL_URL(sessionId),
  { sdp, modalities: ['audio', 'text'] },
  { headers: { Authorization: `Bearer ${clientSecret}`, 'openai-beta': 'realtime=v1' } }
);

// ICE Candidate
await axios.post(
  OPENAI_WEBRTC_ICE_URL(sessionId),
  { candidate },
  { headers: { Authorization: `Bearer ${clientSecret}`, 'openai-beta': 'realtime=v1' } }
);
```

## OpenAI Realtime API: Audio Handling Best Practices (WebSocket)

### Audio Input (User → OpenAI)
- **Format:** 16kHz, 16-bit PCM, mono, base64-encoded
- **Chunking:** Send audio in small, real-time chunks (e.g., 20–100ms per chunk)
- **Message Type:**
  ```js
  ws.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [
        { type: 'input_audio', audio: '<base64-encoded-PCM16>' }
      ]
    }
  }))
  ```
- **End of Input:** Send a final message with `{ type: 'conversation.item.finalize' }` to indicate end of user input.

### Audio Output (OpenAI → User)
- **Type:** `response.audio.delta`
- **Payload:** `{ type: 'response.audio.delta', delta: '<base64-encoded-PCM16>' }`
- **Playback:**
  - Decode base64 PCM16 to ArrayBuffer
  - Use Web Audio API (AudioBufferSourceNode) for low-latency playback
  - Buffer and play audio as it arrives for smooth streaming

### General WebSocket Protocol Notes
- **Session:** Each WebSocket connection is a new session; send both `conversation.item.create` and `response.create` for each turn.
- **Turn-taking:** Wait for `response.audio.delta` and/or `response.text.delta` before starting a new turn.
- **Barge-in:** To interrupt AI, send a new `conversation.item.create` and `conversation.item.finalize` at any time.
- **Error Handling:** Listen for error messages and handle gracefully in UI.

### Example: Audio Playback in Browser
```js
const audioBuffer = await audioContext.decodeAudioData(pcm16ArrayBuffer);
const source = audioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(audioContext.destination);
source.start();
```

### References
- [OpenAI Realtime Conversations: Handling Audio with WebSockets](https://platform.openai.com/docs/guides/realtime-conversations#handling-audio-with-websockets)
