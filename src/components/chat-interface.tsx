// ChatInterface component manages the main chat UI, voice recording, transcription, and Gemini AI integration.
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChatBubble } from '@/components/ui/chat-bubble';
// import { streamChat } from '@/lib/openai';

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
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

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

  // --- WebSocket Voice-to-Voice Integration ---
  const startVoiceStreaming = async () => {
    // Interrupt AI playback if active
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    setIsVoiceStreaming(true);
    setCurrentResponse('');
    // Connect to local proxy
    const ws = new window.WebSocket('ws://localhost:8080');
    wsRef.current = ws;
    if (!audioContextRef.current) audioContextRef.current = new window.AudioContext();
    // Start microphone capture
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new window.AudioContext({ sampleRate: 48000 });
    const source = audioCtx.createMediaStreamSource(stream);

    // Register AudioWorkletProcessor inline
    const workletCode = `
      class PCM16Worklet extends AudioWorkletProcessor {
        constructor() {
          super();
          this._buffer = [];
          this._inputSampleRate = 48000;
          this._outputSampleRate = 16000;
        }
        process(inputs) {
          const input = inputs[0][0];
          if (!input) return true;
          // Downsample
          const downsampled = this.downsampleBuffer(input, this._inputSampleRate, this._outputSampleRate);
          // Convert to PCM16
          const pcm16 = this.floatTo16BitPCM(downsampled);
          this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
          return true;
        }
        downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
          if (outputSampleRate === inputSampleRate) return buffer;
          const sampleRateRatio = inputSampleRate / outputSampleRate;
          const newLength = Math.round(buffer.length / sampleRateRatio);
          const result = new Float32Array(newLength);
          let offsetResult = 0;
          let offsetBuffer = 0;
          while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            let accum = 0, count = 0;
            for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
              accum += buffer[i];
              count++;
            }
            result[offsetResult] = count > 0 ? accum / count : 0;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
          }
          return result;
        }
        floatTo16BitPCM(input) {
          const output = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          return output;
        }
      }
      registerProcessor('pcm16-worklet', PCM16Worklet);
    `;
    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);
    await audioCtx.audioWorklet.addModule(workletUrl);
    const pcmNode = new window.AudioWorkletNode(audioCtx, 'pcm16-worklet');
    source.connect(pcmNode);
    pcmNode.connect(audioCtx.destination);
    let recording = true;
    const audioChunks: Int16Array[] = [];
    let stopStreamingTimeout: ReturnType<typeof setTimeout> | null = null;
    const stopStreaming = async () => {
      if (!recording) return;
      recording = false;
      stream.getTracks().forEach(track => track.stop());
      pcmNode.disconnect();
      source.disconnect();
      audioCtx.close();
      // Flatten and encode
      const flat = new Int16Array(audioChunks.reduce((acc, arr) => acc + arr.length, 0));
      let offset = 0;
      for (const arr of audioChunks) {
        flat.set(arr, offset);
        offset += arr.length;
      }
      const audioBuffer = flat.buffer;
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      const systemPrompt = "You are an assistant that answers briefly and politely. Inject emotion into your voice. Act friendly.";
      ws.send(JSON.stringify({ audio: base64Audio, systemPrompt }));
    };
    pcmNode.port.onmessage = (event) => {
      if (!recording || ws.readyState !== ws.OPEN) return;
      audioChunks.push(new Int16Array(event.data));
      // Auto-stop after 5s or on silence (simple RMS threshold)
      if (stopStreamingTimeout) clearTimeout(stopStreamingTimeout);
      stopStreamingTimeout = setTimeout(stopStreaming, 2000); // 2s of silence
    };
    ws.onopen = () => {
      // Also stop after max 10s
      setTimeout(stopStreaming, 10000);
    };
    ws.onmessage = async (event) => {
      // If user starts talking, interrupt AI playback
      if (isRecording) {
        if (audioSourceRef.current) {
          audioSourceRef.current.stop();
          audioSourceRef.current = null;
        }
      }
      // Handle both string and Blob messages
      if (typeof event.data === 'string') {
        // Try to parse as JSON control message
        try {
          const msg = JSON.parse(event.data);
          // Handle text deltas, etc.
          if (msg.text) setCurrentResponse((prev) => prev + msg.text);
          // You can add more control message handling here if needed
        } catch {
          // Not JSON, ignore
        }
      } else if (event.data instanceof Blob) {
        // Peek at the first byte(s) to check if it's JSON or audio
        const arrayBuffer = await event.data.arrayBuffer();
        const firstByte = new Uint8Array(arrayBuffer, 0, 1)[0];
        if (firstByte === 123) { // '{' character, likely JSON
          try {
            const text = new TextDecoder().decode(arrayBuffer);
            const msg = JSON.parse(text);
            // Handle JSON control message
            if (msg.text) setCurrentResponse((prev) => prev + msg.text);
            // You can add more control message handling here if needed
            return;
          } catch {
            // Not valid JSON, fall through to audio
          }
        }
        // Otherwise, treat as audio
        const ctx = audioContextRef.current;
        if (ctx) {
          try {
            // Interrupt user recording if AI audio starts
            if (recording) {
              recording = false;
              stream.getTracks().forEach(track => track.stop());
              pcmNode.disconnect();
              source.disconnect();
              audioCtx.close();
            }
            const ab = arrayBuffer.slice(0);
            const audioBuffer = await ctx.decodeAudioData(ab);
            const sourceNode = ctx.createBufferSource();
            sourceNode.buffer = audioBuffer;
            sourceNode.connect(ctx.destination);
            sourceNode.start();
            audioSourceRef.current = sourceNode;
          } catch (err) {
            let firstBytes;
            try {
              firstBytes = new Uint8Array(arrayBuffer.slice(0, 32));
            } catch {
              firstBytes = '[ArrayBuffer detached]';
            }
            console.error('decodeAudioData error:', err, 'Blob size:', event.data.size, 'First bytes:', firstBytes);
          }
        }
      }
    };
    ws.onclose = () => {
      setIsVoiceStreaming(false);
      setCurrentResponse('');
      recording = false;
      pcmNode.disconnect();
      source.disconnect();
      audioCtx.close();
      if (audioSourceRef.current) audioSourceRef.current.stop();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
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
            onClick={startVoiceStreaming}
            disabled={isVoiceStreaming || isRecording}
            className="w-full"
            variant="secondary"
          >
            {isVoiceStreaming ? 'Streaming...' : 'Voice-to-Voice (Beta)'}
          </Button>
        </div>
      </div>
    </div>
  );
}
