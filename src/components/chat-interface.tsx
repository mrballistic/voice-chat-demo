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
    // --- Ensure streaming button is always re-enabled on close ---
    ws.onclose = () => {
      setIsVoiceStreaming(false); // Always re-enable button immediately on close
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
          if (input && input.length > 0) {
            let nonZero = false;
            for (let i = 0; i < Math.min(8, input.length); i++) {
              if (input[i] !== 0) nonZero = true;
            }
            if (!nonZero) {
              console.log('[WORKLET] Input buffer is all zeros:', Array.from(input.slice(0, 8)));
            } else {
              console.log('[WORKLET] Input buffer sample:', Array.from(input.slice(0, 8)));
            }
          }
          if (!input) return true;
          // Downsample
          let downsampled = this.downsampleBuffer(input, this._inputSampleRate, this._outputSampleRate);
          // Apply gain to boost signal
          const GAIN = 1; // Set to 1x to avoid clipping
          downsampled = downsampled.map(x => x * GAIN);
          // Log amplified buffer
          console.log('[WORKLET] Amplified downsampled buffer sample:', Array.from(downsampled.slice(0, 8)));
          // Convert to PCM16
          const pcm16 = this.floatTo16BitPCM(downsampled);
          // Log PCM16 buffer
          console.log('[WORKLET] PCM16 buffer sample:', Array.from(pcm16.slice(0, 8)));
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
    let stopStreamingTimeout: ReturnType<typeof setTimeout> | null = null;
    // Buffer for PCM16 audio chunks
    const audioChunks: Int16Array[] = [];
    // --- Cut off after 5 seconds ---
    setTimeout(() => {
      stopStreaming();
    }, 1000);
    function arrayBufferToBase64(buffer: ArrayBuffer): string {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }
    let pendingAudioBase64: string | null = null;
    let pendingSystemPrompt: string | null = null;
    const stopStreaming = async () => {
      if (!recording) return;
      recording = false;
      stream.getTracks().forEach(track => track.stop());
      pcmNode.disconnect();
      source.disconnect();
      audioCtx.close();
      // Filter out empty or all-zero chunks
      const filteredChunks = audioChunks.filter(chunk => {
        if (!chunk || chunk.length === 0) return false;
        // Check if all values are zero
        let allZero = true;
        for (let i = 0; i < chunk.length; i++) {
          if (chunk[i] !== 0) { allZero = false; break; }
        }
        return !allZero;
      });
      // Log chunk lengths and first 8 samples of each
      filteredChunks.forEach((chunk, idx) => {
        console.log(`[FRONTEND] Chunk #${idx} length:`, chunk.length, 'Sample:', Array.from(chunk.slice(0, 8)));
      });
      // Concatenate all PCM16 chunks (flatten to avoid buffer issues)
      const flatPCM = filteredChunks.flatMap(chunk => Array.from(chunk));
      // Trim leading and trailing zeros
      let firstNonZero = 0;
      let lastNonZero = flatPCM.length - 1;
      while (firstNonZero < flatPCM.length && flatPCM[firstNonZero] === 0) firstNonZero++;
      while (lastNonZero > firstNonZero && flatPCM[lastNonZero] === 0) lastNonZero--;
      const trimmedPCM = flatPCM.slice(firstNonZero, lastNonZero + 1);
      console.log('[FRONTEND] Flattened PCM16 type:', typeof flatPCM[0], 'Sample:', flatPCM.slice(0, 32));
      console.log('[FRONTEND] First non-zero index:', firstNonZero, 'Last non-zero index:', lastNonZero, 'Trimmed length:', trimmedPCM.length);
      // Explicitly copy values to Int16Array using set
      const fullPCM = new Int16Array(trimmedPCM.length);
      fullPCM.set(trimmedPCM);
      // Log first 32 PCM16 values and sum for debugging
      console.log('[FRONTEND] First 32 PCM16 values:', Array.from(fullPCM.slice(0, 32)), 'Sum:', fullPCM.reduce((a, b) => a + b, 0));
      // Log PCM buffer length and duration
      console.log('[FRONTEND] Trimmed PCM16 length:', fullPCM.length, 'Duration (s):', (fullPCM.length / 16000).toFixed(2));
      const base64Audio = arrayBufferToBase64(fullPCM.buffer);
      // Save for sending after session.created
      pendingAudioBase64 = base64Audio;
      pendingSystemPrompt = "You are a helpful assistant.";
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              { type: 'input_audio', audio: pendingAudioBase64 }
            ]
          }
        }));
        ws.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['text', 'audio'],
            instructions: pendingSystemPrompt,
            previous_response_id: null
          }
        }));
        pendingAudioBase64 = null;
        pendingSystemPrompt = null;
      }
    };
    pcmNode.port.onmessage = (event) => {
      if (!recording || ws.readyState !== ws.OPEN) return;
      const pcmChunk = new Int16Array(event.data);
      // Log chunk length and first 8 values
      console.log('[MAIN] Received PCM16 chunk length:', pcmChunk.length, 'sample:', Array.from(pcmChunk.slice(0, 8)));
      audioChunks.push(pcmChunk);
      // Auto-stop after 2s of silence
      if (stopStreamingTimeout) clearTimeout(stopStreamingTimeout);
      stopStreamingTimeout = setTimeout(stopStreaming, 2000);
    };
    ws.onopen = () => {
      // No longer send response.create here; send after session.created
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
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'session.created') {
            // sessionReady = true; // No longer needed
            // If audio is ready, send it now
            if (pendingAudioBase64 && ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [
                    { type: 'input_audio', audio: pendingAudioBase64 }
                  ]
                }
              }));
              ws.send(JSON.stringify({
                type: 'response.create',
                response: {
                  modalities: ['text', 'audio'],
                  instructions: pendingSystemPrompt,
                  previous_response_id: null
                }
              }));
              pendingAudioBase64 = null;
              pendingSystemPrompt = null;
            }
          }
          // Handle text deltas, etc.
          if (msg.text) setCurrentResponse((prev) => prev + msg.text);
          // --- Re-enable streaming button on any OpenAI response ---
          if (msg.type && msg.type.startsWith('response.')) {
            setIsVoiceStreaming(false);
          }
          // --- Handle transcription in voice-to-voice mode ---
          if (msg.type === 'response.text.delta' && msg.delta) {
            // Show transcript as a user message (like press-to-talk)
            setMessages(prev => {
              // Only add if last message is not the same transcript
              if (prev.length > 0 && prev[prev.length - 1].content === msg.delta && prev[prev.length - 1].isUser) {
                return prev;
              }
              return [...prev, { content: msg.delta, isUser: true }];
            });
          }
        } catch {
          // Not JSON, ignore
        }
      } else if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        const firstByte = new Uint8Array(arrayBuffer, 0, 1)[0];
        if (firstByte === 123) { // '{' character, likely JSON
          try {
            const text = new TextDecoder().decode(arrayBuffer);
            const msg = JSON.parse(text);
            if (msg.text) setCurrentResponse((prev) => prev + msg.text);
            // You can add more control message handling here if needed
            return;
          } catch {
            // Not valid JSON, fall through to audio
          }
        }
        // Otherwise, treat as audio
        // Wrap PCM16 in WAV header for browser playback
        function pcm16ToWav(pcm16: ArrayBuffer, sampleRate = 16000): ArrayBuffer {
          const numChannels = 1;
          const bytesPerSample = 2;
          const blockAlign = numChannels * bytesPerSample;
          const byteRate = sampleRate * blockAlign;
          const wavBuffer = new ArrayBuffer(44 + pcm16.byteLength);
          const view = new DataView(wavBuffer);
          // RIFF identifier 'RIFF'
          view.setUint32(0, 0x52494646, false);
          // file length minus RIFF and size
          view.setUint32(4, 36 + pcm16.byteLength, true);
          // 'WAVE'
          view.setUint32(8, 0x57415645, false);
          // 'fmt ' chunk
          view.setUint32(12, 0x666d7420, false);
          view.setUint32(16, 16, true); // PCM chunk size
          view.setUint16(20, 1, true); // PCM format
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, byteRate, true);
          view.setUint16(32, blockAlign, true);
          view.setUint16(34, 16, true); // bits per sample
          // 'data' chunk
          view.setUint32(36, 0x64617461, false);
          view.setUint32(40, pcm16.byteLength, true);
          // PCM16 samples
          new Uint8Array(wavBuffer, 44).set(new Uint8Array(pcm16));
          return wavBuffer;
        }
        // Log first 32 bytes of received buffer
        console.log('[FRONTEND] Received binary audio, first 32 bytes:', Array.from(new Uint8Array(arrayBuffer.slice(0, 32))));
        // Wrap and decode
        const wavBuffer = pcm16ToWav(arrayBuffer, 16000);
        const ctx = audioContextRef.current || new window.AudioContext();
        if (!audioContextRef.current) audioContextRef.current = ctx;
        try {
          const audioBuffer = await ctx.decodeAudioData(wavBuffer);
          const sourceNode = ctx.createBufferSource();
          sourceNode.buffer = audioBuffer;
          sourceNode.connect(ctx.destination);
          sourceNode.start();
          audioSourceRef.current = sourceNode;
        } catch (err) {
          let firstBytes;
          try { firstBytes = new Uint8Array(arrayBuffer.slice(0, 32)); } catch { firstBytes = '[ArrayBuffer detached]'; }
          console.error('decodeAudioData error:', err, 'Blob size:', event.data.size, 'First bytes:', firstBytes);
        }
      }
    };
    ws.onclose = () => {
      setIsVoiceStreaming(false); // Always re-enable button immediately on close
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

  // Remove: function generateTestPCM16Sine() { ... }
  // Send known-good test audio to OpenAI
  const sendTestAudio = async () => {
    const ws = new window.WebSocket('ws://localhost:8080');
    let pendingAudioBase64: string | null = null;
    let pendingSystemPrompt: string | null = null;
    // Load base64 PCM16 audio from test-4s.pcm16.b64.txt
    const resp = await fetch('/test-4s.pcm16.b64.txt');
    const base64Audio = (await resp.text()).trim();
    ws.onopen = () => {
      console.log('[TEST] Sending test PCM16 audio from file, length:', base64Audio.length);
      pendingAudioBase64 = base64Audio;
      pendingSystemPrompt = 'You are a helpful assistant.';
      // Only send after session.created
    };
    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'session.created') {
            if (pendingAudioBase64 && ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [
                    { type: 'input_audio', audio: pendingAudioBase64 }
                  ]
                }
              }));
              ws.send(JSON.stringify({
                type: 'response.create',
                response: {
                  modalities: ['text', 'audio'],
                  instructions: pendingSystemPrompt,
                  previous_response_id: null
                }
              }));
              pendingAudioBase64 = null;
              pendingSystemPrompt = null;
            }
          }
          if (msg.text) setCurrentResponse((prev) => prev + msg.text);
        } catch {}
      } else if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        // Wrap PCM16 in WAV header for browser playback
        function pcm16ToWav(pcm16: ArrayBuffer, sampleRate = 16000): ArrayBuffer {
          const numChannels = 1;
          const bytesPerSample = 2;
          const blockAlign = numChannels * bytesPerSample;
          const byteRate = sampleRate * blockAlign;
          const wavBuffer = new ArrayBuffer(44 + pcm16.byteLength);
          const view = new DataView(wavBuffer);
          // RIFF identifier 'RIFF'
          view.setUint32(0, 0x52494646, false);
          // file length minus RIFF and size
          view.setUint32(4, 36 + pcm16.byteLength, true);
          // 'WAVE'
          view.setUint32(8, 0x57415645, false);
          // 'fmt ' chunk
          view.setUint32(12, 0x666d7420, false);
          view.setUint32(16, 16, true); // PCM chunk size
          view.setUint16(20, 1, true); // PCM format
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, byteRate, true);
          view.setUint16(32, blockAlign, true);
          view.setUint16(34, 16, true); // bits per sample
          // 'data' chunk
          view.setUint32(36, 0x64617461, false);
          view.setUint32(40, pcm16.byteLength, true);
          // PCM16 samples
          new Uint8Array(wavBuffer, 44).set(new Uint8Array(pcm16));
          return wavBuffer;
        }
        // Log first 32 bytes of received buffer
        console.log('[FRONTEND] Received binary audio, first 32 bytes:', Array.from(new Uint8Array(arrayBuffer.slice(0, 32))));
        // Wrap and decode
        const wavBuffer = pcm16ToWav(arrayBuffer, 16000);
        const ctx = audioContextRef.current || new window.AudioContext();
        if (!audioContextRef.current) audioContextRef.current = ctx;
        try {
          const audioBuffer = await ctx.decodeAudioData(wavBuffer);
          const sourceNode = ctx.createBufferSource();
          sourceNode.buffer = audioBuffer;
          sourceNode.connect(ctx.destination);
          sourceNode.start();
          audioSourceRef.current = sourceNode;
        } catch (err) {
          let firstBytes;
          try { firstBytes = new Uint8Array(arrayBuffer.slice(0, 32)); } catch { firstBytes = '[ArrayBuffer detached]'; }
          console.error('decodeAudioData error:', err, 'Blob size:', event.data.size, 'First bytes:', firstBytes);
        }
      }
    };
    ws.onclose = () => {
      setIsVoiceStreaming(false);
      setCurrentResponse('');
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
            onClick={startVoiceStreaming}
            disabled={isVoiceStreaming || isRecording}
            className="w-full"
            variant="secondary"
          >
            {isVoiceStreaming ? 'Streaming...' : 'Voice-to-Voice (Beta)'}
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
