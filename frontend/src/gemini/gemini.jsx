import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY_GEM = import.meta.env.VITE_REACT_APP_API_KEY;
const MODEL_NAME = "gemini-2.5-flash";

export async function runGeminiText(prompt) {
  if (!API_KEY_GEM) throw new Error("Missing VITE_REACT_APP_API_KEY");

  const genAI = new GoogleGenerativeAI(API_KEY_GEM);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const result = await model.generateContent(prompt);
  return result.response.text();
}
