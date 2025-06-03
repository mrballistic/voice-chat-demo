// ChatInterface component manages the main chat UI, voice recording, transcription, and OpenAI integration.
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChatBubble } from '@/components/ui/chat-bubble';

/**
 * Message object for chat history.
 * @property content - The message text.
 * @property isUser - Whether the message is from the user (true) or AI (false).
 * @property id - Optional unique identifier for tracking/updating messages.
 */
interface Message {
  content: string;
  isUser: boolean;
  id?: string;
  timestamp?: number; // ms since epoch
}

/**
 * Main chat interface for real-time voice chat with OpenAI.
 * Handles voice recording, streaming transcription, and chat display.
 */
interface IntakeFields {
  name?: string;
  phone?: string;
  email?: string;
  insurance?: string;
  policy?: string;
  group?: string;
  workersComp?: string;
  injuryHow?: string;
  injuryDate?: string;
  symptoms?: string;
  priorTreatment?: string;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isVoiceStreaming, setIsVoiceStreaming] = useState(false);
  const [intake, setIntake] = useState<IntakeFields>({});
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Refs for cleanup
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // --- Live user speech transcript state ---
  const [liveUserTranscript, setLiveUserTranscript] = useState<string>('');
  const [liveUserTranscriptItemId, setLiveUserTranscriptItemId] = useState<string | null>(null);
  const lastFinalizedTranscriptIdRef = useRef<string | null>(null);



  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

  // --- WebRTC Voice-to-Voice Integration (Realtime) ---

  // Register a tool for the agent to call for appointment lookup
  const tools = [
    {
      type: "function",
      name: "find_first_available_appointment",
      description: "Find the first available appointment slot in the group calendar, starting 1 day from today.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  ];

  // Cleanup function to stop all WebRTC/media resources
  const stopVoiceStreaming = () => {
    setIsVoiceStreaming(false);
    setCurrentResponse('');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  const startVoiceStreamingWebRTC = async () => {
    stopVoiceStreaming();
    setIsVoiceStreaming(true);
    setCurrentResponse('');
    let peerConnection: RTCPeerConnection | null = null;
    let remoteAudio: HTMLAudioElement | null = null;
    let localStream: MediaStream | null = null;
    let dataChannel: RTCDataChannel | null = null;

    try {
      // 1. Get ephemeral token from Azure session endpoint
      const sessionUrl = process.env.NEXT_PUBLIC_SESSION_URL;
      if (!sessionUrl) throw new Error('NEXT_PUBLIC_SESSION_URL is not set');
      const sessionResp = await fetch(sessionUrl);
      const sessionData = await sessionResp.json();
      const EPHEMERAL_KEY = sessionData?.client_secret?.value;
      if (!EPHEMERAL_KEY) throw new Error('Failed to get ephemeral token');

      // 2. Create RTCPeerConnection for voice-to-voice
      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });
      peerConnectionRef.current = peerConnection;

      // 4. Get local audio stream and add to voice-to-voice connection
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = localStream;
      for (const track of localStream.getTracks()) {
        peerConnection.addTrack(track, localStream);
      }

      // 5. Set up voice-to-voice DataChannel
      dataChannel = peerConnection.createDataChannel('oai-events');
      dataChannel.onopen = () => {
        // Voice-to-voice session
        if (!dataChannel) return;
        dataChannel.send(JSON.stringify({
          type: "session.update",
          session: {
            voice: "shimmer",
            tools,
            tool_choice: "auto",
            input_audio_transcription: {
              model: 'gpt-4o-transcribe',
              prompt: '',
              language: 'en'
            }
          }
        }));
        console.log('[DataChannel] Sent session.update with tools:', tools);
        dataChannel.send(JSON.stringify({
          type: "conversation.item.create",
          previous_item_id: null,
          item: {
            id: "msg_" + Date.now(),
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: `My name is Todd and I live in Portland, Oregon.` }]
          }
        }));

        dataChannel.send(JSON.stringify({
          type: "conversation.item.create",
          previous_item_id: null,
          item: {
            id: "sys_" + Date.now(),
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text:
`You are a warm, professional, and conversational **medical intake specialist** named **Keighlee**, answering an inbound call to **Dr. Forrester's orthopedic office**. The caller is likely a new patient referred for a **sprained ankle**, but you don't know that yet.

You're Keighlee — friendly, efficient, and a little conversational. Speak at a natural pace — not too slow. Use casual phrasing, like 'alrighty' or 'got it,' and keep things moving.

**Begin speaking immediately**—you are answering the phone. Start with:
  “Dr. Forrester's office, this is Keighlee speaking. How can I help you today?”
   Use a friendly, welcoming tone. Speak **naturally and conversationally**—you may include subtle breaths, light filler words (“okay,” “sure,” “um,” “got it”), and varied sentence structure to sound like a real person. Let the caller finish speaking before replying. Acknowledge discomfort with brief empathy (e.g., “Oof, I'm sorry to hear that”).

✅ Use natural contractions:
Instead of “I will assist you with that,” say:
“I'll help you with that.”

✅ Avoid formal or overly scripted phrasing:
Say: “Okay, let's get you on the schedule.”
Not: “I am now going to proceed with scheduling your appointment.”

✅ Shorten instructions and confirm quickly:
Use phrases like:
“Cool—what's your insurance provider?”
“Alright, and how'd the injury happen?”

✅ Add light interjections and filler:
Strategically add things like:
“Oof, gotcha…”
“Alrighty, hang on one sec…”

Once the caller explains they're a new patient or were referred for an ankle injury, smoothly transition into the **intake process**:

“Got it—I'm happy to help you get started. I'll just need to grab a few quick details to get you set up in our system.”

Collect the following information, asking **one question at a time**, and internally tagging each answer for structured output:

1. **Full name**
2. **Phone number**
3. **Optional email address**
4. **Insurance provider name**
5. **Policy number**
6. **Group number**
7. **Is this a workers' compensation case?** (yes/no) -- if yes, note that there will be no copay needed
8. **How the injury occurred**
9. **Date of injury**
10. **Current symptoms** (pain, swelling, mobility, etc.)
11. **Any prior treatment** (e.g., urgent care, X-rays, medications)

**When it is time to offer an appointment, **YOU MUST** use the 'find_first_available_appointment' tool to get the real first available slot from the calendar. Do not guess or invent a time. Wait for the tool result and then offer that slot to the caller. If it takes more than 1 second to get a result, feel free to note that the computer is a bit slow today.**

If the patient requests to see **Dr. Forrester instead**, gently redirect:
“Dr. Forrester is currently booking about a month out or more, but our PAs are fantastic. And if anything needs escalation, the PA will bring Dr. Forrester in directly.”

Encourage them to see the PA so care isn't delayed. If they agree, suggest a placeholder appointment (e.g., “How does Wednesday at 10:30 AM sound?”).

If they decline entirely, reassure them someone will follow up.

**End the call** warmly:

“Great, you're all set. Someone will follow up with a reminder and any forms you'll need before the visit. Hope you start feeling better soon!”`
              }
            ]
          }
        }));
        console.log('[DataChannel] Sent system prompt.');
        console.log('DataChannel open and voice-to-voice session started');
      };
      dataChannel.onmessage = (event) => {
        // Log every message for debugging
        console.log('[DataChannel] Received message:', event.data);
        try {
          const msg = JSON.parse(event.data);

          // Handle live user speech streaming (OpenAI input transcription)
          if (msg.type === 'conversation.item.input_audio_transcription.delta' && msg.item_id && typeof msg.delta === 'string') {
            if (liveUserTranscriptItemId !== msg.item_id) {
              setLiveUserTranscript(msg.delta);
              setLiveUserTranscriptItemId(msg.item_id);
            } else {
              setLiveUserTranscript(prev => prev + msg.delta);
            }
            return;
          }
          if (msg.type === 'conversation.item.input_audio_transcription.completed' && msg.item_id && typeof msg.transcript === 'string') {
            setMessages(prev => {
              const now = Date.now();
              const newNorm = msg.transcript.trim().toLowerCase();
              function levenshtein(a: string, b: string) {
                const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
                for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
                for (let i = 1; i <= a.length; i++) {
                  for (let j = 1; j <= b.length; j++) {
                    if (a[i - 1] === b[j - 1]) {
                      matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                      matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                      );
                    }
                  }
                }
                return matrix[a.length][b.length];
              }
              const len = newNorm.length;
              const threshold = Math.max(2, Math.ceil(len * 0.1));
              // If a message with this item_id exists, update it and do NOT add a new one
              const idx = prev.findIndex(m => m.isUser && m.id === msg.item_id);
              if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], content: msg.transcript, timestamp: now };
                return updated;
              }
              // If any prior user message is a near-duplicate, do NOT add
              const hasNearDuplicate = prev.some(m => {
                if (!m.isUser || !m.content) return false;
                const prevNorm = m.content.trim().toLowerCase();
                if (
                  newNorm === prevNorm ||
                  newNorm.includes(prevNorm) ||
                  prevNorm.includes(newNorm) ||
                  levenshtein(newNorm, prevNorm) <= threshold
                ) {
                  return true;
                }
                return false;
              });
              if (hasNearDuplicate) {
                return prev;
              }
              // Add new user message (no item_id or near-duplicate found)
              return [...prev, { content: msg.transcript, isUser: true, id: msg.item_id, timestamp: now }];
            });
            setLiveUserTranscript('');
            setLiveUserTranscriptItemId(null);
            lastFinalizedTranscriptIdRef.current = msg.item_id;
            return;
          }

          // Do NOT add user messages on conversation.item.created (system echo)
          if (
            msg.type === 'conversation.item.created' &&
            msg.item &&
            msg.item.role === 'user' &&
            msg.item.type === 'message'
          ) {
            // Ignore system echo user messages
            return;
          }

          // Tool call: find_first_available_appointment (support OpenAI function_call item format)
          if (
            msg.item &&
            msg.item.type === 'function_call' &&
            msg.item.name === 'find_first_available_appointment' &&
            msg.item.status === 'in_progress'
          ) {
            if (dataChannel && dataChannel.readyState === 'open') {
              console.log('[DataChannel] Detected function_call item for find_first_available_appointment:', msg);
              offerFirstAvailableAppointment({ functionCallItem: msg.item as FunctionCallItem, dataChannel });
            } else {
              console.warn('[DataChannel] No dataChannel available or not open for function_call result. State:', dataChannel?.readyState);
            }
            return;
          }

          // Helper to filter and display only AI output
          function showAIText(item: unknown) {
            if (typeof item === 'object' && item !== null) {
              // If this is a system echo of a user message, skip it
              const maybeItem = item as { text?: unknown; transcript?: unknown; role?: string; type?: string };
              if (maybeItem.role === 'user' && maybeItem.type === 'message') {
                // Do not add user messages from system echo
                return;
              }
              if (typeof maybeItem.text === 'string') {
                setMessages(prev => [...prev, { content: maybeItem.text as string, isUser: false }]);
              } else if (typeof maybeItem.transcript === 'string') {
                setMessages(prev => [...prev, { content: maybeItem.transcript as string, isUser: false }]);
              }
            }
          }

          // Only display final AI output, not streaming/incremental
          if (msg.type === 'response.output_item.done' && msg.item) {
            showAIText(msg.item);
            if (msg.item.content && Array.isArray(msg.item.content)) {
              msg.item.content.forEach(showAIText);
            }
          }

          // Log all messages for debugging
          console.log('DataChannel message:', msg);

          // Log error messages
          if (msg.type === 'error') {
            console.error('OpenAI DataChannel error:', msg.error);
          }
        } catch {
          // Non-JSON DataChannel message
          console.log('[DataChannel] Non-JSON message:', event.data);
        }
      };

      // 7. Play remote audio for voice-to-voice
      peerConnection.ontrack = (event) => {
        if (!remoteAudio) {
          remoteAudio = new window.Audio();
          remoteAudio.autoplay = true;
          remoteAudio.controls = false;
          document.body.appendChild(remoteAudio);
        }
        remoteAudio.srcObject = event.streams[0];
      };

      // 8. Create offer and set as local description for voice-to-voice
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // 9. POST offer.sdp to OpenAI for answer (voice-to-voice)
      const mainRealtimeUrl = process.env.NEXT_PUBLIC_OPENAI_REALTIME_URL;
      if (!mainRealtimeUrl) throw new Error('NEXT_PUBLIC_OPENAI_REALTIME_URL is not set');
      const sdpResp = await fetch(mainRealtimeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1'
        },
        body: offer.sdp
      });
      if (!sdpResp.ok) throw new Error('Failed to exchange SDP');
      const sdpText = await sdpResp.text();
      const answer: RTCSessionDescriptionInit = { type: 'answer', sdp: sdpText };
      await peerConnection.setRemoteDescription(answer);

      // 12. Update UI state
      setCurrentResponse('');

      // 13. Cleanup on close for both connections
      peerConnection.onconnectionstatechange = () => {
        if (
          peerConnection?.connectionState === 'disconnected' ||
          peerConnection?.connectionState === 'closed' ||
          peerConnection?.connectionState === 'failed'
        ) {
          setIsVoiceStreaming(false);
          setCurrentResponse('');
          if (peerConnection) peerConnection.close();
          if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
          if (remoteAudio) {
            remoteAudio.pause();
            remoteAudio.srcObject = null;
            remoteAudio.remove();
          }
        }
      };
    } catch (err) {
      setIsVoiceStreaming(false);
      setCurrentResponse('[WebRTC Error]');
      setMessages(prev => [...prev, { content: '[WebRTC Error]', isUser: false }]);
      console.error('WebRTC error:', err);
    }
  };

  // Helper: extract intake fields using GPT-4o via API route
  async function extractIntakeWithGPT(fullTranscript: string) {
    try {
      // Auto-detect base path for local dev and subdirectory deployments
      let basePath = '';
      if (typeof window !== 'undefined') {
        basePath = window.location.pathname.startsWith('/voice-chat-demo') ? '/voice-chat-demo' : '';
      } else if (process.env.NEXT_PUBLIC_BASE_PATH) {
        basePath = process.env.NEXT_PUBLIC_BASE_PATH;
      }
      const apiUrl = `${basePath}/api/openai-extract-intake`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: fullTranscript })
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.fields) {
        setIntake(prev => ({ ...prev, ...data.fields }));
      }
    } catch {
      // Optionally log error
    }
  }

  // Define a minimal type for functionCallItem
  interface FunctionCallItem {
    call_id: string;
    name: string;
    [key: string]: unknown;
  }

  // Helper: Find and offer the first available appointment slot after chat ends
  // Now: Accepts a functionCallItem and dataChannel, sends result to agent
  async function offerFirstAvailableAppointment({ functionCallItem, dataChannel }: { functionCallItem: FunctionCallItem, dataChannel: RTCDataChannel }) {
    console.log('[offerFirstAvailableAppointment] Called with functionCallItem:', functionCallItem);
    try {
      let basePath = '';
      if (typeof window !== 'undefined') {
        basePath = window.location.pathname.startsWith('/voice-chat-demo') ? '/voice-chat-demo' : '';
      } else if (process.env.NEXT_PUBLIC_BASE_PATH) {
        basePath = process.env.NEXT_PUBLIC_BASE_PATH;
      }
      const apiUrl = `${basePath}/api/calendar/first-available`;
      const resp = await fetch(apiUrl, { credentials: 'include' });
      console.log('[offerFirstAvailableAppointment] Fetched:', resp);
      let outputObj;
      if (!resp.ok) {
        outputObj = { error: 'No open appointment slots found.' };
      } else {
        const data = await resp.json();
        console.log('[offerFirstAvailableAppointment] Data:', data);
        if (data.slot && data.slot.start && data.slot.end) {
          outputObj = { slot: { start: data.slot.start, end: data.slot.end } };
        } else {
          outputObj = { error: 'No open appointment slots found.' };
        }
      }
      // Send function_call_output item to agent (only if DataChannel is open)
      if (dataChannel && dataChannel.readyState === 'open' && functionCallItem && functionCallItem.call_id && functionCallItem.id) {
        dataChannel.send(JSON.stringify({
          type: 'conversation.item.create',
          previous_item_id: functionCallItem.id,
          item: {
            type: 'function_call_output',
            call_id: functionCallItem.call_id,
            output: JSON.stringify(outputObj)
          }
        }));
        // Immediately prompt the model to respond to the tool result
        dataChannel.send(JSON.stringify({
          type: 'response.create'
        }));
      } else {
        console.warn('[offerFirstAvailableAppointment] DataChannel not open when sending function_call_output. State:', dataChannel?.readyState);
      }
    } catch (err) {
      console.error('[offerFirstAvailableAppointment] Error:', err);
      if (dataChannel && dataChannel.readyState === 'open' && functionCallItem && functionCallItem.call_id && functionCallItem.id) {
        dataChannel.send(JSON.stringify({
          type: 'conversation.item.create',
          previous_item_id: functionCallItem.id,
          item: {
            type: 'function_call_output',
            call_id: functionCallItem.call_id,
            output: JSON.stringify({ error: 'Error checking calendar.' })
          }
        }));
      } else {
        console.warn('[offerFirstAvailableAppointment] DataChannel not open when sending function_call_output error. State:', dataChannel?.readyState);
      }
    }
  }


 
  // Only run if the last message is a new user message
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last.isUser) return;
    // Build full transcript from all user messages
    const allUserSpeech = messages.filter(m => m.isUser).map(m => m.content).join('\n');
    extractIntakeWithGPT(allUserSpeech);
    // Optionally, debounce this if you want to avoid too many calls
  }, [messages]);

  // Add avatar circle with emoji before the chat bubble
  return (
    <div className="w-full flex justify-center bg-[#002078]">
      <div className="flex flex-col md:flex-row h-[80vh] w-full max-w-7xl mx-auto">
        {/* Chat area (left, 2/3 on md+) */}
        <div className="flex flex-col flex-1 md:w-2/3 border rounded-lg bg-black/20 backdrop-blur-md min-w-0">
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((message, index) => (
              message.isUser ? (
                message.timestamp ? (
                  <div key={index} className="flex items-end gap-2 justify-end">
                    <ChatBubble 
                      content={message.content}
                      isUser={message.isUser}
                    />
                    <div
                      className="flex-shrink-0 w-10 h-10 flex items-end justify-center text-3xl z-20"
                    >
                      🧔
                    </div>
                  </div>
                ) : (
                  (() => { console.warn('Skipping user message without timestamp:', message); return null; })()
                )
              ) : (
                <div key={index} className="flex items-end gap-2">
                  <div
                    className="flex-shrink-0 w-10 h-10 flex items-end justify-center text-3xl z-20"
                  >
                    🤖
                  </div>
                  <ChatBubble 
                    content={message.content}
                    isUser={message.isUser}
                  />
                </div>
              )
            ))}
            {/* Show live user transcript as a user bubble while speaking, only if not nearly identical to last user message */}
            {liveUserTranscript && (
              (() => {
                // Compare to last user message
                const lastUserMsg = messages.length > 0 && messages[messages.length - 1].isUser ? messages[messages.length - 1].content : '';
                // Simple similarity: ignore case, trim, and check if equal or if one is a substring of the other
                const liveNorm = liveUserTranscript.trim().toLowerCase();
                const lastNorm = (lastUserMsg || '').trim().toLowerCase();
                if (
                  liveNorm &&
                  lastNorm &&
                  (liveNorm === lastNorm || lastNorm.includes(liveNorm) || liveUserTranscript.includes(lastNorm))
                ) {
                  return null;
                }
                return (
                  <div className="flex items-start gap-2 justify-end opacity-70">
                    <ChatBubble content={liveUserTranscript} isUser={true} />
                    <div
                      className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-3xl"
                    >
                      🧔
                    </div>
                  </div>
                );
              })()
            )}
            {currentResponse && (
              <div className="flex items-start gap-2">
                <div
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-3xl"
                >
                  {'🤖'}
                </div>
                <ChatBubble 
                  content={currentResponse}
                  isUser={false}
                />
              </div>
            )}
          </div>
          <div className="border-t p-4 flex flex-col sm:flex-row gap-2 w-full">
            <div className="flex-1">
              <Button
                onClick={() => {
                  if (isVoiceStreaming) {
                    stopVoiceStreaming();
                  } else {
                    startVoiceStreamingWebRTC();
                  }
                }}
                className={`w-full font-bold  ${isVoiceStreaming ? 'text-white bg-red-600 hover:bg-red-700' : 'text-[#002078] bg-[#1bddf0] hover:bg-[#15afbd]'}`}
                style={{ transition: 'background 0.2s' }}
              >
                {isVoiceStreaming ? 'Stop Voice Chat' : 'Start Voice Chat'}
              </Button>
            </div>
          </div>
        </div>
        {/* Intake data summary (right, 1/3 on md+, below on small screens) */}
        <div className="w-full md:w-1/3 pl-0 md:pl-6 mt-6 md:mt-0">
          <div className=" rounded-lg p-4 text-sm h-full flex flex-col">
            <div className="font-semibold text-lg mb-2 text-white text-left">Intake Data</div>
            <div className="w-full border-b border-white/30 mb-3" style={{height: '1px'}} />
            <ul className="grid grid-cols-1 gap-y-1 text-white text-left">
              {intake.name && <li><b>Name:</b> {intake.name}</li>}
              {intake.phone && <li><b>Phone:</b> {intake.phone}</li>}
              {intake.email && <li><b>Email:</b> {intake.email}</li>}
              {intake.insurance && <li><b>Insurance:</b> {intake.insurance}</li>}
              {intake.policy && <li><b>Policy #:</b> {intake.policy}</li>}
              {intake.group && <li><b>Group #:</b> {intake.group}</li>}
              {intake.workersComp && <li><b>Workers Comp:</b> {intake.workersComp}</li>}
              {intake.injuryHow && <li><b>How Injury Occurred:</b> {intake.injuryHow}</li>}
              {intake.injuryDate && <li><b>Date of Injury:</b> {intake.injuryDate}</li>}
              {intake.symptoms && <li><b>Symptoms:</b> {intake.symptoms}</li>}
              {intake.priorTreatment && <li><b>Prior Treatment:</b> {intake.priorTreatment}</li>}
            </ul>

          </div>
        </div>
      </div>
    </div>
  );
}
