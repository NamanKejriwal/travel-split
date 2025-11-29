import { useEffect, useState } from "react"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase } from "@/lib/supabaseClient"
import { Group } from "@/components/views/groups-view"
import { Loader2, AlertTriangle, Bus, Plane, BedDouble, Utensils, ShoppingBag, Ticket, HelpCircle } from "lucide-react"

export interface ExpenseToEdit {
  id: string
  description: string
  amount: number
  paid_by: string
  category?: string
}

interface AddExpenseDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeGroup: Group | null
  onExpenseAdded?: () => void
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

export function AddExpenseDrawer({ open, onOpenChange, activeGroup, onExpenseAdded, expenseToEdit }: AddExpenseDrawerProps) {
  const [availableGroups, setAvailableGroups] = useState<Group[]>([])
  const [manualGroupId, setManualGroupId] = useState<string>("")
  const [isInitializing, setIsInitializing] = useState(true)

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [paidBy, setPaidBy] = useState("")
  const [category, setCategory] = useState("Food")
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
          await fetchExistingSplits(expenseToEdit.id)
        } else {
          setDescription("")
          setAmount("")
          setCategory("Food")
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

      const { data, error } = await supabase
        .from('group_members')
        .select('groups(id, name, created_at, created_by)')
        .eq('user_id', user.id)

      if (error) throw error

      // @ts-ignore
      const rawData = data || []
      const groups = rawData
        // @ts-ignore
        .map(item => Array.isArray(item.groups) ? item.groups[0] : item.groups)
        .filter(Boolean) as Group[] 

      setAvailableGroups(groups)
      
      if (groups.length === 1) setManualGroupId(groups[0].id)
    } catch (error) {
      console.error("Error fetching groups:", error)
    }
  }

  async function fetchExistingSplits(expenseId: string) {
    try {
      const { data, error } = await supabase
        .from('expense_splits')
        .select('user_id')
        .eq('expense_id', expenseId)
      
      if (error) throw error
      if (data) {
        setSplitWith(data.map(s => s.user_id))
      }
    } catch (error) {
      console.error("Error fetching splits:", error)
    }
  }

  async function fetchMembers(groupId: string) {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, profiles(id, full_name)')
        .eq('group_id', groupId)

      if (error) console.error("Error fetching members:", error)

      // @ts-ignore
      let mappedMembers: Member[] = (data || []).map(item => {
        // Safe access: handle if profiles is array or object
        const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;

        if (profile && profile.full_name) {
            return { id: profile.id, full_name: profile.full_name }
        }
        
        if (user && item.user_id === user.id) {
            return { id: user.id, full_name: 'You' }
        }
        
        return { id: item.user_id, full_name: 'Unknown Member' }
      })

      const amIInList = mappedMembers.some(m => m.id === user?.id)
      if (user && !amIInList) {
          mappedMembers.push({ id: user.id, full_name: 'You' })
      }

      setMembers(mappedMembers)

      if (!expenseToEdit) {
        if (user && !paidBy) setPaidBy(user.id)
        else if (mappedMembers.length > 0 && !paidBy) setPaidBy(mappedMembers[0].id)
        setSplitWith(mappedMembers.map((m: Member) => m.id))
      }

    } catch (error) {
      console.error("Critical error in fetchMembers:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!targetGroupId || !amount || !description || !paidBy) return
    setSubmitting(true)

    try {
      const numericAmount = parseFloat(amount)
      if (isNaN(numericAmount) || numericAmount <= 0) throw new Error("Invalid amount")

      let expenseId = expenseToEdit?.id

      if (isEditing && expenseId) {
        const { error: updateError } = await supabase
          .from('expenses')
          .update({
            description,
            amount: numericAmount,
            paid_by: paidBy,
            category
          })
          .eq('id', expenseId)
        
        if (updateError) throw updateError

        const { error: deleteSplitsError } = await supabase
          .from('expense_splits')
          .delete()
          .eq('expense_id', expenseId)
        
        if (deleteSplitsError) throw deleteSplitsError

      } else {
        const { data: expenseData, error: insertError } = await supabase
          .from('expenses')
          .insert({
              group_id: targetGroupId,
              description,
              amount: numericAmount,
              paid_by: paidBy,
              category
          })
          .select()
          .single()
        
        if (insertError) throw insertError
        expenseId = expenseData.id
      }

      if (!expenseId) throw new Error("No expense ID found")

      const splitCount = splitWith.length
      if (splitCount === 0) throw new Error("Must split with at least one person")
      
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

      onOpenChange(false)
      
      if (onExpenseAdded) onExpenseAdded()

      if (!isEditing) {
        setDescription("")
        setAmount("")
        setCategory("Food")
      }

    } catch (error: any) {
      console.error("Error saving expense:", error)
      alert(error.message || "Failed to save expense.")
    } finally {
      setSubmitting(false)
    }
  }

  const toggleSplitMember = (memberId: string) => {
    setSplitWith(current => 
      current.includes(memberId) 
        ? current.filter(id => id !== memberId)
        : [...current, memberId]
    )
  }

  if (isInitializing) {
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="sr-only">
                    <DrawerTitle>Loading</DrawerTitle>
                    <DrawerDescription>Please wait...</DrawerDescription>
                </div>
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                </div>
            </DrawerContent>
        </Drawer>
    )
  }

  if (!activeGroup && !manualGroupId && !expenseToEdit) {
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm p-8 text-center">
                    <DrawerHeader>
                        <DrawerTitle className="text-center text-lg font-semibold text-zinc-900">
                            No Trip Selected
                        </DrawerTitle>
                        <DrawerDescription className="text-center text-zinc-500">
                            Action required
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="flex justify-center mb-4 mt-2">
                        <AlertTriangle className="h-12 w-12 text-yellow-500 opacity-80" />
                    </div>
                    <p className="text-zinc-500 mb-6 text-sm">
                        Please go to the <b>Groups</b> tab and click on a trip to select it before adding expenses.
                    </p>
                    <Button onClick={() => onOpenChange(false)} className="w-full" variant="outline">
                        Close
                    </Button>
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
            <DrawerDescription>
                {activeGroup ? `For ${activeGroup.name}` : "Update expense details"}
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="p-4 space-y-4">
            {!activeGroup && !isEditing && (
                <div className="space-y-2">
                    <Label className="text-emerald-600 font-semibold">Select Trip</Label>
                    <Select value={manualGroupId} onValueChange={setManualGroupId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Choose a trip..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableGroups.map(group => (
                                <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="space-y-2">
               <Label className="text-center block text-xs text-muted-foreground uppercase tracking-wide">Amount</Label>
               <div className="flex items-center justify-center">
                  <span className="text-3xl font-bold mr-1">₹</span>
                  <Input 
                    className="text-3xl font-bold border-none text-center w-40 focus-visible:ring-0 p-0 h-auto placeholder:text-zinc-200" 
                    placeholder="0.00" 
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
               </div>
            </div>

            <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                        {CATEGORIES.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                                <div className="flex items-center">
                                    <cat.icon className="w-4 h-4 mr-2 opacity-50" />
                                    {cat.label}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Description</Label>
                <Input 
                    placeholder="What was this for?" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label>Paid By</Label>
                <Select value={paidBy} onValueChange={setPaidBy} disabled={!targetGroupId}>
                    <SelectTrigger>
                        <SelectValue placeholder={loading ? "Loading..." : "Select who paid"} />
                    </SelectTrigger>
                    <SelectContent>
                        {members.map(member => (
                            <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label className="mb-2 block">Split With</Label>
                <div className="grid grid-cols-2 gap-2">
                    {members.map(member => (
                        <div key={member.id} className="flex items-center space-x-2 border p-2 rounded-md">
                            <Checkbox 
                                id={`split-${member.id}`} 
                                checked={splitWith.includes(member.id)}
                                onCheckedChange={() => toggleSplitMember(member.id)}
                            />
                            <Label htmlFor={`split-${member.id}`} className="cursor-pointer flex-1 text-sm font-normal">
                                {member.full_name}
                            </Label>
                        </div>
                    ))}
                </div>
            </div>
          </div>

          <DrawerFooter>
            <Button onClick={handleSave} disabled={submitting || !amount || !description || !paidBy || !targetGroupId} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update Expense" : "Save Expense"}
            </Button>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}