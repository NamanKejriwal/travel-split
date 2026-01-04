import React from "react"
import { ArrowLeft, Shield, Lock, Server, EyeOff } from "lucide-react"
import Link from "next/link"

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-[#00A896] selection:text-white">
      <div className="container mx-auto max-w-3xl px-6 py-20">
        <Link href="/" className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-12">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold text-white mb-8 tracking-tight">Security & Privacy</h1>
        <p className="text-sm text-zinc-500 mb-12 uppercase tracking-widest">Last Updated: December 2025</p>

        <section className="space-y-12">
          
          {/* Section 1 */}
          <div>
            <div className="flex items-center gap-3 mb-4 text-white">
               <Shield className="h-6 w-6 text-[#00A896]" />
               <h2 className="text-xl font-semibold">Bank-Grade Encryption</h2>
            </div>
            <p className="leading-relaxed pl-9 border-l border-white/10">
              All data transmitted between your device and our servers is encrypted using TLS 1.3 (Transport Layer Security). Your financial records are encrypted at rest in our database using industry-standard AES-256 encryption.
            </p>
          </div>

          {/* Section 2 */}
          <div>
            <div className="flex items-center gap-3 mb-4 text-white">
               <Lock className="h-6 w-6 text-[#00A896]" />
               <h2 className="text-xl font-semibold">Row Level Security (RLS)</h2>
            </div>
            <p className="leading-relaxed pl-9 border-l border-white/10">
              We utilize Supabase's rigorous Row Level Security policies. This means that the database itself enforces access control. Even if our application logic were to fail, the database would reject any unauthorized query. Only you can access your data.
            </p>
          </div>

          {/* Section 3 */}
          <div>
            <div className="flex items-center gap-3 mb-4 text-white">
               <Server className="h-6 w-6 text-[#00A896]" />
               <h2 className="text-xl font-semibold">Infrastructure</h2>
            </div>
            <p className="leading-relaxed pl-9 border-l border-white/10">
              Our infrastructure is hosted on AWS (Amazon Web Services), providing world-class physical security, power redundancy, and network protection against DDoS attacks.
            </p>
          </div>

          {/* Section 4 */}
          <div>
            <div className="flex items-center gap-3 mb-4 text-white">
               <EyeOff className="h-6 w-6 text-[#00A896]" />
               <h2 className="text-xl font-semibold">Data Privacy</h2>
            </div>
            <p className="leading-relaxed pl-9 border-l border-white/10">
              We do not sell your personal data to third parties. Your spending habits are analyzed by our AI solely to provide you with insights and are never shared with advertisers.
            </p>
          </div>

        </section>

        <footer className="mt-20 pt-8 border-t border-white/5 text-xs text-zinc-600">
          Security Contact: security@travelsplit.com
        </footer>
      </div>
    </div>
  )
}