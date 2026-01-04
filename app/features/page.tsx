import React from "react"
import { ArrowLeft, Zap, Brain, TrendingUp, Search } from "lucide-react"
import Link from "next/link"

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-[#00A896] selection:text-white">
      <div className="container mx-auto max-w-4xl px-6 py-20">
        <Link href="/" className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-12">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>
        
        <h1 className="text-5xl font-black text-white mb-6 tracking-tighter">Premium Features</h1>
        <p className="text-lg text-zinc-400 mb-16 max-w-2xl leading-relaxed">
          TravelSplit isn't just a calculator. It's a complete financial operating system designed for modern group travel.
        </p>

        <div className="grid gap-12">
          {/* Feature 1 */}
          <div className="p-8 rounded-3xl bg-[#0a0a0a] border border-white/10 flex flex-col md:flex-row gap-8 items-start">
            <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500">
              <Brain className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">AI Financial Companion</h2>
              <p className="leading-relaxed text-zinc-400">
                Our proprietary AI engine analyzes your spending patterns in real-time. It detects budget overruns before they happen and suggests actionable tips to save money based on local data (e.g., "Take the metro instead of Uber to save ₹500").
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="p-8 rounded-3xl bg-[#0a0a0a] border border-white/10 flex flex-col md:flex-row gap-8 items-start">
            <div className="p-4 bg-[#00A896]/10 rounded-2xl text-[#00A896]">
              <Zap className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Accurate Settlement Algorithm</h2>
              <p className="leading-relaxed text-zinc-400">
                Forget complex math. Our graph-based algorithm minimizes the total number of transactions needed to settle up. If A owes B, and B owes C, the system simply tells A to pay C directly.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="p-8 rounded-3xl bg-[#0a0a0a] border border-white/10 flex flex-col md:flex-row gap-8 items-start">
            <div className="p-4 bg-purple-500/10 rounded-2xl text-purple-500">
              <TrendingUp className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Visual Analytics</h2>
              <p className="leading-relaxed text-zinc-400">
                Visualize your trip's financial health. Track your daily burn rate, see a category-wise breakdown of expenses, and understand your personal net balance with interactive charts.
              </p>
            </div>
          </div>

           {/* Feature 4 */}
           <div className="p-8 rounded-3xl bg-[#0a0a0a] border border-white/10 flex flex-col md:flex-row gap-8 items-start">
            <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-500">
              <Search className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Universal Search</h2>
              <p className="leading-relaxed text-zinc-400">
                Instantly locate any expense, settlement, or person across all your trips. Just type "Dinner" or "Taxi" and find the exact record in milliseconds.
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-20 pt-8 border-t border-white/5 text-xs text-zinc-600">
          © 2025 TravelSplit Inc.
        </footer>
      </div>
    </div>
  )
}