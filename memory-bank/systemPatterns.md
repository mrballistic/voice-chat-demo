# System Patterns

- **Architecture**: Next.js app with modular React components.
- **UI**: shadcn/ui for components, Tailwind CSS for styling.
- **Voice Input**: Web Audio API for capturing user audio.
- **API Integration**: OpenAI Whisper API for real-time voice transcription, OpenAI GPT-4o for chat completions (streaming).
- **State Management**: React hooks (useState, useEffect, useContext).
- **Streaming**: AI responses streamed and rendered in real-time.
- **Component Relationships**: ChatInterface manages state and logic; ChatBubble displays individual messages.
- **Backend Logic**: Next.js API routes for all backend logic.
- **Silence Detection**: Implemented via AudioContext RMS.
- **Serverless API Endpoints**: All AI/LLM calls are made via serverless API endpoints; client fetches `/api/openai-transcribe` for transcription and `/api/openai-chat` for chat.
- **Removed**: No Gemini or Google API usage.
