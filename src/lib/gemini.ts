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
 * @returns The streaming result from Gemini.
 */
export async function streamChat(prompt: string) {
  const result = await geminiModel.generateContentStream(prompt);
  return result;
}
