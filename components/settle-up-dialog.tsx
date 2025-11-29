import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabaseClient"
import { Group } from "@/components/views/groups-view"
import { Loader2 } from "lucide-react"

interface SettleUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeGroup: Group | null
  onSettled: () => void
}

export function SettleUpDialog({ open, onOpenChange, activeGroup, onSettled }: SettleUpDialogProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [members, setMembers] = useState<{id: string, full_name: string}[]>([])
  
  const [payTo, setPayTo] = useState("")
  const [amount, setAmount] = useState("")

  useEffect(() => {
    if (open && activeGroup) fetchMembers()
  }, [open, activeGroup])

  async function fetchMembers() {
    if (!activeGroup) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, profiles(id, full_name)')
        .eq('group_id', activeGroup.id)

      if (error) throw error

      // Robust Mapping
      // @ts-ignore
      const validMembers = (data || []).map(item => {
         if (item.profiles && item.profiles.full_name) return item.profiles
         return { id: item.user_id, full_name: 'Unknown User' }
      })

      const others = validMembers.filter((m: any) => m.id !== user?.id)
      setMembers(others)

    } catch (err) {
      console.error("Error fetching members", err)
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

      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
            group_id: activeGroup.id,
            description: 'Settlement',
            amount: numAmount,
            paid_by: user.id,
            is_settlement: true
        })
        .select()
        .single()

      if (expenseError) throw expenseError

      const { error: splitError } = await supabase
        .from('expense_splits')
        .insert({
            expense_id: expense.id,
            user_id: payTo,
            amount_owed: numAmount
        })

      if (splitError) throw splitError

      onSettled()
      onOpenChange(false)
      setAmount("")
      setPayTo("")

    } catch (error) {
      console.error("Settlement failed:", error)
      alert("Failed to record settlement")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle Up</DialogTitle>
          <DialogDescription>Record a payment you made to a friend.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Paying to</Label>
            <Select value={payTo} onValueChange={setPayTo}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Loading..." : "Select friend"} />
              </SelectTrigger>
              <SelectContent>
                {members.length === 0 ? (
                    <SelectItem value="none" disabled>No other members found</SelectItem>
                ) : (
                    members.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label>Amount</Label>
            <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-500">₹</span>
                <Input 
                    type="number" 
                    className="pl-7" 
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSettle} disabled={submitting || !payTo || !amount} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}