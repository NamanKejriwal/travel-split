import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    // 1. Initialize Model with Search & Safety
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      tools: [{ googleSearch: {} } as any],
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });

    const categories = ["Food", "Local Transport", "Travel", "Hostel / Hotel", "Shopping", "Activity", "Other"];

    // 2. The "Strict Auditor" Prompt
    const prompt = `
      You are a specialized Travel Budget Architect. You DO NOT guess. You RESEARCH.
      
      TRIP DOSSIER:
      - Destinations: ${JSON.stringify(data.destinations)}
      - Description/Vibe: "${data.description}" (Use this to determine if they need Hostels or 5-Star Hotels)
      - Duration: ${data.totalDays} days
      - Total Budget: ${data.budgetPerPerson} INR (Indian Rupees)
      
      PHASE 1: MARKET RATE INVESTIGATION (Use Google Search)
      Perform searches to find the *current* realistic baseline costs in ${data.destinations?.[0]?.name}:
      1. "Average price of ${data.tripType} accommodation in ${data.destinations?.[0]?.name} per night"
      2. "Cost of street food vs restaurant meal in ${data.destinations?.[0]?.name}"
      3. "Daily scooter rental / taxi rates in ${data.destinations?.[0]?.name}"
      4. "Entry fees for popular tourist spots in ${data.destinations?.[0]?.name}"

      PHASE 2: REALISTIC ALLOCATION
      - Calculate the *Minimum Viable Daily Cost* based on your research.
      - If (Minimum Cost * Days) > Total Budget:
         -> WARN mode. Allocate 90% to essentials (Food, Stay, Travel). Set Shopping/Activity to near ZERO.
      - If Budget is healthy:
         -> Allocate comfortably based on the "Vibe" (e.g. if "Foodie", boost Food limit).
      
      PHASE 3: JSON GENERATION
      - Create strict upper limits for: ${categories.join(", ")}.
      - The sum of these limits MUST equal ${data.budgetPerPerson}.
      
      OUTPUT VALID JSON ONLY. NO MARKDOWN.
      Format: { "Food": 1500, "Travel": 5000, ... }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Invalid AI Response:", text);
      throw new Error("AI did not return valid JSON");
    }
    
    return NextResponse.json(JSON.parse(jsonMatch[0]));

  } catch (error) {
    console.error("Budget Gen Error:", error);
    return NextResponse.json({ error: "Failed to generate limits" }, { status: 500 });
  }
}