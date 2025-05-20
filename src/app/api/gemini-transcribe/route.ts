// API route for streaming real-time transcription from Gemini using audio input.
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * POST handler for audio transcription.
 * Accepts base64-encoded audio and streams transcription chunks as JSON.
 * Accepts an optional systemPrompt to guide Gemini's transcription.
 */
export async function POST(req: NextRequest) {
  try {
    const { audio, mimeType, systemPrompt }: { audio: string; mimeType?: string; systemPrompt?: string } = await req.json();
    if (!audio) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }
    // Debug: log audio and mimeType
    console.log('Gemini API transcription request:', {
      audioLength: audio.length,
      mimeType,
      hasApiKey: Boolean(apiKey),
      model: 'models/gemini-2.5-flash-preview-05-20',
      systemPrompt
    });
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash-preview-05-20' });
    const contents = [];
    // Gemini only accepts 'user' and 'model' roles. If a systemPrompt is provided, prepend as a user text part.
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    }
    contents.push({
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: audio,
          },
        },
      ],
    });
    let result;
    try {
      result = await model.generateContentStream({
        contents,
        generationConfig: {
          // You can add config here if needed
        },
      });
    } catch (err) {
      console.error('Error from model.generateContentStream:', err);
      throw err;
    }

    // Stream the transcript as it's generated
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            // Debug: log the chunk structure
            console.log('Gemini chunk:', chunk);
            let chunkText = undefined;
            if (typeof chunk.text === 'function') {
              chunkText = chunk.text();
            } else if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts && chunk.candidates[0].content.parts[0].text) {
              chunkText = chunk.candidates[0].content.parts[0].text;
            } else if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts && chunk.candidates[0].content.parts[0]) {
              chunkText = chunk.candidates[0].content.parts[0];
            }
            controller.enqueue(encoder.encode(JSON.stringify({ transcript: chunkText })));
          }
        } catch (err) {
          console.error('Error in Gemini stream for-await:', err);
          controller.enqueue(encoder.encode(JSON.stringify({ transcript: '', error: String(err) })));
        }
        controller.close();
      }
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (err) {
    console.error('Gemini transcription API error:', err);
    return NextResponse.json({ error: 'Transcription failed', details: String(err) }, { status: 500 });
  }
}
