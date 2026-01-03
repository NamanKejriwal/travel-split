import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GenerateBudgetRequest, BudgetBreakdown } from "@/types/ai-response";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const genAI = process.env.GOOGLE_API_KEY 
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) 
  : null;

const CATEGORIES = [
  "Food",
  "Local Transport", 
  "Travel",
  "Hostel / Hotel",
  "Shopping",
  "Activity",
  "Other"
] as const;

export async function POST(req: Request) {
  try {
    // === AUTHENTICATION ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // === PARSE REQUEST ===
    const body: GenerateBudgetRequest = await req.json();

    // === FALLBACK IF NO API KEY ===
    if (!genAI) {
      console.warn("⚠️ GOOGLE_API_KEY missing → Using smart fallback");
      return NextResponse.json(calculateSmartFallbackBudget(body));
    }

    // === BUILD INTELLIGENT PROMPT ===
    const prompt = buildBudgetPrompt(body);

    // === CALL GEMMA 3 MODEL ===
    const model = genAI.getGenerativeModel({ 
      model: "gemma-3-12b-it",
      generationConfig: {
        temperature: 0.5, // Lower temp for more consistent budgets
        maxOutputTokens: 512,
      }
    });

    console.log("🤖 Generating budget with AI...");
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    // === CLEAN & PARSE JSON ===
    const cleanedText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    console.log("📄 AI Budget Response:", cleanedText);

    // === SAFE JSON PARSING ===
    let budget: BudgetBreakdown;
    try {
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      budget = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError);
      return NextResponse.json(calculateSmartFallbackBudget(body));
    }

    // === VALIDATE & FIX BUDGET ===
    budget = validateAndFixBudget(budget, body.budgetPerPerson);

    // === SUCCESS ===
    console.log("✅ Budget Generated:", budget);
    return NextResponse.json(budget);

  } catch (error: any) {
    console.error("💥 Budget Generation Error:", error.message || error);
    
    // === GRACEFUL FALLBACK ===
    const body: GenerateBudgetRequest = await req.json();
    return NextResponse.json(calculateSmartFallbackBudget(body));
  }
}

// === INTELLIGENT BUDGET PROMPT ===
function buildBudgetPrompt(body: GenerateBudgetRequest): string {
  const destinations = body.destinations.map(d => d.name).join(", ");
  const tripType = body.tripType || "Leisure";
  const description = body.description || "General travel";

  return `
You are a LOCAL TRAVEL BUDGET EXPERT with deep knowledge of ${destinations}.

=== TRIP CONTEXT ===
Destinations: ${destinations}
Trip Type: ${tripType}
Duration: ${body.totalDays} days
Budget Per Person: ₹${body.budgetPerPerson}
Trip Description: ${description}

=== YOUR TASK ===
Create a REALISTIC daily budget breakdown for this trip.

Consider:
1. **Destination Cost Level**: Is ${destinations} expensive (Mumbai, Goa beach areas) or budget-friendly (Tier 2 cities)?
2. **Trip Type**: ${tripType}
   - Luxury: Higher hotel (40%), nicer food (25%)
   - Backpacking: Hostel budget (15%), street food (25%), more activities (20%)
   - Leisure/Adventure: Balanced
3. **Duration**: ${body.totalDays} days
   - Longer trips → lower daily hotel cost (weekly deals)
   - Shorter trips → more activities packed in

=== CATEGORY GUIDELINES (for Indian destinations) ===

**Food** (20-30%):
- Budget: ₹200-400/day (street food, local restaurants)
- Mid-range: ₹500-800/day (casual dining)
- Luxury: ₹1000+/day (fine dining)

**Local Transport** (5-15%):
- Budget: ₹100-200/day (buses, shared autos)
- Mid-range: ₹300-500/day (cabs, app-based rides)
- Luxury: ₹800+/day (private cars)

**Travel** (Inter-city) (10-20%):
- Depends on distance. Budget ₹500-3000 for major routes.

**Hostel / Hotel** (25-40%):
- Budget: ₹500-800/night (hostels, budget hotels)
- Mid-range: ₹1500-3000/night (3-star hotels)
- Luxury: ₹5000+/night (4-5 star resorts)

**Shopping** (5-10%):
- Souvenirs, essentials. Varies widely.

**Activity** (10-20%):
- Entry fees, tours, experiences.
- Beach/nature spots: ₹200-500/day
- Adventure activities: ₹1000-3000/activity

**Other** (5-10%):
- Emergency buffer, miscellaneous.

=== OUTPUT REQUIREMENTS ===

Return ONLY this JSON structure. NO explanations. NO markdown.

{
  "Food": 0,
  "Local Transport": 0,
  "Travel": 0,
  "Hostel / Hotel": 0,
  "Shopping": 0,
  "Activity": 0,
  "Other": 0
}

**CRITICAL RULES:**
1. Sum should be CLOSE to ₹${body.budgetPerPerson} (within ₹500)
2. All values MUST be positive integers
3. NO category should be 0 (minimum ₹100)
4. Be REALISTIC for ${destinations}
5. Consider ${tripType} preferences
`.trim();
}

// === VALIDATE & FIX BUDGET ===
function validateAndFixBudget(budget: Partial<BudgetBreakdown>, targetTotal: number): BudgetBreakdown {
  // Ensure all categories exist
  const fixedBudget: BudgetBreakdown = {
    "Food": Math.max(100, Math.round(budget["Food"] || 0)),
    "Local Transport": Math.max(100, Math.round(budget["Local Transport"] || 0)),
    "Travel": Math.max(100, Math.round(budget["Travel"] || 0)),
    "Hostel / Hotel": Math.max(100, Math.round(budget["Hostel / Hotel"] || 0)),
    "Shopping": Math.max(100, Math.round(budget["Shopping"] || 0)),
    "Activity": Math.max(100, Math.round(budget["Activity"] || 0)),
    "Other": Math.max(100, Math.round(budget["Other"] || 0)),
  };

  // Calculate current total
  const currentTotal = Object.values(fixedBudget).reduce((sum, val) => sum + val, 0);

  // If total is way off, scale proportionally
  if (Math.abs(currentTotal - targetTotal) > targetTotal * 0.2) {
    const scale = targetTotal / currentTotal;
    
    Object.keys(fixedBudget).forEach((key) => {
      fixedBudget[key as keyof BudgetBreakdown] = Math.max(
        100, 
        Math.round(fixedBudget[key as keyof BudgetBreakdown] * scale)
      );
    });
  }

  return fixedBudget;
}

// === SMART FALLBACK BUDGET ===
function calculateSmartFallbackBudget(body: GenerateBudgetRequest): BudgetBreakdown {
  const total = body.budgetPerPerson || 10000;
  const tripType = (body.tripType || "leisure").toLowerCase();
  const days = body.totalDays || 7;

  // Destination intelligence (basic heuristics)
  const destinationName = body.destinations[0]?.name.toLowerCase() || "";
  const isExpensive = 
    destinationName.includes("mumbai") ||
    destinationName.includes("goa") ||
    destinationName.includes("delhi") ||
    destinationName.includes("bangalore");

  // Base weights (balanced leisure trip)
  let weights = {
    food: 0.25,
    transport: 0.10,
    travel: 0.15,
    hotel: 0.30,
    shopping: 0.05,
    activity: 0.10,
    other: 0.05
  };

  // Adjust for trip type
  if (tripType.includes("luxury") || tripType.includes("premium")) {
    weights = {
      food: 0.20,
      transport: 0.08,
      travel: 0.12,
      hotel: 0.45,
      shopping: 0.05,
      activity: 0.05,
      other: 0.05
    };
  } else if (tripType.includes("backpack") || tripType.includes("budget")) {
    weights = {
      food: 0.25,
      transport: 0.15,
      travel: 0.20,
      hotel: 0.15,
      shopping: 0.02,
      activity: 0.18,
      other: 0.05
    };
  } else if (tripType.includes("adventure")) {
    weights = {
      food: 0.22,
      transport: 0.12,
      travel: 0.15,
      hotel: 0.25,
      shopping: 0.03,
      activity: 0.20,
      other: 0.03
    };
  }

  // Adjust for expensive destinations
  if (isExpensive) {
    weights.food *= 1.2;
    weights.hotel *= 1.3;
    weights.transport *= 1.15;
  }

  // Adjust for trip length (longer trips = lower daily hotel cost)
  if (days > 14) {
    weights.hotel *= 0.9;
    weights.activity *= 1.1;
  }

  // Normalize weights to sum to 1
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
  Object.keys(weights).forEach(key => {
    weights[key as keyof typeof weights] /= weightSum;
  });

  // Calculate budget
  const budget: BudgetBreakdown = {
    "Food": Math.round(total * weights.food),
    "Local Transport": Math.round(total * weights.transport),
    "Travel": Math.round(total * weights.travel),
    "Hostel / Hotel": Math.round(total * weights.hotel),
    "Shopping": Math.round(total * weights.shopping),
    "Activity": Math.round(total * weights.activity),
    "Other": Math.round(total * weights.other),
  };

  // Ensure no category is below 100
  Object.keys(budget).forEach(key => {
    if (budget[key as keyof BudgetBreakdown] < 100) {
      budget[key as keyof BudgetBreakdown] = 100;
    }
  });

  // Adjust total to match (distribute difference in largest category)
  const actualTotal = Object.values(budget).reduce((a, b) => a + b, 0);
  const diff = total - actualTotal;
  budget["Hostel / Hotel"] += diff; // Add/subtract from hotel (usually largest)

  return budget;
}