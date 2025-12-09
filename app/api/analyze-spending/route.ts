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
    if (!data.aiEnabled) return NextResponse.json({ message: "AI disabled" });

    // FIX: Use Gemma 3 12B IT (High Rate Limit: ~14k requests/day)
    // NOTE: We REMOVED the 'tools' array because Gemma does not support Google Search.
    const model = genAI.getGenerativeModel({ 
      model: "gemma-3-12b-it", 
    });

    const prompt = `
      You are an objective Travel Expense Auditor.
      
      CONTEXT:
      - Location: ${data.destinations?.[0]?.name || "Unknown"}
      - Vibe: ${data.description}
      - Currency: INR (₹)
      
      EXPENSE: "${data.currentExpense?.description}" for ₹${data.currentExpense?.amount} (${data.currentExpense?.category})
      
      MATH VIOLATIONS: ${JSON.stringify(data.violations || [])}
      
      TASK:
      1. ESTIMATE PRICE: Based on your general knowledge of ${data.destinations?.[0]?.name}, is this expense reasonable?
      2. TIP: Warn if it seems significantly higher than average. Praise if it seems like a good deal. Always mention if a Math Violation exists.
      3. ALERTS: If "MATH VIOLATIONS" is not empty, you MUST return an alert for that category. Do not clear it unless the violation is resolved.
      
      OUTPUT JSON ONLY (No Markdown):
      {
        "tip": "⚠️ You paid ₹2000, which is high for this city (avg ~₹800). Budget critical.",
        "alerts": [{ "category": "Food", "alert": "Over daily limit.", "advice": "Eat cheaper." }]
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up potential Markdown formatting (Gemma sometimes adds ```json)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error("Invalid JSON from AI");
    
    return NextResponse.json(JSON.parse(jsonMatch[0]));

  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({ tip: "Expense saved. (AI busy)", alerts: [] });
  }
}