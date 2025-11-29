"use client"

import { TrendingUp, TrendingDown, Wallet } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function SummaryCard() {
  const totalCost = 2458.5
  const myShare = 614.63
  const netBalance = 125.37

  return (
    <Card className="overflow-hidden border-0 bg-card shadow-lg">
      <CardContent className="p-0">
        <div className="bg-primary px-5 py-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary-foreground/80" />
            <span className="text-sm font-medium text-primary-foreground/80">Bali Trip 2024</span>
          </div>
          <p className="mt-3 text-4xl font-bold tracking-tight text-primary-foreground">
            ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-sm text-primary-foreground/70">Total Trip Expenses</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">My Share</p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">
              ${myShare.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Net Balance</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              {netBalance >= 0 ? (
                <>
                  <TrendingUp className="h-5 w-5 text-success" />
                  <span className="text-2xl font-bold text-success">
                    +${netBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  <span className="text-2xl font-bold text-destructive">
                    -${Math.abs(netBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{netBalance >= 0 ? "You are owed" : "You owe"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
