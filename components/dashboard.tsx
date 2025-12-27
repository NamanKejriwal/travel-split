"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { 
  Loader2, Receipt, ArrowRightLeft, MapPin, Users, Pencil, 
  AlertTriangle, Smartphone, Banknote, Target, Bell, Trash2, 
  Check, Lightbulb, Wallet 
} from "lucide-react"
import { Group } from "@/components/views/groups-view" 
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ExpenseToEdit } from "@/components/add-expense-drawer"
import { toast } from "sonner" 
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from "framer-motion"

const supabase = createClient()

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(5px)" },
  show: { 
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

// --- HELPER: ANIMATED NUMBER ---
function AnimatedNumber({ value, currency = true }: { value: number, currency?: boolean }) {
  const spring = useSpring(0, { stiffness: 50, damping: 20 })
  const display = useTransform(spring, (current) => 
    currency 
      ? `₹${Math.round(current).toLocaleString()}` 
      : Math.round(current).toLocaleString()
  )

  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  return <motion.span>{display}</motion.span>
}

// --- INTERFACES ---
interface DashboardProps {
  activeGroup: Group | null
  onSettleUp: () => void
  onEditExpense: (expense: ExpenseToEdit) => void
  isAnalyzing?: boolean
  latestTip?: string | null 
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

// --- NEON COLOR PALETTE ---
const CATEGORY_COLORS: Record<string, string> = {
  "Food": "#2dd4bf",          // Teal-400
  "Local Transport": "#3b82f6", // Blue-500
  "Travel": "#8b5cf6",        // Violet-500
  "Hostel / Hotel": "#f59e0b", // Amber-500
  "Shopping": "#ec4899",      // Pink-500
  "Activity": "#ef4444",      // Red-500
  "Other": "#9ca3af"          // Gray-400
}

export function Dashboard({ activeGroup, onSettleUp, onEditExpense, isAnalyzing, latestTip }: DashboardProps) {
  // --- STATE ---
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
  
  const [rawAlerts, setRawAlerts] = useState<AIAlertItem[]>([])
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [activeTip, setActiveTip] = useState<string | null>(null)

  // --- EFFECTS ---
  useEffect(() => {
      if (latestTip) setActiveTip(latestTip)
  }, [latestTip])

  useEffect(() => {
    if (activeGroup) fetchData()
  }, [activeGroup])

  useEffect(() => {
    if (!activeGroup) return
  
    const channel = supabase
      .channel(`expenses-${activeGroup.id}`)
      .on(
        "postgres_changes",
        { schema: "public", table: "expenses", event: "*" },
        () => fetchData()
      )
      .subscribe()
  
    // --- CHANGE THIS PART ---
    return () => {
      supabase.removeChannel(channel)
    }
    // ------------------------
    
  }, [activeGroup?.id])
  // --- DATA FETCHING ---
  async function fetchData() {
    if (!activeGroup) return
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUser(user)

      // 1. Fetch Group Settings
      const { data: groupData } = await supabase
        .from('groups')
        .select('ai_alerts, category_limits, budget_per_person')
        .eq('id', activeGroup.id)
        .single()

      if (groupData) {
        let alerts = groupData.ai_alerts || []
        if (typeof alerts === 'string') {
            try { alerts = JSON.parse(alerts) } catch(e) { alerts = [] }
        }
        setRawAlerts(alerts.reverse())
      }

      // 2. Fetch Balances
      const { data: balanceData } = await supabase.rpc('get_trip_balances', { p_group_id: activeGroup.id })
      if (balanceData) {
        setMembers(balanceData.map((b: any) => ({
            id: b.user_id,
            full_name: b.full_name,
            net_balance: b.net_balance 
        })))
      }

      // 3. Fetch Expenses
      const { data: expenseData } = await supabase
        .from('expenses')
        .select(`*, profiles (full_name)`)
        .eq('group_id', activeGroup.id)
        .order('created_at', { ascending: false })

      const allExpenses = (expenseData || []).map((e: any) => {
         const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles
         return { ...e, profiles: profile }
      }) as Expense[]
      
      setExpenses(allExpenses)
      
      // 4. Calculate Stats
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

      // 5. Calculate My Share
      const { data: mySplits } = await supabase.from('expense_splits').select('amount_owed, expense_id, expenses(is_settlement)').eq('user_id', user.id)
      const groupExpenseIds = new Set(allExpenses.map(e => e.id))
      const relevantSplits = mySplits?.filter((s:any) => groupExpenseIds.has(s.expense_id) && !s.expenses?.is_settlement) || []
      const share = relevantSplits.reduce((sum:any, i:any) => sum + Number(i.amount_owed), 0)
      setMyShare(share)
      
      const myBalanceData = balanceData?.find((b: any) => b.user_id === user.id)
      setNetBalance(myBalanceData ? myBalanceData.net_balance : 0)

    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExpense = async (expenseId: string, category?: string) => {
    if (!confirm("Are you sure?")) return
    
    try {
        await supabase.from('expenses').delete().eq('id', expenseId)
        
        if (category && activeGroup) {
            const { data: group } = await supabase.from('groups').select('ai_alerts').eq('id', activeGroup.id).single()
            let currentAlerts = group?.ai_alerts || []
            if (typeof currentAlerts === 'string') currentAlerts = JSON.parse(currentAlerts)
            const filteredAlerts = currentAlerts.filter((a: any) => a.category !== category)
            if (filteredAlerts.length !== currentAlerts.length) {
                await supabase.from('groups').update({ ai_alerts: filteredAlerts }).eq('id', activeGroup.id)
            }
        }

        fetchData() 
        toast.success("Expense deleted")
    } catch {
        toast.error("Failed to delete expense")
    }
  }

  // --- RENDER HELPERS ---
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
        
        return (
            <motion.path 
                key={i} 
                d={pathData} 
                fill={stat.color} 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.9, scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                whileHover={{ opacity: 1, scale: 1.05 }}
                className="transition-opacity" 
            />
        )
    })

    return (
        <div className="flex flex-col sm:flex-row gap-8 items-center justify-center py-2">
            <div className="relative w-40 h-40 shrink-0 filter drop-shadow-[0_0_10px_rgba(45,212,191,0.2)]">
                <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full">
                    {paths}
                </svg>
                <div className="absolute inset-0 m-auto w-24 h-24 bg-[#020617] rounded-full flex flex-col items-center justify-center border border-white/10 shadow-inner z-10">
                    <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Total</span>
                    <span className="text-sm font-bold text-white">
                        <AnimatedNumber value={totalCost} />
                    </span>
                </div>
            </div>
            
            <div className="flex-1 w-full grid grid-cols-2 gap-3 text-xs">
                {categoryStats.map((stat, i) => (
                    <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + (i * 0.05) }}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shadow-[0_0_6px_currentColor]" style={{ backgroundColor: stat.color, color: stat.color }} />
                            <span className="text-zinc-300 truncate max-w-[80px]">{stat.label}</span>
                        </div>
                        <span className="font-semibold text-white">₹{Math.round(stat.value)}</span>
                    </motion.div>
                ))}
            </div>
        </div>
    )
  }

  // --- EMPTY STATE ---
  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-6 text-center space-y-6 bg-[#020617] text-white">
        <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative"
        >
            <div className="absolute inset-0 bg-[#00A896] blur-3xl opacity-20 animate-pulse"></div>
            <div className="bg-[#00A896]/10 p-6 rounded-full border border-[#00A896]/30 relative z-10">
                <MapPin className="h-10 w-10 text-[#00A896]" />
            </div>
        </motion.div>
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <h2 className="text-2xl font-bold text-white">No Trip Selected</h2>
            <p className="text-zinc-400 mt-2 max-w-xs mx-auto">Select a trip from the Groups tab to view your dashboard.</p>
        </motion.div>
      </div>
    )
  }

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="space-y-6 p-6 max-w-3xl mx-auto bg-[#020617] min-h-screen">
        <div className="h-12 w-48 bg-white/5 animate-pulse rounded-xl" />
        <div className="h-48 bg-white/5 animate-pulse rounded-3xl border border-white/5" />
        <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-white/5 animate-pulse rounded-2xl border border-white/5" />
            <div className="h-24 bg-white/5 animate-pulse rounded-2xl border border-white/5" />
        </div>
      </div>
    )
  }

  const mainAlert = rawAlerts.length > 0 ? rawAlerts[0] : null

  return (
    // MAIN CONTAINER
    <div className="min-h-screen w-full bg-[#020617] text-white pb-24">
        
        {/* Background Gradients */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
             <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00A896]/10 rounded-full blur-[100px]"></div>
        </div>

        <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="relative z-10 space-y-8 p-4 sm:p-6 max-w-3xl mx-auto"
        >

            {/* HEADER */}
            <motion.div variants={itemVariants} className="flex justify-between items-start pt-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-1 drop-shadow-md">
                        {activeGroup.name}
                    </h2>
                    <div className="flex items-center text-sm text-zinc-400 font-medium">
                        <div className="h-2 w-2 rounded-full bg-[#00A896] mr-2 shadow-[0_0_8px_#00A896]"></div>
                        {members.length} members
                    </div>
                </div>
                
                {/* ALERTS BUTTON */}
                <Dialog open={alertsOpen} onOpenChange={setAlertsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative hover:bg-white/10 rounded-full h-10 w-10 text-white transition-colors">
                            <Bell className="h-5 w-5" />
                            {rawAlerts.length > 0 && (
                                <span className="absolute top-1 right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                </span>
                            )}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#020617]/90 backdrop-blur-xl border border-white/10 text-white sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Budget Alerts</DialogTitle>
                            <DialogDescription className="text-zinc-400">AI-generated financial insights.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 mt-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {rawAlerts.length === 0 ? (
                                <div className="text-center py-8 text-zinc-500">
                                    <Check className="h-10 w-10 mx-auto mb-2 text-[#00A896] opacity-50" />
                                    <p>You are within budget!</p>
                                </div>
                            ) : (
                                rawAlerts.map((alert, idx) => {
                                    const severity = alert?.severity || "info";
                                    const isCritical = severity === "critical";
                                    const isWarning = severity === "warning";
                                    const borderColor = isCritical ? "border-red-500/50" : isWarning ? "border-amber-500/50" : "border-blue-500/50";
                                    const bgGradient = isCritical ? "from-red-500/10 to-transparent" : isWarning ? "from-amber-500/10 to-transparent" : "from-blue-500/10 to-transparent";
                                    const iconColor = isCritical ? "text-red-400" : isWarning ? "text-amber-400" : "text-blue-400";
                                    const textColor = isCritical ? "text-red-200" : isWarning ? "text-amber-200" : "text-blue-200";

                                    return (
                                        <div key={idx} className={`rounded-xl border-l-2 p-3 bg-gradient-to-r ${bgGradient} ${borderColor} mb-2`}>
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 shrink-0">
                                                    <AlertTriangle className={`h-4 w-4 ${iconColor}`} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/5 ${iconColor}`}>
                                                            {alert.category} • {severity}
                                                        </span>
                                                    </div>
                                                    <p className={`text-sm font-medium leading-snug ${textColor}`}>
                                                        {alert.message || alert.alert}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 italic mt-1">
                                                        Tip: {alert.advice}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </motion.div>

            {/* MEMBERS LIST */}
            <motion.div variants={itemVariants} className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                {members.map((m, i) => (
                <motion.div 
                    key={m.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col items-center gap-2 snap-start shrink-0 group cursor-pointer"
                >
                    <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#00A896] to-purple-500 opacity-0 group-hover:opacity-100 blur transition-opacity"></div>
                    <Avatar className="h-14 w-14 border-2 border-[#00A896]/30 shadow-lg relative z-10 group-hover:border-transparent transition-all">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${m.full_name}&backgroundColor=0f172a`} />
                        <AvatarFallback className="bg-slate-800 text-[#00A896] font-bold">
                        {m.full_name?.[0]}
                        </AvatarFallback>
                    </Avatar>
                    
                    {m.net_balance !== undefined && Math.abs(m.net_balance) > 1 && (
                        <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-lg border border-white/10 z-20 whitespace-nowrap
                            ${m.net_balance > 0 ? 'bg-[#00d2aa]/90 shadow-[0_0_10px_#00d2aa40]' : 'bg-rose-500/90 shadow-[0_0_10px_#f43f5e40]'}`}>
                        {m.net_balance > 0 ? "+" : ""}₹{Math.abs(m.net_balance).toFixed(0)}
                        </div>
                    )}
                    </div>
                    <span className="text-[10px] font-medium text-zinc-400 group-hover:text-white transition-colors">{m.full_name.split(' ')[0]}</span>
                </motion.div>
                ))}
            </motion.div>

            {/* DYNAMIC ALERTS / TIPS AREA (AnimatePresence for smooth swap) */}
            <AnimatePresence mode="wait">
                {isAnalyzing && (
                    <motion.div 
                        key="analyzing"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-3 overflow-hidden"
                    >
                        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                        <span className="text-sm font-medium text-blue-300">AI is analyzing your latest expense...</span>
                    </motion.div>
                )}

                {!isAnalyzing && activeTip && (
                    <motion.div 
                        key="tip"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4 flex items-start gap-3 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 blur-xl rounded-full -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="mt-1 shrink-0 rounded-full bg-indigo-500/20 p-1.5">
                            <Lightbulb className="h-4 w-4 text-indigo-300" />
                        </div>
                        <div className="flex-1 z-10">
                            <p className="text-sm font-medium text-indigo-100 leading-snug">
                                {activeTip}
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-indigo-400 hover:text-indigo-200 -mt-1 -mr-1" onClick={() => setActiveTip(null)}>
                            <Trash2 className="w-3 h-3" />
                        </Button>
                    </motion.div>
                )}

                {!isAnalyzing && mainAlert && !activeTip && (
                    <motion.div 
                        key="alert"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        {(() => {
                            const severity = mainAlert.severity || "info";
                            const isCritical = severity === "critical";
                            const isWarning = severity === "warning";
                            const borderColor = isCritical ? "border-rose-500/30" : isWarning ? "border-amber-500/30" : "border-blue-500/30";
                            const bgGradient = isCritical ? "bg-gradient-to-r from-rose-500/10 to-transparent" : isWarning ? "bg-gradient-to-r from-amber-500/10 to-transparent" : "bg-gradient-to-r from-blue-500/10 to-transparent";
                            const iconColor = isCritical ? "text-rose-400" : isWarning ? "text-amber-400" : "text-blue-400";
                            const titleColor = isCritical ? "text-rose-200" : isWarning ? "text-amber-200" : "text-blue-200";

                            return (
                                <div className={`rounded-2xl border ${borderColor} ${bgGradient} p-4 flex items-start gap-3 shadow-lg relative overflow-hidden`}>
                                    <div className={`mt-1 shrink-0 rounded-full p-1.5 bg-black/20 backdrop-blur-sm border border-white/5`}>
                                        <AlertTriangle className={`h-4 w-4 ${iconColor}`} />
                                    </div>
                                    <div className="flex-1 z-10">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-wide opacity-80 ${titleColor}`}>
                                                {mainAlert.category} • {severity}
                                            </span>
                                        </div>
                                        <p className={`text-sm font-semibold leading-snug ${titleColor}`}>
                                            {mainAlert.message || mainAlert.alert}
                                        </p>
                                        <p className={`text-xs italic mt-1 opacity-60 ${titleColor}`}>
                                            Tip: {mainAlert.advice}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TOTAL COST HERO CARD */}
            <motion.div variants={itemVariants} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00A896] to-blue-600 rounded-3xl opacity-20 blur-xl group-hover:opacity-30 transition duration-1000"></div>
                
                <motion.div 
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
                    className="relative rounded-3xl p-6 sm:p-8 bg-[#020617]/80 backdrop-blur-xl border border-white/10"
                >
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Total Trip Cost</p>
                            <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tight">
                                <AnimatedNumber value={totalCost} />
                            </h1>
                        </div>
                        
                        {activeGroup.budget_per_person && activeGroup.budget_per_person > 0 && (
                            <div className="text-right">
                                <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Budget</p>
                                <p className="font-mono text-sm text-[#00A896] font-bold">₹{(activeGroup.budget_per_person * members.length).toLocaleString()}</p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5">
                        <div className="text-center">
                            <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">You Paid</p>
                            <p className="font-bold text-lg text-white">
                                <AnimatedNumber value={myPaid} />
                            </p>
                        </div>
                        <div className="text-center border-l border-white/5">
                            <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Your Share</p>
                            <p className="font-bold text-lg text-white">
                                <AnimatedNumber value={myShare} />
                            </p>
                        </div>
                        <div className="text-center border-l border-white/5">
                            <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Balance</p>
                            <p className={`font-bold text-lg ${netBalance >= 0 ? 'text-[#2dd4bf] drop-shadow-[0_0_5px_rgba(45,212,191,0.5)]' : 'text-rose-500 drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]'}`}>
                                {netBalance > 0 ? '+' : ''}<AnimatedNumber value={netBalance} />
                            </p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            {/* STATS GRID */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
                <motion.div 
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.03)" }}
                    className="bg-[#020617]/60 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex flex-col justify-between h-28 relative overflow-hidden group"
                >
                    <div className="absolute -right-4 -top-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity bg-blue-500 rounded-full blur-2xl w-24 h-24"></div>
                    <div className="z-10 bg-blue-500/10 w-8 h-8 rounded-lg flex items-center justify-center mb-2">
                        <Smartphone className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Online / UPI</p>
                        <p className="text-2xl font-bold text-white mt-1">
                            <AnimatedNumber value={methodStats.upi} />
                        </p>
                    </div>
                </motion.div>

                <motion.div 
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.03)" }}
                    className="bg-[#020617]/60 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex flex-col justify-between h-28 relative overflow-hidden group"
                >
                    <div className="absolute -right-4 -top-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity bg-emerald-500 rounded-full blur-2xl w-24 h-24"></div>
                    <div className="z-10 bg-emerald-500/10 w-8 h-8 rounded-lg flex items-center justify-center mb-2">
                        <Banknote className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Cash Spent</p>
                        <p className="text-2xl font-bold text-white mt-1">
                            <AnimatedNumber value={methodStats.cash} />
                        </p>
                    </div>
                </motion.div>
            </motion.div>

            {/* CHART SECTION */}
            {totalCost > 0 && (
                <motion.div variants={itemVariants} className="bg-[#020617]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                            <Target className="w-4 h-4 text-[#00A896]" />
                            Analytics
                        </h3>
                        {activeGroup.category_limits && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00A896]/10 border border-[#00A896]/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00A896] animate-pulse"></div>
                                <span className="text-[10px] font-medium text-[#00A896]">AI Limits Active</span>
                            </div>
                        )}
                    </div>
                    {renderPieChart()}
                </motion.div>
            )}

            {/* RECENT EXPENSES */}
            <motion.div variants={itemVariants} className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Recent Activity
                    <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></span>
                </h3>

                {expenses.length === 0 ? (
                    <div className="text-center py-12 rounded-3xl border border-dashed border-white/10 bg-white/5">
                        <Receipt className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
                        <p className="text-zinc-400 text-sm">No expenses yet. Start adding!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence initial={false} mode="popLayout">
                        {expenses.slice(0, 5).map((expense) => (
                        <motion.div 
                            key={expense.id} 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
                            className="group relative bg-[#020617]/50 border border-white/5 rounded-2xl overflow-hidden transition-colors duration-200 backdrop-blur-md"
                        >
                            <div className="p-4 flex items-center justify-between">
                                
                                <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner transition-colors
                                    ${expense.is_settlement ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-[#00A896]/20 text-[#00A896] border border-[#00A896]/30'}`}>
                                    {expense.is_settlement ? <ArrowRightLeft className="h-5 w-5" /> : (expense.profiles?.full_name?.[0] || "?")}
                                </div>
                                
                                <div className="min-w-0">
                                    <p className="font-medium text-white truncate max-w-[140px] sm:max-w-[200px]">{expense.description}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        <span className="text-zinc-400">{expense.profiles?.full_name?.split(' ')[0] || "Someone"}</span>
                                        {!expense.is_settlement && expense.payment_method && ` • ${expense.payment_method}`}
                                    </p>
                                </div>
                                </div>

                                <div className="text-right whitespace-nowrap pl-2">
                                <p className={`font-bold text-sm sm:text-base ${expense.is_settlement ? 'text-blue-400' : 'text-white'}`}>
                                    ₹{expense.amount}
                                </p>
                                </div>
                            </div>

                            {currentUser && expense.paid_by === currentUser.id && !expense.is_settlement && (
                                <div className="absolute right-0 top-0 bottom-0 px-4 bg-gradient-to-l from-[#020617] via-[#020617]/90 to-transparent flex items-center gap-2 translate-x-full group-hover:translate-x-0 transition-transform duration-200">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteExpense(expense.id, expense.category);
                                        }}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                        ))}
                        </AnimatePresence>
                    </div>
                )}
            </motion.div>

        </motion.div>
    </div>
  )
}