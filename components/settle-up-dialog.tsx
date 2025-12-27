"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { createClient } from "@/utils/supabase/client"
import { Group } from "@/components/views/groups-view"
import { Wallet, Smartphone, CreditCard, Loader2, ArrowRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"

const supabase = createClient()

// --- ANIMATION VARIANTS ---
const formContainerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { 
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(5px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { 
      type: "spring" as const, // <--- ADD THIS HERE
      stiffness: 260, 
      damping: 20 
    }
  }
}
interface SettleUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeGroup: Group | null
  onSettled: () => void
}

export function SettleUpDialog({ open, onOpenChange, activeGroup, onSettled }: SettleUpDialogProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([])

  const [payTo, setPayTo] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMode, setPaymentMode] = useState("UPI")

  useEffect(() => {
    if (open && activeGroup) {
      fetchMembers()
      setPaymentMode("UPI")
      setAmount("")
      setPayTo("")
    }
  }, [open, activeGroup])

  async function fetchMembers() {
    if (!activeGroup) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data } = await supabase
        .from("group_members")
        .select("user_id, profiles(id, full_name)")
        .eq("group_id", activeGroup.id)

      const valid = (data || []).map((m: any) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
        return p?.full_name ? p : { id: m.user_id, full_name: "Unknown User" }
      })

      const others = valid.filter((m: any) => m.id !== user?.id)
      setMembers(others)
    } catch {
      console.error("member load failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleSettle() {
    if (!payTo || !amount || !activeGroup) return
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not logged in")

      const numAmount = parseFloat(amount)

      const { data: expense } = await supabase
        .from("expenses")
        .insert({
          group_id: activeGroup.id,
          description: "Settlement",
          amount: numAmount,
          paid_by: user.id,
          is_settlement: true,
          payment_mode: paymentMode,
          category: "Other",
        })
        .select()
        .single()

      await supabase.from("expense_splits").insert({
        expense_id: expense.id,
        user_id: payTo,
        amount_owed: numAmount,
      })

      onSettled()
      onOpenChange(false)
    } catch (e) {
      alert("Failed to record settlement")
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#020617]/95 backdrop-blur-xl border-white/10 text-white sm:max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#00A896]" />
            Settle Up
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Record a payment you made to a friend to clear debts.
          </DialogDescription>
        </DialogHeader>

        <motion.div 
            className="grid gap-6 py-4"
            variants={formContainerVariants}
            initial="hidden"
            animate="visible"
        >

          {/* Paying To */}
          <motion.div variants={itemVariants} className="grid gap-2">
            <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Paying to</Label>

            {loading ? (
              <Skeleton className="h-12 w-full bg-white/5 rounded-xl" />
            ) : (
              <Select value={payTo} onValueChange={setPayTo}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:ring-[#00A896] hover:bg-white/10 transition-colors">
                  <SelectValue placeholder="Select friend" />
                </SelectTrigger>

                <SelectContent className="bg-[#0f172a] border-white/10 text-white z-[9999]">
                  {members.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No members found
                    </SelectItem>
                  ) : (
                    members.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="focus:bg-white/10 cursor-pointer">
                        {m.full_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </motion.div>

          {/* Amount + Mode Grid */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Amount */}
            <motion.div variants={itemVariants} className="grid gap-2">
              <Label className="text-xs font-bold text-[#00A896] uppercase tracking-wider">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-lg">₹</span>
                <Input
                  type="number"
                  className="pl-8 bg-white/5 border-white/10 text-white h-12 rounded-xl text-lg font-bold placeholder:text-zinc-600 focus-visible:ring-[#00A896]"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </motion.div>

            {/* Payment Mode */}
            <motion.div variants={itemVariants} className="grid gap-2">
              <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Via</Label>

              {loading ? (
                <Skeleton className="h-12 w-full bg-white/5 rounded-xl" />
              ) : (
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:ring-[#00A896]">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent className="bg-[#0f172a] border-white/10 text-white z-[9999]">
                    <SelectItem value="UPI" className="focus:bg-white/10 cursor-pointer">
                      <div className="flex items-center">
                        <Smartphone className="w-4 h-4 mr-2 text-blue-400" /> UPI
                      </div>
                    </SelectItem>

                    <SelectItem value="Cash" className="focus:bg-white/10 cursor-pointer">
                      <div className="flex items-center">
                        <Wallet className="w-4 h-4 mr-2 text-emerald-400" /> Cash
                      </div>
                    </SelectItem>

                    <SelectItem value="Card" className="focus:bg-white/10 cursor-pointer">
                      <div className="flex items-center">
                        <CreditCard className="w-4 h-4 mr-2 text-purple-400" /> Card
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </motion.div>
          </div>
        </motion.div>

        <DialogFooter className="mt-2">
          <motion.div 
            className="w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
                onClick={handleSettle}
                disabled={submitting || !payTo || !amount}
                className="w-full h-12 bg-[#00A896] hover:bg-[#00A896]/90 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(0,168,150,0.3)] transition-all"
            >
                {submitting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Recording...
                    </>
                ) : (
                    <>
                        Record Payment <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                )}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}