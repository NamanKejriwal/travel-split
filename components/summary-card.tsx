"use client"

import { TrendingUp, TrendingDown, MapPin } from "lucide-react"
import { motion, useSpring, useTransform } from "framer-motion"
import { useEffect } from "react"

// --- ANIMATED NUMBER COMPONENT ---
function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 60, damping: 20 })
  const display = useTransform(spring, (current) => 
    current.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )

  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  return <motion.span>{display}</motion.span>
}

// --- MAIN COMPONENT ---
export function SummaryCard() {
  const totalCost = 2458.5
  const myShare = 614.63
  const netBalance = 125.37

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring" as const , stiffness: 260, damping: 20 }}
      whileHover={{ scale: 1.01 }}
      className="relative group cursor-default"
    >
      {/* Ambient Glow behind the card */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00A896] to-blue-600 rounded-3xl opacity-20 blur-xl group-hover:opacity-40 transition duration-1000"></div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#020617]/80 backdrop-blur-xl shadow-2xl transition-colors duration-300 group-hover:bg-[#020617]/90">
        
        {/* TOP SECTION: Total Cost */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-[#00A896]/10 text-[#00A896]">
                <MapPin className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-zinc-300 tracking-wide uppercase">Bali Trip 2024</span>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl text-zinc-500 font-bold">$</span>
            <p className="text-5xl font-black text-white tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <AnimatedNumber value={totalCost} />
            </p>
          </div>
          <p className="mt-1 text-xs text-[#00A896] font-medium uppercase tracking-wider pl-1">Total Trip Expenses</p>
        </div>

        {/* BOTTOM SECTION: Stats Grid */}
        <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 bg-white/[0.02]">
          
          {/* My Share */}
          <div className="p-5 hover:bg-white/[0.02] transition-colors">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">My Share</p>
            <p className="text-2xl font-bold text-white flex items-baseline">
              $<AnimatedNumber value={myShare} />
            </p>
          </div>

          {/* Net Balance */}
          <div className="p-5 hover:bg-white/[0.02] transition-colors">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Net Balance</p>
            <div className="flex items-center gap-2">
              {netBalance >= 0 ? (
                <>
                  <div className="bg-[#00d2aa]/10 p-1 rounded-full">
                    <TrendingUp className="h-4 w-4 text-[#00d2aa]" />
                  </div>
                  <span className="text-2xl font-bold text-[#00d2aa] drop-shadow-[0_0_8px_rgba(0,210,170,0.4)] flex items-baseline">
                    +$<AnimatedNumber value={netBalance} />
                  </span>
                </>
              ) : (
                <>
                  <div className="bg-rose-500/10 p-1 rounded-full">
                    <TrendingDown className="h-4 w-4 text-rose-500" />
                  </div>
                  <span className="text-2xl font-bold text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)] flex items-baseline">
                    -$<AnimatedNumber value={Math.abs(netBalance)} />
                  </span>
                </>
              )}
            </div>
            <p className="mt-1 text-[10px] font-medium text-zinc-400">
                {netBalance >= 0 ? "You are owed" : "You owe"}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}