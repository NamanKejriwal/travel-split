import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(model: any, prompt: string, retries = 3) {
  let waitTime = 1000; 

  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result; 
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      const isOverloaded = status === 503 || status === 500 || (error.message && error.message.includes('503'));

      if (isOverloaded) {
        if (i === retries - 1) throw error; 
        console.warn(`Gemini 503 Overloaded. Retrying in ${waitTime}ms (Attempt ${i + 1}/${retries})...`);
        await delay(waitTime);
        waitTime *= 2; 
      } else {
        throw error; 
      }
    }
  }
  throw new Error("Failed to generate content after retries");
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!data.aiEnabled) {
      return NextResponse.json({ message: "AI disabled" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });

    // New Prompt: Always return a tip, optionally return alerts
    const prompt = `
      You are a savvy travel budget assistant.
      
      TRIP CONTEXT:
      - Vibe: ${data.description}
      - Locations: ${JSON.stringify(data.destinations)}
      - Current Day: ${data.day} of ${data.totalDays}
      
      VIOLATIONS FOUND:
      ${JSON.stringify(data.violations || [])}
      
      TASK:
      1. ALWAYS Provide a "tip": A single, short, helpful sentence related to the trip context and current progress. If no violations, be encouraging (e.g. "Great pace! You have extra for dinner."). If violations exist, be constructive.
      2. If violations exist, provide specific "alerts" for each.
      
      OUTPUT JSON ONLY:
      {
        "tip": "Your helpful tip here.",
        "alerts": [
          {
            "category": "Food",
            "alert": "Spending 2x the daily limit.",
            "advice": "Eat street food tonight."
          }
        ] (optional if no violations)
      }
    `;

    const result = await generateWithRetry(model, prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI response did not contain valid JSON.");
    
    return NextResponse.json(JSON.parse(jsonMatch[0]));

  } catch (error) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}