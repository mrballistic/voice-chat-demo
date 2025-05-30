# Progress

**What works:**
- Real-time voice capture and silence detection
- Real-time user transcription and intake extraction via OpenAI GPT-4o Realtime API (no Whisper)
- Streaming chat completions via OpenAI GPT-4o (NDJSON, real-time UI updates)
- Node.js WebSocket proxy for OpenAI realtime voice-to-voice API (local/dev)
- Proxy relays AI audio as binary to frontend, all other messages as JSON
- Frontend streams PCM16 audio to proxy, plays back AI-generated audio in real time
- Modern, accessible UI with shadcn/ui and Tailwind CSS
- Dark mode and error handling
- **Cumulative intake extraction:** All finalized user speech is concatenated and sent to `/api/openai-extract-intake`, which uses GPT-4o to extract and merge intake fields. The intake panel always shows the latest, most complete set of user-provided data.
- **Subdirectory support:** Frontend auto-detects base path for API calls, supporting both root and subdirectory deployments (e.g., GitHub Pages).
- **Robust user message deduplication:** Only one user bubble appears per utterance, even with backend replays or system echoes. Deduplication logic prevents all duplicate/near-duplicate user messages.

**What's left:**
- Further UI/UX polish and accessibility
- Advanced error handling and user feedback
- (Optional) Add OpenAI TTS/voice streaming for AI replies (legacy REST)
- Document known limitations and edge cases

**Known issues:**
- Some edge cases in audio streaming/playback may need further handling
- All Gemini/Google code removed; all OpenAI endpoints are functional
- **API routes will not work on static-only hosts (e.g., GitHub Pages).** Use Vercel/Netlify or a custom backend for dynamic features.
