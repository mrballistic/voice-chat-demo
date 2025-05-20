# 🎤 Voice Chat Demo with Gemini API 🤖

A real-time voice chat demo built with Next.js, React, shadcn/ui, and Tailwind CSS. This app captures user voice, streams it to the Gemini Voice API, and displays AI responses as text in chat bubbles.

## ✨ Features
- 🎙️ Real-time voice input (Web Audio API)
- 🔄 Streaming AI responses from Gemini API
- 💎 Modern UI with shadcn/ui and Tailwind CSS
- 💬 Conversation history in chat bubbles
- ♿ Accessible and responsive design

## 🛠️ Tech Stack
- **Framework:** Next.js (React, TypeScript)
- **UI:** shadcn/ui, Tailwind CSS
- **API:** Google Gemini Voice API (`@google/generative-ai`)
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
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
```

### 4. ▶️ Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🗂️ Project Structure
- `src/components/ui/chat-bubble.tsx` – 💬 Chat bubble UI component
- `src/components/chat-interface.tsx` – 🧠 Main chat interface logic
- `src/lib/gemini.ts` – 🔗 Gemini API utility
- `src/lib/utils.ts` – 🛠️ Utility functions
- `src/app/page.tsx` – 🏠 Main page entry point
- `memory-bank/` – 🗃️ Project documentation and context

## 📄 License
This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.
