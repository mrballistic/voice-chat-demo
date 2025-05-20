'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChatBubble } from '@/components/ui/chat-bubble';
import { streamChat } from '@/lib/gemini';

interface Message {
  content: string;
  isUser: boolean;
}

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

  const startRecording = async (): Promise<void> => {
    setIsRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];

      mediaRecorder.addEventListener('dataavailable', (event: BlobEvent) => {
        audioChunks.push(event.data);
      });

      mediaRecorder.addEventListener('stop', async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const wavBlob = await convertWebmToWav(audioBlob);
        const fileReader = new FileReader();
        fileReader.onloadend = async () => {
          const base64Audio = typeof fileReader.result === 'string' ? fileReader.result.split(',')[1] : undefined;
          if (!base64Audio) return;
          // Stream transcription from Gemini
          setCurrentResponse('');
          setMessages(prev => [...prev, { content: '[Transcribing audio...]', isUser: true }]);
          const response = await fetch('/api/gemini-transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64Audio, mimeType: 'audio/wav' })
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
            return [...filtered, { content: transcript, isUser: true }];
          });
          setCurrentResponse('');
          // Now send transcript to Gemini chat
          try {
            const result = await streamChat(transcript);
            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              setCurrentResponse(prev => prev + chunkText);
            }
            setMessages(prev => [...prev, { content: currentResponse, isUser: false }]);
            setCurrentResponse('');
          } catch {
            // ignore errors
          }
        };
        fileReader.readAsDataURL(wavBlob);
      });

      mediaRecorder.start();
      // Stop recording after 5 seconds for demo
      setTimeout(() => {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      }, 5000);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error accessing microphone:', error);
      setIsRecording(false);
    }
  };

  // Helper: Convert WebM to WAV using browser AudioContext
  async function convertWebmToWav(webmBlob: Blob): Promise<Blob> {
    const arrayBuffer = await webmBlob.arrayBuffer();
    // @ts-expect-error: webkitAudioContext is for legacy browser support
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    // Encode to WAV
    const wavBuffer = encodeWAV(audioBuffer);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  // Helper: Encode AudioBuffer to WAV (PCM 16-bit)
  function encodeWAV(audioBuffer: AudioBuffer): ArrayBuffer {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const samples = audioBuffer.length * numChannels;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);

    // Write WAV header
    function writeString(view: DataView, offset: number, str: string) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitDepth / 8, true);
    view.setUint16(32, numChannels * bitDepth / 8, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples * 2, true);

    // Write PCM samples
    let offset = 44;
    for (let ch = 0; ch < numChannels; ch++) {
      const channel = audioBuffer.getChannelData(ch);
      for (let i = 0; i < channel.length; i++) {
        let sample = Math.max(-1, Math.min(1, channel[i]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, sample, true);
        offset += 2;
      }
    }
    return buffer;
  }

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
