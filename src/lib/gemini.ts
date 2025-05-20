// Gemini API utility for streaming chat and model access.
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini model instance for chat and transcription.
 */
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export const geminiModel = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash-preview-05-20" });

/**
 * Streams chat responses from Gemini for a given prompt.
 * @param prompt - The user prompt to send to Gemini.
 * @param systemPrompt - (Optional) System prompt to guide Gemini's response style.
 * @returns The streaming result from Gemini.
 */
export async function streamChat(prompt: string, systemPrompt?: string) {
  // Compose the contents array for Gemini: systemPrompt as context, then user prompt
  const contents = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
  } else {
    // Default system prompt for chat responses
    contents.push({
      role: 'user',
      parts: [{ text: 'You are a helpful AI assistant. Respond clearly and concisely. Keep replies under 260 characters unless more detail is needed.' }]
    });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });
  const result = await geminiModel.generateContentStream({ contents });
  return result;
}
