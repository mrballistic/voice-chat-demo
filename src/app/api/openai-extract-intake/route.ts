// API route for extracting intake fields from a transcript using OpenAI GPT-4o.
import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

/**
 * POST handler for extracting intake fields from transcript.
 * Accepts { transcript: string } and returns extracted fields as JSON.
 */
export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();
    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }
    const prompt = `Extract the following fields from this text if present: full name, phone, email, insurance provider, policy number, group number, workers comp (yes/no), how injury occurred, date of injury, symptoms, prior treatment. Return as a compact JSON object with keys: name, phone, email, insurance, policy, group, workersComp, injuryDate, injuryHow, symptoms, priorTreatment. If a field is not present, use null.`;
    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: transcript }
    ];
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 256,
        temperature: 0.0,
        response_format: { type: 'json_object' }
      })
    });
    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: 'OpenAI GPT-4o API failed', details: err }, { status: 500 });
    }
    const data = await response.json();
    let fields = {};
    try {
      fields = JSON.parse(data.choices[0].message.content);
    } catch {
      fields = { error: 'Failed to parse JSON', raw: data.choices[0].message.content };
    }
    return NextResponse.json({ fields });
  } catch (err) {
    return NextResponse.json({ error: 'Extraction failed', details: String(err) }, { status: 500 });
  }
}
