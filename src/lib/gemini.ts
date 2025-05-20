import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export const geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });

export async function streamChat(prompt: string) {
  const result = await geminiModel.generateContentStream(prompt);
  return result;
}
