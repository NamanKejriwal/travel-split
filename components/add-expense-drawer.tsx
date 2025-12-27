"use client"

import { useEffect, useState } from "react"
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/utils/supabase/client"
import { Group } from "@/components/views/groups-view"
import { Loader2, Bus, Plane, BedDouble, Utensils, ShoppingBag, Ticket, HelpCircle, Smartphone, Wallet, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { trackEvent } from '@/lib/analytics'
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

const supabase = createClient()

// --- ANIMATION VARIANTS (Consistent with Dashboard) ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { 
      staggerChildren: 0.06,
      delayChildren: 0.1
    } 
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { 
      type: "spring" as const, // <--- ADD "as const" HERE
      stiffness: 260, 
      damping: 20 
    }
  }
}

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
}

const CATEGORY_CONFIG: Record<string, { icon: any, color: string }> = {
  "Food": { icon: Utensils, color: "text-[#2dd4bf]" },
  "Local Transport": { icon: Bus, color: "text-[#3b82f6]" },
  "Travel": { icon: Plane, color: "text-[#8b5cf6]" },
  "Hostel / Hotel": { icon: BedDouble, color: "text-[#f59e0b]" },
  "Shopping": { icon: ShoppingBag, color: "text-[#ec4899]" },
  "Activity": { icon: Ticket, color: "text-[#ef4444]" },
  "Other": { icon: HelpCircle, color: "text-[#9ca3af]" },
}

const CATEGORIES = Object.keys(CATEGORY_CONFIG).map(id => ({
  id, label: id === "Travel" ? "Travel (Inter-city)" : id, ...CATEGORY_CONFIG[id]
}))

export function AddExpenseDrawer({ open, onOpenChange, activeGroup, onExpenseAdded, onAnalysisComplete, expenseToEdit }: AddExpenseDrawerProps) {
  const [availableGroups, setAvailableGroups] = useState<Group[]>([])
  const [manualGroupId, setManualGroupId] = useState<string>("")
  const [isInitializing, setIsInitializing] = useState(true)

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [paidBy, setPaidBy] = useState("")
  const [category, setCategory] = useState("Food")
  const [paymentMethod, setPaymentMethod] = useState("UPI") 
  const [splitWith, setSplitWith] = useState<string[]>([])
  
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const targetGroupId = activeGroup?.id || manualGroupId
  const isEditing = !!expenseToEdit

  useEffect(() => {
    if (open) {
      setIsInitializing(true)
      setSubmitting(false)
      
      const init = async () => {
        if (!activeGroup) {
          await fetchUserGroups()
        } else {
          setManualGroupId("") 
        }

        if (expenseToEdit) {
          setDescription(expenseToEdit.description)
          setAmount(expenseToEdit.amount.toString())
          setPaidBy(expenseToEdit.paid_by)
          setCategory(expenseToEdit.category || "Food")
          setPaymentMethod(expenseToEdit.payment_method || "UPI")
          await fetchExistingSplits(expenseToEdit.id)
        } else {
          setDescription("")
          setAmount("")
          setCategory("Food")
          setPaymentMethod("UPI")
        }
        setIsInitializing(false)
      }
      init()
    }
  }, [open, activeGroup, expenseToEdit])

  useEffect(() => {
    if (targetGroupId) {
      fetchMembers(targetGroupId)
    }
  }, [targetGroupId])

  async function fetchUserGroups() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('group_members').select('groups(id, name, created_at, created_by, category_limits, budget_per_person, start_date, end_date, destinations, trip_type, description, ai_alerts_enabled)').eq('user_id', user.id)
      // @ts-ignore
      const groups = (data || []).map(item => Array.isArray(item.groups) ? item.groups[0] : item.groups).filter(Boolean) as Group[] 
      setAvailableGroups(groups)
      if (groups.length === 1) setManualGroupId(groups[0].id)
    } catch (error) { console.error(error) }
  }

  async function fetchExistingSplits(expenseId: string) {
    const { data } = await supabase.from('expense_splits').select('user_id').eq('expense_id', expenseId)
    if (data) setSplitWith(data.map(s => s.user_id))
  }

  async function fetchMembers(groupId: string) {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('group_members').select('user_id, profiles(id, full_name)').eq('group_id', groupId)
      // @ts-ignore
      let mappedMembers: Member[] = (data || []).map(item => {
        const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        if (profile && profile.full_name) return { id: profile.id, full_name: profile.full_name }
        if (user && item.user_id === user.id) return { id: user.id, full_name: 'You' }
        return { id: item.user_id, full_name: 'Unknown Member' }
      })
      const amIInList = mappedMembers.some(m => m.id === user?.id)
      if (user && !amIInList) mappedMembers.push({ id: user.id, full_name: 'You' })
      setMembers(mappedMembers)
      if (!expenseToEdit) {
        if (user && !paidBy) setPaidBy(user.id)
        else if (mappedMembers.length > 0 && !paidBy) setPaidBy(mappedMembers[0].id)
        setSplitWith(mappedMembers.map((m: Member) => m.id))
      }
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }


async function checkAndSaveAlerts(groupId: string, newExpenseAmount: number, category: string) {
  let aiTip = null;
  try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single();
      
      if (!group || !group.ai_alerts_enabled) {
        if(onAnalysisComplete) onAnalysisComplete();
        return;
      }

      const { data: recentData } = await supabase
          .from('expenses')
          .select('description, amount, category')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
          .limit(5);

      const { data: allExpenses } = await supabase.from('expenses').select('amount').eq('group_id', groupId);
      const totalSpentSoFar = allExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      let totalDays = 1;
      let currentDay = 1;
      
      if (group.start_date && group.end_date) {
          const start = new Date(group.start_date);
          const end = new Date(group.end_date);
          const now = new Date();
          start.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0);
          totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
          currentDay = Math.ceil((now.getTime() - start.getTime()) / (1000 * 3600 * 24));
          if (currentDay < 1) currentDay = 1;
          if (currentDay > totalDays) currentDay = totalDays;
      }

      const { count: memberCount } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', groupId);
      const totalBudget = (group.budget_per_person || 0) * (memberCount || 1);
      const categoryLimits = group.category_limits || {};

      const res = await fetch('/api/analyze-spending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
              tripType: group.trip_type || 'Leisure',
              destinations: group.destinations || [{ name: 'Unknown' }],
              description: group.description || '',
              totalDays, currentDay, budgetTotal: totalBudget, totalSpentSoFar,
              recentExpenses: recentData || [],
              currentExpense: { description, amount: newExpenseAmount, category },
              categoryLimits, aiEnabled: true
          })
      });

      const aiRes = await res.json();
      
      if (aiRes) {
          if (aiRes.tip) aiTip = aiRes.tip;
          if (aiRes.alerts && Array.isArray(aiRes.alerts)) {
              let currentAlerts = group.ai_alerts || [];
              if (typeof currentAlerts === 'string') {
                try { currentAlerts = JSON.parse(currentAlerts); } catch(e) { currentAlerts = []; }
              }
              const newCategories = new Set(aiRes.alerts.map((a: any) => a.category));
              const otherAlerts = currentAlerts.filter((a: any) => !newCategories.has(a.category));
              const newAlerts = [...otherAlerts, ...aiRes.alerts];
              await supabase.from('groups').update({ ai_alerts: newAlerts }).eq('id', groupId);
          }
      }
  } catch (e) {
      console.error("❌ AI Analysis Error:", e);
  } finally {
      if(onAnalysisComplete) onAnalysisComplete(aiTip || undefined);
  }
}

async function handleSave() {
  // 1. Validate inputs immediately
  if (!targetGroupId) {
    toast.error("No trip selected. Please select a group.")
    return
  }
  if (!amount || !description || !paidBy) {
    toast.error("Please fill in all required fields.")
    return
  }

  setSubmitting(true)

  try {
    const numericAmount = parseFloat(amount)
    let expenseId = expenseToEdit?.id

    const expenseDataPayload = { 
      description, 
      amount: numericAmount, 
      paid_by: paidBy, 
      category, 
      payment_method: paymentMethod 
    }

    if (isEditing && expenseId) {
      // UPDATE LOGIC
      const { error } = await supabase
        .from('expenses')
        .update(expenseDataPayload)
        .eq('id', expenseId)

      if (error) throw error // <--- CRITICAL: Throw DB error if update fails
      
      // Clear old splits to overwrite them
      const { error: deleteError } = await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', expenseId)
        
      if (deleteError) throw deleteError

    } else {
      // INSERT LOGIC
      const { data, error } = await supabase
        .from('expenses')
        .insert({ group_id: targetGroupId, ...expenseDataPayload })
        .select()
        .single()

      // <--- CRITICAL FIX START --->
      if (error) {
        console.error("Supabase Insert Error:", error)
        throw new Error(error.message || "Database insert failed") 
      }
      
      if (!data) {
        throw new Error("Expense created but no ID returned. Please refresh.")
      }
      // <--- CRITICAL FIX END --->

      expenseId = data.id
    }

    if (!expenseId) throw new Error("Critical Error: Expense ID missing")

    // SPLIT LOGIC
    const splitCount = splitWith.length
    if (splitCount === 0) throw new Error("Please select at least one person to split with.")
    
    const splitAmount = numericAmount / splitCount
    const splitsToInsert = splitWith.map(memberId => ({ 
      expense_id: expenseId, 
      user_id: memberId, 
      amount_owed: splitAmount 
    }))

    const { error: splitError } = await supabase
      .from('expense_splits')
      .insert(splitsToInsert)

    if (splitError) throw splitError

    // SUCCESS
    setSubmitting(false) 
    onOpenChange(false)
    toast.success(isEditing ? "Expense updated!" : "Expense added!")
    trackEvent.expenseAdded(numericAmount, category, splitCount)

    if (onExpenseAdded) onExpenseAdded(true)
    await checkAndSaveAlerts(targetGroupId, numericAmount, category)

    if (!isEditing) {
      setDescription(""); setAmount(""); setCategory("Food"); setPaymentMethod("UPI")
    }

  } catch (error: any) {
    console.error("Save Expense Error:", error)
    toast.error(error.message || "Failed to save expense. Please try again.")
    setSubmitting(false) 
  }
}
  const toggleSplitMember = (memberId: string) => {
    setSplitWith(current => current.includes(memberId) ? current.filter(id => id !== memberId) : [...current, memberId])
  }

  if (isInitializing) return null

  if (!activeGroup && !manualGroupId && !expenseToEdit) {
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-[#020617] border-t border-white/10 text-white">
                <div className="p-8 text-center">
                    <p className="text-zinc-400">Please select a trip first.</p>
                    <Button onClick={() => onOpenChange(false)} className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white border-none">Close</Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-[#020617]/95 backdrop-blur-xl border-t border-white/10 text-white h-[92vh] flex flex-col mt-0">
        
        <div className="mx-auto w-full max-w-md flex flex-col h-full">
          {/* HEADER */}
          <DrawerHeader className="flex-none">
            <DrawerTitle className="text-xl font-bold text-white text-center">{isEditing ? "Edit Expense" : "Add Expense"}</DrawerTitle>
            <DrawerDescription className="text-center text-[#00A896] font-medium">{activeGroup ? activeGroup.name : "Update expense details"}</DrawerDescription>
          </DrawerHeader>
          
          {/* SCROLLABLE MIDDLE SECTION - ANIMATED */}
          <motion.div 
            className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            
            {/* Trip Selector */}
            {!activeGroup && !isEditing && (
                <motion.div variants={itemVariants} className="space-y-2">
                    <Label className="text-zinc-400">Select Trip</Label>
                    <Select value={manualGroupId} onValueChange={setManualGroupId}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:ring-[#00A896]">
                            <SelectValue placeholder="Choose a trip..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                            {availableGroups.map(group => <SelectItem key={group.id} value={group.id} className="focus:bg-[#00A896]/20 focus:text-[#00A896]">{group.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </motion.div>
            )}

            {/* Amount Input - HERO ANIMATION */}
            <motion.div 
              variants={itemVariants} 
              className="space-y-2 text-center py-4"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring" as const, stiffness: 400 }}
            >
               <Label className="text-center block text-xs font-bold text-[#00A896] uppercase tracking-widest mb-2">Amount</Label>
               <div className="flex items-center justify-center relative">
                  <span className="text-4xl font-bold mr-1 text-white/50">₹</span>
                  <Input 
                    className="text-5xl font-bold bg-transparent border-none text-center w-48 p-0 h-auto placeholder:text-zinc-700 text-white focus-visible:ring-0 focus-visible:ring-offset-0 caret-[#00A896]" 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    placeholder="0" 
                    autoFocus
                  />
               </div>
            </motion.div>

            {/* Category & Method */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-zinc-400 text-xs uppercase">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-xl hover:bg-white/10 transition-colors">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f172a] border-white/10 text-white z-[9999]">
                            {CATEGORIES.map(cat => (
                                <SelectItem key={cat.id} value={cat.id} className="focus:bg-white/10 cursor-pointer">
                                    <div className="flex items-center">
                                        <cat.icon className={cn("w-4 h-4 mr-2", cat.color)} />
                                        {cat.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-zinc-400 text-xs uppercase">Paid via</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-xl hover:bg-white/10 transition-colors">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f172a] border-white/10 text-white z-[9999]">
                            <SelectItem value="UPI" className="focus:bg-white/10"><span className="flex items-center"><Smartphone className="w-4 h-4 mr-2 text-blue-400"/> UPI</span></SelectItem>
                            <SelectItem value="Cash" className="focus:bg-white/10"><span className="flex items-center"><Wallet className="w-4 h-4 mr-2 text-green-400"/> Cash</span></SelectItem>
                            <SelectItem value="Card" className="focus:bg-white/10"><span className="flex items-center"><CreditCard className="w-4 h-4 mr-2 text-purple-400"/> Card</span></SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </motion.div>

            {/* Description */}
            <motion.div variants={itemVariants} className="space-y-2">
                <Label className="text-zinc-400 text-xs uppercase">Description</Label>
                <Input 
                    className="bg-white/5 border-white/10 text-white h-12 rounded-xl placeholder:text-zinc-600 focus-visible:ring-[#00A896]"
                    placeholder="e.g. Dinner at Martin's Corner" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                />
            </motion.div>

            {/* Paid By */}
            <motion.div variants={itemVariants} className="space-y-2">
                <Label className="text-zinc-400 text-xs uppercase">Who Paid?</Label>
                <Select value={paidBy} onValueChange={setPaidBy} disabled={!targetGroupId}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-xl hover:bg-white/10 transition-colors">
                        <SelectValue placeholder="Select who paid" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f172a] border-white/10 text-white z-[9999]">
                        {members.map(member => (
                            <SelectItem key={member.id} value={member.id} className="focus:bg-white/10 cursor-pointer">
                                {member.full_name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </motion.div>

            {/* Split With */}
            <motion.div variants={itemVariants} className="space-y-3 pb-6">
                <Label className="text-zinc-400 text-xs uppercase mb-2 block">Split With</Label>
                <div className="grid grid-cols-2 gap-2">
                    {members.map(member => {
                        const isSelected = splitWith.includes(member.id);
                        return (
                            <motion.div 
                                key={member.id} 
                                onClick={() => toggleSplitMember(member.id)}
                                initial={false}
                                animate={{
                                    backgroundColor: isSelected ? "rgba(0, 168, 150, 0.2)" : "rgba(255, 255, 255, 0.05)",
                                    borderColor: isSelected ? "#00A896" : "rgba(255, 255, 255, 0.1)",
                                }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.96 }}
                                className="flex items-center space-x-3 p-3 rounded-xl border cursor-pointer select-none"
                            >
                                <motion.div 
                                    className="w-5 h-5 rounded-full border flex items-center justify-center"
                                    animate={{
                                        backgroundColor: isSelected ? "#00A896" : "transparent",
                                        borderColor: isSelected ? "#00A896" : "#71717a"
                                    }}
                                >
                                    {isSelected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 bg-white rounded-full" />}
                                </motion.div>
                                <span className={cn("text-sm font-medium", isSelected ? "text-white" : "text-zinc-400")}>
                                    {member.full_name}
                                </span>
                            </motion.div>
                        )
                    })}
                </div>
            </motion.div>
          </motion.div>

          {/* FOOTER */}
          <DrawerFooter className="flex-none pb-8 pt-4 bg-[#020617] border-t border-white/5 z-20">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                    onClick={handleSave} 
                    disabled={submitting || !amount || !description || !paidBy} 
                    className="w-full h-14 text-lg font-bold rounded-full bg-[#00A896] hover:bg-[#00A896]/90 text-white shadow-[0_0_20px_rgba(0,168,150,0.4)] transition-all"
                >
                    {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    {isEditing ? "Update Expense" : "Save Expense"}
                </Button>
            </motion.div>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}