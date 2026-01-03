export type Severity = "info" | "warning" | "critical";

export interface AIAlert {
  category: string;
  severity: Severity;
  message: string;
  advice: string;
}

export interface AIAnalysis {
  financial_status: string;
  risk_level: "low" | "medium" | "high";
  reasoning: string;
  burn_rate?: string; // NEW: Daily spending rate
  pace_analysis?: string; // NEW: On track / ahead / behind
}

export interface AIForecast {
  projection_comment: string;
  predicted_overspend?: number; // NEW: How much over budget if continues
  days_until_broke?: number; // NEW: When money runs out
  can_recover?: boolean; // NEW: Is recovery possible
}

export interface AIResponse {
  tip: string | null;
  analysis: AIAnalysis;
  forecast: AIForecast;
  alerts: AIAlert[];
}

// NEW: Request payload type
export interface AnalyzeSpendingRequest {
  tripType: string;
  destinations: Array<{ name: string }>;
  description: string;
  totalDays: number;
  currentDay: number;
  budgetTotal: number;
  totalSpentSoFar: number;
  recentExpenses: Array<{
    description: string;
    amount: number;
    category: string;
  }>;
  currentExpense: {
    description: string;
    amount: number;
    category: string;
  };
  aiEnabled: boolean;
  categoryLimits?: Record<string, number>; // NEW: Category budgets
}

// NEW: Budget generation request
export interface GenerateBudgetRequest {
  tripType: string;
  destinations: Array<{ name: string; country?: string }>;
  budgetPerPerson: number;
  totalDays: number;
  description?: string;
}

// Budget response type
export interface BudgetBreakdown {
  "Food": number;
  "Local Transport": number;
  "Travel": number;
  "Hostel / Hotel": number;
  "Shopping": number;
  "Activity": number;
  "Other": number;
}