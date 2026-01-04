"use client"

import { useEffect, useState, useRef } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/utils/supabase/client"
import { Group } from "@/components/views/groups-view"
import {
  Loader2, Bus, Plane, BedDouble, Utensils,
  ShoppingBag, Ticket, HelpCircle, ChevronLeft,
  Check, Wallet, Smartphone, CreditCard, X
} from "lucide-react"
import { toast } from "sonner"
import { trackEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

const supabase = createClient()

export interface ExpenseToEdit {
  id: string
  description: string
  amount: number
  paid_by: string
  category?: string
  payment_method?: string
}

interface AddExpenseDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeGroup: Group | null
  onExpenseAdded?: (triggerAI?: boolean) => void
  onAnalysisComplete?: (tip?: string) => void
  expenseToEdit?: ExpenseToEdit | null
}

interface Member {
  id: string
  full_name: string
  email?: string
}

const CATEGORY_CONFIG: Record<string, { icon: any, color: string, bg: string }> = {
  "Food": { icon: Utensils, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  "Local Transport": { icon: Bus, color: "text-blue-400", bg: "bg-blue-400/10" },
  "Travel": { icon: Plane, color: "text-violet-400", bg: "bg-violet-400/10" },
  "Hostel / Hotel": { icon: BedDouble, color: "text-amber-400", bg: "bg-amber-400/10" },
  "Shopping": { icon: ShoppingBag, color: "text-pink-400", bg: "bg-pink-400/10" },
  "Activity": { icon: Ticket, color: "text-rose-400", bg: "bg-rose-400/10" },
  "Other": { icon: HelpCircle, color: "text-zinc-400", bg: "bg-zinc-400/10" }
}

const CATEGORIES = Object.keys(CATEGORY_CONFIG).map(id => ({
  id, label: id, ...CATEGORY_CONFIG[id]
}))

const STEPS = [
  { id: "amount", title: "Enter Amount" },
  { id: "details", title: "What for?" },
  { id: "split", title: "Who pays?" }
]

export function AddExpenseDrawer({
  open,
  onOpenChange,
  activeGroup,
  onExpenseAdded,
  onAnalysisComplete,
  expenseToEdit
}: AddExpenseDrawerProps) {

  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(0)

  const [availableGroups, setAvailableGroups] = useState<Group[]>([])
  const [manualGroupId, setManualGroupId] = useState<string>("")
  const [members, setMembers] = useState<Member[]>([])

  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("Food")
  const [description, setDescription] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("UPI")
  const [paidBy, setPaidBy] = useState("")
  const [splitWith, setSplitWith] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const targetGroupId = activeGroup?.id || manualGroupId
  const isEditing = !!expenseToEdit
  const inputRef = useRef<HTMLInputElement>(null)

  // Prevent bg scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "auto"
  }, [open])

  useEffect(() => {
    if (!open) return

    setCurrentStep(0)
    setSubmitting(false)

    const init = async () => {
      if (!activeGroup) await fetchUserGroups()
      else setManualGroupId("")

      if (expenseToEdit) {
        setAmount(expenseToEdit.amount.toString())
        setCategory(expenseToEdit.category || "Food")
        setDescription(expenseToEdit.description)
        setPaidBy(expenseToEdit.paid_by)
        setPaymentMethod(expenseToEdit.payment_method || "UPI")
        await fetchExistingSplits(expenseToEdit.id)
      } else {
        setAmount("")
        setCategory("Food")
        setDescription("")
        setPaymentMethod("UPI")
      }
    }

    init()
    setTimeout(() => inputRef.current?.focus(), 150)

  }, [open])

  async function fetchUserGroups() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
  
    const { data, error } = await supabase
      .from("group_members")
      .select("groups(*)")   // 👈 fetch FULL group object
      .eq("user_id", user.id)
  
    if (error) {
      console.error("Failed to fetch groups", error)
      return
    }
  
    // Normalize + ensure correct typing
    const groups: Group[] = (data || [])
      // @ts-ignore
      .map(item => Array.isArray(item.groups) ? item.groups[0] : item.groups)
      .filter(Boolean)
  
    setAvailableGroups(groups)
  
    if (groups.length && !activeGroup)
      setManualGroupId(groups[0].id)
  }
  
  async function fetchExistingSplits(id: string) {
    const { data } = await supabase.from("expense_splits").select("user_id").eq("expense_id", id)
    if (data) setSplitWith(data.map(s => s.user_id))
  }

  useEffect(() => {
    if (targetGroupId) fetchMembers(targetGroupId)
  }, [targetGroupId])

  async function fetchMembers(groupId: string) {
    setLoading(true)
  
    const { data: { user } } = await supabase.auth.getUser()
  
    const { data, error } = await supabase
      .from("group_members")
      .select(`
        user_id,
        profiles (
          id,
          full_name,
          email
        )
      `)
      .eq("group_id", groupId)
  
    if (error) {
      console.error("Failed to fetch members", error)
      setLoading(false)
      return
    }
  
    const mapped: Member[] = (data || []).map(item => {
      const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      return {
        id: item.user_id,
        full_name: profile?.full_name || "Member",
        email: profile?.email
      }
    })
  
    if (user && !mapped.find(m => m.id === user.id))
      mapped.push({ id: user.id, full_name: "You" })
  
    setMembers(mapped)
  
    if (!expenseToEdit) {
      if (user && !paidBy) setPaidBy(user.id)
      else if (mapped.length > 0 && !paidBy) setPaidBy(mapped[0].id)
  
      setSplitWith(mapped.map(m => m.id))
    }
  
    setLoading(false)
  }
  
  // -------- AI LOGIC --------
  async function checkAndSaveAlerts(groupId: string, newExpenseAmount: number, category: string) {
    try {
      if (newExpenseAmount < 99) {
        onAnalysisComplete?.()
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return onAnalysisComplete?.()

      const { data: group } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single()

      if (!group || !group.ai_alerts_enabled) {
        onAnalysisComplete?.()
        return
      }

      const { data: recentData } = await supabase
        .from("expenses")
        .select("description, amount, category")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(5)

      const { data: allExpenses } = await supabase
        .from("expenses")
        .select("amount")
        .eq("group_id", groupId)

      const totalSpentSoFar =
        allExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0

      const { count: memberCount } = await supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId)

      const totalBudget =
        (group.budget_per_person || 0) * (memberCount || 1)

      const res = await fetch("/api/analyze-spending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          aiEnabled: true,
        
          tripType: group.trip_type || "Leisure",
          destinations: group.destinations || [],
        
          totalDays: group.total_days || 3,
          currentDay: group.current_day || 1,
        
          budgetTotal: totalBudget,
          totalSpentSoFar,
        
          currentExpense: {
            description,
            amount: newExpenseAmount,
            category
          },
        
          recentExpenses: (recentData || []).map(e => ({
            description: e.description,
            amount: Number(e.amount),
            category: e.category
          }))
        })
        
      })

      if (!res.ok) {
        onAnalysisComplete?.()
        return
      }

      const result = await res.json()

      if (result?.tip) onAnalysisComplete?.(result.tip)
      else onAnalysisComplete?.()

    } catch (err) {
      console.error("AI Alert Error", err)
      onAnalysisComplete?.()
    }
  }

  // SAVE
  async function handleSave() {
    if (!targetGroupId || !amount || !description || !paidBy) return

    setSubmitting(true)

    try {
      const numAmount = parseFloat(amount)
      const payload = {
        description,
        amount: numAmount,
        paid_by: paidBy,
        category,
        payment_method: paymentMethod
      }

      let expenseId = expenseToEdit?.id

      if (isEditing && expenseId) {
        await supabase.from("expenses").update(payload).eq("id", expenseId)
        await supabase.from("expense_splits").delete().eq("expense_id", expenseId)
      } else {
        const { data, error } = await supabase
          .from("expenses")
          .insert({ group_id: targetGroupId, ...payload })
          .select()
          .single()

        if (error) throw error
        expenseId = data.id
      }

      if (splitWith.length === 0) throw new Error("Select at least one person")

      const splitAmt = numAmount / splitWith.length

      await supabase.from("expense_splits")
        .insert(splitWith.map(uid => ({
          expense_id: expenseId!,
          user_id: uid,
          amount_owed: splitAmt
        })))

      toast.success(isEditing ? "Updated" : "Saved")
      trackEvent.expenseAdded(numAmount, category, splitWith.length)

      onExpenseAdded?.(true)

      // === EMAIL NOTIFICATION LOGIC ===
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const payerName = user?.user_metadata?.full_name || "A friend"
        const groupName = activeGroup?.name || availableGroups.find(g => g.id === targetGroupId)?.name || "Trip"

        const recipients = members
          .filter(m => splitWith.includes(m.id) && m.id !== user?.id && m.email)
          .map(m => ({
            email: m.email,
            name: m.full_name,
            amountOwed: numAmount / splitWith.length
          }))

        if (recipients.length > 0) {
          console.log("Sending email notifications to:", recipients.length, "people");
          
          // Use await to ensure the request is actually sent before component unmounts
          const res = await fetch('/api/notify', {
            method: 'POST',
            body: JSON.stringify({
              type: 'EXPENSE',
              action: isEditing ? 'EDITED' : 'ADDED',
              amount: numAmount,
              payerName,
              groupName,
              description,
              recipients
            })
          })
          
          if (!res.ok) {
             const errData = await res.json().catch(() => ({}))
             console.error("Email notification failed:", errData)
          } else {
             console.log("Email notification sent successfully")
          }
        } else {
          console.warn("No recipients found with email addresses for notification")
        }
      } catch (err) { console.error("Notify error", err) }
      // ================================

      await checkAndSaveAlerts(targetGroupId, numAmount, category)

      onOpenChange(false)

    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    if (currentStep === 0 && (!amount || parseFloat(amount) <= 0)) return toast.error("Enter valid amount")
    if (currentStep === 1 && !description) return toast.error("Enter description")
    setDirection(1)
    setCurrentStep(s => s + 1)
  }

  const handleBack = () => {
    setDirection(-1)
    setCurrentStep(s => s - 1)
  }

  const toggleSplitMember = (id: string) =>
    setSplitWith(curr =>
      curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id]
    )

  if (!activeGroup && !manualGroupId && !expenseToEdit) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="
          bg-[#020617] text-white border-white/10
          sm:max-w-lg sm:rounded-2xl
          w-full max-w-[95%]
          h-[88vh]
          flex flex-col
          overflow-hidden
        "
      >
        <DialogTitle className="sr-only">Add Expense</DialogTitle>

        <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
          {currentStep > 0 ? (
            <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full w-10 h-10 bg-white/5 text-zinc-400">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full w-10 h-10 bg-white/5 text-zinc-400">
              <X className="w-5 h-5" />
            </Button>
          )}

          <div className="flex gap-2">
            {STEPS.map((_, idx) => (
              <motion.div
                key={idx}
                animate={{
                  width: idx === currentStep ? 32 : 8,
                  backgroundColor: idx <= currentStep ? "#00A896" : "#27272a"
                }}
                className="h-1.5 rounded-full"
              />
            ))}
          </div>

          <div className="w-10" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-20">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              initial={{ x: direction > 0 ? 40 : -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -40 : 40, opacity: 0 }}
              transition={{ type: "spring" as const, stiffness: 260, damping: 25 }}
              className="h-full flex flex-col"
            >
              {currentStep === 0 && (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-zinc-500 text-sm mb-4">Total Amount</p>
                  <div className="relative flex items-center justify-center">
                    <span className="text-5xl font-bold text-[#00A896] mr-1 mt-1">₹</span>
                    <input
                      ref={inputRef}
                      inputMode="numeric"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full max-w-[260px] text-7xl font-bold bg-transparent border-none text-center caret-[#00A896] outline-none"
                    />
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-8 pt-6">
                  <h2 className="text-2xl font-bold text-center">What is this for?</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {CATEGORIES.map(cat => {
                      const isSelected = category === cat.id
                      return (
                        <motion.button
                          key={cat.id}
                          onClick={() => setCategory(cat.id)}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all space-y-3",
                            isSelected ? "border-[#00A896] bg-[#00A896]/10" : "border-white/5 bg-white/5"
                          )}
                        >
                          <div className={cn("p-3 rounded-full", cat.bg)}>
                            <cat.icon className={cn("w-6 h-6", cat.color)} />
                          </div>
                          <span className={cn("text-xs font-semibold", isSelected ? "text-white" : "text-zinc-400")}>
                            {cat.label}
                          </span>
                        </motion.button>
                      )
                    })}
                  </div>

                  <div className="space-y-3">
                    <Label className="text-zinc-400 text-xs ml-1">Note</Label>
                    <Input
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="e.g. Dinner"
                      className="bg-white/5 border-white/10 text-white h-14 rounded-2xl pl-5 text-lg placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-8 pt-4">
                  <h2 className="text-2xl font-bold text-center">Who is paying?</h2>

                  <div className="bg-white/5 rounded-3xl p-5 space-y-4 border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 text-sm">Paid By</span>
                      <Select value={paidBy} onValueChange={setPaidBy}>
                        <SelectTrigger className="bg-transparent border-none shadow-none text-right">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f172a] text-white border-white/10">
                          {members.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-full h-px bg-white/10" />

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 text-sm">Method</span>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="bg-transparent border-none shadow-none text-right">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f172a] text-white border-white/10">
                          <SelectItem value="UPI"><span className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> UPI</span></SelectItem>
                          <SelectItem value="Cash"><span className="flex items-center gap-2"><Wallet className="w-4 h-4" /> Cash</span></SelectItem>
                          <SelectItem value="Card"><span className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Card</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                  <h2 className="text-zinc-400 text-sm font-medium ml-1 pb-1">Split Between</h2>
                    {members.map(member => {
                      const isSelected = splitWith.includes(member.id)
                      return (
                        <motion.button
                          key={member.id}
                          onClick={() => toggleSplitMember(member.id)}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                            isSelected ? "bg-[#00A896]/10 border-[#00A896]" : "bg-white/[0.02] border-white/5"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              isSelected ? "bg-[#00A896] text-white" : "bg-white/10 text-zinc-400"
                            )}>
                              {member.full_name.charAt(0)}
                            </div>
                            <span className={cn(
                              "font-medium text-lg",
                              isSelected ? "text-white" : "text-zinc-400"
                            )}>
                              {member.full_name}
                            </span>
                          </div>

                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                            isSelected ? "border-[#00A896] bg-[#00A896]" : "border-zinc-600"
                          )}>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-5 border-t border-white/10 bg-[#020617]/90 backdrop-blur-lg">
          <Button
            onClick={currentStep === 2 ? handleSave : handleNext}
            disabled={submitting}
            className="w-full h-14 text-lg font-bold rounded-xl bg-[#00A896]"
          >
            {submitting
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : currentStep === 2
                ? (isEditing ? "Update Expense" : "Confirm Expense")
                : "Next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}