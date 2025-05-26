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
export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isVoiceStreaming, setIsVoiceStreaming] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Refs for cleanup
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  // const transcriptionPeerConnectionRef = useRef<RTCPeerConnection | null>(null); // Bypassed for now
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

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
    // Close voice-to-voice peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    // Bypass: do not close transcription peer connection
    // if (transcriptionPeerConnectionRef.current) {
    //   transcriptionPeerConnectionRef.current.close();
    //   transcriptionPeerConnectionRef.current = null;
    // }
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const startVoiceStreamingWebRTC = async () => {
    // Always clean up before starting a new session
    stopVoiceStreaming();
    setIsVoiceStreaming(true);
    setCurrentResponse('');
    let peerConnection: RTCPeerConnection | null = null;
    // let transcriptionPeerConnection: RTCPeerConnection | null = null; // Bypassed
    let remoteAudio: HTMLAudioElement | null = null;
    let localStream: MediaStream | null = null;
    let dataChannel: RTCDataChannel | null = null;
    // let transcriptionDataChannel: RTCDataChannel | null = null; // Bypassed

    // Fallback transcription: buffer audio chunks for REST transcription
    const audioChunks: BlobPart[] = [];
    let userMsgId = "";

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

      // 3. (Bypassed) Create RTCPeerConnection for transcription
      // transcriptionPeerConnection = new RTCPeerConnection({
      //   iceServers: [
      //     { urls: 'stun:stun.l.google.com:19302' },
      //   ],
      // });
      // transcriptionPeerConnectionRef.current = transcriptionPeerConnection;

      // 4. Get local audio stream and add to voice-to-voice connection
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = localStream;
      for (const track of localStream.getTracks()) {
        peerConnection.addTrack(track, localStream);
        // transcriptionPeerConnection.addTrack(track, localStream); // Bypassed
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
            tool_choice: "auto"
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

      // 6. (Bypassed) Set up transcription DataChannel
      // transcriptionDataChannel = transcriptionPeerConnection.createDataChannel('transcription-events');
      // transcriptionDataChannel.onopen = () => {
      //   console.log('Transcription DataChannel open');
      // };
      // transcriptionDataChannel.onmessage = (event) => {
      //   // ...bypassed...
      // };

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

      // 10. (Bypassed) Create offer and set as local description for transcription
      // const transcriptionOffer = await transcriptionPeerConnection.createOffer();
      // await transcriptionPeerConnection.setLocalDescription(transcriptionOffer);

      // 11. (Bypassed) POST offer.sdp to Azure session endpoint for transcription
      // const transcriptionSdpResp = await fetch(sessionUrl, { ... });
      // if (!transcriptionSdpResp.ok) throw new Error('Failed to exchange transcription SDP');
      // const transcriptionSdpText = await transcriptionSdpResp.text();
      // const transcriptionAnswer: RTCSessionDescriptionInit = { type: 'answer', sdp: transcriptionSdpText };
      // await transcriptionPeerConnection.setRemoteDescription(transcriptionAnswer);

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
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          if (remoteAudio) {
            remoteAudio.pause();
            remoteAudio.srcObject = null;
            remoteAudio.remove();
          }
        }
      };
      // transcriptionPeerConnection.onconnectionstatechange = () => { ... } // Bypassed

      // --- Fallback: Non-realtime transcription (buffer audio, send to REST endpoint) ---
      // Set up MediaRecorder to buffer audio and send to /api/openai-transcribe after stop
      mediaRecorderRef.current = new window.MediaRecorder(localStream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        audioChunks.push(event.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        // Insert a placeholder user message and keep its ID
        userMsgId = "user_" + Date.now();
        setMessages(prev => [
          ...prev,
          { content: "[Transcribing...]", isUser: true, id: userMsgId }
        ] as Message[]);
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const fileReader = new FileReader();
        fileReader.onloadend = async () => {
          const base64Audio = typeof fileReader.result === 'string' ? fileReader.result.split(',')[1] : undefined;
          if (!base64Audio) return;
          // Send to Whisper (fallback/final transcript)
          const response = await fetch('/api/openai-transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio: base64Audio,
              mimeType: 'audio/webm'
            })
          });
          if (!response.ok) return;
          const data = await response.json();
          const transcript = data.transcript;
          if (transcript && transcript !== 'undefined') {
            setMessages(prev => {
              // Update the placeholder user message with the actual transcript
              const idx = prev.findIndex((m: Message) => m.id === userMsgId);
              if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = { content: transcript, isUser: true, id: userMsgId };
                return updated as Message[];
              }
              // If not found, just append
              return [...prev, { content: transcript, isUser: true, id: userMsgId }] as Message[];
            });
          }
        };
        fileReader.readAsDataURL(audioBlob);
      };
      mediaRecorderRef.current.start();

    } catch (err) {
      setIsVoiceStreaming(false);
      setCurrentResponse('[WebRTC Error]');
      setMessages(prev => [...prev, { content: '[WebRTC Error]', isUser: false }]);
      console.error('WebRTC error:', err);
    }
  };

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
