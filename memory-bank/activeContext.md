# Active Context

## Active Context (as of 2025-05-27)

### Current Architecture
- **Voice Chat**: Uses Azure backend for session management and OpenAI Realtime API for voice-to-voice streaming.
- **User Transcription**: User audio is buffered locally and sent to OpenAI Whisper via `/api/openai-transcribe` as soon as the user finishes speaking. The transcript is displayed as a user chat bubble.
- **AI Response**: AI replies (text or transcript) are displayed as robot chat bubbles, only from `response.output_item.done` messages.
- **Configurable Endpoints**: Both the Azure session endpoint and the OpenAI Realtime API endpoint are set via environment variables (`NEXT_PUBLIC_SESSION_URL` and `NEXT_PUBLIC_OPENAI_REALTIME_URL`), not hardcoded.
- **UI**: Single "Voice Chat" toggle button (orange/red), fixed-width chat area, no mode switching, no WebRTC terminology, no "Press to Talk" button.
- **Removed**: All local proxy scripts and the `/api/openai-realtime` route.
- **No Duplicates**: Only one user and one AI bubble per turn.
- **Intake Extraction**: All finalized user speech is concatenated and sent to `/api/openai-extract-intake`, which uses GPT-4o to extract and merge intake fields (name, phone, insurance, etc.) cumulatively. The intake panel always shows the latest, most complete set of user-provided data.
- **Subdirectory Support**: Frontend auto-detects base path for API calls, supporting both root and subdirectory deployments (e.g., GitHub Pages).

### Recent Changes
- Intake extraction now merges new fields with previous ones, so earlier info is preserved even if OpenAI omits them in later responses.
- All user messages are concatenated and sent as the full transcript for intake extraction, ensuring cumulative context.
- API route for intake extraction is serverless and will not work on static-only hosts (e.g., GitHub Pages).
- UI and chat bubble logic updated for clarity and stability.

### Next Steps
- Further UI/UX polish and accessibility
- Advanced error handling and user feedback
- (Optional) Add OpenAI TTS/voice streaming for AI replies (legacy REST)
- Document known limitations and edge cases

### Security
- **Never leak secrets to github.** Secrets include internal URLs, endpoints, and API keys. Always use environment variables for sensitive configuration.

**Next Steps:**  
- Further UI/UX polish and accessibility
- Advanced error handling and user feedback
- (Optional) Add OpenAI TTS/voice streaming for AI replies (legacy REST)
- Document known limitations and edge cases
