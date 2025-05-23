// wav-to-base64.js
// Usage: node wav-to-base64.js [input.wav] [output.txt]
// Reads a WAV file, finds the PCM16 data chunk, base64-encodes it, and prints or saves the result.

import fs from 'fs';

const inputFile = process.argv[2] || 'test-4s.wav';
const outputFile = process.argv[3];

const wavBuffer = fs.readFileSync(inputFile);

function findDataChunk(buffer) {
  for (let i = 0; i < buffer.length - 8; i++) {
    if (
      buffer[i] === 0x64 && // 'd'
      buffer[i + 1] === 0x61 && // 'a'
      buffer[i + 2] === 0x74 && // 't'
      buffer[i + 3] === 0x61 // 'a'
    ) {
      const dataSize = buffer.readUInt32LE(i + 4);
      const dataStart = i + 8;
      console.log(`[PCM Extract] Found 'data' chunk at offset ${i}, size ${dataSize}`);
      return {pcm: buffer.slice(dataStart, dataStart + dataSize), offset: i, size: dataSize};
    }
  }
  return null;
}

const found = findDataChunk(wavBuffer);
let pcmBuffer;
if (found && found.pcm && found.pcm.length > 0) {
  pcmBuffer = found.pcm;
  // Log first 16 bytes as ASCII and hex
  const ascii = pcmBuffer.slice(0, 16).toString('ascii');
  const hex = Array.from(pcmBuffer.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
  console.log(`[PCM Extract] First 16 bytes of extracted buffer (ASCII): ${ascii}`);
  console.log(`[PCM Extract] First 16 bytes of extracted buffer (hex): ${hex}`);
  // If still starts with 'UklG' or 'RIFF', skip forward until header is gone
  if (ascii.startsWith('UklG') || ascii.startsWith('RIFF')) {
    console.warn('[PCM Extract] Data chunk still starts with WAV header, searching for first non-header data...');
    // Try to find first non-header (non-ASCII) data
    let start = 0;
    for (let i = 0; i < pcmBuffer.length - 4; i++) {
      const a = pcmBuffer[i];
      const b = pcmBuffer[i+1];
      const c = pcmBuffer[i+2];
      const d = pcmBuffer[i+3];
      // Look for a run of 4 bytes that are not ASCII letters (likely PCM)
      if (a > 127 || b > 127 || c > 127 || d > 127) {
        start = i;
        break;
      }
    }
    if (start > 0) {
      pcmBuffer = pcmBuffer.slice(start);
      console.log(`[PCM Extract] Skipped ${start} bytes of header, new buffer length: ${pcmBuffer.length}`);
    } else {
      console.error('[PCM Extract] Could not skip WAV header, extraction failed.');
      process.exit(1);
    }
  }
} else {
  // Fallback: skip first 44 bytes (standard header)
  console.warn('[PCM Extract] Could not find data chunk, falling back to skipping 44 bytes.');
  pcmBuffer = wavBuffer.slice(44);
}
const base64 = pcmBuffer.toString('base64');

if (base64.startsWith('UklGR')) {
  console.error('[PCM Extract] Output still contains WAV header! Extraction failed.');
  process.exit(1);
}

if (outputFile) {
  fs.writeFileSync(outputFile, base64);
  console.log('Base64 PCM16 written to', outputFile);
} else {
  console.log(base64);
}
