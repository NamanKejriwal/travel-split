import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"
import { Loader2, Receipt, ArrowRightLeft, MapPin, Users, Pencil, AlertTriangle, Smartphone, Banknote, Target, Info, Bell, Trash2, Check, Lightbulb } from "lucide-react"
import { Group } from "@/components/views/groups-view" 
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ExpenseToEdit } from "@/components/add-expense-drawer"

interface DashboardProps {
  activeGroup: Group | null
  onSettleUp: () => void
  onEditExpense: (expense: ExpenseToEdit) => void
  isAnalyzing?: boolean
  latestTip?: string | null // NEW PROP: Receive the tip from the drawer
}

interface Expense {
  id: string
  description: string
  amount: number
  paid_by: string
  created_at: string
  category?: string 
  payment_method?: string
  is_settlement?: boolean
  profiles?: { full_name: string }
}

interface Member {
  id: string
  full_name: string
}

interface AIAlertItem {
  category: string
  alert: string
  advice: string
}

const CATEGORY_COLORS: Record<string, string> = {
  "Food": "#10b981", "Local Transport": "#3b82f6", "Travel": "#8b5cf6", 
  "Hostel / Hotel": "#f59e0b", "Shopping": "#ec4899", "Activity": "#ef4444", "Other": "#9ca3af" 
}

export function Dashboard({ activeGroup, onSettleUp, onEditExpense, isAnalyzing, latestTip }: DashboardProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  const [totalCost, setTotalCost] = useState(0)
  const [myPaid, setMyPaid] = useState(0)
  const [myShare, setMyShare] = useState(0)
  const [netBalance, setNetBalance] = useState(0)
  const [categoryStats, setCategoryStats] = useState<{label: string, value: number, color: string}[]>([])
  const [methodStats, setMethodStats] = useState<{upi: number, cash: number}>({ upi: 0, cash: 0 })
  
  // Alerts State
  const [rawAlerts, setRawAlerts] = useState<AIAlertItem[]>([])
  const [visibleAlerts, setVisibleAlerts] = useState<AIAlertItem[]>([])
  const [alertsOpen, setAlertsOpen] = useState(false)
  
  // Tip State 
  const [activeTip, setActiveTip] = useState<string | null>(null)

  useEffect(() => {
      if (latestTip) setActiveTip(latestTip)
  }, [latestTip])

  // Robust Limit Parser
  const getLimits = () => {
    if (!activeGroup?.category_limits) return null;
    if (typeof activeGroup.category_limits === 'string') {
        try { return JSON.parse(activeGroup.category_limits); } 
        catch (e) { return null; }
    }
    return activeGroup.category_limits;
  }

  useEffect(() => {
    if (activeGroup) {
      fetchData()
    }
  }, [activeGroup])

  // Re-calculate alert relevance whenever expenses or raw alerts change
  useEffect(() => {
    filterRelevantAlerts()
  }, [totalCost, rawAlerts, categoryStats]) // ADDED categoryStats to dependency

  async function fetchData() {
    if (!activeGroup) return
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUser(user)

      // Fetch fresh group data (including latest alerts)
      const { data: groupData } = await supabase
        .from('groups')
        .select('ai_alerts, category_limits, budget_per_person, start_date, end_date')
        .eq('id', activeGroup.id)
        .single()

      if (groupData) {
         let alerts = groupData.ai_alerts || []
         if (typeof alerts === 'string') {
             try { alerts = JSON.parse(alerts) } catch(e) { alerts = [] }
         }
         // Reverse so newest alerts (appended last) come first
         setRawAlerts(alerts.reverse())
      }

      // Fetch Members
      const { data: memberData } = await supabase.from('group_members').select('profiles(id, full_name)').eq('group_id', activeGroup.id)
      
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

      const allExpenses = (expenseData || []).map((e: any) => {
         const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles
         return { ...e, profiles: profile }
      }) as Expense[]
      
      setExpenses(allExpenses)
      
      // Calculate Stats
      const realExpenses = allExpenses.filter(e => !e.is_settlement)
      const total = realExpenses.reduce((sum, item) => sum + Number(item.amount), 0)
      setTotalCost(total)

      const myOutflow = allExpenses.filter(e => e.paid_by === user.id).reduce((sum, item) => sum + Number(item.amount), 0)
      setMyPaid(myOutflow)

      const methods = { upi: 0, cash: 0 }
      const catMap = new Map<string, number>()
      
      realExpenses.forEach(e => {
        const cat = e.category || "Other"
        catMap.set(cat, (catMap.get(cat) || 0) + Number(e.amount))
        if (e.payment_method === 'Cash') methods.cash += Number(e.amount)
        else methods.upi += Number(e.amount) 
      })

      setMethodStats(methods)
      const stats = Array.from(catMap.entries()).map(([label, value]) => ({
        label,
        value,
        color: CATEGORY_COLORS[label] || CATEGORY_COLORS["Other"]
      })).sort((a, b) => b.value - a.value)
      setCategoryStats(stats)

      // My Balance
      const { data: mySplits } = await supabase.from('expense_splits').select('amount_owed, expense_id, expenses(is_settlement)').eq('user_id', user.id)
      const myGroupSplits = mySplits?.filter((split: any) => allExpenses.some(e => e.id === split.expense_id)) || []
      const share = myGroupSplits.filter((s:any) => !s.expenses?.is_settlement).reduce((sum:any, i:any) => sum + Number(i.amount_owed), 0)
      setMyShare(share)
      setNetBalance(myOutflow - myGroupSplits.reduce((sum:any, i:any) => sum + Number(i.amount_owed), 0))

    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // --- SMART FILTERING ---
  function filterRelevantAlerts() {
    const limits = getLimits() as Record<string, number> | null
    if (!limits || rawAlerts.length === 0) {
        setVisibleAlerts([])
        return
    }

    let totalDays = 7
    if (activeGroup?.destinations && Array.isArray(activeGroup.destinations)) {
        if (activeGroup.start_date && activeGroup.end_date) {
             const s = new Date(activeGroup.start_date)
             const e = new Date(activeGroup.end_date)
             totalDays = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1
        }
    }
    const startDate = new Date(activeGroup?.start_date || activeGroup?.created_at || Date.now())
    const now = new Date()
    
    // Pre-Trip Logic
    let currentDay = 1
    if (now >= startDate) {
        const diffTime = Math.abs(now.getTime() - startDate.getTime())
        currentDay = Math.min(totalDays, Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))))
    }
    
    const memberCount = members.length || 1

    const validAlerts = rawAlerts.filter(alert => {
        // If category spend is 0 or missing, alert is stale
        const stat = categoryStats.find(s => s.label === alert.category)
        if (!stat || stat.value === 0) return false 

        const perPersonLimit = limits[alert.category]
        if (!perPersonLimit) return false

        const groupLimit = perPersonLimit * memberCount
        const dailyLimit = groupLimit / totalDays
        const expectedSpendByNow = dailyLimit * currentDay
        
        if (stat.value > groupLimit) return true
        if (stat.value > (expectedSpendByNow * 1.1)) return true

        return false 
    })

    setVisibleAlerts(validAlerts)
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Are you sure?")) return
    await supabase.from('expenses').delete().eq('id', expenseId)
    fetchData() 
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
                <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full">
                    {paths}
                </svg>
                <div className="absolute inset-0 m-auto w-16 h-16 bg-card rounded-full flex items-center justify-center shadow-inner">
                    <span className="text-[10px] text-muted-foreground font-medium">Total</span>
                </div>
            </div>
            <div className="flex-1 space-y-2 text-xs">
                {categoryStats.map((stat, i) => (
                    <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                            <span className="text-muted-foreground truncate max-w-[80px]">{stat.label}</span>
                        </div>
                        <span className="font-semibold text-foreground">₹{Math.round(stat.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    )
  }

  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] p-4 text-center space-y-4">
        <div className="bg-emerald-100 p-4 rounded-full">
          <MapPin className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold">No Trip Selected</h2>
        <p className="text-muted-foreground max-w-xs">Go to the <span className="font-bold text-emerald-600">Groups Tab</span> and select a trip.</p>
      </div>
    )
  }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>

  const mainAlert = visibleAlerts.length > 0 ? visibleAlerts[0] : null

  return (
    <div className="space-y-6 pb-20 p-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{activeGroup.name}</h2>
          <div className="flex items-center text-sm text-muted-foreground mt-1">
             <Users className="h-3 w-3 mr-1" /> 
             {members.length} members
          </div>
        </div>
        
        {/* NOTIFICATION BELL */}
        <div className="flex gap-2">
            <Dialog open={alertsOpen} onOpenChange={setAlertsOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                        <Bell className="h-6 w-6 text-muted-foreground" />
                        {visibleAlerts.length > 0 && (
                            <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">
                                {visibleAlerts.length}
                            </span>
                        )}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Budget Alerts</DialogTitle>
                        <DialogDescription>AI-generated warnings for your spending.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {visibleAlerts.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500">
                                <Check className="h-10 w-10 mx-auto mb-2 text-emerald-500 opacity-50" />
                                <p>You are within budget!</p>
                            </div>
                        ) : (
                            visibleAlerts.map((alert, idx) => (
                                <div key={idx} className="rounded-lg border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 p-3 shadow-sm flex items-start gap-3">
                                    <div className="mt-1 shrink-0 rounded-full bg-red-100 dark:bg-red-900 p-1">
                                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-red-900 dark:text-red-300 bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded uppercase tracking-wider">
                                                {alert.category}
                                            </span>
                                        </div>
                                        <p className="text-sm font-semibold text-red-900 dark:text-red-200 leading-snug mb-1">
                                            {alert.alert}
                                        </p>
                                        <div className="flex items-start gap-1.5 mt-1">
                                            <Info className="w-3 h-3 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                                            <p className="text-xs text-red-700 dark:text-red-300 italic">
                                                {alert.advice}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* AI SPINNER - Shown when analyzing */}
      {isAnalyzing && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 p-4 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
            <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">AI is analyzing your latest expense...</span>
        </div>
      )}

      {/* LATEST AI TIP (Displayed whether warning or just advice) */}
      {!isAnalyzing && activeTip && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 p-3 shadow-sm flex items-start gap-3 animate-in slide-in-from-top-2">
            <div className="mt-1 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 p-1">
                <Lightbulb className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200 leading-snug">
                    {activeTip}
                </p>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-indigo-400" onClick={() => setActiveTip(null)}>
                <span className="sr-only">Dismiss</span>
                <Trash2 className="w-3 h-3" />
            </Button>
        </div>
      )}

      {/* CRITICAL ALERT BANNER (Only if serious violation exists & tip dismissed or in addition) */}
      {!isAnalyzing && mainAlert && !activeTip && (
        <div className="mb-4 rounded-lg border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 p-3 shadow-sm flex items-start gap-3 animate-in slide-in-from-top-2">
            <div className="mt-1 shrink-0 rounded-full bg-red-100 dark:bg-red-900 p-1">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-red-900 dark:text-red-300 uppercase tracking-wide">
                        {mainAlert.category} Critical
                    </span>
                </div>
                <p className="text-sm font-medium text-red-900 dark:text-red-200 leading-snug">
                    {mainAlert.alert}
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 italic mt-1">
                    Tip: {mainAlert.advice}
                </p>
            </div>
        </div>
      )}

      {/* Main Stats Card */}
      <Card className="bg-emerald-600 text-white border-none shadow-lg">
        <CardContent className="pt-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-emerald-100 text-sm font-medium mb-1">Total Trip Cost</p>
              <h1 className="text-4xl font-bold">₹{totalCost.toFixed(0)}</h1>
            </div>
            {activeGroup.budget_per_person && activeGroup.budget_per_person > 0 && (
                <div className="text-right">
                    <p className="text-emerald-100 text-[10px] uppercase">Group Budget</p>
                    <p className="font-mono text-sm opacity-80">₹{activeGroup.budget_per_person * members.length}</p>
                </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-emerald-500/30 text-center">
            <div>
              <p className="text-emerald-100 text-[10px] uppercase tracking-wider">You Paid</p>
              <p className="font-semibold text-lg">₹{myPaid.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-emerald-100 text-[10px] uppercase tracking-wider">Your Share</p>
              <p className="font-semibold text-lg">₹{myShare.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-emerald-100 text-[10px] uppercase tracking-wider">Balance</p>
              <p className={`font-bold text-lg ${netBalance >= 0 ? 'text-white' : 'text-red-200'}`}>
                {netBalance > 0 ? '+' : ''}₹{netBalance.toFixed(0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods Card */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-full text-blue-600 dark:text-blue-400">
                    <Smartphone className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Online / UPI</p>
                    <p className="text-lg font-bold text-foreground">₹{methodStats.upi.toFixed(0)}</p>
                </div>
            </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded-full text-green-600 dark:text-green-400">
                    <Banknote className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Cash</p>
                    <p className="text-lg font-bold text-foreground">₹{methodStats.cash.toFixed(0)}</p>
                </div>
            </CardContent>
        </Card>
      </div>

      {totalCost > 0 && (
        <Card>
            <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Spending by Category</h3>
                {renderPieChart()}
                {activeGroup.category_limits && (
                    <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <Target className="w-3 h-3 mr-1" />
                            AI-Optimized budget limits active
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="font-semibold text-foreground">Recent Expenses</h3>
        {expenses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
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
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${expense.is_settlement ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-200'}`}>
                        {expense.is_settlement ? <ArrowRightLeft className="h-4 w-4" /> : (expense.profiles?.full_name?.[0] || "?")}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate max-w-[120px]">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">
                            {expense.profiles?.full_name || "Unknown"} paid 
                            {!expense.is_settlement && expense.payment_method && ` • ${expense.payment_method}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className={`font-bold ${expense.is_settlement ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`}>₹{expense.amount}</p>
                      {currentUser && expense.paid_by === currentUser.id && !expense.is_settlement && (
                        <div className="flex justify-end mt-1 -mr-2">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-emerald-600" 
                                onClick={() => onEditExpense({
                                    id: expense.id, description: expense.description, amount: expense.amount, 
                                    paid_by: expense.paid_by, category: expense.category, payment_method: expense.payment_method
                                })}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" 
                                onClick={() => handleDeleteExpense(expense.id)}>
                                <Trash2 className="h-3 w-3" />
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