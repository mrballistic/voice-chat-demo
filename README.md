# 🎤 Voice Chat Demo with OpenAI API 🤖

A real-time voice chat demo built with Next.js, React, shadcn/ui, and Tailwind CSS. This app captures user voice, streams it to the OpenAI Whisper API for transcription, and displays AI responses from OpenAI GPT-4o as text in chat bubbles.

## ✨ Features
- 🎙️ Real-time voice input (Web Audio API)
- 🔄 Streaming AI responses from OpenAI GPT-4o
- 💎 Modern UI with shadcn/ui and Tailwind CSS
- 💬 Conversation history in chat bubbles
- ♿ Accessible and responsive design

## 🛠️ Tech Stack
- **Framework:** Next.js (React, TypeScript)
- **UI:** shadcn/ui, Tailwind CSS
- **API:** OpenAI Whisper (speech-to-text), OpenAI GPT-4o (chat completions)
- **Voice:** Web Audio API, MediaRecorder

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

## 🗂️ Project Structure
- `src/components/ui/chat-bubble.tsx` – 💬 Chat bubble UI component
- `src/components/chat-interface.tsx` – 🧠 Main chat interface logic
- `src/lib/openai.ts` – 🔗 OpenAI API utility
- `src/lib/utils.ts` – 🛠️ Utility functions
- `src/app/api/openai-transcribe/route.ts` – 🎤 Whisper API endpoint
- `src/app/api/openai-chat/route.ts` – 🤖 Chat completions endpoint
- `memory-bank/` – 🗃️ Project documentation and context

## 📄 License
This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
