import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"
import { Loader2, Receipt, ArrowRightLeft, MapPin, UserPlus, Copy, Check, Trash2, Users, Pencil, Wallet, Smartphone, CreditCard } from "lucide-react"
import { Group } from "@/components/views/groups-view" 
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ExpenseToEdit } from "@/components/add-expense-drawer"

interface DashboardProps {
  activeGroup: Group | null
  onSettleUp: () => void
  onEditExpense: (expense: ExpenseToEdit) => void
}

interface Expense {
  id: string
  description: string
  amount: number
  paid_by: string
  created_at: string
  category?: string
  payment_mode?: string
  is_settlement?: boolean
  profiles?: {
    full_name: string
  }
}

interface Member {
  id: string
  full_name: string
}

const CATEGORY_COLORS: Record<string, string> = {
  "Food": "#10b981", "Local Transport": "#3b82f6", "Travel": "#8b5cf6", 
  "Hostel / Hotel": "#f59e0b", "Shopping": "#ec4899", "Activity": "#ef4444", "Other": "#9ca3af" 
}

export function Dashboard({ activeGroup, onSettleUp, onEditExpense }: DashboardProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  const [totalCost, setTotalCost] = useState(0)
  const [myPaid, setMyPaid] = useState(0)
  const [myShare, setMyShare] = useState(0)
  const [netBalance, setNetBalance] = useState(0)
  const [categoryStats, setCategoryStats] = useState<{label: string, value: number, color: string}[]>([])
  
  const [myCashSpent, setMyCashSpent] = useState(0)
  const [myUpiSpent, setMyUpiSpent] = useState(0)
  
  const [inviteCode, setInviteCode] = useState<string>("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (activeGroup) {
      fetchData()
      fetchGroupDetails()
    }
  }, [activeGroup])

  async function fetchGroupDetails() {
    if (!activeGroup) return
    const { data } = await supabase.from('groups').select('invite_code').eq('id', activeGroup.id).single()
    if (data) setInviteCode(data.invite_code)
  }

  async function fetchData() {
    if (!activeGroup) return
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUser(user)

      // Fetch Members
      const { data: memberData } = await supabase
        .from('group_members')
        .select('profiles(id, full_name)')
        .eq('group_id', activeGroup.id)
      
      if (memberData) {
        // @ts-ignore
        const cleanMembers = (memberData as any[]).map((m) => {
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
            return profile
        }).filter(Boolean) as Member[]
        setMembers(cleanMembers)
      }

      // Fetch Expenses
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select(`*, profiles (full_name)`)
        .eq('group_id', activeGroup.id)
        .order('created_at', { ascending: false })

      if (expenseError) throw expenseError

      // @ts-ignore
      const allExpenses: Expense[] = (expenseData || []).map((e: any) => {
         const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles
         return { ...e, profiles: profile }
      })
      setExpenses(allExpenses)
      
      // Calculate Stats
      const realExpenses = allExpenses.filter(e => !e.is_settlement)
      const total = realExpenses.reduce((sum, item) => sum + Number(item.amount), 0)
      setTotalCost(total)

      const myExpenses = allExpenses.filter(e => e.paid_by === user.id)
      const myOutflow = myExpenses.reduce((sum, item) => sum + Number(item.amount), 0)
      setMyPaid(myOutflow)

      // Payment Modes
      const upi = myExpenses.filter(e => e.payment_mode === "UPI" || !e.payment_mode).reduce((sum, item) => sum + Number(item.amount), 0)
      const cash = myExpenses.filter(e => e.payment_mode === "Cash").reduce((sum, item) => sum + Number(item.amount), 0)
      setMyUpiSpent(upi)
      setMyCashSpent(cash)

      // Categories
      const catMap = new Map<string, number>()
      realExpenses.forEach(e => {
        const cat = e.category || "Other"
        const current = catMap.get(cat) || 0
        catMap.set(cat, current + Number(e.amount))
      })
      setCategoryStats(Array.from(catMap.entries()).map(([label, value]) => ({
        label, value, color: CATEGORY_COLORS[label] || CATEGORY_COLORS["Other"]
      })).sort((a, b) => b.value - a.value))

      // Balances
      const { data: mySplits, error: splitError } = await supabase
        .from('expense_splits')
        .select('amount_owed, expense_id, expenses(is_settlement)')
        .eq('user_id', user.id)
      
      if (splitError) throw splitError

      const myGroupSplits = mySplits?.filter((split: any) => allExpenses.some(e => e.id === split.expense_id)) || []
      const share = myGroupSplits.filter((s: any) => {
            const exp = Array.isArray(s.expenses) ? s.expenses[0] : s.expenses
            return !exp?.is_settlement
        }).reduce((sum: number, item: any) => sum + Number(item.amount_owed), 0)
      setMyShare(share)

      const totalConsumption = myGroupSplits.reduce((sum: number, item: any) => sum + Number(item.amount_owed), 0)
      setNetBalance(myOutflow - totalConsumption)

    } catch (error: any) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return
    try {
        const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
        if (error) throw error
        fetchData()
    } catch (error: any) { alert("Could not delete expense. " + error.message) }
  }

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderPieChart = () => {
    if (totalCost === 0) return null
    let cumulativePercent = 0
    const paths = categoryStats.map((stat, i) => {
        const percent = stat.value / totalCost
        const startX = Math.cos(2 * Math.PI * cumulativePercent)
        const startY = Math.sin(2 * Math.PI * cumulativePercent)
        cumulativePercent += percent
        const endX = Math.cos(2 * Math.PI * cumulativePercent)
        const endY = Math.sin(2 * Math.PI * cumulativePercent)
        const largeArcFlag = percent > 0.5 ? 1 : 0
        if (percent === 1) return <circle key={i} cx="0" cy="0" r="1" fill={stat.color} />
        const pathData = `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`
        return <path key={i} d={pathData} fill={stat.color} />
    })

    return (
        <div className="flex gap-6 items-center">
            <div className="relative w-32 h-32 shrink-0">
                <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full">{paths}</svg>
                <div className="absolute inset-0 m-auto w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner">
                    <span className="text-[10px] text-zinc-400 font-medium">Total</span>
                </div>
            </div>
            <div className="flex-1 space-y-2 text-xs">
                {categoryStats.map((stat, i) => (
                    <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                            <span className="text-zinc-600 truncate max-w-[80px]">{stat.label}</span>
                        </div>
                        <span className="font-semibold text-zinc-900">₹{Math.round(stat.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    )
  }

  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] p-4 text-center space-y-4">
        <div className="bg-emerald-100 p-4 rounded-full"><MapPin className="h-8 w-8 text-emerald-600" /></div>
        <h2 className="text-xl font-semibold">No Trip Selected</h2>
        <p className="text-zinc-500 max-w-xs">Go to Groups to select a trip.</p>
      </div>
    )
  }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-6 pb-20 p-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{activeGroup.name}</h2>
          <div className="flex items-center text-sm text-zinc-500 mt-1">
             <Users className="h-3 w-3 mr-1" /> {members.length} member{members.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex gap-2">
            <Dialog>
                <DialogTrigger asChild><Button variant="outline" size="icon"><UserPlus className="h-4 w-4" /></Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Invite Friends</DialogTitle><DialogDescription>Share this code: <b>{activeGroup.name}</b></DialogDescription></DialogHeader>
                    <div className="flex items-center space-x-2 mt-4">
                        <Input id="link" defaultValue={inviteCode} readOnly className="text-center font-mono text-lg" />
                        <Button size="sm" onClick={copyInviteCode}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                    </div>
                </DialogContent>
            </Dialog>
            <Button variant="outline" size="icon" onClick={fetchData}><Receipt className="h-4 w-4" /></Button>
        </div>
      </div>

      {members.length > 0 && (
        <div className="flex -space-x-2 overflow-hidden py-1">
            {members.map((m) => (
                <Avatar key={m.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-white cursor-help" title={m.full_name}>
                    <AvatarFallback className="bg-emerald-100 text-emerald-800 text-xs">{m.full_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
            ))}
        </div>
      )}

      <Card className="bg-emerald-600 text-white border-none shadow-lg">
        <CardContent className="pt-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-emerald-100 text-sm font-medium mb-1">Total Trip Cost</p>
              <h1 className="text-4xl font-bold">₹{totalCost.toFixed(2)}</h1>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-emerald-500/30 text-center">
            <div><p className="text-emerald-100 text-[10px] uppercase">You Paid</p><p className="font-semibold text-lg">₹{myPaid.toFixed(2)}</p></div>
            <div><p className="text-emerald-100 text-[10px] uppercase">Your Share</p><p className="font-semibold text-lg">₹{myShare.toFixed(2)}</p></div>
            <div>
                <p className="text-emerald-100 text-[10px] uppercase">Balance</p>
                <p className={`font-bold text-lg ${netBalance >= 0 ? 'text-white' : 'text-red-200'}`}>
                    {netBalance > 0 ? '+' : ''}₹{netBalance.toFixed(2)}
                </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {(myUpiSpent > 0 || myCashSpent > 0) && (
        <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center text-blue-700 text-xs font-medium uppercase tracking-wide">
                    <Smartphone className="w-3 h-3 mr-1.5" /> UPI Paid
                </div>
                <div className="font-bold text-blue-900 text-lg">₹{myUpiSpent.toFixed(0)}</div>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center text-green-700 text-xs font-medium uppercase tracking-wide">
                    <Wallet className="w-3 h-3 mr-1.5" /> Cash Paid
                </div>
                <div className="font-bold text-green-900 text-lg">₹{myCashSpent.toFixed(0)}</div>
            </div>
        </div>
      )}

      {totalCost > 0 && (
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-500 uppercase">Spending by Category</CardTitle></CardHeader>
            <CardContent>{renderPieChart()}</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="font-semibold text-zinc-900">Recent Expenses</h3>
        {expenses.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 border-2 border-dashed rounded-lg">
             <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
             <p>No expenses yet.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {expenses.map((expense) => (
              <Card key={expense.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${expense.is_settlement ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {expense.is_settlement ? <ArrowRightLeft className="h-4 w-4" /> : (expense.profiles?.full_name?.[0] || "?")}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">{expense.description}</p>
                        <p className="text-xs text-zinc-500">
                          {expense.profiles?.full_name || "Unknown"} • {expense.payment_mode || "UPI"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className={`font-bold ${expense.is_settlement ? 'text-blue-600' : 'text-zinc-900'}`}>₹{expense.amount}</p>
                        <p className="text-xs text-zinc-400">{new Date(expense.created_at).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</p>
                      </div>
                      {currentUser && expense.paid_by === currentUser.id && (
                        <div className="flex gap-1 ml-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-emerald-600" onClick={() => onEditExpense({ id: expense.id, description: expense.description, amount: expense.amount, paid_by: expense.paid_by, category: expense.category, payment_mode: expense.payment_mode })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-500" onClick={() => handleDeleteExpense(expense.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}