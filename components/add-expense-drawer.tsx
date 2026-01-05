"use client"

import { useEffect, useState, useRef, useCallback } from "react"
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

interface Recipient {
  email: string
  name: string
  amountOwed: number
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
  const [sendingEmails, setSendingEmails] = useState(false)

  const targetGroupId = activeGroup?.id || manualGroupId
  const isEditing = !!expenseToEdit
  const inputRef = useRef<HTMLInputElement>(null)
  const isMounted = useRef(true)

  // Helper function to validate email
  const isValidEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }, [])

  // Prevent bg scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "auto"
    return () => {
      document.body.style.overflow = "auto"
    }
  }, [open])

  // Handle component mount/unmount
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // Initialize component
  useEffect(() => {
    if (!open) {
      // Reset form after dialog closes (with delay for animation)
      const timer = setTimeout(() => {
        if (!open && isMounted.current) {
          setCurrentStep(0)
          setAmount("")
          setCategory("Food")
          setDescription("")
          setPaymentMethod("UPI")
          setSplitWith([])
          setSendingEmails(false)
        }
      }, 300)
      return () => clearTimeout(timer)
    }

    if (isMounted.current) {
      setCurrentStep(0)
      setSubmitting(false)
      setSendingEmails(false)
    }

    const init = async () => {
      if (!activeGroup) await fetchUserGroups()
      else if (isMounted.current) setManualGroupId("")

      if (expenseToEdit && isMounted.current) {
        setAmount(expenseToEdit.amount.toString())
        setCategory(expenseToEdit.category || "Food")
        setDescription(expenseToEdit.description)
        setPaidBy(expenseToEdit.paid_by)
        setPaymentMethod(expenseToEdit.payment_method || "UPI")
        await fetchExistingSplits(expenseToEdit.id)
      }
    }

    init()
    
    // Focus input after a small delay for better UX
    const focusTimer = setTimeout(() => {
      if (open && inputRef.current && isMounted.current) {
        inputRef.current.focus()
      }
    }, 150)
    
    return () => clearTimeout(focusTimer)
  }, [open, activeGroup, expenseToEdit])

  // Fetch user groups
  const fetchUserGroups = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from("group_members")
      .select("groups(*)")
      .eq("user_id", user.id)

    if (error) {
      console.error("Failed to fetch groups:", error)
      toast.error("Could not load groups")
      return
    }

    const groups: Group[] = (data || [])
      .map(item => {
        const group = item.groups as any
        return Array.isArray(group) ? group[0] : group
      })
      .filter(Boolean)

    if (isMounted.current) {
      setAvailableGroups(groups)

      if (groups.length && !activeGroup) {
        setManualGroupId(groups[0].id)
      }
    }
  }, [activeGroup])

  // Fetch existing splits for edit mode
  const fetchExistingSplits = async (expenseId: string) => {
    const { data, error } = await supabase
      .from("expense_splits")
      .select("user_id")
      .eq("expense_id", expenseId)

    if (error) {
      console.error("Failed to fetch splits:", error)
      toast.error("Could not load expense details")
      return
    }

    if (data && isMounted.current) {
      setSplitWith(data.map(s => s.user_id))
    }
  }

  // Fetch members for the group
  useEffect(() => {
    if (targetGroupId) fetchMembers(targetGroupId)
  }, [targetGroupId])

  const fetchMembers = async (groupId: string) => {
    if (!isMounted.current) return
    setLoading(true)

    try {
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

      if (error) throw error

      const mapped: Member[] = (data || []).map(item => {
        const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
        return {
          id: item.user_id,
          full_name: profile?.full_name || "Member",
          email: profile?.email
        }
      })

      // Add current user if not in list
      if (user && !mapped.find(m => m.id === user.id)) {
        mapped.push({ id: user.id, full_name: "You" })
      }

      if (isMounted.current) {
        setMembers(mapped)

        // Initialize form fields
        if (!expenseToEdit) {
          if (user && !paidBy) setPaidBy(user.id)
          else if (mapped.length > 0 && !paidBy) setPaidBy(mapped[0].id)

          // Auto-select all members by default
          setSplitWith(mapped.map(m => m.id))
        }
      }
    } catch (error) {
      console.error("Failed to fetch members:", error)
      toast.error("Could not load group members")
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }

  // AI Analysis logic
  const checkAndSaveAlerts = useCallback(async (
    groupId: string, 
    newExpenseAmount: number, 
    category: string
  ) => {
    try {
      // Skip AI for small amounts
      if (newExpenseAmount < 99) {
        onAnalysisComplete?.()
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        onAnalysisComplete?.()
        return
      }

      // Fetch group settings
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single()

      if (groupError || !group || !group.ai_alerts_enabled) {
        onAnalysisComplete?.()
        return
      }

      // Fetch recent expenses for context
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

      // Calculate totals
      const totalSpentSoFar = allExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0

      const { count: memberCount } = await supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId)

      const totalBudget = (group.budget_per_person || 0) * (memberCount || 1)

      // Call AI analysis endpoint
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
          currentExpense: { description, amount: newExpenseAmount, category },
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
      if (result?.tip) {
        onAnalysisComplete?.(result.tip)
      } else {
        onAnalysisComplete?.()
      }
    } catch (err) {
      console.error("AI Alert Error:", err)
      onAnalysisComplete?.()
    }
  }, [description, category, onAnalysisComplete])

  // Send email notifications (await for reliability)
  const sendEmailNotifications = async (
    recipients: Recipient[],
    numAmount: number,
    payerName: string,
    groupName: string
  ): Promise<boolean> => {
    if (recipients.length === 0) return false

    // Safety: Limit recipients to prevent API abuse
    const maxRecipients = 100
    const safeRecipients = recipients.slice(0, maxRecipients)
    
    if (recipients.length > maxRecipients) {
      console.warn(`Too many recipients (${recipients.length}), limiting to ${maxRecipients}`)
    }

    try {
      // CRITICAL: We await this to ensure Vercel/Browser doesn't kill the request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'EXPENSE',
          action: isEditing ? 'EDITED' : 'ADDED',
          amount: numAmount,
          payerName,
          groupName,
          description,
          recipients: safeRecipients
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!isMounted.current) {
        console.log('Component unmounted during email send')
        return false
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error("Email notification failed:", {
          status: res.status,
          error: errorData.message || 'Unknown error'
        })
        return false
      }

      const result = await res.json()
      console.log("Email notification sent successfully")
      return true

    } catch (err: any) {
      console.error("Notify setup error:", err)
      
      if (err.name === 'AbortError') {
        console.error('Email send timeout after 10 seconds')
      }
      return false
    }
  }

  // Main save handler
  const handleSave = async () => {
    if (!targetGroupId) {
      toast.error("No group selected")
      return
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    
    if (!description.trim()) {
      toast.error("Enter a description")
      return
    }
    
    if (!paidBy) {
      toast.error("Select who paid")
      return
    }
    
    if (splitWith.length === 0) {
      toast.error("Select at least one person to split with")
      return
    }

    if (!isMounted.current) return
    
    setSubmitting(true)

    try {
      const numAmount = parseFloat(amount)
      const splitAmt = parseFloat((numAmount / splitWith.length).toFixed(2))
      const payload = {
        description: description.trim(),
        amount: numAmount,
        paid_by: paidBy,
        category,
        payment_method: paymentMethod,
        updated_at: new Date().toISOString()
      }

      let expenseId = expenseToEdit?.id

      // Database operations
      if (isEditing && expenseId) {
        // Update existing expense
        const { error: expenseError } = await supabase
          .from("expenses")
          .update(payload)
          .eq('id', expenseId)

        if (expenseError) throw expenseError

        // Recreate splits
        await supabase.from("expense_splits").delete().eq("expense_id", expenseId)
      } else {
        // Create new expense - let database handle created_at
        const { data, error } = await supabase
          .from("expenses")
          .insert({ 
            group_id: targetGroupId, 
            ...payload
          })
          .select()
          .single()

        if (error) throw error
        expenseId = data.id
      }

      // Create expense splits - let database handle created_at
      const { error: splitError } = await supabase
        .from("expense_splits")
        .insert(
          splitWith.map(userId => ({
            expense_id: expenseId!,
            user_id: userId,
            amount_owed: splitAmt
          }))
        )

      if (splitError) throw splitError

      // Success feedback
      onExpenseAdded?.(true)

      // Email notifications (get payer name first)
      let emailSent = false
      let payerName = "A friend"
      let groupName = "Trip"
      
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        // Get payer's display name
        payerName = user?.user_metadata?.full_name || "A friend"
        if (user) {
          // Try to get actual profile data
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()
            
          if (profile?.full_name) {
            payerName = profile.full_name
          }
        }
        
        // Get group name
        groupName = activeGroup?.name || 
                   availableGroups.find(g => g.id === targetGroupId)?.name || 
                   "Trip"

        // Filter recipients carefully
        const recipients: Recipient[] = members
          .filter(m => {
            // Must be in split
            if (!splitWith.includes(m.id)) return false
            
            // Not the payer
            if (m.id === user?.id) return false
            
            // Must have valid email
            if (!m.email || !isValidEmail(m.email)) return false
            
            return true
          })
          .map(m => ({
            email: m.email!,
            name: m.full_name,
            amountOwed: splitAmt
          }))

        if (recipients.length > 0) {
          setSendingEmails(true)
          emailSent = await sendEmailNotifications(recipients, numAmount, payerName, groupName)
        }
      } catch (emailErr: any) {
        console.error("Email preparation error:", emailErr)
      } finally {
        if (isMounted.current) {
          setSendingEmails(false)
        }
      }

      // Show appropriate success message
      if (emailSent) {
        toast.success(isEditing ? "Updated and notification sent!" : "Saved and notification sent!")
      } else {
        toast.success(isEditing ? "Expense updated!" : "Expense saved!")
      }

      // Trigger AI analysis (fire-and-forget)
      checkAndSaveAlerts(targetGroupId, numAmount, category)

      // Small delay for better UX before closing
      await new Promise(resolve => setTimeout(resolve, 800))

      // Close dialog
      if (isMounted.current) {
        onOpenChange(false)
      }

    } catch (error: any) {
      console.error("Save error:", error)
      toast.error(error.message || "Failed to save expense")
    } finally {
      if (isMounted.current) {
        setSubmitting(false)
        setSendingEmails(false)
      }
    }
  }

  // Navigation handlers
  const handleNext = () => {
    if (currentStep === 0 && (!amount || parseFloat(amount) <= 0)) {
      return toast.error("Enter a valid amount")
    }
    
    if (currentStep === 1 && !description.trim()) {
      return toast.error("Enter a description")
    }
    
    if (isMounted.current) {
      setDirection(1)
      setCurrentStep(s => Math.min(s + 1, STEPS.length - 1))
    }
  }

  const handleBack = () => {
    if (isMounted.current) {
      setDirection(-1)
      setCurrentStep(s => Math.max(s - 1, 0))
    }
  }

  const toggleSplitMember = (id: string) => {
    if (isMounted.current) {
      setSplitWith(curr => 
        curr.includes(id) 
          ? curr.filter(x => x !== id) 
          : [...curr, id]
      )
    }
  }

  // Early return if no valid context
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
          shadow-2xl
        "
      >
        <DialogTitle className="sr-only">
          {isEditing ? "Edit Expense" : "Add New Expense"}
        </DialogTitle>

        {/* Header with navigation */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0 border-b border-white/5">
          {currentStep > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="rounded-full w-10 h-10 bg-white/5 text-zinc-400 hover:bg-white/10 transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="rounded-full w-10 h-10 bg-white/5 text-zinc-400 hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </Button>
          )}

          {/* Step indicators */}
          <div className="flex gap-2" aria-label="Progress steps">
            {STEPS.map((_, idx) => (
              <motion.div
                key={idx}
                animate={{
                  width: idx === currentStep ? 32 : 8,
                  backgroundColor: idx <= currentStep ? "#00A896" : "#27272a"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="h-1.5 rounded-full"
                aria-current={idx === currentStep ? "step" : undefined}
              />
            ))}
          </div>

          <div className="w-10" /> {/* Spacer for alignment */}
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto px-6 pb-20 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              initial={{ x: direction > 0 ? 40 : -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -40 : 40, opacity: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 260, 
                damping: 25,
                opacity: { duration: 0.2 }
              }}
              className="h-full flex flex-col"
            >
              {/* Step 1: Amount */}
              {currentStep === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <p className="text-zinc-500 text-sm mb-6 font-medium">Total Amount</p>
                  <div className="relative flex items-center justify-center">
                    <span 
                      className="text-5xl font-bold text-[#00A896] mr-2 mt-1"
                      aria-hidden="true"
                    >
                      ₹
                    </span>
                    <input
                      ref={inputRef}
                      inputMode="numeric"
                      type="text"
                      value={amount}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, '')
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          setAmount(value)
                        }
                      }}
                      placeholder="0"
                      className="w-full max-w-[280px] text-7xl font-bold bg-transparent border-none text-center caret-[#00A896] outline-none placeholder:text-zinc-600/50"
                      aria-label="Enter amount in Indian Rupees"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && amount && parseFloat(amount) > 0) {
                          handleNext()
                        }
                      }}
                    />
                  </div>
                  <p className="text-zinc-500 text-sm mt-6">
                    Press <span className="text-[#00A896] font-semibold">Enter</span> or tap <span className="text-[#00A896] font-semibold">Next</span> to continue
                  </p>
                </div>
              )}

              {/* Step 2: Details */}
              {currentStep === 1 && (
                <div className="space-y-8 pt-6">
                  <h2 className="text-2xl font-bold text-center text-white">
                    What is this for?
                  </h2>
                  
                  {/* Categories */}
                  <div className="grid grid-cols-3 gap-3">
                    {CATEGORIES.map(cat => {
                      const Icon = cat.icon
                      const isSelected = category === cat.id
                      
                      return (
                        <motion.button
                          key={cat.id}
                          onClick={() => setCategory(cat.id)}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all space-y-3",
                            "focus:outline-none focus:ring-2 focus:ring-[#00A896] focus:ring-offset-2 focus:ring-offset-[#020617]",
                            isSelected 
                              ? "border-[#00A896] bg-[#00A896]/10" 
                              : "border-white/5 bg-white/5 hover:bg-white/10"
                          )}
                          aria-pressed={isSelected}
                        >
                          <div className={cn("p-3 rounded-full", cat.bg)}>
                            <Icon className={cn("w-6 h-6", cat.color)} />
                          </div>
                          <span className={cn(
                            "text-xs font-semibold",
                            isSelected ? "text-white" : "text-zinc-400"
                          )}>
                            {cat.label}
                          </span>
                        </motion.button>
                      )
                    })}
                  </div>

                  {/* Description */}
                  <div className="space-y-3">
                    <Label 
                      htmlFor="expense-description" 
                      className="text-zinc-400 text-xs font-medium ml-1"
                    >
                      Note / Description
                    </Label>
                    <Input
                      id="expense-description"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="e.g., Dinner at restaurant, Taxi ride, Hotel stay"
                      className="bg-white/5 border-white/10 text-white h-14 rounded-2xl pl-5 text-lg placeholder:text-zinc-600 focus:border-[#00A896] focus:ring-[#00A896] transition-colors"
                      maxLength={100}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && description.trim()) {
                          handleNext()
                        }
                      }}
                    />
                    <p className="text-xs text-zinc-500 text-right">
                      {description.length}/100 characters
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Split */}
              {currentStep === 2 && (
                <div className="space-y-8 pt-4">
                  <h2 className="text-2xl font-bold text-center text-white">
                    Who is paying?
                  </h2>

                  {/* Payment Details Card */}
                  <div className="bg-white/5 rounded-3xl p-5 space-y-4 border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 text-sm font-medium">Paid By</span>
                      <Select value={paidBy} onValueChange={setPaidBy}>
                        <SelectTrigger 
                          className="bg-transparent border-none shadow-none text-right text-white hover:bg-white/5 px-3 py-2 rounded-lg"
                          aria-label="Select who paid"
                        >
                          <SelectValue placeholder="Select person" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f172a] text-white border-white/10">
                          {members.map(m => (
                            <SelectItem 
                              key={m.id} 
                              value={m.id}
                              className="focus:bg-white/10 focus:text-white"
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

                    <div className="w-full h-px bg-white/10" />

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 text-sm font-medium">Payment Method</span>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger 
                          className="bg-transparent border-none shadow-none text-right text-white hover:bg-white/5 px-3 py-2 rounded-lg"
                          aria-label="Select payment method"
                        >
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f172a] text-white border-white/10">
                          <SelectItem value="UPI">
                            <span className="flex items-center gap-2">
                              <Smartphone className="w-4 h-4" /> UPI
                            </span>
                          </SelectItem>
                          <SelectItem value="Cash">
                            <span className="flex items-center gap-2">
                              <Wallet className="w-4 h-4" /> Cash
                            </span>
                          </SelectItem>
                          <SelectItem value="Card">
                            <span className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4" /> Card
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Split Between Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-zinc-400 text-sm font-medium ml-1">
                        Split Between ({splitWith.length} selected)
                      </h3>
                      {members.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const allSelected = splitWith.length === members.length
                            setSplitWith(allSelected ? [] : members.map(m => m.id))
                          }}
                          className="text-xs text-[#00A896] hover:text-[#00A896]/80 hover:bg-[#00A896]/10"
                        >
                          {splitWith.length === members.length ? "Deselect All" : "Select All"}
                        </Button>
                      )}
                    </div>
                    
                    {members.map(member => {
                      const isSelected = splitWith.includes(member.id)
                      const splitAmount = amount && splitWith.length > 0 
                        ? parseFloat((parseFloat(amount) / splitWith.length).toFixed(2))
                        : 0
                      
                      return (
                        <motion.button
                          key={member.id}
                          onClick={() => toggleSplitMember(member.id)}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                            "focus:outline-none focus:ring-2 focus:ring-[#00A896] focus:ring-offset-2 focus:ring-offset-[#020617]",
                            isSelected 
                              ? "bg-[#00A896]/10 border-[#00A896]" 
                              : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                          )}
                          aria-pressed={isSelected}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                              "transition-colors",
                              isSelected 
                                ? "bg-[#00A896] text-white" 
                                : "bg-white/10 text-zinc-400"
                            )}>
                              {member.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-left">
                              <span className={cn(
                                "font-medium text-lg block",
                                isSelected ? "text-white" : "text-zinc-400"
                              )}>
                                {member.full_name}
                              </span>
                              {isSelected && amount && splitWith.length > 0 && (
                                <span className="text-sm text-[#00A896] font-medium">
                                  ₹{splitAmount.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                            "transition-colors",
                            isSelected 
                              ? "border-[#00A896] bg-[#00A896]" 
                              : "border-zinc-600"
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

        {/* Footer with action button */}
        <div className="p-5 border-t border-white/10 bg-[#020617]/90 backdrop-blur-lg sticky bottom-0">
          <Button
            onClick={currentStep === 2 ? handleSave : handleNext}
            disabled={submitting || loading || sendingEmails}
            className="w-full h-14 text-lg font-bold rounded-xl bg-[#00A896] hover:bg-[#00A896]/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#00A896]/20"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {isEditing ? "Updating..." : "Saving..."}
              </>
            ) : sendingEmails ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Sending Notifications...
              </>
            ) : currentStep === 2 ? (
              isEditing ? "Update Expense" : `Confirm (₹${amount ? parseFloat(amount).toLocaleString('en-IN') : "0"})`
            ) : (
              "Next"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}