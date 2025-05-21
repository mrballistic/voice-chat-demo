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
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isVoiceStreaming, setIsVoiceStreaming] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

  /**
   * Starts voice recording, streams audio to Gemini for transcription,
   * and sends the transcript to Gemini for a chat response.
   */
  const startRecording = async (): Promise<void> => {
    setIsRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      const audioChunks: BlobPart[] = [];
      let silenceTimeout: ReturnType<typeof setTimeout> | null = null;
      const maxDurationTimeout: ReturnType<typeof setTimeout> = setTimeout(() => {
        stopRecording();
      }, 60000);

      // --- Silence detection using AudioContext ---
      // @ts-expect-error: webkitAudioContext is for legacy browser support
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.fftSize);
      let silenceStart: number | null = null;
      const SILENCE_THRESHOLD = 0.04; // Raise the floor for silence (0.0-1.0)
      const SILENCE_DURATION = 2000; // ms
      let silenceCheckRunning = true;
      let stopped = false; // Prevent double stop

      function checkSilence() {
        if (!silenceCheckRunning) return;
        analyser.getByteTimeDomainData(dataArray);
        // Calculate RMS (root mean square) amplitude
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        if (rms < SILENCE_THRESHOLD) {
          if (silenceStart === null) silenceStart = Date.now();
          if (Date.now() - (silenceStart ?? 0) > SILENCE_DURATION) {
            stopRecording();
            return;
          }
        } else {
          silenceStart = null;
        }
        requestAnimationFrame(checkSilence);
      }
      requestAnimationFrame(checkSilence);

      const stopRecording = () => {
        if (stopped) return;
        stopped = true;
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        if (silenceTimeout) clearTimeout(silenceTimeout);
        clearTimeout(maxDurationTimeout);
        silenceCheckRunning = false;
        // Only close if not already closed
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
      };

      mediaRecorder.addEventListener('dataavailable', (event: BlobEvent) => {
        audioChunks.push(event.data);
        if (silenceTimeout) clearTimeout(silenceTimeout);
        // Set a 2s silence timeout
        silenceTimeout = setTimeout(() => {
          stopRecording();
        }, 2000);
      });

      mediaRecorder.addEventListener('stop', async () => {
        // No need to trim trailing silence here; handled in OpenAI Whisper
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const fileReader = new FileReader();
        fileReader.onloadend = async () => {
          const base64Audio = typeof fileReader.result === 'string' ? fileReader.result.split(',')[1] : undefined;
          if (!base64Audio) return;
          setCurrentResponse('');
          setMessages(prev => [...prev, { content: '[Transcribing audio...]', isUser: true }]);
          // Use OpenAI Whisper endpoint
          const response = await fetch('/api/openai-transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio: base64Audio,
              mimeType: 'audio/webm'
            })
          });
          if (!response.ok) {
            setMessages(prev => [...prev, { content: '[Transcription failed]', isUser: true }]);
            setCurrentResponse('');
            return;
          }
          const data = await response.json();
          const transcript = data.transcript;
          setMessages(prev => {
            // Remove the placeholder
            const filtered = prev.filter(m => m.content !== '[Transcribing audio...]');
            if (transcript && transcript !== 'undefined') {
              return [...filtered, { content: transcript, isUser: true }];
            }
            return filtered;
          });
          setCurrentResponse('');
          // Now send transcript to OpenAI chat
          try {
            setCurrentResponse('');
            let aiResponse = '';
            // Call the new OpenAI chat API route
            const response = await fetch('/api/openai-chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transcript })
            });
            if (!response.body) return;
            const streamReader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
              const { value, done } = await streamReader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const { text } = JSON.parse(line);
                  aiResponse += text;
                  setCurrentResponse(aiResponse);
                } catch {
                  // ignore JSON parse errors
                }
              }
            }
            setMessages(prev => [...prev, { content: aiResponse, isUser: false }]);
            setCurrentResponse('');
          } catch {
            // ignore errors
          }
        };
        fileReader.readAsDataURL(audioBlob);
      });

      mediaRecorder.start();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsRecording(false);
    }
  };

  // --- WebRTC Voice-to-Voice Integration (OpenAI Realtime) ---
  const startVoiceStreamingWebRTC = async () => {
    setIsVoiceStreaming(true);
    setCurrentResponse('');
    // Connect to local proxy for signaling
    const ws = new window.WebSocket('ws://localhost:8080');
    wsRef.current = ws;
    let peerConnection: RTCPeerConnection | null = null;
    let remoteAudio: HTMLAudioElement | null = null;
    let localStream: MediaStream | null = null;
    let iceCandidatesQueue: RTCIceCandidateInit[] = [];
    let signalingReady = false;

    ws.onopen = async () => {
      // Create RTCPeerConnection
      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });
      // Get mic audio
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of localStream.getTracks()) {
        peerConnection.addTrack(track, localStream);
      }
      // Send ICE candidates to proxy
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          if (signalingReady) {
            ws.send(JSON.stringify({
              type: 'webrtc-signal',
              signalType: 'ice',
              data: { candidate: event.candidate },
            }));
          } else {
            iceCandidatesQueue.push(event.candidate);
          }
        }
      };
      // Play remote audio
      peerConnection.ontrack = (event) => {
        if (!remoteAudio) {
          remoteAudio = new window.Audio();
          remoteAudio.autoplay = true;
          remoteAudio.controls = false;
          document.body.appendChild(remoteAudio);
        }
        remoteAudio.srcObject = event.streams[0];
      };
      // Create offer and send to proxy
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      ws.send(JSON.stringify({
        type: 'webrtc-signal',
        signalType: 'offer',
        data: { sdp: offer.sdp },
      }));
    };
    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'webrtc-signal' && msg.signalType === 'answer') {
          if (peerConnection) {
            await peerConnection.setRemoteDescription({
              type: 'answer',
              sdp: msg.data.sdp,
            });
            signalingReady = true;
            // Flush queued ICE candidates
            for (const cand of iceCandidatesQueue) {
              ws.send(JSON.stringify({
                type: 'webrtc-signal',
                signalType: 'ice',
                data: { candidate: cand },
              }));
            }
            iceCandidatesQueue = [];
          }
        }
      } catch {
        // Not JSON, ignore
      }
    };
    ws.onclose = () => {
      setIsVoiceStreaming(false);
      setCurrentResponse('');
      if (peerConnection) peerConnection.close();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
        remoteAudio.remove();
      }
    };
  };

  // Send known-good test audio to OpenAI using WebRTC
  const sendTestAudio = async () => {
    setIsVoiceStreaming(true);
    setCurrentResponse('');
    const ws = new window.WebSocket('ws://localhost:8080');
    wsRef.current = ws;
    let peerConnection: RTCPeerConnection | null = null;
    let remoteAudio: HTMLAudioElement | null = null;
    let iceCandidatesQueue: RTCIceCandidateInit[] = [];
    let signalingReady = false;
    // Hoist ctx and source so they are accessible in ws.onmessage and ws.onclose
    let ctx: AudioContext | null = null;
    let source: AudioBufferSourceNode | null = null;

    ws.onerror = (err) => {
      console.error('[TEST] WebSocket error:', err);
    };
    ws.onclose = (event) => {
      console.warn('[TEST] WebSocket closed:', event);
    };
    ws.onopen = async () => {
      console.log('[TEST] ws.onopen fired');
      // Load base64 PCM16 audio from test-4s.pcm16.b64.txt and decode to ArrayBuffer
      const resp = await fetch('/test-4s.pcm16.b64.txt');
      const base64Audio = (await resp.text()).trim();
      const binaryString = window.atob(base64Audio);
      const pcm16 = new Int16Array(binaryString.length / 2);
      for (let i = 0; i < pcm16.length; i++) {
        pcm16[i] = (binaryString.charCodeAt(i * 2 + 1) << 8) | binaryString.charCodeAt(i * 2);
      }
      // Wrap PCM16 in a WAV header for browser decode
      function pcm16ToWav(pcm16: Int16Array, sampleRate = 16000): ArrayBuffer {
        const numChannels = 1;
        const bytesPerSample = 2;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const wavBuffer = new ArrayBuffer(44 + pcm16.byteLength);
        const view = new DataView(wavBuffer);
        view.setUint32(0, 0x52494646, false); // 'RIFF'
        view.setUint32(4, 36 + pcm16.byteLength, true);
        view.setUint32(8, 0x57415645, false); // 'WAVE'
        view.setUint32(12, 0x666d7420, false); // 'fmt '
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true);
        view.setUint32(36, 0x64617461, false); // 'data'
        view.setUint32(40, pcm16.byteLength, true);
        new Uint8Array(wavBuffer, 44).set(new Uint8Array(pcm16.buffer));
        return wavBuffer;
      }
      const wavBuffer = pcm16ToWav(pcm16, 16000);
      // Decode to AudioBuffer
      ctx = new window.AudioContext();
      const audioBuffer = await ctx.decodeAudioData(wavBuffer);
      // Create a MediaStream from the AudioBuffer
      const dest = ctx.createMediaStreamDestination();
      source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(dest);
      // Start the source when the connection is ready
      console.log('[TEST] WebSocket open, preparing to create RTCPeerConnection and send offer');
      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });
      for (const track of dest.stream.getTracks()) {
        peerConnection.addTrack(track, dest.stream);
      }
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          if (signalingReady) {
            console.log('[TEST] Sending ICE candidate to proxy:', event.candidate);
            ws.send(JSON.stringify({
              type: 'webrtc-signal',
              signalType: 'ice',
              data: { candidate: event.candidate },
            }));
          } else {
            iceCandidatesQueue.push(event.candidate);
          }
        }
      };
      peerConnection.ontrack = (event) => {
        if (!remoteAudio) {
          remoteAudio = new window.Audio();
          remoteAudio.autoplay = true;
          remoteAudio.controls = false;
          document.body.appendChild(remoteAudio);
        }
        remoteAudio.srcObject = event.streams[0];
      };
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.log('[TEST] Sending webrtc-signal offer to proxy:', offer.sdp);
      ws.send(JSON.stringify({
        type: 'webrtc-signal',
        signalType: 'offer',
        data: { sdp: offer.sdp },
      }));
    };
    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'webrtc-signal' && msg.signalType === 'answer') {
          if (peerConnection) {
            await peerConnection.setRemoteDescription({
              type: 'answer',
              sdp: msg.data.sdp,
            });
            signalingReady = true;
            for (const cand of iceCandidatesQueue) {
              ws.send(JSON.stringify({
                type: 'webrtc-signal',
                signalType: 'ice',
                data: { candidate: cand },
              }));
            }
            iceCandidatesQueue = [];
            // Start playback of the test audio
            if (source) source.start();
          }
        }
      } catch {
        // Not JSON, ignore
      }
    };
    ws.onclose = () => {
      setIsVoiceStreaming(false);
      setCurrentResponse('');
      if (peerConnection) peerConnection.close();
      if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
        remoteAudio.remove();
      }
      if (ctx) ctx.close();
    };
  };

  // Add avatar circle with emoji before the chat bubble
  return (
    <div className="flex flex-col h-[80vh] max-w-2xl mx-auto border rounded-lg">
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
            onClick={startRecording}
            disabled={isRecording || isVoiceStreaming}
            className="w-full"
          >
            {isRecording ? 'Listening...' : 'Press to Talk'}
          </Button>
        </div>
        <div className="flex-1">
          <Button
            onClick={startVoiceStreamingWebRTC}
            disabled={isVoiceStreaming || isRecording}
            className="w-full"
            variant="secondary"
          >
            {isVoiceStreaming ? 'Streaming...' : 'Voice-to-Voice (WebRTC Beta)'}
          </Button>
        </div>
        <div className="flex-1">
          <Button
            onClick={sendTestAudio}
            className="w-full"
            variant="outline"
          >
            Send Test Audio
          </Button>
        </div>
      </div>
    </div>
  );
}
