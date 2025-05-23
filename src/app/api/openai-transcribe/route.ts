// API route for streaming real-time transcription from OpenAI Whisper API using audio input.
import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

/**
 * POST handler for audio transcription using OpenAI Whisper API.
 * Accepts base64-encoded audio and streams transcription chunks as JSON.
 */
export async function POST(req: NextRequest) {
  try {
    const { audio, mimeType } = await req.json();
    if (!audio) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }
    // Convert base64 to Buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    // Prepare multipart/form-data for OpenAI Whisper
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: mimeType || 'audio/webm' }), 'audio.webm');
    formData.append('model', 'whisper-1');
    // You can add language or prompt params if needed

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: formData
    });
    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: 'OpenAI Whisper API failed', details: err }, { status: 500 });
    }
    const data = await response.json();
    // Whisper returns the full transcript at once
    return NextResponse.json({ transcript: data.text });
  } catch (err) {
    return NextResponse.json({ error: 'Transcription failed', details: String(err) }, { status: 500 });
  }
}
