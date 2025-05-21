// record-4s.js
const mic = require('mic');
const fs = require('fs');
const wav = require('wav');

const outputFile = 'test-4s.wav';
const durationMs = 4000;

const micInstance = mic({
  rate: '16000',
  channels: '1',
  bitwidth: '16',
  encoding: 'signed-integer',
  endian: 'little',
  device: 'default',
  fileType: 'wav'
});

const micInputStream = micInstance.getAudioStream();
const fileWriter = new wav.FileWriter(outputFile, {
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16
});

micInputStream.pipe(fileWriter);

console.log('Recording for 4 seconds...');
micInstance.start();

setTimeout(() => {
  micInstance.stop();
  fileWriter.end();
  console.log('Recording stopped. Saved to', outputFile);
}, durationMs);