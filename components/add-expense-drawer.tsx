import { useEffect, useState } from "react"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase } from "@/lib/supabaseClient"
import { Group } from "@/components/views/groups-view"
import { Loader2, AlertTriangle, Bus, Plane, BedDouble, Utensils, ShoppingBag, Ticket, HelpCircle, Smartphone, Wallet, CreditCard } from "lucide-react"

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
  onAnalysisComplete?: (tip?: string) => void // UPDATED SIGNATURE
  expenseToEdit?: ExpenseToEdit | null
}

interface Member {
  id: string
  full_name: string
}

const CATEGORIES = [
  { id: "Food", label: "Food", icon: Utensils },
  { id: "Local Transport", label: "Local Transport", icon: Bus },
  { id: "Travel", label: "Travel (Inter-city)", icon: Plane },
  { id: "Hostel / Hotel", label: "Hostel / Hotel", icon: BedDouble },
  { id: "Shopping", label: "Shopping", icon: ShoppingBag },
  { id: "Activity", label: "Activity", icon: Ticket },
  { id: "Other", label: "Other", icon: HelpCircle },
]

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
        // 1. Fetch Group & Expenses
        const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single()
        if (!group || !group.ai_alerts_enabled || !group.category_limits) {
             if(onAnalysisComplete) onAnalysisComplete()
             return
        }

        const { data: expenses } = await supabase.from('expenses').select('amount').eq('group_id', groupId).eq('category', category)
        const totalSpent = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
        
        const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', groupId)
        const memberCount = count || 1

        // 2. Check Limits
        let limits = group.category_limits
        if (typeof limits === 'string') limits = JSON.parse(limits)
        const perPersonLimit = limits[category]
        
        if (!perPersonLimit) {
             if(onAnalysisComplete) onAnalysisComplete()
             return
        }

        const groupLimit = perPersonLimit * memberCount
        
        // Dates
        let totalDays = 7
        if (group.start_date && group.end_date) {
            const s = new Date(group.start_date)
            const e = new Date(group.end_date)
            totalDays = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1
        }
        const startDate = new Date(group.start_date || group.created_at || Date.now())
        const now = new Date()
        
        let currentDay = 1
        let isPreTrip = false
        const startMidnight = new Date(startDate); startMidnight.setHours(0,0,0,0);
        const nowMidnight = new Date(now); nowMidnight.setHours(0,0,0,0);

        if (nowMidnight < startMidnight) {
            isPreTrip = true
            currentDay = 0 
        } else {
            const diffTime = Math.abs(now.getTime() - startDate.getTime())
            currentDay = Math.min(totalDays, Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))))
        }

        const dailyLimit = groupLimit / totalDays
        const expectedSpendByNow = isPreTrip ? (groupLimit * 0.15) : (dailyLimit * currentDay)
        const threshold = expectedSpendByNow * 1.1

        let violations = []
        if (totalSpent > groupLimit) {
             violations.push({ category, spent: totalSpent, limit: groupLimit, reason: "limit_exceeded" })
        } else if (totalSpent > threshold) {
             violations.push({ 
                 category, 
                 spent: totalSpent, 
                 expected: expectedSpendByNow, 
                 limit: groupLimit, 
                 reason: isPreTrip ? "pre_trip_high_spend" : "pace_exceeded" 
             })
        }

        // CALL AI ALWAYS
        const res = await fetch('/api/analyze-spending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tripType: group.trip_type || 'Leisure',
                destinations: group.destinations || [],
                description: group.description || '', 
                totalDays,
                day: isPreTrip ? "Pre-Trip" : currentDay,
                violations: violations,
                aiEnabled: true
            })
        })
        const aiRes = await res.json()
        
        if (aiRes) {
            if (aiRes.tip) aiTip = aiRes.tip
            
            if (aiRes.alerts && aiRes.alerts.length > 0) {
                let currentAlerts = group.ai_alerts || []
                if (typeof currentAlerts === 'string') currentAlerts = JSON.parse(currentAlerts)
                
                const newAlerts = [
                    ...currentAlerts.filter((a: any) => a.category !== category),
                    ...aiRes.alerts
                ]
                await supabase.from('groups').update({ ai_alerts: newAlerts }).eq('id', groupId)
            }
        }
    } catch (e) {
        console.error("AI Error", e)
    } finally {
        // Pass the tip back to parent
        if(onAnalysisComplete) onAnalysisComplete(aiTip || undefined)
    }
  }

  async function handleSave() {
    if (!targetGroupId || !amount || !description || !paidBy) return
    setSubmitting(true)

    try {
      const numericAmount = parseFloat(amount)
      let expenseId = expenseToEdit?.id

      const expenseDataPayload = { description, amount: numericAmount, paid_by: paidBy, category, payment_method: paymentMethod }

      if (isEditing && expenseId) {
        await supabase.from('expenses').update(expenseDataPayload).eq('id', expenseId)
        await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
      } else {
        const { data } = await supabase.from('expenses').insert({ group_id: targetGroupId, ...expenseDataPayload }).select().single()
        expenseId = data?.id
      }

      if (!expenseId) throw new Error("No expense ID")

      const splitCount = splitWith.length
      if (splitCount === 0) throw new Error("Select split members")
      const splitAmount = numericAmount / splitCount
      const splitsToInsert = splitWith.map(memberId => ({ expense_id: expenseId, user_id: memberId, amount_owed: splitAmount }))
      await supabase.from('expense_splits').insert(splitsToInsert)

      onOpenChange(false)
      
      // Tell parent AI is starting
      if (onExpenseAdded) onExpenseAdded(true)

      // Run logic
      await checkAndSaveAlerts(targetGroupId, numericAmount, category)

      if (!isEditing) {
        setDescription(""); setAmount(""); setCategory("Food"); setPaymentMethod("UPI")
      }
    } catch (error: any) {
      alert("Failed to save: " + error.message)
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
            <DrawerContent>
                <div className="p-8 text-center">
                    <p>Please select a trip first.</p>
                    <Button onClick={() => onOpenChange(false)} className="w-full mt-4" variant="outline">Close</Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>{isEditing ? "Edit Expense" : "Add Expense"}</DrawerTitle>
            <DrawerDescription>{activeGroup ? activeGroup.name : "Update expense"}</DrawerDescription>
          </DrawerHeader>
          
          <div className="p-4 space-y-4">
            
            {!activeGroup && !isEditing && (
                <div className="space-y-2">
                    <Label>Select Trip</Label>
                    <Select value={manualGroupId} onValueChange={setManualGroupId}>
                        <SelectTrigger><SelectValue placeholder="Choose a trip..." /></SelectTrigger>
                        <SelectContent>{availableGroups.map(group => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            )}

            <div className="space-y-2">
               <Label className="text-center block text-xs text-muted-foreground uppercase tracking-wide">Amount</Label>
               <div className="flex items-center justify-center">
                  <span className="text-3xl font-bold mr-1">₹</span>
                  <Input className="text-3xl font-bold border-none text-center w-40 p-0 h-auto placeholder:text-zinc-200" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>
                                    <div className="flex items-center"><cat.icon className="w-4 h-4 mr-2 opacity-50" />{cat.label}</div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="UPI"><span className="flex items-center"><Smartphone className="w-3 h-3 mr-2"/> UPI</span></SelectItem>
                            <SelectItem value="Cash"><span className="flex items-center"><Wallet className="w-3 h-3 mr-2"/> Cash</span></SelectItem>
                            <SelectItem value="Card"><span className="flex items-center"><CreditCard className="w-3 h-3 mr-2"/> Card</span></SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="What was this for?" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="space-y-2">
                <Label>Paid By</Label>
                <Select value={paidBy} onValueChange={setPaidBy} disabled={!targetGroupId}>
                    <SelectTrigger><SelectValue placeholder="Select who paid" /></SelectTrigger>
                    <SelectContent>
                        {members.map(member => <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label className="mb-2 block">Split With</Label>
                <div className="grid grid-cols-2 gap-2">
                    {members.map(member => (
                        <div key={member.id} className="flex items-center space-x-2 border p-2 rounded-md">
                            <Checkbox id={`split-${member.id}`} checked={splitWith.includes(member.id)} onCheckedChange={() => toggleSplitMember(member.id)} />
                            <Label htmlFor={`split-${member.id}`} className="cursor-pointer flex-1 text-sm font-normal">{member.full_name}</Label>
                        </div>
                    ))}
                </div>
            </div>
          </div>

          <DrawerFooter>
            <Button onClick={handleSave} disabled={submitting || !amount || !description || !paidBy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update" : "Save"}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}