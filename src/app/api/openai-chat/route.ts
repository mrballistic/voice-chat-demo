// API route for streaming OpenAI chat completions (GPT-4o or GPT-4-turbo)
import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

export const runtime = 'edge'; // for streaming

/**
 * POST handler for OpenAI chat completions (streaming).
 * Accepts a transcript and optional system prompt, streams chat response as JSON.
 */
export async function POST(req: NextRequest) {
  try {
    const { transcript, systemPrompt } = await req.json();
    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    } else {
      messages.push({ role: 'system', content: 'You are a helpful AI assistant. Respond clearly and concisely. Keep replies under 260 characters unless more detail is needed.' });
    }
    messages.push({ role: 'user', content: transcript });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        stream: true,
        max_tokens: 512
      })
    });
    if (!response.ok || !response.body) {
      const err = await response.text();
      return NextResponse.json({ error: 'OpenAI Chat API failed', details: err }, { status: 500 });
    }
    // Stream the response as it comes in
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        if (!response.body) {
          controller.error(new Error('No response body from OpenAI API'));
          return;
        }
        const reader = response.body.getReader();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += new TextDecoder().decode(value);
          // Parse SSE stream for 'data: ...' lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.replace('data: ', '').trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content || '';
                if (text) {
                  controller.enqueue(encoder.encode(JSON.stringify({ text })));
                }
              } catch {}
            }
          }
        }
        controller.close();
      }
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (err) {
    return NextResponse.json({ error: 'Chat completion failed', details: String(err) }, { status: 500 });
  }
}
