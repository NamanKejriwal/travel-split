"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Group } from "@/components/views/groups-view"
import { ArrowRight, CheckCircle2, Wallet, Scale, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const supabase = createClient()

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { 
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 260, damping: 20 }
  }
}

interface BalanceViewProps {
  activeGroup: Group | null
  onSettleUp: () => void
}

interface Transaction {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}

export function BalanceView({ activeGroup, onSettleUp }: BalanceViewProps) {
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [myBalance, setMyBalance] = useState(0)
  const [currentUserId, setCurrentUserId] = useState("")

  useEffect(() => {
    if (activeGroup) calculateBalances()
  }, [activeGroup])

  async function calculateBalances() {
    if (!activeGroup) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const { data: balances } = await supabase
        .rpc("get_trip_balances", { p_group_id: activeGroup.id })

      if (!balances) return

      const debtors = balances
        .filter((b: any) => b.net_balance < -0.01)
        .map((b: any) => ({ ...b, amount: Math.abs(b.net_balance) }))
        .sort((a: any, b: any) => b.amount - a.amount)

      const creditors = balances
        .filter((b: any) => b.net_balance > 0.01)
        .map((b: any) => ({ ...b, amount: b.net_balance }))
        .sort((a: any, b: any) => b.amount - a.amount)

      const proposedTransactions: Transaction[] = []
      let i = 0, j = 0

      while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i]
        const creditor = creditors[j]
        const amount = Math.min(debtor.amount, creditor.amount)

        proposedTransactions.push({
          from: debtor.user_id,
          fromName: debtor.full_name || "Unknown",
          to: creditor.user_id,
          toName: creditor.full_name || "Unknown",
          amount
        })

        debtor.amount -= amount
        creditor.amount -= amount
        if (debtor.amount < 0.01) i++
        if (creditor.amount < 0.01) j++
      }

      setTransactions(proposedTransactions)

      if (user) {
        const me = balances.find((b: any) => b.user_id === user.id)
        setMyBalance(me ? me.net_balance : 0)
      }

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (!activeGroup)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[#020617] text-zinc-500 p-8 text-center">
        <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
        >
            <Scale className="h-12 w-12 mb-4 opacity-20" />
            <p>Select a trip to view balances.</p>
        </motion.div>
      </div>
    )

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 pb-24 relative overflow-hidden">
      
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[20%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-[#00A896]/10 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 space-y-8 max-w-3xl mx-auto"
      >
        
        {/* HEADER */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">Balances</h2>
          <Button 
            size="sm" 
            className="rounded-full bg-[#00A896] hover:bg-[#00A896]/90 text-white font-bold px-6 shadow-[0_0_15px_rgba(0,168,150,0.4)] transition-all hover:scale-105" 
            onClick={onSettleUp}
          >
            Settle Up
          </Button>
        </motion.div>

        {/* SELF BALANCE HERO CARD */}
        <motion.div variants={itemVariants}>
          {loading ? (
            <div className="h-32 w-full rounded-3xl bg-white/5 animate-pulse border border-white/5" />
          ) : (
            <motion.div 
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
                className={`relative overflow-hidden rounded-3xl p-6 border transition-all duration-300 backdrop-blur-xl ${
                myBalance >= 0 
                  ? 'border-[#00A896]/30 bg-[#00A896]/10 shadow-[0_0_30px_rgba(0,168,150,0.15)]' 
                  : 'border-rose-500/30 bg-rose-500/10 shadow-[0_0_30px_rgba(244,63,94,0.15)]'
              }`}>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${myBalance >= 0 ? 'text-[#00A896]' : 'text-rose-400'}`}>
                        Your Net Position
                    </p>
                    <h3 className={`text-3xl sm:text-4xl font-black ${myBalance >= 0 ? 'text-white' : 'text-white'}`}>
                      {myBalance >= 0 ? "You are owed" : "You owe"} 
                      <span className={`ml-2 ${myBalance >= 0 ? 'text-[#00d2aa] drop-shadow-[0_0_10px_rgba(0,210,170,0.5)]' : 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`}>
                        ₹{Math.abs(myBalance).toFixed(2)}
                      </span>
                    </h3>
                  </div>

                  <div className={`p-3 rounded-2xl ${myBalance >= 0 ? 'bg-[#00A896]/20 text-[#00A896]' : 'bg-rose-500/20 text-rose-500'}`}>
                    {myBalance >= 0
                      ? <Wallet className="h-8 w-8" />
                      : <Scale className="h-8 w-8" />
                    }
                  </div>
                </div>
            </motion.div>
          )}
        </motion.div>

        {/* SUGGESTED REPAYMENTS LIST */}
        <motion.div variants={itemVariants} className="space-y-4">
            <div>
                <h3 className="text-lg font-bold text-white">Suggested Repayments</h3>
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mt-1">
                    Optimized to minimize transactions
                </p>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 w-full rounded-2xl bg-white/5 animate-pulse border border-white/5" />
                    ))}
                </div>
            ) : transactions.length === 0 ? (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-white/[0.02] border border-white/5"
                >
                    <div className="h-16 w-16 rounded-full bg-[#00A896]/10 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(0,168,150,0.2)]">
                        <CheckCircle2 className="h-8 w-8 text-[#00A896]" />
                    </div>
                    <p className="text-white font-bold text-lg">All settled up!</p>
                    <p className="text-sm text-zinc-500 mt-1">No pending debts in this group.</p>
                </motion.div>
            ) : (
                <motion.div 
                    className="space-y-3"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <AnimatePresence>
                    {transactions.map((t, idx) => {
                        const isMePaying = t.from === currentUserId
                        const isMeReceiving = t.to === currentUserId

                        return (
                            <motion.div 
                                key={`${t.from}-${t.to}-${idx}`} 
                                variants={itemVariants}
                                whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.05)" }}
                                className="group flex items-center justify-between p-4 rounded-2xl bg-[#020617]/60 backdrop-blur-md border border-white/5 transition-colors duration-300 shadow-sm"
                            >
                                
                                <div className="flex items-center gap-3 flex-1">
                                    {/* Avatar / Name FROM */}
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold border ${isMePaying ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                                            {isMePaying ? "YOU" : t.fromName[0]}
                                        </div>
                                        <span className={`font-semibold text-sm ${isMePaying ? 'text-white' : 'text-zinc-400'}`}>
                                            {isMePaying ? "You" : t.fromName}
                                        </span>
                                    </div>

                                    {/* Arrow */}
                                    <div className="flex flex-col items-center px-2 opacity-50">
                                        <span className="text-[10px] text-zinc-600 mb-0.5">PAY</span>
                                        <ArrowRight className="h-4 w-4 text-zinc-500" />
                                    </div>

                                    {/* Avatar / Name TO */}
                                    <div className="flex items-center gap-3">
                                        <span className={`font-semibold text-sm ${isMeReceiving ? 'text-white' : 'text-zinc-400'}`}>
                                            {isMeReceiving ? "You" : t.toName}
                                        </span>
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold border ${isMeReceiving ? 'bg-[#00A896]/10 border-[#00A896]/30 text-[#00A896]' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                                            {isMeReceiving ? "YOU" : t.toName[0]}
                                        </div>
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="font-bold text-white text-lg ml-4 pl-4 border-l border-white/10">
                                    ₹{t.amount.toFixed(0)}
                                </div>
                            </motion.div>
                        )
                    })}
                    </AnimatePresence>
                </motion.div>
            )}
        </motion.div>
      </motion.div>
    </div>
  )
}