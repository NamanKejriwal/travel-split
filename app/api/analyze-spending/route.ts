import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
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
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    if (!data.aiEnabled) {
      return NextResponse.json({ message: "AI disabled" });
    }

    // 1. Configure Model with 2.5 Flash + Search + Safety Settings
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

    // 2. "Investigative Auditor" Prompt
    const prompt = `
      You are an objective Travel Expense Auditor.
      
      CONTEXT:
      - Location: ${data.destinations?.[0]?.name || "Unknown"}
      - Vibe: ${data.description}
      - Currency: INR (₹)
      
      THE EXPENSE TO AUDIT:
      Item: "${data.currentExpense?.description}"
      Category: ${data.currentExpense?.category}
      User Paid: ₹${data.currentExpense?.amount}
      
      BUDGET HEALTH (Math):
      ${JSON.stringify(data.violations || [])}
      
      ---
      
      TASK 1: PRICE VERIFICATION (Use Google Search)
      - Search for the *actual* current price of "${data.currentExpense?.description}" in ${data.destinations?.[0]?.name}.
      - Compare: [User Paid] vs [Real Market Price].
      
      TASK 2: GENERATE TIP (Max 20 words)
      - If User Paid > Market Price (+20%): WARN. "⚠️ You overpaid! Average price is ₹[Market Price]."
      - If User Paid ≈ Market Price: VALIDATE. "✅ Fair price."
      - If User Paid < Market Price: PRAISE. "🎉 Great deal! You saved money."
      - *Crucial:* If the math shows a "Limit Exceeded" violation, mention it regardless of the price fairness.
      
      TASK 3: GENERATE ALERTS
      - If the "MATH VIOLATIONS" list is not empty, you MUST return an alert for that category.
      - **Exception:** If the category is 'Travel' or 'Hotel' AND your Google Search proves the price is standard for a lump-sum booking, you may suppress the "Pace" alert. But NEVER suppress a "Total Budget Limit" alert.
      
      ---
      
      OUTPUT VALID JSON ONLY. NO MARKDOWN.
      Format:
      {
        "tip": "⚠️ You paid ₹2000, but locals pay ₹800. Negotiate next time!",
        "alerts": [
          {
            "category": "Food",
            "alert": "Food budget critical.",
            "advice": "Stick to street food (avg ₹150/meal) to recover."
          }
        ]
      }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI response did not contain valid JSON.");
        
        return NextResponse.json(JSON.parse(jsonMatch[0]));

    } catch (aiError: any) {
        console.error("AI Generation/Parsing failed:", aiError);
        // Fallback to prevent crash
        return NextResponse.json({
            tip: "Expense recorded. (AI verification unavailable)",
            alerts: [] 
        });
    }

  } catch (error) {
    console.error("Critical Server Error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 }); 
  }
}