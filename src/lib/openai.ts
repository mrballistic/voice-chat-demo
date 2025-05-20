// OpenAI API utility for streaming chat completions
const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

/**
 * Streams chat responses from OpenAI for a given prompt.
 * @param prompt - The user prompt to send to OpenAI.
 * @param systemPrompt - (Optional) System prompt to guide OpenAI's response style.
 * @returns The streaming result from OpenAI.
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
    throw new Error('OpenAI Chat API failed: ' + (await response.text()));
  }
  // Log the full response for debugging
  console.log('OpenAI chat response headers:', response.headers);
  // Log each chunk as text for debugging
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  async function* streamChunks() {
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
