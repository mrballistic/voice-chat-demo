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

### Current Focus
- Ensuring robust deduplication of user messages in the chat UI for the real-time voice chat app.
- Preventing duplicate or near-duplicate user bubbles from backend replays or system echoes.

### Recent Changes
- Updated deduplication logic in `src/components/chat-interface.tsx`:
  - User messages are only updated if a transcript with the same `item_id` arrives.
  - No new user message is added if any prior user message is a near-duplicate (Levenshtein distance and substring checks).
  - All user messages from `conversation.item.created` events (system echo) are ignored.
  - Only user messages with a `timestamp` property are rendered.
- Intake extraction now merges new fields with previous ones, so earlier info is preserved even if OpenAI omits them in later responses.
- All user messages are concatenated and sent as the full transcript for intake extraction, ensuring cumulative context.
- API route for intake extraction is serverless and will not work on static-only hosts (e.g., GitHub Pages).
- UI and chat bubble logic updated for clarity and stability.
- Removed all CSS/JS hacks for hiding the Next.js feedback bubble (bottom left). Now handled via next.config.ts (`devIndicators: false`).

### Next Steps
- Monitor for any remaining edge cases in user message deduplication.
- Continue improving user experience and reliability of the chat UI.
- Further UI/UX polish and accessibility
- Advanced error handling and user feedback
- (Optional) Add OpenAI TTS/voice streaming for AI replies (legacy REST)
- Document known limitations and edge cases

### Security
- **Never leak secrets to github.** Secrets include internal URLs, endpoints, and API keys. Always use environment variables for sensitive configuration.

## 2025-06-02: UI/UX and Dev Experience Update
- All CSS/JS hacks for hiding the Next.js feedback bubble (bottom left) have been removed. This is now handled via next.config.ts (`devIndicators: false`).
- Footer logo remains fixed at the bottom right of the browser window, unaffected by overlays.
- Main content area fills 80% of the viewport width, is responsive, and the layout is visually polished.
- All major requirements (robust deduplication, responsive layout, custom theming, persistent footer) are complete.
- No major pending tasks; further fine-tuning is possible based on feedback.

**Next Steps:**  
- Monitor for any remaining edge cases in user message deduplication.
- Continue improving user experience and reliability of the chat UI.
- Further UI/UX polish and accessibility
- Advanced error handling and user feedback
- (Optional) Add OpenAI TTS/voice streaming for AI replies (legacy REST)
- Document known limitations and edge cases
