import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export const geminiModel = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash-preview-05-20" });

export async function streamChat(prompt: string) {
  const result = await geminiModel.generateContentStream(prompt);
  return result;
}
