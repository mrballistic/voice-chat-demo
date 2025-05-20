# Active Context

**Current Focus:**  
- Real-time voice-to-voice chat using OpenAI GPT-4o Realtime (WebSocket)
- Proxying audio and control messages between frontend and OpenAI's realtime endpoint
- UI/UX for streaming voice playback and capture
- Accessibility, error handling, and polish

**Recent Changes:**  
- Node.js WebSocket proxy (`openai-realtime-proxy.js`) created for OpenAI realtime API
- README and product context updated for voice-to-voice streaming
- All Gemini code removed; now using OpenAI for all features
- `/api/openai-transcribe` and `/api/openai-chat` endpoints implemented
- Frontend updated to use OpenAI endpoints
- Memory bank and documentation updated for OpenAI
- Fixed streaming chat: NDJSON streaming from backend, frontend parses and updates UI in real time

**Next Steps:**  
- Implement frontend WebSocket client for real-time audio streaming
- Integrate microphone capture and AI voice playback
- Further UI/UX polish and accessibility
- Advanced error handling and user feedback
