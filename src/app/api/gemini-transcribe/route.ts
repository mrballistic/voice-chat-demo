import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    const { audio, mimeType }: { audio: string; mimeType?: string } = await req.json();
    if (!audio) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash-preview-05-20' });
    const result = await model.generateContentStream({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audio,
              },
            },
          ],
        },
      ],
      generationConfig: {
        // You can add config here if needed
      },
    });

    // Stream the transcript as it's generated
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          controller.enqueue(encoder.encode(JSON.stringify({ transcript: chunkText })));
        }
        controller.close();
      }
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch {
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
