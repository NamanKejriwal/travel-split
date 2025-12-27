import React from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-[#00A896] selection:text-white">
      <div className="container mx-auto max-w-3xl px-6 py-20">
        <Link href="/" className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-12">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold text-white mb-8 tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-zinc-500 mb-12 uppercase tracking-widest">Last Updated: December 2025</p>

        <section className="space-y-10">
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">1. Data Collection</h2>
            <p className="leading-relaxed">
              TravelSplit collects information you provide directly to us when you create an account, log expenses, and create groups. This includes your name, email, and spending data.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-4">2. AI Analysis</h2>
            <p className="leading-relaxed">
              Our AI insights feature processes your expense descriptions to categorize spending and provide budget advice. This data is processed securely and is never sold to third parties.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-4">3. Security</h2>
            <p className="leading-relaxed">
              We use industry-standard encryption to protect your data. Your financial records are stored securely via Supabase with strict row-level security policies.
            </p>
          </div>
        </section>

        <footer className="mt-20 pt-8 border-t border-white/5 text-xs text-zinc-600">
          Contact: tripsplit8@gmail.com
        </footer>
      </div>
    </div>
  )
}