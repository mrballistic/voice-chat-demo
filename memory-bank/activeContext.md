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
## Active Context (as of 2025-05-23)

### Current Architecture
- **Voice Chat**: Uses Azure backend for session management and OpenAI Realtime API for voice-to-voice streaming.
- **User Transcription**: User audio is buffered locally and sent to OpenAI Whisper via `/api/openai-transcribe` as soon as the user finishes speaking. The transcript is displayed as a user chat bubble.
- **AI Response**: AI replies (text or transcript) are displayed as robot chat bubbles, only from `response.output_item.done` messages.
- **Configurable Endpoints**: Both the Azure session endpoint and the OpenAI Realtime API endpoint are set via environment variables (`NEXT_PUBLIC_SESSION_URL` and `NEXT_PUBLIC_OPENAI_REALTIME_URL`), not hardcoded.
- **UI**: Single "Voice Chat" toggle button (orange/red), fixed-width chat area, no mode switching, no WebRTC terminology, no "Press to Talk" button.
- **Removed**: All local proxy scripts and the `/api/openai-realtime` route.
- **No Duplicates**: Only one user and one AI bubble per turn.

### Recent Changes
- Removed all legacy proxy and WebRTC mode code.
- Whisper transcription now runs in parallel with voice-to-voice, triggered immediately after user speech ends.
- UI and chat bubble logic updated for clarity and stability.

### Next Steps
- Continue to monitor OpenAI API for native user transcript support in Realtime API.
- Further UI/UX improvements as needed.
- Keep memory bank and README in sync with architecture and workflow changes.
- Fixed: No more decodeAudioData errors, robust message handling in frontend

**Next Steps:**  
- Further UI/UX polish and accessibility
- Advanced error handling and user feedback
- (Optional) Add OpenAI TTS/voice streaming for AI replies (legacy REST)
- Document known limitations and edge cases
