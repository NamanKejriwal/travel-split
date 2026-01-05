"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { createClient } from "@/utils/supabase/client"
import { Group } from "@/components/views/groups-view"
import { Wallet, Smartphone, CreditCard, Loader2, ArrowRight, Banknote } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const supabase = createClient()

interface SettleUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeGroup: Group | null
  onSettled: () => void
  paymentToEdit?: any | null
}

export function SettleUpDialog({ 
  open, 
  onOpenChange, 
  activeGroup, 
  onSettled, 
  paymentToEdit 
}: SettleUpDialogProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([])
  const [dataReady, setDataReady] = useState(false)

  const [payTo, setPayTo] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMode, setPaymentMode] = useState("UPI")
  
  const [editingSplitId, setEditingSplitId] = useState<string | null>(null)

  useEffect(() => {
    if (open && activeGroup) {
      setDataReady(false)
      fetchMembersAndSetData()
    } else {
      if (!open) {
        // Reset form when dialog closes
        setTimeout(() => {
          setPaymentMode("UPI")
          setAmount("")
          setPayTo("")
          setEditingSplitId(null)
          setDataReady(false)
        }, 300) // Wait for dialog close animation
      }
    }
  }, [open, activeGroup, paymentToEdit])

  async function fetchMembersAndSetData() {
    if (!activeGroup) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Fetch Members
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

      // If Editing, Fetch & Fill Data
      if (paymentToEdit) {
        setAmount(paymentToEdit.amount.toString())
        setPaymentMode(paymentToEdit.payment_mode || "UPI")

        const { data: splitData } = await supabase
          .from('expense_splits')
          .select('id, user_id')
          .eq('expense_id', paymentToEdit.id)
          .single()

        if (splitData) {
          setPayTo(splitData.user_id)
          setEditingSplitId(splitData.id)
        }
      } else {
        setAmount("")
        setPayTo("")
        setPaymentMode("UPI")
        setEditingSplitId(null)
      }

      // Small delay to show skeleton (feels more intentional)
      await new Promise(resolve => setTimeout(resolve, 300))
      setDataReady(true)

    } catch (err) {
      console.error("Failed to load data", err)
      toast.error("Failed to load details")
      setDataReady(true) // Show form even on error
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!payTo || !amount || !activeGroup) {
      toast.error("Please fill all fields")
      return
    }
    
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not logged in")

      // ====================================================
      // 1. DATABASE OPERATIONS
      // ====================================================
      
      // === EDIT MODE ===
      if (paymentToEdit) {
        // Update Main Expense
        const { error: expenseError } = await supabase
          .from("expenses")
          .update({
            amount: numAmount,
            payment_mode: paymentMode,
            payment_method: paymentMode,
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentToEdit.id)

        if (expenseError) throw expenseError

        // Update Split (only if we have the ID)
        if (editingSplitId) {
          const { error: splitError } = await supabase
            .from("expense_splits")
            .update({
              user_id: payTo,
              amount_owed: numAmount
            })
            .eq('id', editingSplitId)

          if (splitError) throw splitError
        }

        toast.success("Payment updated!")
      } 
      // === CREATE MODE ===
      else {
        // Insert Expense
        const { data: expense, error: expenseError } = await supabase
          .from("expenses")
          .insert({
            group_id: activeGroup.id,
            description: "Settlement",
            amount: numAmount,
            paid_by: user.id,
            is_settlement: true,
            payment_mode: paymentMode,
            payment_method: paymentMode,
            category: "Other"
          })
          .select()
          .single()

        if (expenseError) throw expenseError

        // Insert Split
        const { error: splitError } = await supabase
          .from("expense_splits")
          .insert({
            expense_id: expense.id,
            user_id: payTo,
            amount_owed: numAmount
          })

        if (splitError) throw splitError

        toast.success("Settlement recorded!")
      }

      // ====================================================
      // 2. EMAIL NOTIFICATION (Runs for both Add & Edit)
      // ====================================================
      let emailSuccess = false
      
      try {
        const { data: recipient } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', payTo)
          .single()

        if (recipient?.email) {
          // Use await to ensure email is sent before closing dialog
          const response = await fetch('/api/notify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'SETTLEMENT',
              action: paymentToEdit ? 'EDITED' : 'ADDED',
              amount: numAmount,
              payerName: user.user_metadata?.full_name || "A friend",
              groupName: activeGroup?.name || "Trip",
              recipients: [{ 
                email: recipient.email, 
                name: recipient.full_name 
              }]
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const result = await response.json()
          emailSuccess = result.success
        }
      } catch (emailError: any) { 
        console.error("Email notification failed:", emailError)
        // Don't throw here - we don't want email failure to block the transaction
      }

      // ====================================================
      // 3. CLEANUP & SUCCESS FEEDBACK
      // ====================================================
      
      // Show success message
      if (emailSuccess) {
        toast.success(
          paymentToEdit 
            ? "Payment updated and notification sent!" 
            : "Settlement recorded and notification sent!",
          {
            duration: 3000
          }
        )
      } else {
        toast.success(
          paymentToEdit 
            ? "Payment updated!" 
            : "Settlement recorded!",
          {
            description: emailSuccess === false ? "Notification could not be sent" : undefined,
            duration: 3000
          }
        )
      }

      // Wait a moment before closing for better UX
      await new Promise(resolve => setTimeout(resolve, 500))

      // Trigger parent callback
      onSettled()
      
      // Close dialog after parent callback
      onOpenChange(false)

    } catch (e: any) {
      console.error("Save Error:", e)
      toast.error(e.message || "Failed to save settlement")
    } finally {
      setSubmitting(false)
    }
  }
  
  const PAYMENT_METHODS = [
    { value: "UPI", label: "UPI", icon: Smartphone, color: "text-blue-400", bg: "bg-blue-400/10" },
    { value: "Cash", label: "Cash", icon: Banknote, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { value: "Card", label: "Card", icon: CreditCard, color: "text-purple-400", bg: "bg-purple-400/10" }
  ]

  const isEditMode = !!paymentToEdit

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="
          bg-[#020617]/95 backdrop-blur-2xl border-white/10 text-white 
          w-[95%] max-w-md rounded-3xl p-0 overflow-hidden
          sm:max-w-md
        "
      >

        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#00A896]/10 border border-[#00A896]/20">
              <Wallet className="w-5 h-5 text-[#00A896]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {isEditMode ? "Edit Payment" : "Record Payment"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                {isEditMode ? "Update transaction details" : "Log a payment you made"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form Content */}
        <AnimatePresence mode="wait">
          {!dataReady ? (
            // Skeleton Loading State
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-6 py-5 space-y-6"
            >
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-24 bg-white/10" />
                <Skeleton className="h-14 w-full bg-white/5 rounded-xl" />
              </div>

              <div className="space-y-2.5">
                <Skeleton className="h-4 w-20 bg-white/10" />
                <Skeleton className="h-14 w-full bg-white/5 rounded-xl" />
              </div>

              <div className="space-y-2.5">
                <Skeleton className="h-4 w-32 bg-white/10" />
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="h-24 bg-white/5 rounded-xl" />
                  <Skeleton className="h-24 bg-white/5 rounded-xl" />
                  <Skeleton className="h-24 bg-white/5 rounded-xl" />
                </div>
              </div>
            </motion.div>
          ) : (
            // Actual Form
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-6 py-5 space-y-6"
            >

              {/* Pay To */}
              <div className="space-y-2.5">
                <Label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                  Paying To
                </Label>

                <Select value={payTo} onValueChange={setPayTo}>
                  <SelectTrigger className="h-14 rounded-xl bg-white/[0.04] border-white/10 text-white hover:bg-white/[0.08] focus:ring-[#00A896] focus:ring-offset-0 transition-all text-base">
                    <SelectValue placeholder="Select friend" />
                  </SelectTrigger>

                  <SelectContent className="bg-[#0f172a]/95 backdrop-blur-xl border-white/10 text-white rounded-xl">
                    {members.map(m => (
                      <SelectItem 
                        key={m.id} 
                        value={m.id}
                        className="focus:bg-white/10 focus:text-white rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-[#00A896]/20 flex items-center justify-center text-xs font-bold text-[#00A896]">
                            {m.full_name.charAt(0)}
                          </div>
                          {m.full_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Input */}
              <div className="space-y-2.5">
                <Label className="text-xs uppercase tracking-wider text-[#00A896] font-semibold">
                  Amount
                </Label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-xl font-bold pointer-events-none">
                    ₹
                  </span>

                  <Input
                    type="number"
                    inputMode="numeric"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="h-14 pl-10 rounded-xl bg-white/[0.04] border-white/10 text-white text-xl font-semibold focus-visible:ring-[#00A896] focus-visible:ring-offset-0 transition-all placeholder:text-zinc-600"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2.5">
                <Label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                  Payment Method
                </Label>

                <div className="grid grid-cols-3 gap-3">
                  {PAYMENT_METHODS.map(method => {
                    const Icon = method.icon
                    const isSelected = paymentMode === method.value

                    return (
                      <motion.button
                        key={method.value}
                        onClick={() => setPaymentMode(method.value)}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                          isSelected 
                            ? "border-[#00A896] bg-[#00A896]/10" 
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-lg",
                          isSelected ? method.bg : "bg-white/5"
                        )}>
                          <Icon className={cn("h-5 w-5", isSelected ? method.color : "text-zinc-500")} />
                        </div>
                        <span className={cn(
                          "text-xs font-semibold",
                          isSelected ? "text-white" : "text-zinc-500"
                        )}>
                          {method.label}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <DialogFooter className="p-6 pt-4 border-t border-white/5 bg-[#020617]/60">
          <Button
            onClick={handleSave}
            disabled={submitting || !payTo || !amount || !dataReady}
            className="w-full h-14 rounded-xl bg-[#00A896] hover:bg-[#00A896]/90 font-bold text-white text-base tracking-wide shadow-lg shadow-[#00A896]/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {isEditMode ? "Saving..." : "Recording..."}
              </>
            ) : (
              <>
                {isEditMode ? "Save Changes" : "Confirm Payment"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  )
}