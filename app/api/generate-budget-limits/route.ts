import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const data = await req.json();
    // Use flash model if available for speed, otherwise preview
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });

    const categories = ["Food", "Local Transport", "Travel", "Hostel / Hotel", "Shopping", "Activity", "Other"];

    const prompt = `
      You are a travel budget architect.
      
      TRIP CONTEXT:
      - Destination: ${JSON.stringify(data.destinations)}
      - Description/Vibe: ${data.description}
      - Budget Per Person: ${data.budgetPerPerson}
      - Trip Type: ${data.tripType}
      - Duration: ${data.totalDays} days
      
      TASK:
      Distribute the "Budget Per Person" into STRICT upper limits for categories: ${categories.join(", ")}.
      
      OUTPUT JSON ONLY. Format: { "Food": 1000, "Travel": 2000 }
    `;

    // Retry Logic
    let result;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        result = await model.generateContent(prompt);
        break; 
      } catch (error: any) {
        if (error.status === 503 || (error.message && error.message.includes('503'))) {
          console.warn(`Gemini API 503. Retrying ${retryCount + 1}/${maxRetries}...`);
          retryCount++;
          if (retryCount === maxRetries) throw error;
          await delay(1000 * Math.pow(2, retryCount - 1));
        } else {
          throw error;
        }
      }
    }

    if (!result) throw new Error("Failed to get AI response");

    const response = await result.response;
    const text = response.text();
    
    // ROBUST PARSING: Extract JSON object using Regex
    // This fixes issues where AI says "Here is your JSON: { ... }"
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Invalid AI Response:", text);
      throw new Error("AI did not return valid JSON");
    }
    
    const cleanJson = jsonMatch[0];
    return NextResponse.json(JSON.parse(cleanJson));

  } catch (error) {
    console.error("Budget Gen Error:", error);
    return NextResponse.json({ error: "Failed to generate limits" }, { status: 500 });
  }
}