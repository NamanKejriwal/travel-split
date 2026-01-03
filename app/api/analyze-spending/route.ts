//app/api/analyze-spending/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { AIResponse, AnalyzeSpendingRequest } from "@/types/ai-response";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const genAI = process.env.GOOGLE_API_KEY 
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) 
  : null;

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
    const body: AnalyzeSpendingRequest = await req.json();

    if (!body.aiEnabled) {
      return NextResponse.json({ 
        message: "AI disabled",
        tip: null,
        analysis: { financial_status: "Tracking", risk_level: "low", reasoning: "AI disabled" },
        forecast: { projection_comment: "Enable AI for insights" },
        alerts: []
      });
    }

    // === FALLBACK IF NO API KEY ===
    if (!genAI) {
      console.warn("⚠️ GOOGLE_API_KEY missing");
      return generateFallbackResponse(body);
    }

    // === CALCULATE FINANCIAL INTELLIGENCE ===
    const intelligence = calculateFinancialIntelligence(body);

    // === BUILD ULTRA-SMART PROMPT ===
    const prompt = buildIntelligentPrompt(body, intelligence);

    // === CALL GEMMA 3 MODEL ===
    const model = genAI.getGenerativeModel({ 
      model: "gemma-3-12b-it",
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 256,
      }
    });

    console.log("🤖 Sending prompt to AI...");
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    // === CLEAN & PARSE JSON ===
    const cleanedText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .replace(/^\s*[\r\n]/gm, "")
      .trim();

    console.log("📄 AI Response (cleaned):", cleanedText.substring(0, 200));

    // === SAFE JSON PARSING ===
    let aiResponse: AIResponse;
    try {
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      aiResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError);
      console.error("Raw AI output:", cleanedText);
      return generateFallbackResponse(body);
    }

    // === VALIDATE RESPONSE STRUCTURE ===
    if (!aiResponse.tip || !aiResponse.analysis || !aiResponse.forecast || !Array.isArray(aiResponse.alerts)) {
      console.error("❌ Invalid AI response structure");
      return generateFallbackResponse(body);
    }

    // === VALIDATE ALERT CATEGORIES ===
    const validCategories = ["Food", "Local Transport", "Travel", "Hostel / Hotel", "Shopping", "Activity", "Other"];
    aiResponse.alerts = aiResponse.alerts.filter(alert => 
      validCategories.includes(alert.category)
    );

    // === SUCCESS ===
    console.log("✅ AI Analysis Complete");
    return NextResponse.json(aiResponse);

  } catch (error: any) {
    console.error("💥 AI Engine Error:", error.message || error);
    
    // === GRACEFUL FALLBACK ===
    return NextResponse.json({
      tip: "Expense saved. AI is temporarily unavailable.",
      analysis: {
        financial_status: "Tracking",
        risk_level: "low",
        reasoning: "AI service unavailable"
      },
      forecast: {
        projection_comment: "Continue tracking expenses"
      },
      alerts: []
    });
  }
}

// === FINANCIAL INTELLIGENCE CALCULATOR ===
function calculateFinancialIntelligence(body: AnalyzeSpendingRequest) {
  const {
    totalDays,
    currentDay,
    budgetTotal,
    totalSpentSoFar,
    recentExpenses,
    currentExpense
  } = body;

  // Burn Rate (daily spending)
  const burnRate = currentDay > 0 ? totalSpentSoFar / currentDay : 0;
  
  // Expected Pace (what should have spent by now)
  const expectedPace = (budgetTotal / totalDays) * currentDay;
  
  // Pace Variance (ahead or behind)
  const paceVariance = totalSpentSoFar - expectedPace;
  const paceVariancePercent = expectedPace > 0 ? (paceVariance / expectedPace) * 100 : 0;

  // Days Remaining
  const daysRemaining = totalDays - currentDay;

  // Projected Total Spend (if continues at current rate)
  const projectedTotalSpend = burnRate * totalDays;

  // Predicted Overspend
  const predictedOverspend = Math.max(0, projectedTotalSpend - budgetTotal);

  // Days Until Broke (if overspending)
  const remainingBudget = budgetTotal - totalSpentSoFar;
  const daysUntilBroke = burnRate > 0 && remainingBudget > 0 
    ? Math.floor(remainingBudget / burnRate)
    : daysRemaining;

  // Can Recover?
  const canRecover = daysRemaining > 0 && projectedTotalSpend <= budgetTotal * 1.1;

  // Trip Phase
  const tripPhase = currentDay <= totalDays * 0.3 
    ? "early" 
    : currentDay >= totalDays * 0.7 
    ? "late" 
    : "mid";

  // Spending Velocity (last 3 expenses vs average)
  const recentAvg = recentExpenses.length > 0
    ? recentExpenses.slice(0, 3).reduce((sum, e) => sum + e.amount, 0) / Math.min(3, recentExpenses.length)
    : 0;
  const overallAvg = totalSpentSoFar / Math.max(1, currentDay);
  const isAccelerating = recentAvg > overallAvg * 1.2;

  return {
    burnRate,
    expectedPace,
    paceVariance,
    paceVariancePercent,
    daysRemaining,
    projectedTotalSpend,
    predictedOverspend,
    daysUntilBroke,
    canRecover,
    tripPhase,
    isAccelerating,
    recentAvg,
    overallAvg
  };
}

// === INTELLIGENT PROMPT BUILDER ===
function buildIntelligentPrompt(body: AnalyzeSpendingRequest, intel: ReturnType<typeof calculateFinancialIntelligence>): string {
  const location = body.destinations[0]?.name || "Unknown";
  const tripType = body.tripType || "Leisure";
  
  return `
You are an ELITE Travel Financial Advisor with deep local knowledge of ${location}.

=== TRIP CONTEXT ===
Location: ${location}
Trip Type: ${tripType}
Trip Description: ${body.description || "Not provided"}
Total Duration: ${body.totalDays} days
Current Day: ${body.currentDay} (${intel.tripPhase} phase)
Days Remaining: ${intel.daysRemaining}

=== FINANCIAL REALITY ===
Total Budget: ₹${body.budgetTotal}
Spent So Far: ₹${body.totalSpentSoFar.toFixed(0)}
Budget Remaining: ₹${(body.budgetTotal - body.totalSpentSoFar).toFixed(0)}

Burn Rate: ₹${intel.burnRate.toFixed(0)}/day
Expected Pace: ₹${intel.expectedPace.toFixed(0)} (should have spent by now)
Actual Pace: ${intel.paceVariance > 0 ? "OVERSPENDING" : "UNDERSPENDING"} by ₹${Math.abs(intel.paceVariance).toFixed(0)} (${Math.abs(intel.paceVariancePercent).toFixed(0)}%)

=== CURRENT EXPENSE BEING ADDED ===
Item: "${body.currentExpense.description}"
Amount: ₹${body.currentExpense.amount}
Category: ${body.currentExpense.category}

=== SPENDING HISTORY (Last 5 Expenses) ===
${body.recentExpenses.map((e, i) => `${i + 1}. ${e.description} - ₹${e.amount} (${e.category})`).join('\n')}

=== BEHAVIORAL PATTERNS DETECTED ===
${intel.isAccelerating ? `⚠️ ACCELERATION DETECTED: Recent expenses (₹${intel.recentAvg.toFixed(0)}) are 20%+ higher than earlier average (₹${intel.overallAvg.toFixed(0)})` : "Spending velocity stable"}

=== FORECAST ===
If Current Burn Rate Continues:
- Projected Total Spend: ₹${intel.projectedTotalSpend.toFixed(0)}
- Predicted Overspend: ₹${intel.predictedOverspend.toFixed(0)}
- Days Until Broke: ${intel.daysUntilBroke} days
- Can Recover: ${intel.canRecover ? "YES" : "NO"}

=== YOUR MISSION ===

1. PRICE REALITY CHECK:
   - Is ₹${body.currentExpense.amount} for "${body.currentExpense.description}" reasonable for ${location}?
   - Consider: ${tripType} trip vibes, local standards, tourist trap potential
   - If OVERPAYING by 50%+: CRITICAL alert
   - If FAIR: INFO level
   - If GREAT DEAL: INFO level with praise

2. FINANCIAL HEALTH ANALYSIS:
   - Given current burn rate and days remaining, assess risk
   - Consider trip phase: 
     * Early overspend = CRITICAL (sets bad precedent)
     * Mid-trip overspend = WARNING (still correctable)
     * Late-trip overspend = INFO (trip ending anyway)

3. BEHAVIORAL INTELLIGENCE:
   - Detect patterns: impulsive spending? luxury creep? panic underspending?
   - Provide corrective nudges WITHOUT nagging

4. FORECASTING:
   - Predict outcome if continues current pace
   - State if recovery is possible
   - Quantify risk

5. ALERTS (by category):
   - Only create alerts for categories with real violations or concerns
   - Severity: "critical" (>30% over), "warning" (10-30% over), "info" (tips/praise)

=== OUTPUT REQUIREMENTS ===

STRICT JSON ONLY. NO MARKDOWN. NO EXTRA TEXT.

{
  "tip": "One powerful sentence. Max 120 characters. Actionable advice.",
  "analysis": {
    "financial_status": "Brief status (30 words max)",
    "risk_level": "low" | "medium" | "high",
    "reasoning": "Explain the situation clearly (50 words max)",
    "burn_rate": "₹X/day description",
    "pace_analysis": "On track | Ahead by X% | Behind by Y%"
  },
  "forecast": {
    "projection_comment": "What happens if continues current pace (40 words max)",
    "predicted_overspend": ${intel.predictedOverspend > 0 ? intel.predictedOverspend.toFixed(0) : 0},
    "days_until_broke": ${intel.daysUntilBroke},
    "can_recover": ${intel.canRecover}
  },
  "alerts": [
    {
      "category": "Must be one of: Food | Local Transport | Travel | Hostel / Hotel | Shopping | Activity | Other",
      "severity": "info" | "warning" | "critical",
      "message": "Clear problem statement (30 words max)",
      "advice": "Specific corrective action (30 words max)"
    }
  ]
}

CRITICAL RULES:
- If no alerts needed → alerts: []
- NEVER hallucinate category names
- Keep all text concise and actionable
- NO emojis in JSON
- NO markdown formatting
- Consider ${location}'s cost of living realistically
- Consider trip phase (${intel.tripPhase}) when assessing severity
`.trim();
}

// === FALLBACK RESPONSE GENERATOR ===
function generateFallbackResponse(body: AnalyzeSpendingRequest): NextResponse {
  const intel = calculateFinancialIntelligence(body);
  
  let tip = "Expense tracked.";
  let riskLevel: "low" | "medium" | "high" = "low";
  const alerts: any[] = [];

  // Simple rule-based fallback
  if (intel.paceVariancePercent > 30) {
    riskLevel = "high";
    tip = "⚠️ Spending 30%+ above pace. Slow down to avoid budget overshoot.";
    
    alerts.push({
      category: body.currentExpense.category,
      severity: "warning",
      message: "Overspending detected in this category",
      advice: "Review recent expenses and cut back"
    });
  } else if (intel.paceVariancePercent > 10) {
    riskLevel = "medium";
    tip = "Slightly over budget pace. Monitor spending closely.";
  } else if (body.currentExpense.amount > intel.burnRate * 2) {
    tip = "⚠️ This expense is 2x your daily average. Large purchases add up.";
  }

  return NextResponse.json({
    tip,
    analysis: {
      financial_status: `Spent ₹${body.totalSpentSoFar.toFixed(0)} of ₹${body.budgetTotal}`,
      risk_level: riskLevel,
      reasoning: "AI unavailable. Basic tracking active.",
      burn_rate: `₹${intel.burnRate.toFixed(0)}/day`,
      pace_analysis: intel.paceVariance > 0 
        ? `Ahead by ${Math.abs(intel.paceVariancePercent).toFixed(0)}%`
        : `On track`
    },
    forecast: {
      projection_comment: intel.predictedOverspend > 0
        ? `May exceed budget by ₹${intel.predictedOverspend.toFixed(0)} if pace continues`
        : "On track to stay within budget",
      predicted_overspend: intel.predictedOverspend,
      days_until_broke: intel.daysUntilBroke,
      can_recover: intel.canRecover
    },
    alerts
  });
}