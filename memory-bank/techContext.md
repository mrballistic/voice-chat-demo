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
