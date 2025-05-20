# 🎤 Voice Chat Demo with OpenAI API 🤖

A real-time voice chat demo built with Next.js, React, shadcn/ui, and Tailwind CSS. This app captures user voice, streams it to the OpenAI Whisper API for transcription, and displays AI responses from OpenAI GPT-4o as text in chat bubbles. It also supports real-time voice-to-voice chat using OpenAI's GPT-4o Realtime API.

## ✨ Features
- 🎙️ Real-time voice input (Web Audio API)
- 🔄 Streaming AI responses from OpenAI GPT-4o (text and voice)
- 🗣️ Real-time voice-to-voice chat with OpenAI GPT-4o Realtime API
- 💎 Modern UI with shadcn/ui and Tailwind CSS
- 💬 Conversation history in chat bubbles
- ♿ Accessible and responsive design

## 🛠️ Tech Stack
- **Framework:** Next.js (React, TypeScript)
- **UI:** shadcn/ui, Tailwind CSS
- **API:** OpenAI Whisper (speech-to-text), OpenAI GPT-4o (chat completions & realtime voice)
- **Voice:** Web Audio API, AudioWorklet, MediaRecorder

## 🚀 Getting Started

### 1. 🧑‍💻 Clone the repository
```bash
git clone <your-repo-url>
cd voice-chat-demo
```

### 2. 📦 Install dependencies
```bash
npm install
```

### 3. 🔑 Configure Environment Variables
Create a `.env.local` file in the project root:
```
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
```

### 4. ▶️ Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🗣️ Real-Time Voice-to-Voice (WebSocket Proxy)

To enable real-time voice-to-voice chat with OpenAI's GPT-4o Realtime API, run the local proxy server:

```bash
npm install ws
node openai-realtime-proxy.js
```

This will start a WebSocket proxy on `ws://localhost:8080` that relays audio and control messages between your browser and OpenAI's realtime endpoint.

- The frontend connects to `ws://localhost:8080` for real-time streaming.
- The proxy connects to `wss://api.openai.com/v1/realtime` using your API key.
- The proxy relays `response.audio.delta` as binary audio to the frontend, all other messages as JSON.
- The frontend streams user PCM16 audio (base64-encoded) to the proxy, and plays back AI-generated audio in real time.

See `openai-realtime-proxy.js` for details.

## 🗂️ Project Structure
- `src/components/ui/chat-bubble.tsx` – 💬 Chat bubble UI component
- `src/components/chat-interface.tsx` – 🧠 Main chat interface logic (voice-to-voice and REST flows)
- `src/lib/openai.ts` – 🔗 OpenAI API utility
- `src/lib/utils.ts` – 🛠️ Utility functions
- `src/app/api/openai-transcribe/route.ts` – 🎤 Whisper API endpoint
- `src/app/api/openai-chat/route.ts` – 🤖 Chat completions endpoint
- `openai-realtime-proxy.js` – 🗣️ Node.js WebSocket proxy for OpenAI realtime API
- `memory-bank/` – 🗃️ Project documentation and context

## 📄 License
This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
