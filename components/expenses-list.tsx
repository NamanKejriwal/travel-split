"use client"

import type React from "react"

import { Utensils, Car, Home, Plane, ShoppingBag, Ticket, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const categoryIcons: Record<string, React.ElementType> = {
  food: Utensils,
  transport: Car,
  accommodation: Home,
  flights: Plane,
  shopping: ShoppingBag,
  activities: Ticket,
}

const categoryColors: Record<string, string> = {
  food: "bg-orange-100 text-orange-600",
  transport: "bg-blue-100 text-blue-600",
  accommodation: "bg-emerald-100 text-emerald-600",
  flights: "bg-sky-100 text-sky-600",
  shopping: "bg-pink-100 text-pink-600",
  activities: "bg-amber-100 text-amber-600",
}

const expenses = [
  {
    id: 1,
    date: "Nov 28",
    description: "Beach Club Dinner",
    category: "food",
    payer: "You",
    amount: 185.0,
    splitBetween: 4,
  },
  {
    id: 2,
    date: "Nov 27",
    description: "Scooter Rentals",
    category: "transport",
    payer: "Mike",
    amount: 120.0,
    splitBetween: 4,
  },
  {
    id: 3,
    date: "Nov 27",
    description: "Villa Accommodation",
    category: "accommodation",
    payer: "Sarah",
    amount: 850.0,
    splitBetween: 4,
  },
  {
    id: 4,
    date: "Nov 26",
    description: "Temple Tour Entry",
    category: "activities",
    payer: "Emma",
    amount: 80.0,
    splitBetween: 4,
  },
  {
    id: 5,
    date: "Nov 26",
    description: "Souvenir Shopping",
    category: "shopping",
    payer: "You",
    amount: 65.5,
    splitBetween: 2,
  },
  {
    id: 6,
    date: "Nov 25",
    description: "Airport Transfer",
    category: "transport",
    payer: "Jake",
    amount: 45.0,
    splitBetween: 4,
  },
]

export function ExpensesList() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Recent Expenses</h2>
        <button className="text-xs font-medium text-primary">View All</button>
      </div>

      <div className="space-y-2">
        {expenses.map((expense) => {
          const Icon = categoryIcons[expense.category] || Utensils
          const colorClass = categoryColors[expense.category] || categoryColors.food

          return (
            <Card
              key={expense.id}
              className="flex items-center gap-3 border-0 bg-card p-3 shadow-sm transition-colors active:bg-muted/50"
            >
              {/* Category Icon */}
              <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl", colorClass)}>
                <Icon className="h-5 w-5" />
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{expense.description}</p>
                <p className="text-xs text-muted-foreground">
                  {expense.date} • Paid by {expense.payer}
                </p>
              </div>

              {/* Amount */}
              <div className="flex flex-shrink-0 items-center gap-1">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">${expense.amount.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">÷{expense.splitBetween}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
