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

  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

  // --- WebRTC Voice-to-Voice Integration (Realtime) ---

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
            tools: [
              {
                type: "function",
                name: "search_web",
                description: "Search the web for current information about any topic",
                parameters: {
                  type: "object",
                  properties: { query: { type: "string" } },
                  required: ["query"]
                }
              }
            ],
            tool_choice: "auto",
            input_audio_transcription: {
              model: 'gpt-4o-transcribe',
              prompt: '',
              language: 'en'
            }
          }
        }));
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
            content: [{ type: "input_text", text: 
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

  After collecting that information, offer an **appointment with a PA approximately two weeks out**:

    “Okay, we can get you in with one of our excellent PAs in about two weeks. They're trained in orthopedic injuries and can evaluate and treat ankle sprains right away.”

  If the patient requests to see **Dr. Forrester instead**, gently redirect:
  “Dr. Forrester is currently booking about a month out or more, but our PAs are fantastic. And if anything needs escalation, the PA will bring Dr. Forrester in directly.”

  Encourage them to see the PA so care isn't delayed. If they agree, suggest a placeholder appointment (e.g., “How does Wednesday at 10:30 AM sound?”).

  If they decline entirely, reassure them someone will follow up.

  **End the call** warmly:

  “Great, you're all set. Someone will follow up with a reminder and any forms you'll need before the visit. Hope you start feeling better soon!”
          ` }]
          }
        }));

        console.log('DataChannel open and voice-to-voice session started');
      };
      dataChannel.onmessage = (event) => {
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
            setMessages(prev => [...prev, { content: msg.transcript, isUser: true }]);
            setLiveUserTranscript('');
            setLiveUserTranscriptItemId(null);
            // Extract intake fields from all user messages so far
            const allUserSpeech = [...messages.filter(m => m.isUser).map(m => m.content), msg.transcript].join('\n');
            extractIntakeWithGPT(allUserSpeech);
            return;
          }

          // Helper to filter and display only AI output
          function showAIText(item: unknown) {
            if (typeof item === 'object' && item !== null) {
              const maybeItem = item as { text?: unknown; transcript?: unknown };
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
          console.log('Non-JSON DataChannel message:', event.data);
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

  // Add avatar circle with emoji before the chat bubble
  return (
    <div className="w-full flex justify-center bg-background">
      <div className="flex flex-col h-[80vh] w-full sm:w-[800px] mx-auto border rounded-lg">
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.map((message, index) => (
            message.isUser ? (
              <div key={index} className="flex items-start gap-2 justify-end">
                <ChatBubble 
                  content={message.content}
                  isUser={message.isUser}
                />
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: '#333' }}
                >
                  🧔
                </div>
              </div>
            ) : (
              <div key={index} className="flex items-start gap-2">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: '#333' }}
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
          {/* Show live user transcript as a user bubble while speaking */}
          {liveUserTranscript && (
            <div className="flex items-start gap-2 justify-end opacity-70">
              <ChatBubble content={liveUserTranscript} isUser={true} />
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: '#333' }}
              >
                🧔
              </div>
            </div>
          )}
          {currentResponse && (
            <div className="flex items-start gap-2">
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: '#333' }}
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
        {/* Intake data summary display */}
        <div className="border-t bg-muted p-4 text-sm">
          <div className="font-semibold mb-2">Collected Intake Data:</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
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
              className={`w-full font-bold text-white ${isVoiceStreaming ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'}`}
              style={{ transition: 'background 0.2s' }}
            >
              {isVoiceStreaming ? 'Stop Voice Chat' : 'Start Voice Chat'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
