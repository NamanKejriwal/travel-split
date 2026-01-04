"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { 
  Loader2, Receipt, ArrowRightLeft, MapPin, 
  Smartphone, Banknote, Target, Bell, 
  Check, Lightbulb, X, BarChart3 
} from "lucide-react"
import { Group } from "@/components/views/groups-view" 
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ExpenseToEdit } from "@/components/add-expense-drawer"
import { toast } from "sonner" 
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion"
import { cn } from "@/lib/utils"

interface DashboardProps {
  activeGroup: Group | null;
  onSettleUp: () => void;
  onEditExpense: (expense: ExpenseToEdit) => void;
  isAnalyzing?: boolean;
  latestTip?: string | null;
  setActiveTab?: (tab: string) => void;
  // NEW: Prop to trigger the full screen analytics view
  onShowAnalytics?: () => void; 
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
  net_balance?: number
}

interface AIAlertItem {
  category: string
  alert?: string
  advice: string
  message?: string
  severity?: "info" | "warning" | "critical"
}

const supabase = createClient()

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { type: "spring", stiffness: 300, damping: 24 } as const
  }
}

const AVATAR_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", 
  "bg-lime-500", "bg-green-500", "bg-emerald-500", "bg-teal-500", 
  "bg-cyan-500", "bg-sky-500", "bg-blue-500", "bg-indigo-500", 
  "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500", "bg-rose-500"
];

function getAvatarColor(name: string) {
  if (!name) return "bg-zinc-700";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name: string) {
    if (!name) return "?";
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AnimatedNumber({ value, currency = true }: { value: number, currency?: boolean }) {
  const spring = useSpring(0, { stiffness: 60, damping: 20 })
  const display = useTransform(spring, (current) => 
    currency 
      ? `₹${Math.round(current).toLocaleString('en-IN')}` 
      : Math.round(current).toLocaleString('en-IN')
  )
  useEffect(() => { spring.set(value) }, [value, spring])
  return <motion.span>{display}</motion.span>
}

const CATEGORY_COLORS: Record<string, string> = {
  "Food": "#2dd4bf", "Local Transport": "#3b82f6", "Travel": "#8b5cf6",        
  "Hostel / Hotel": "#f59e0b", "Shopping": "#ec4899", "Activity": "#ef4444", "Other": "#9ca3af"          
}

export function Dashboard({ activeGroup, onSettleUp, onEditExpense, isAnalyzing, latestTip, setActiveTab, onShowAnalytics }: DashboardProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  const [totalCost, setTotalCost] = useState(0)
  const [myPaid, setMyPaid] = useState(0)
  const [myShare, setMyShare] = useState(0)
  const [netBalance, setNetBalance] = useState(0)
  // These stats are calculated here for the small cards, but full analytics happen in the view
  const [methodStats, setMethodStats] = useState<{upi: number, cash: number}>({ upi: 0, cash: 0 })
  
  const [rawAlerts, setRawAlerts] = useState<AIAlertItem[]>([])
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [activeTip, setActiveTip] = useState<string | null>(null)
  
  useEffect(() => { if (latestTip) setActiveTip(latestTip) }, [latestTip])
  useEffect(() => { if (activeGroup) fetchData() }, [activeGroup])
  
  useEffect(() => {
    if (!activeGroup) return
    const channel = supabase
      .channel(`dashboard-expenses-${activeGroup.id}`)
      .on(
        "postgres_changes",
        { 
          schema: "public", 
          table: "expenses", 
          event: "*",
          filter: `group_id=eq.${activeGroup.id}`
        },
        () => { fetchData() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeGroup?.id])

  async function fetchData() {
    if (!activeGroup) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUser(user)

      const { data: groupData } = await supabase.from('groups').select('ai_alerts, category_limits, budget_per_person').eq('id', activeGroup!.id).single()
      if (groupData) {
        let alerts = groupData.ai_alerts || []
        if (typeof alerts === 'string') { try { alerts = JSON.parse(alerts) } catch(e) { alerts = [] } }
        setRawAlerts(alerts.reverse())
      }

      const { data: balanceData } = await supabase.rpc('get_trip_balances', { p_group_id: activeGroup!.id })
      if (balanceData) {
        setMembers(balanceData.map((b: any) => ({
            id: b.user_id, full_name: b.full_name, net_balance: b.net_balance 
        })))
      }

      const { data: expenseData } = await supabase.from('expenses').select(`*, profiles (full_name)`).eq('group_id', activeGroup!.id).order('created_at', { ascending: false })
      const allExpenses = (expenseData || []).map((e: any) => {
         const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles
         return { ...e, profiles: profile }
      }) as Expense[]
      setExpenses(allExpenses)
      
      const realExpenses = allExpenses.filter(e => !e.is_settlement)
      setTotalCost(realExpenses.reduce((sum, item) => sum + Number(item.amount), 0))
      setMyPaid(allExpenses.filter(e => e.paid_by === user.id).reduce((sum, item) => sum + Number(item.amount), 0))

      const methods = { upi: 0, cash: 0 }
      realExpenses.forEach(e => {
        if (e.payment_method === 'Cash') methods.cash += Number(e.amount)
        else methods.upi += Number(e.amount) 
      })
      setMethodStats(methods)

      const { data: mySplits } = await supabase.from('expense_splits').select('amount_owed, expense_id, expenses(is_settlement)').eq('user_id', user.id)
      const groupExpenseIds = new Set(allExpenses.map(e => e.id))
      const relevantSplits = mySplits?.filter((s:any) => groupExpenseIds.has(s.expense_id) && !s.expenses?.is_settlement) || []
      setMyShare(relevantSplits.reduce((sum:any, i:any) => sum + Number(i.amount_owed), 0))
      
      const myBalanceData = balanceData?.find((b: any) => b.user_id === user.id)
      setNetBalance(myBalanceData ? myBalanceData.net_balance : 0)

    } catch (error) { console.error(error) } finally { setLoading(false) }
  }

  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] p-6 text-center space-y-6 bg-[#020617] text-white">
        <div className="bg-[#00A896]/10 p-8 rounded-full border border-[#00A896]/30 animate-pulse">
            <MapPin className="h-12 w-12 text-[#00A896]" />
        </div>
        <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">No Trip Selected</h2>
            <p className="text-zinc-400 text-sm">Choose a trip from your groups to see details.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 bg-[#020617] min-h-screen space-y-8">
        <div className="flex justify-between items-center"><div className="h-8 w-40 bg-white/10 rounded-lg animate-pulse" /><div className="h-10 w-10 bg-white/10 rounded-full animate-pulse" /></div>
        <div className="h-56 bg-white/5 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-2 gap-4"><div className="h-28 bg-white/5 rounded-2xl animate-pulse" /><div className="h-28 bg-white/5 rounded-2xl animate-pulse" /></div>
      </div>
    )
  }

  const displayedMembers = members.slice(0, 3);
  const remainingCount = members.length - displayedMembers.length;

  return (
    <div className="min-h-screen w-full bg-[#020617] text-white pb-32 overflow-x-hidden">
        <div className="fixed inset-0 pointer-events-none z-0">
             <div className="absolute top-0 right-0 w-[80vw] h-[80vw] bg-[#00A896]/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
             <div className="absolute bottom-0 left-0 w-[60vw] h-[60vw] bg-blue-600/5 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4"></div>
        </div>

        <motion.div variants={containerVariants} initial="hidden" animate="show" className="relative z-10 px-5 pt-6 max-w-lg mx-auto space-y-8">
            
            {/* 1. Header & Members */}
            <motion.div variants={itemVariants} className="space-y-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-white tracking-tighter leading-none drop-shadow-xl">{activeGroup.name}</h1>
                        <p className="text-xs font-medium text-zinc-400 tracking-wide uppercase">Dashboard</p>
                    </div>
                    
                    {/* BUTTONS: Charts & Alerts */}
                    <div className="flex gap-2">
                        {/* CHART BUTTON - Triggers Full Screen View */}
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={onShowAnalytics} 
                            className="h-11 w-11 rounded-full bg-white/5 border-white/10 active:scale-95 transition-all shadow-lg text-zinc-300 hover:bg-[#00A896]/10 hover:text-[#00A896] hover:border-[#00A896]/30"
                        >
                            <BarChart3 className="h-5 w-5" />
                        </Button>

                        <Dialog open={alertsOpen} onOpenChange={setAlertsOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="icon" className="h-11 w-11 rounded-full bg-white/5 border-white/10 active:scale-95 transition-all shadow-lg text-zinc-300">
                                    <div className="relative">
                                        <Bell className="h-5 w-5" />
                                        {rawAlerts.length > 0 && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-rose-500 rounded-full border-2 border-[#020617]" />}
                                    </div>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-[#0f172a]/95 backdrop-blur-2xl border-white/10 text-white sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Trip Insights</DialogTitle>
                                    <DialogDescription className="text-zinc-400">Budget alerts and financial tips.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3 mt-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                    {rawAlerts.length === 0 ? (
                                        <div className="flex flex-col items-center py-8 text-zinc-500 gap-3">
                                            <div className="p-3 bg-white/5 rounded-full"><Check className="h-6 w-6 text-[#00A896]" /></div>
                                            <p className="text-sm">Everything looks good!</p>
                                        </div>
                                    ) : (
                                        rawAlerts.map((alert, idx) => (
                                            <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", alert.severity === 'critical' ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400")}>
                                                        {alert.category}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-zinc-200">{alert.message || alert.alert}</p>
                                                <p className="text-xs text-zinc-500 mt-1 italic">{alert.advice}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="flex -space-x-3 overflow-x-auto pb-2 scrollbar-hide pl-1">
                    {displayedMembers.map((m) => (
                        <div key={m.id} className="relative group shrink-0 transition-transform active:scale-95">
                            <Avatar className="h-12 w-12 border-[3px] border-[#020617] shadow-lg">
                                <AvatarFallback className={cn("text-xs font-bold text-white", getAvatarColor(m.full_name))}>
                                    {getInitials(m.full_name)}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                    ))}
                    {remainingCount > 0 && (
                        <div className="flex items-center justify-center h-12 w-12 rounded-full border-[3px] border-[#020617] bg-zinc-800 text-zinc-400 text-xs font-bold ml-[-12px] shrink-0 relative z-0 shadow-lg">
                            +{remainingCount}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* 2. AI Insight */}
            <AnimatePresence>
                {(isAnalyzing || (activeTip && !isAnalyzing)) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="relative p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex gap-3 items-start shadow-inner">
                            <div className="p-2 rounded-full bg-indigo-500/20 shrink-0">
                                {isAnalyzing ? <Loader2 className="h-4 w-4 text-indigo-300 animate-spin" /> : <Lightbulb className="h-4 w-4 text-indigo-300" />}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                                <p className="text-sm font-medium text-indigo-100 leading-relaxed">{isAnalyzing ? "Analyzing spending patterns..." : activeTip}</p>
                            </div>
                            {!isAnalyzing && <button onClick={() => setActiveTip(null)} className="text-indigo-400 hover:text-white"><X className="h-4 w-4" /></button>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 3. Main Cost Card (Overview) */}
            <motion.div variants={itemVariants} className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#00A896]/20 to-blue-600/20 rounded-[2rem] blur-xl opacity-50"></div>
                <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 shadow-2xl overflow-hidden">
                    <div className="flex flex-col gap-1 mb-8 relative z-10">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Total Trip Cost</span>
                        <div className="flex items-baseline gap-1 text-white">
                            <span className="text-5xl font-black tracking-tighter drop-shadow-sm"><AnimatedNumber value={totalCost} /></span>
                        </div>
                        {activeGroup.budget_per_person && (
                            <div className="absolute top-0 right-0 text-right">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase block">Budget</span>
                                <span className="text-sm font-mono font-bold text-[#00A896]">₹{(activeGroup.budget_per_person * members.length).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent mb-6"></div>
                    <div className="grid grid-cols-3 gap-2 text-center relative z-10">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">You Paid</p>
                            <p className="text-lg font-bold text-white tracking-tight"><AnimatedNumber value={myPaid} /></p>
                        </div>
                        <div className="space-y-1 border-l border-white/5">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Your Share</p>
                            <p className="text-lg font-bold text-white tracking-tight"><AnimatedNumber value={myShare} /></p>
                        </div>
                        <div className="space-y-1 border-l border-white/5">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Balance</p>
                            <p className={cn("text-lg font-bold tracking-tight", netBalance > 0 ? "text-[#00A896]" : netBalance < 0 ? "text-rose-500" : "text-zinc-400")}>
                                {netBalance > 0 ? "+" : ""}<AnimatedNumber value={netBalance} />
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* 4. Payment Methods */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
                <div className="bg-[#0f172a]/60 border border-white/5 rounded-2xl p-4 flex flex-col justify-between h-24 relative overflow-hidden active:scale-[0.98] active:bg-white/5 transition-all">
                    <div className="absolute top-0 right-0 p-3 opacity-10"><Smartphone className="h-12 w-12 text-blue-400 -mr-4 -mt-4 rotate-12" /></div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Online / UPI</span>
                    <span className="text-xl font-bold text-blue-100"><AnimatedNumber value={methodStats.upi} /></span>
                </div>
                <div className="bg-[#0f172a]/60 border border-white/5 rounded-2xl p-4 flex flex-col justify-between h-24 relative overflow-hidden active:scale-[0.98] active:bg-white/5 transition-all">
                    <div className="absolute top-0 right-0 p-3 opacity-10"><Banknote className="h-12 w-12 text-emerald-400 -mr-4 -mt-4 rotate-12" /></div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Cash</span>
                    <span className="text-xl font-bold text-emerald-100"><AnimatedNumber value={methodStats.cash} /></span>
                </div>
            </motion.div>

            {/* 5. Recent Activity */}
            <motion.div variants={itemVariants} className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-lg font-bold text-white tracking-tight">Last 5 Activity</h3>
                    <Button 
                        variant="link" 
                        onClick={() => {
                            if(setActiveTab) {
                                setActiveTab('activity')
                            } else {
                                toast.error("Navigation not available")
                            }
                        }} 
                        className="text-xs text-[#00A896] h-auto p-0 hover:no-underline opacity-80"
                    >
                        View all
                    </Button>
                </div>

                <div className="space-y-3">
                    <AnimatePresence initial={false} mode="popLayout">
                    {expenses.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                            <Receipt className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                            <p className="text-zinc-500 text-sm font-medium">No expenses yet</p>
                        </div>
                    ) : (
                        expenses.slice(0, 5).map((expense) => {
                            return (
                                <motion.div 
                                    key={expense.id}
                                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="group relative bg-[#0f172a]/80 border border-white/5 rounded-2xl p-3.5 flex items-center gap-4 transition-colors active:bg-white/5 shadow-md"
                                >
                                    <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner border border-white/5 text-lg font-bold",
                                        expense.is_settlement ? "bg-blue-500/10 text-blue-400" : "bg-[#00A896]/10 text-[#00A896]"
                                    )}>
                                        {expense.is_settlement ? <ArrowRightLeft className="h-5 w-5" /> : getInitials(expense.profiles?.full_name || "?")}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate pr-2">{expense.description}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[11px] font-medium text-zinc-400 truncate max-w-[80px]">
                                                {expense.is_settlement ? "Settlement" : (expense.profiles?.full_name?.split(' ')[0] || "Unknown")}
                                            </span>
                                            {!expense.is_settlement && (
                                                <>
                                                    <span className="text-[10px] text-zinc-600">•</span>
                                                    <span className="text-[10px] text-zinc-500 uppercase font-medium tracking-wide border border-white/10 px-1.5 rounded-[4px]">{expense.payment_method || "UPI"}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={cn("text-sm font-bold tabular-nums tracking-tight", expense.is_settlement ? "text-blue-400" : "text-white")}>₹{expense.amount.toLocaleString()}</p>
                                        <p className="text-[10px] text-zinc-600 font-medium mt-0.5">{new Date(expense.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                                    </div>
                                </motion.div>
                            )
                        })
                    )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    </div>
  )
}