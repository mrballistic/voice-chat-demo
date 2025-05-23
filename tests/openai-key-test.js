// Simple test script to check if the OpenAI API key is working
import fetch from 'node-fetch';
import 'dotenv/config';

async function testOpenAI() {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    console.error('No OpenAI API key found in environment variables.');
    process.exit(1);
  }
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    console.error('OpenAI API request failed:', response.status, response.statusText);
    process.exit(1);
  }
  const data = await response.json();
  console.log('OpenAI API key is valid. Available models:', data.data ? data.data.map(m => m.id) : data);
}

testOpenAI();
