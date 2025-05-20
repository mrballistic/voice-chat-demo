# Active Context

**Current Focus:**  
- Real-time voice-to-voice chat using OpenAI GPT-4o Realtime (WebSocket)
- Node.js WebSocket proxy relays audio and control messages between frontend and OpenAI's realtime endpoint
- Frontend streams user PCM16 audio to proxy, receives and plays back AI-generated audio in real time
- UI/UX for streaming voice playback and capture
- Accessibility, error handling, and polish

**Recent Changes:**  
- Node.js WebSocket proxy (`openai-realtime-proxy.js`) fully implemented for OpenAI realtime API
- Proxy now relays `response.audio.delta` as binary audio to frontend, all other messages as JSON
- Frontend voice-to-voice flow: records, down-samples, encodes, and sends audio as base64 JSON; plays back AI audio responses
- All Gemini code removed; now using OpenAI for all features
- `/api/openai-transcribe` and `/api/openai-chat` endpoints implemented for REST-based flows
- README and memory bank updated for OpenAI voice-to-voice streaming
- Fixed: No more decodeAudioData errors, robust message handling in frontend

**Next Steps:**  
- Further UI/UX polish and accessibility
- Advanced error handling and user feedback
- (Optional) Add OpenAI TTS/voice streaming for AI replies (legacy REST)
- Document known limitations and edge cases
