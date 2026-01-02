
import { GoogleGenAI, Type } from "@google/genai";
import { DayData, MinuteStatus, GeminiInsight } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateInsights = async (dayData: DayData): Promise<GeminiInsight> => {
  const productiveCount = dayData.minutes.filter(m => m === MinuteStatus.PRODUCTIVE).length;
  const unproductiveCount = dayData.minutes.filter(m => m === MinuteStatus.UNPRODUCTIVE).length;

  const prompt = `
    Analyze this daily productivity data:
    - Total productive minutes: ${productiveCount}
    - Total unproductive minutes: ${unproductiveCount}
    - Date: ${dayData.date}

    The data represents every single minute of the day. 
    Please provide a concise summary, specific recommendations for improvement, and a trend analysis.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            productivityTrend: { type: Type.STRING }
          },
          required: ["summary", "recommendations", "productivityTrend"]
        }
      }
    });

    // The text property directly returns the string output. Handle potential undefined safely.
    const jsonStr = response.text?.trim() || "{}";
    return JSON.parse(jsonStr) as GeminiInsight;
  } catch (error) {
    console.error("Error generating insights:", error);
    return {
      summary: "Could not generate AI insights at this time.",
      recommendations: ["Ensure your API key is configured correctly.", "Check your internet connection."],
      productivityTrend: "Unknown"
    };
  }
};
