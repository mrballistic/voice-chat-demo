# OpenAI Real-Time Voice Chat Demo

✨ This project is a real-time voice chat demo app built with Next.js, React, shadcn/ui, and Tailwind CSS. It uses OpenAI's Whisper API for real-time streaming transcription and OpenAI GPT-4o for chat completions. The app features robust silence detection, accessible and modern UI, and supports both light and dark mode.

---

## Features 🚀

- 🎤 Real-time voice-to-text transcription using OpenAI Whisper
- 🤖 Real-time AI chat responses using OpenAI GPT-4o
- 🔄 Streaming UI for both transcription and chat
- 🔇 Robust silence detection and error handling
- ♿ Accessible, visually polished, and dark mode support
- 🖼️ Responsive 2-column layout with custom color theming
- 🦶 Persistent footer logo (bottom right, always visible)
- 🛡️ Robust user message deduplication (no duplicate/near-duplicate user bubbles)
- 🚫 All overlays (e.g., Next.js feedback bubble) are disabled via next.config.ts (`devIndicators: false`)
- 🖥️ Main content area fills 80% of the viewport width for a modern, flexible layout

---

## Architecture

```mermaid
flowchart TD
    User((User)) -->|Voice| UI[Chat UI]
    UI -->|Audio/Text| OpenAIRealtime[OpenAI Realtime API (voice+text)]
    OpenAIRealtime -->|AI Response| UI
    UI -->|Transcript| IntakeAPI[/api/openai-extract-intake]
    IntakeAPI -->|Classification| GPT4o[OpenAI GPT-4o (classification)]
    GPT4o -->|Intake Fields| IntakePanel[Intake Extraction Panel]
    UI -->|Footer| Logo[Footer Logo]
```

---

## Status

✅ All major requirements are complete. Further UI/UX polish and accessibility improvements can be made as needed based on feedback.

---

## Getting Started

1. Clone the repo
2. Install dependencies: `npm install`
3. Set up your `.env.local` with OpenAI API keys
4. Run the app: `npm run dev`

---

## License

MIT
