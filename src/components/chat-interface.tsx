// ChatInterface component manages the main chat UI, voice recording, transcription, and Gemini AI integration.
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChatBubble } from '@/components/ui/chat-bubble';
import { streamChat } from '@/lib/gemini';

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
  const chatContainerRef = useRef<HTMLDivElement>(null);

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
      let maxDurationTimeout: ReturnType<typeof setTimeout>;

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
        // No need to trim trailing silence here; handled in Gemini system prompt
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const fileReader = new FileReader();
        fileReader.onloadend = async () => {
          const base64Audio = typeof fileReader.result === 'string' ? fileReader.result.split(',')[1] : undefined;
          if (!base64Audio) return;
          setCurrentResponse('');
          setMessages(prev => [...prev, { content: '[Transcribing audio...]', isUser: true }]);
          const response = await fetch('/api/gemini-transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio: base64Audio,
              mimeType: 'audio/webm',
              systemPrompt: 'If the audio contains a high-pitched tone or noise at the end, please ignore it and only transcribe the spoken content.'
            })
          });
          if (!response.body) return;
          const streamReader = response.body.getReader();
          let transcript = '';
          const decoder = new TextDecoder();
          while (true) {
            const { value, done } = await streamReader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            try {
              const { transcript: chunkText } = JSON.parse(chunk);
              transcript += chunkText;
              setCurrentResponse(transcript);
            } catch {
              // ignore JSON parse errors
            }
          }
          setMessages(prev => {
            // Remove the placeholder
            const filtered = prev.filter(m => m.content !== '[Transcribing audio...]');
            // Only add transcript if it is non-empty and not 'undefined'
            if (transcript && transcript !== 'undefined') {
              return [...filtered, { content: transcript, isUser: true }];
            }
            return filtered;
          });
          setCurrentResponse('');
          // Now send transcript to Gemini chat
          try {
            setCurrentResponse('');
            let aiResponse = '';
            const result = await streamChat(transcript);
            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              aiResponse += chunkText;
              setCurrentResponse(aiResponse);
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
      // Stop after 1 minute max
      maxDurationTimeout = setTimeout(() => {
        stopRecording();
      }, 60000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col h-[80vh] max-w-2xl mx-auto border rounded-lg">
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message, index) => (
          <ChatBubble 
            key={index}
            content={message.content}
            isUser={message.isUser}
          />
        ))}
        {currentResponse && (
          <ChatBubble 
            content={currentResponse}
            isUser={false}
          />
        )}
      </div>
      <div className="border-t p-4">
        <Button 
          onClick={startRecording}
          disabled={isRecording}
          className="w-full"
        >
          {isRecording ? 'Listening...' : 'Press to Talk'}
        </Button>
      </div>
    </div>
  );
}
