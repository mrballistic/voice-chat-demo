// ChatInterface component manages the main chat UI, voice recording, transcription, and Gemini AI integration.
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChatBubble } from '@/components/ui/chat-bubble';

/**
 * Message object for chat history.
 * @property content - The message text.
 * @property isUser - Whether the message is from the user (true) or AI (false).
 */
interface Message {
  content: string;
  isUser: boolean;
}

/**
 * Main chat interface for real-time voice chat with Gemini AI.
 * Handles voice recording, streaming transcription, and chat display.
 */
export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isVoiceStreaming, setIsVoiceStreaming] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);


  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

  // --- WebRTC Voice-to-Voice Integration (OpenAI Realtime) ---
  const startVoiceStreamingWebRTC = async () => {
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

      // 2. Create RTCPeerConnection
      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });

      // 3. Add audio track and buffer for Whisper transcription
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of localStream.getTracks()) {
        peerConnection.addTrack(track, localStream);
      }
      // Buffer audio for Whisper
      const audioChunks: BlobPart[] = [];
      const mediaRecorder = new window.MediaRecorder(localStream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        audioChunks.push(event.data);
      };
      mediaRecorder.start();

      // When user finishes speaking, send to Whisper
      const stopAndTranscribe = async () => {
        mediaRecorder.stop();
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const fileReader = new FileReader();
        fileReader.onloadend = async () => {
          const base64Audio = typeof fileReader.result === 'string' ? fileReader.result.split(',')[1] : undefined;
          if (!base64Audio) return;
          // Send to Whisper
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
            setMessages(prev => [...prev, { content: transcript, isUser: true }]);
          }
        };
        fileReader.readAsDataURL(audioBlob);
      };

      // Listen for speech stop event to trigger transcription
      mediaRecorder.onstop = stopAndTranscribe;

      // 4. Create DataChannel for structured messages
      dataChannel = peerConnection.createDataChannel('oai-events');
      dataChannel.onopen = () => {
        // Send session.update and initial message
        if (dataChannel) {
          dataChannel.send(JSON.stringify({
            type: "session.update",
            session: {
              voice: "alloy",
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
              content: [{ type: "input_text", text: `You are a helpful assistant. Speak clearly, quickly and concisely.` }]
            }
          }));

          console.log('DataChannel open and initial messages sent');
        }
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

      // 5. Play remote audio
      peerConnection.ontrack = (event) => {
        if (!remoteAudio) {
          remoteAudio = new window.Audio();
          remoteAudio.autoplay = true;
          remoteAudio.controls = false;
          document.body.appendChild(remoteAudio);
        }
        remoteAudio.srcObject = event.streams[0];
      };

      // 6. Create offer and set as local description
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // 7. POST offer.sdp to OpenAI for answer (raw SDP, not JSON)
      const realtimeUrl = process.env.NEXT_PUBLIC_OPENAI_REALTIME_URL;
      if (!realtimeUrl) throw new Error('NEXT_PUBLIC_OPENAI_REALTIME_URL is not set');
      const sdpResp = await fetch(realtimeUrl, {
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

      // 8. Update UI state
      setCurrentResponse('');
      // Do not add '[WebRTC Connected]' to chat bubbles

      // 9. Cleanup on close
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection?.connectionState === 'disconnected' || peerConnection?.connectionState === 'closed' || peerConnection?.connectionState === 'failed') {
          setIsVoiceStreaming(false);
          setCurrentResponse('');
          if (peerConnection) peerConnection.close();
          if (localStream) localStream.getTracks().forEach(t => t.stop());
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

  // Add avatar circle with emoji before the chat bubble
  return (
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
                // Stop streaming
                setIsVoiceStreaming(false);
                setCurrentResponse('');
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
  );
}
