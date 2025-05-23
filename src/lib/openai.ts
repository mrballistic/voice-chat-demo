/**
 * OpenAI API utility for streaming chat completions.
 * Handles authentication via NEXT_PUBLIC_OPENAI_API_KEY environment variable.
 */
const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

/**
 * Type representing a chunk of OpenAI chat completion response.
 * Adjust fields as needed to match actual API response.
 */
export interface OpenAIChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
      function_call?: unknown;
      tool_calls?: unknown;
    };
    index: number;
    finish_reason: string | null;
  }>;
}

/**
 * Streams chat responses from OpenAI for a given prompt using Server-Sent Events (SSE).
 * @param prompt - The user prompt to send to OpenAI.
 * @param systemPrompt - (Optional) System prompt to guide OpenAI's response style.
 * @returns An async generator yielding parsed OpenAI chat completion chunks.
 * @throws Error if the OpenAI API call fails.
 */
export async function streamChat(prompt: string, systemPrompt?: string) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  } else {
    messages.push({ role: 'system', content: 'You are a helpful AI assistant. Respond clearly and concisely. Keep replies under 260 characters unless more detail is needed.' });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error('OpenAI Chat API failed: ' + (await response.text()));
  }
  // Log the full response for debugging
  console.log('OpenAI chat response headers:', response.headers);
  // Log each chunk as text for debugging
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  /**
   * Async generator yielding parsed OpenAI chat completion chunks from the SSE stream.
   * Each yielded value is a parsed JSON chunk from the OpenAI API.
   */
  async function* streamChunks(): AsyncGenerator<OpenAIChatCompletionChunk, void, unknown> {
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunkText = decoder.decode(value);
      console.log('OpenAI raw chunk:', chunkText); // Log raw SSE chunk
      buffer += chunkText;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.replace('data: ', '').trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            console.log('OpenAI chat chunk:', parsed); // Log parsed JSON chunk
            yield parsed;
          } catch (err) {
            console.error('Failed to parse OpenAI chunk:', err, data);
          }
        }
      }
    }
  }
  return streamChunks();
}
