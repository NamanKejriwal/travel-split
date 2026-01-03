"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Group } from "@/components/views/groups-view"
import { 
  ArrowRight, CheckCircle2, Wallet, Scale, Trash2, AlertCircle, Loader2, 
  Info, Smartphone, Banknote, CreditCard, Pencil, X
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { calculateMinimalSettlements, SettlementTransaction } from "@/lib/settlement-logic"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { SettleUpDialog } from "@/components/settle-up-dialog"

const supabase = createClient()

interface BalanceViewProps {
  activeGroup: Group | null
  onSettleUp: () => void
}

interface Settlement {
  id: string
  description: string
  amount: number
  paid_by: string
  created_at: string
  payment_mode?: string
  profiles?: { full_name: string }
  expense_splits: { user_id: string, profiles?: { full_name: string } }[]
}

export function BalanceView({ activeGroup, onSettleUp }: BalanceViewProps) {
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<SettlementTransaction[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [myBalance, setMyBalance] = useState(0)
  const [currentUserId, setCurrentUserId] = useState("")
  
  // Dialog States
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  
  // Loading state for settlement details (fetching the receiver name if needed)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [receiverName, setReceiverName] = useState("Unknown")

  useEffect(() => {
    if (activeGroup) loadBalances()
  }, [activeGroup])

  // Real-time subscription
  useEffect(() => {
    if (!activeGroup) return

    const channel = supabase
      .channel(`settlements-${activeGroup.id}`)
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "expenses",
          event: "*",
          filter: `group_id=eq.${activeGroup.id}`
        },
        (payload) => {
          if (payload.new && (payload.new as any).is_settlement) {
            loadBalances()
          }
          // Also reload on delete
          if (payload.eventType === "DELETE") {
             loadBalances()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeGroup?.id])

  async function loadBalances() {
    if (!activeGroup) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      // 1. Balances
      const { data: balances, error } = await supabase
        .rpc("get_trip_balances", { p_group_id: activeGroup.id })

      if (error) throw error
      if (!balances) return

      const logicInput = balances.map((b: any) => ({
        userId: b.user_id,
        userName: b.full_name || "Unknown",
        amount: b.net_balance
      }))

      const optimized = calculateMinimalSettlements(logicInput)
      setTransactions(optimized)

      if (user) {
        const me = logicInput.find((b: any) => b.userId === user.id)
        setMyBalance(me ? me.amount : 0)
      }

      // 2. Recent Settlements (Fetch with profiles)
      const { data: settlementsData } = await supabase
        .from("expenses")
        .select(`
          id,
          description,
          amount,
          paid_by,
          created_at,
          payment_mode,
          profiles:paid_by (full_name),
          expense_splits (
            user_id,
            profiles:user_id (full_name)
          )
        `)
        .eq("group_id", activeGroup.id)
        .eq("is_settlement", true)
        .order("created_at", { ascending: false })
        .limit(5)

      // @ts-ignore
      setSettlements(settlementsData || [])

    } catch (e) {
      console.error("Balance Load Error:", e)
      toast.error("Failed to load balances")
    } finally {
      setLoading(false)
    }
  }

  const handleSettlementClick = (settlement: Settlement) => {
    setSelectedSettlement(settlement)
    
    // Extract receiver name safely
    const split = settlement.expense_splits?.[0]
    // @ts-ignore
    const rName = split?.profiles?.full_name || "Unknown"
    setReceiverName(rName)
    
    setDetailOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedSettlement || !confirm("Delete this settlement permanently?")) return

    try {
      // Delete expenses (splits cascade usually, but good to be safe)
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", selectedSettlement.id)

      if (error) throw error

      toast.success("Settlement deleted")
      setDetailOpen(false)
      loadBalances() // Refresh UI
    } catch (err) {
      toast.error("Failed to delete")
    }
  }

  const handleEdit = () => {
    setDetailOpen(false)
    setEditDialogOpen(true)
  }

  const handleSettlementUpdated = useCallback(() => {
    loadBalances()
    setEditDialogOpen(false)
    setSelectedSettlement(null)
  }, [])

  if (!activeGroup) return null

  return (
    <div className="min-h-screen bg-[#020617] text-white p-5 pb-24 relative overflow-hidden">

      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[50vw] h-[50vw] bg-[#00A896]/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 space-y-6 max-w-3xl mx-auto">

        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h2 className="text-3xl font-black tracking-tight">Balances</h2>
            <p className="text-zinc-500 text-sm mt-1">Your group's financial overview</p>
          </div>
          <Button 
            onClick={onSettleUp}
            className="rounded-full bg-[#00A896] hover:bg-[#00A896]/90 text-white font-bold px-6 h-11 shadow-lg shadow-[#00A896]/20 active:scale-95 transition-all"
          >
            Settle Up
          </Button>
        </motion.div>

        {/* Hero Balance Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className={`relative overflow-hidden rounded-3xl p-6 border backdrop-blur-xl transition-all duration-300 ${
            myBalance >= 0 
              ? 'border-[#00A896]/30 bg-[#00A896]/10'
              : 'border-rose-500/30 bg-rose-500/10'
          }`}>
            <div className="flex items-center justify-between">
              
              <div className="flex-1">
                <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                  myBalance >= 0 ? 'text-[#00A896]' : 'text-rose-400'
                }`}>
                  Your Net Position
                </p>

                <div className="text-3xl font-black tracking-tight">
                  {loading ? (
                    <div className="h-10 bg-white/10 rounded-xl w-48 animate-pulse" />
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-zinc-400 text-lg font-medium">
                        {myBalance >= 0 ? "You are owed" : "You owe"}
                      </span>
                      <span className={myBalance >= 0 ? "text-[#00d2aa]" : "text-rose-400"}>
                        ₹{Math.abs(Math.round(myBalance)).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className={`p-4 rounded-2xl ${
                myBalance >= 0 ? 'bg-[#00A896]/20' : 'bg-rose-500/20'
              }`}>
                {myBalance >= 0 ? (
                  <Wallet className="h-8 w-8" />
                ) : (
                  <Scale className="h-8 w-8" />
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Suggested Repayments */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-bold text-zinc-300">Suggested Repayments</h3>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div 
                  key={i} 
                  className="h-20 w-full rounded-2xl bg-white/5 border border-white/10 animate-pulse"
                />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-white/[0.02] border border-white/5"
            >
              <CheckCircle2 className="h-12 w-12 text-[#00A896] mb-4 opacity-60" />
              <p className="text-white font-bold text-lg">All settled up!</p>
              <p className="text-zinc-500 text-sm mt-1">No pending payments in this trip</p>
            </motion.div>

          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {transactions.map((t, idx) => {
                  const isMePaying = t.from === currentUserId
                  const isMeReceiving = t.to === currentUserId

                  return (
                    <motion.div
                      key={`${t.from}-${t.to}-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-between p-4 rounded-2xl bg-[#020617]/60 border border-white/5 hover:bg-white/5 transition-all"
                    >
                      
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex items-center gap-2 shrink-0">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                            isMePaying 
                              ? "bg-rose-500/20 border-rose-500 text-rose-300"
                              : "bg-zinc-800 border-zinc-700 text-zinc-400"
                          }`}>
                            {isMePaying ? "YOU" : t.fromName.charAt(0)}
                          </div>

                          <span className={`text-sm font-medium truncate max-w-[80px] ${
                            isMePaying ? "text-white" : "text-zinc-400"
                          }`}>
                            {isMePaying ? "You" : t.fromName.split(" ")[0]}
                          </span>
                        </div>

                        <ArrowRight className="h-4 w-4 text-zinc-600 shrink-0" />

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-medium truncate max-w-[80px] ${
                            isMeReceiving ? "text-white" : "text-zinc-400"
                          }`}>
                            {isMeReceiving ? "You" : t.toName.split(" ")[0]}
                          </span>

                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                            isMeReceiving
                              ? "bg-[#00A896]/20 border-[#00A896] text-[#00A896]"
                              : "bg-zinc-800 border-zinc-700 text-zinc-400"
                          }`}>
                            {isMeReceiving ? "YOU" : t.toName.charAt(0)}
                          </div>
                        </div>
                      </div>

                      <div className="font-bold text-white text-base ml-3 shrink-0">
                        ₹{Math.round(t.amount).toLocaleString("en-IN")}
                      </div>

                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Recent Settlements */}
        {settlements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-300">Recent Settlements</h3>
            </div>
            
            <p className="text-[12.3px] text-zinc-500 flex items-center gap-1.5 opacity-60">
                <Info className="w-3 h-3" /> Tap any settlement to view details & edit or delete.
            </p>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {settlements.slice(0, 5).map((settlement, idx) => {
                  // @ts-ignore
                  const payerName = settlement.profiles?.full_name || "Unknown"
                  // @ts-ignore
                  const receiverName = settlement.expense_splits?.[0]?.profiles?.full_name || "Unknown"

                  return (
                    <motion.div
                      key={settlement.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleSettlementClick(settlement)}
                      className="group cursor-pointer relative p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                              <Wallet className="h-4 w-4 text-blue-400" />
                            </div>
                            <span className="text-sm font-semibold text-blue-100">
                              {payerName.split(" ")[0]} paid {receiverName.split(" ")[0]}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 ml-10">
                            {new Date(settlement.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>

                        <span className="text-base font-bold text-blue-100">
                            ₹{settlement.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </div>

      {/* READ-ONLY SETTLEMENT DETAILS DIALOG */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-[#020617]/95 backdrop-blur-2xl border-white/10 text-white w-[95vw] max-w-md rounded-3xl p-0 overflow-hidden shadow-2xl">
            
            {/* Header */}
            <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-[#00A896]/10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#00A896] text-white shadow-lg shadow-[#00A896]/30">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                        <DialogTitle className="text-lg font-bold">Payment Record</DialogTitle>
                        <DialogDescription className="text-xs text-[#00A896]/80 font-medium">
                            Logged on {selectedSettlement && new Date(selectedSettlement.created_at).toLocaleString()}
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="px-6 py-6 space-y-6">
                
                {/* Amount Display */}
                <div className="flex flex-col items-center justify-center p-6 bg-white/[0.03] border border-white/5 rounded-2xl">
                    <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Amount Paid</span>
                    <div className="flex items-baseline gap-1 text-4xl font-black text-white">
                        <span className="text-2xl text-zinc-500">₹</span>
                        {selectedSettlement && Number(selectedSettlement.amount).toLocaleString('en-IN')}
                    </div>
                </div>

                {/* Payment Flow */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    {/* Payer */}
                    <div className="flex flex-col items-center p-3 bg-white/[0.03] rounded-xl border border-white/5">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">From</span>
                        <div className="h-8 w-8 rounded-full bg-[#00A896]/20 flex items-center justify-center text-[#00A896] font-bold text-xs mb-1">
                            {/* @ts-ignore */}
                            {selectedSettlement?.profiles?.full_name?.charAt(0)}
                        </div>
                        <span className="text-xs font-medium text-center line-clamp-1">
                            {/* @ts-ignore */}
                            {selectedSettlement?.profiles?.full_name?.split(' ')[0]}
                        </span>
                    </div>

                    <ArrowRight className="w-5 h-5 text-zinc-600" />

                    {/* Receiver */}
                    <div className="flex flex-col items-center p-3 bg-white/[0.03] rounded-xl border border-white/5">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">To</span>
                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs mb-1">
                            {receiverName.charAt(0)}
                        </div>
                        <span className="text-xs font-medium text-center line-clamp-1">
                            {receiverName.split(' ')[0]}
                        </span>
                    </div>
                </div>

                    {/* Method */}
                <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl border border-white/5">
                    <span className="text-xs text-zinc-400 font-medium">Payment Method</span>
                    <div className="flex items-center gap-2 text-xs font-bold text-white bg-white/5 px-2.5 py-1 rounded-lg">
                        {selectedSettlement?.payment_mode === 'Cash' && <Banknote className="w-3.5 h-3.5 text-emerald-400" />}
                        {selectedSettlement?.payment_mode === 'UPI' && <Smartphone className="w-3.5 h-3.5 text-blue-400" />}
                        {selectedSettlement?.payment_mode === 'Card' && <CreditCard className="w-3.5 h-3.5 text-purple-400" />}
                        {selectedSettlement?.payment_mode || "Cash"}
                    </div>
                </div>

            </div>

            {/* Actions Footer */}
            <DialogFooter className="p-4 bg-[#020617] border-t border-white/5">
                {(currentUserId === selectedSettlement?.paid_by) ? (
                    <div className="grid grid-cols-3 gap-2 w-full">
                        <Button variant="ghost" className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-10" onClick={handleDelete}>
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                        <Button variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs h-10" onClick={handleEdit}>
                            <Pencil className="w-4 h-4 mr-1" /> Edit
                        </Button>
                        <Button className="bg-white/10 hover:bg-white/20 text-white text-xs h-10" onClick={() => setDetailOpen(false)}>
                            Close
                        </Button>
                    </div>
                ) : (
                    <Button className="w-full bg-white/10 text-white hover:bg-white/20 h-11 rounded-xl" onClick={() => setDetailOpen(false)}>
                        Close
                    </Button>
                )}
            </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* REUSED EDIT DIALOG */}
      <SettleUpDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        activeGroup={activeGroup}
        onSettled={handleSettlementUpdated}
        paymentToEdit={selectedSettlement}
      />

    </div>
  )
}