import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await req.json();
    
    // FIX: Use Gemma 3 12B IT (High Rate Limit)
    // Removed 'tools' (Google Search) as it is not supported on Gemma
    const model = genAI.getGenerativeModel({ 
      model: "gemma-3-12b-it", 
    });

    const categories = ["Food", "Local Transport", "Travel", "Hostel / Hotel", "Shopping", "Activity", "Other"];

    const prompt = `
      You are a Travel Budget Architect.
      TRIP: ${JSON.stringify(data.destinations)}, Vibe: ${data.description}, Budget: ${data.budgetPerPerson} INR, Days: ${data.totalDays}.
      
      TASK: Estimate realistic costs for this trip based on your knowledge of the location.
      Calculate specific limits for: ${categories.join(", ")}.
      If budget is tight, prioritize Hotel/Travel.
      
      OUTPUT JSON ONLY (No Markdown): 
      { "Food": 1500, "Travel": 5000, ... }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error("Invalid JSON");
    return NextResponse.json(JSON.parse(jsonMatch[0]));

  } catch (error) {
    console.error("Budget Gen Error:", error);
    // Fallback: simple math split
    const total = (await req.json()).budgetPerPerson || 10000;
    return NextResponse.json({ "Food": total*0.3, "Travel": total*0.2, "Hostel / Hotel": total*0.3, "Other": total*0.2 });
  }
}