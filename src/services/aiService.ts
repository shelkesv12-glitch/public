import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function analyzeCivicIssue(imageBase64: string) {
  const prompt = `
    Analyze this photo for a civic issue (e.g., pothole, garbage, water leakage, broken street light, blocked drainage).
    
    If no civic issue is found, indicate that clearly.
  `;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBase64.split(",")[1] || imageBase64,
                mimeType: "image/jpeg",
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            found: { type: Type.BOOLEAN },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { 
              type: Type.STRING,
              description: "One of: pothole, garbage, water_leakage, drainage, other"
            },
            severity: { 
              type: Type.STRING,
              description: "One of: low, medium, high, critical"
            },
            recommendedAction: { type: Type.STRING }
          },
          required: ["found", "title", "description", "category", "severity"]
        }
      }
    });

    const text = result.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return {
      found: false,
      error: "Failed to analyze image"
    };
  }
}
