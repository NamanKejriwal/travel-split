"use client"

import { Button } from "@/components/ui/button"
import { Plane, Users, Receipt, ArrowRight } from "lucide-react"

interface LandingViewProps {
  onGetStarted: () => void
}

export function LandingView({ onGetStarted }: LandingViewProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Hero Section */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        {/* Logo */}
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
          <Plane className="h-10 w-10 text-primary-foreground" />
        </div>

        {/* Title */}
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground">TravelSplit</h1>
        <p className="mb-8 max-w-xs text-lg text-muted-foreground">
          Split expenses with friends. No more awkward money talks.
        </p>

        {/* Feature Pills */}
        <div className="mb-10 flex flex-wrap justify-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-sm">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Group Expenses</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-sm">
            <Receipt className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Smart Splitting</span>
          </div>
        </div>

        {/* CTA Button */}
        <Button size="lg" className="h-14 w-full max-w-xs gap-2 text-base font-semibold" onClick={onGetStarted}>
          Get Started
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Footer */}
      <div className="pb-8 text-center">
        <p className="text-xs text-muted-foreground">Free to use. No credit card required.</p>
      </div>
    </div>
  )
}
