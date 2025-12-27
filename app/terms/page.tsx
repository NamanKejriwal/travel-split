import React from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-[#00A896] selection:text-white">
      <div className="container mx-auto max-w-3xl px-6 py-20">
        <Link href="/" className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-12">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold text-white mb-8 tracking-tight">Terms of Service</h1>
        <p className="text-sm text-zinc-500 mb-12 uppercase tracking-widest">Effective Date: December 2025</p>

        <section className="space-y-10">
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">1. Acceptable Use</h2>
            <p className="leading-relaxed">
              By using TravelSplit, you agree to provide accurate expense information. You are responsible for maintaining the security of your account and the groups you manage.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-4">2. Accuracy of Calculations</h2>
            <p className="leading-relaxed">
              While we strive for 100% accuracy in splitting logic, TravelSplit is a tool to assist in tracking. Final settlements remain the responsibility of the users involved.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-4">3. AI Service</h2>
            <p className="leading-relaxed">
              AI-generated budgeting advice is for informational purposes only. TravelSplit is not a licensed financial advisor.
            </p>
          </div>
        </section>

        <footer className="mt-20 pt-8 border-t border-white/5 text-xs text-zinc-600">
          &copy; 2025 TravelSplit Inc.
        </footer>
      </div>
    </div>
  )
}