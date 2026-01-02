
import { GoogleGenAI } from "@google/genai";
import { DayData, MinuteStatus } from "../types";

/**
 * Generates productivity insights using Gemini AI based on the provided daily logs.
 */
// Fix: Use the Google GenAI SDK to generate insights from user activity
export const generateInsights = async (dayData: DayData): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Calculate metrics for the prompt
    const productiveMinutes = dayData.minutes.filter(m => m === MinuteStatus.PRODUCTIVE).length;
    const unproductiveMinutes = dayData.minutes.filter(m => m === MinuteStatus.UNPRODUCTIVE).length;
    
    const prompt = `Review my productivity log for ${dayData.date}:
    - Productive minutes: ${productiveMinutes}
    - Unproductive minutes: ${unproductiveMinutes}
    
    Please provide 3 very brief, actionable tips to improve my efficiency for tomorrow. 
    Keep the response concise, encouraging, and under 100 words.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Fix: Access .text property directly as per SDK guidelines
    return response.text ?? "Insights currently unavailable.";
  } catch (error) {
    console.error("Gemini Insight Generation failed:", error);
    return "Unable to generate insights at this moment.";
  }
};
