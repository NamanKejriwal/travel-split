"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { Group } from "@/components/views/groups-view"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { motion, useInView } from "framer-motion"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend
} from "recharts"
import {
  ArrowLeft, Wallet, TrendingUp, Calendar, Users, 
  ArrowUpRight, ArrowDownLeft, Activity, Sparkles, Tag
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const supabase = createClient()

// --- HELPER COMPONENT FOR SCROLL ANIMATIONS ---
function ChartInView({ children, height = 250 }: { children: React.ReactNode, height?: number | string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <div ref={ref} style={{ height, width: "100%" }}>
      {isInView ? children : <div className="h-full w-full animate-pulse bg-white/5 rounded-xl" />}
    </div>
  )
}

// --- INTERFACES ---
interface AnalyticsViewProps {
  activeGroup: Group | null
  onBack: () => void
}

interface Expense {
  id: string
  amount: number
  paid_by: string
  created_at: string
  category: string
  is_settlement: boolean
  profiles?: { full_name: string }
}

interface MemberMetric {
  id: string
  name: string
  paid: number
  share: number
  net: number // paid - share
}

// --- CONSTANTS ---
const CATEGORY_COLORS: Record<string, string> = {
  "Food": "#2dd4bf", 
  "Local Transport": "#3b82f6", 
  "Travel": "#8b5cf6", 
  "Hostel / Hotel": "#f59e0b", 
  "Shopping": "#ec4899", 
  "Activity": "#ef4444", 
  "Other": "#9ca3af" 
}
const DEFAULT_COLOR = "#64748b"

// Card Animation
const scrollVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: "easeOut" } 
  }
} as const

export function AnalyticsView({ activeGroup, onBack }: AnalyticsViewProps) {
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('all')
  const [currentUserId, setCurrentUserId] = useState<string>("")
  
  // Data State
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<MemberMetric[]>([])
  
  // Derived Metrics
  const [totalSpent, setTotalSpent] = useState(0)
  const [userPaid, setUserPaid] = useState(0)
  const [userNetBalance, setUserNetBalance] = useState(0)
  const [topCategory, setTopCategory] = useState({ name: "N/A", value: 0 })
  const [activeDays, setActiveDays] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (activeGroup && currentUserId) fetchData()
  }, [activeGroup, currentUserId, timeRange])

  async function fetchData() {
    if (!activeGroup) return
    setLoading(true)

    try {
      // 1. Fetch Expenses
      let query = supabase
        .from('expenses')
        .select('*, profiles(full_name)')
        .eq('group_id', activeGroup.id)
        .eq('is_settlement', false)
        .order('created_at', { ascending: true })

      if (timeRange === '7d') {
        const date = new Date()
        date.setDate(date.getDate() - 7)
        query = query.gte('created_at', date.toISOString())
      } else if (timeRange === '30d') {
        const date = new Date()
        date.setDate(date.getDate() - 30)
        query = query.gte('created_at', date.toISOString())
      }

      const { data: expenseData, error } = await query
      if (error) throw error

      const rawExpenses = (expenseData || []).map((e: any) => ({
        ...e,
        profiles: Array.isArray(e.profiles) ? e.profiles[0] : e.profiles
      })) as Expense[]
      
      setExpenses(rawExpenses)

      // 2. Fetch Accurate Balances (RPC)
      const { data: balanceData } = await supabase.rpc('get_trip_balances', { p_group_id: activeGroup.id })
      
      // 3. Fetch Members List
      const { data: memberData } = await supabase
        .from('group_members')
        .select('user_id, profiles(full_name)')
        .eq('group_id', activeGroup.id)
      
      // 4. Calculate Metrics
      const total = rawExpenses.reduce((sum, e) => sum + e.amount, 0)
      setTotalSpent(total)

      // You Paid
      const myPaidAmt = rawExpenses
        .filter(e => e.paid_by === currentUserId)
        .reduce((sum, e) => sum + e.amount, 0)
      setUserPaid(myPaidAmt)

      // Net Balance
      const myBalanceRecord = balanceData?.find((b: any) => b.user_id === currentUserId)
      setUserNetBalance(myBalanceRecord ? myBalanceRecord.net_balance : 0)

      // Map member data
      const memberCount = memberData?.length || 1
      const fairShare = total / memberCount

      const updatedMembers = (memberData || []).map((m: any) => {
        const paid = rawExpenses
          .filter(e => e.paid_by === m.user_id)
          .reduce((sum, e) => sum + e.amount, 0)
        
        return {
          id: m.user_id,
          name: m.profiles?.full_name?.split(' ')[0] || "Unknown",
          paid,
          share: fairShare, 
          net: paid - fairShare
        }
      }).sort((a: any, b: any) => b.paid - a.paid)

      setMembers(updatedMembers)

      // Top Category
      const catMap = new Map<string, number>()
      rawExpenses.forEach(e => {
        const cat = e.category || 'Other'
        catMap.set(cat, (catMap.get(cat) || 0) + e.amount)
      })
      let maxCat = { name: "N/A", value: 0 }
      catMap.forEach((val, key) => {
        if (val > maxCat.value) maxCat = { name: key, value: val }
      })
      setTopCategory(maxCat)

      // Active Days
      if (rawExpenses.length > 0) {
        const start = new Date(rawExpenses[0].created_at).getTime()
        const end = new Date(rawExpenses[rawExpenses.length - 1].created_at).getTime()
        const diff = Math.ceil((end - start) / (1000 * 3600 * 24)) + 1
        setActiveDays(diff)
      } else {
        setActiveDays(1)
      }

    } catch (err) {
      console.error(err)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  // --- CHART DATA PREPARATION ---
  const trendData = useMemo(() => {
    const map = new Map<string, number>()
    expenses.forEach(e => {
      const date = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      map.set(date, (map.get(date) || 0) + e.amount)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [expenses])

  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    expenses.forEach(e => {
      const cat = e.category || 'Other'
      map.set(cat, (map.get(cat) || 0) + e.amount)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [expenses])

  const netBalanceData = useMemo(() => {
    return members.map(m => ({
      name: m.name,
      value: m.net,
      fill: m.net >= 0 ? '#10b981' : '#f43f5e'
    })).sort((a, b) => b.value - a.value)
  }, [members])

  const CustomTooltip = ({ active, payload, label, currency = true }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 p-3 rounded-xl shadow-2xl z-50">
          <p className="text-xs text-zinc-400 font-medium mb-1">{label}</p>
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className="text-sm font-bold text-white">
                {entry.name}: {currency ? `₹${Math.round(Math.abs(entry.value)).toLocaleString()}` : entry.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 bg-[#020617] min-h-screen">
        <Activity className="h-8 w-8 text-[#00A896] animate-spin" />
        <p className="text-zinc-500 text-sm animate-pulse">Analyzing financials...</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-[#020617] text-white overflow-y-auto pb-24 scrollbar-hide">
      
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#00A896]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="sticky top-0 z-30 bg-[#020617]/80 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-white/10 -ml-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-sm font-bold leading-tight">{activeGroup?.name}</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Analytics</p>
            </div>
          </div>
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <TabsList className="h-8 bg-white/5 border border-white/5 p-0.5 rounded-lg">
              {['7d', '30d', 'all'].map((t) => (
                <TabsTrigger 
                  key={t} 
                  value={t} 
                  className="text-[10px] h-7 px-3 rounded-md data-[state=active]:bg-[#00A896] data-[state=active]:text-white transition-all"
                >
                  {t === 'all' ? 'All' : t.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="px-5 py-6 space-y-8 max-w-lg mx-auto relative z-10">

        {/* 1. KEY METRICS GRID */}
        <motion.div 
          className="grid grid-cols-2 gap-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-20px" }}
          variants={scrollVariant}
        >
          {/* Card 1: Total Spent */}
          <motion.div 
            whileTap={{ scale: 0.95 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/10 backdrop-blur-sm active:opacity-80 transition-opacity"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] text-emerald-200/60 font-bold uppercase tracking-wider">Total Spent</p>
            <p className="text-xl font-black text-white mt-1">₹{Math.round(totalSpent).toLocaleString()}</p>
          </motion.div>

          {/* Card 2: You Paid */}
          <motion.div 
            whileTap={{ scale: 0.95 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/10 backdrop-blur-sm active:opacity-80 transition-opacity"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] text-blue-200/60 font-bold uppercase tracking-wider">You Paid</p>
            <p className="text-xl font-black text-white mt-1">₹{Math.round(userPaid).toLocaleString()}</p>
          </motion.div>

          {/* Card 3: Net Position */}
          <motion.div 
            whileTap={{ scale: 0.95 }}
            className={cn(
              "p-4 rounded-2xl border backdrop-blur-sm active:opacity-80 transition-opacity",
              userNetBalance >= 0 
                ? "bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-emerald-500/10"
                : "bg-gradient-to-br from-rose-500/10 to-red-500/5 border-rose-500/10"
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className={cn("p-2 rounded-lg", userNetBalance >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>
                {userNetBalance >= 0 ? <Users className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
              </div>
            </div>
            <p className={cn("text-[10px] font-bold uppercase tracking-wider", userNetBalance >= 0 ? "text-emerald-200/60" : "text-rose-200/60")}>
              {userNetBalance >= 0 ? "You Will Get" : "You Owe"}
            </p>
            <p className="text-xl font-black text-white mt-1">₹{Math.round(Math.abs(userNetBalance)).toLocaleString()}</p>
          </motion.div>

          {/* Card 4: Top Category */}
          <motion.div 
            whileTap={{ scale: 0.95 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/10 backdrop-blur-sm active:opacity-80 transition-opacity"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <Tag className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] text-amber-200/60 font-bold uppercase tracking-wider">Top Spend</p>
            <div className="mt-1">
              <p className="text-sm font-bold text-white truncate">{topCategory.name}</p>
              <p className="text-xs font-medium text-amber-400">₹{Math.round(topCategory.value).toLocaleString()}</p>
            </div>
          </motion.div>
        </motion.div>

        {/* 2. ACTIVITY PULSE (Area Chart) */}
        <motion.div 
          initial="hidden" 
          whileInView="visible" 
          whileTap={{ scale: 0.98 }}
          viewport={{ once: true, margin: "-50px" }}
          variants={scrollVariant}
          className="rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden active:border-white/10 transition-colors"
        >
          <div className="p-5 border-b border-white/5 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#00A896]" />
            <h3 className="font-bold text-sm text-zinc-200">Activity Pulse</h3>
          </div>
          <div className="pt-4 pr-0">
            <ChartInView height={220}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00A896" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#00A896" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#52525b', fontSize: 10}} 
                    dy={10}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#00A896" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorTrend)"
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartInView>
          </div>
        </motion.div>

        {/* 3. CATEGORY DNA (Donut Chart) */}
        <motion.div 
          initial="hidden" 
          whileInView="visible" 
          whileTap={{ scale: 0.98 }}
          viewport={{ once: true, margin: "-50px" }}
          variants={scrollVariant}
          className="rounded-3xl border border-white/5 bg-white/[0.02] p-5 active:border-white/10 transition-colors"
        >
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <h3 className="font-bold text-sm text-zinc-200">Category Breakdown</h3>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-[200px]">
              <ChartInView height={200}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={5}
                      animationDuration={1500}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || DEFAULT_COLOR} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartInView>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Top</span>
                <span className="text-sm font-black text-white truncate max-w-[80px]">
                  {categoryData[0]?.name || "N/A"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 w-full mt-6">
              {categoryData.slice(0, 6).map((cat, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.name] || DEFAULT_COLOR }} />
                    <span className="text-xs text-zinc-300 truncate font-medium">{cat.name}</span>
                  </div>
                  <span className="text-xs font-bold text-white">{(cat.value / totalSpent * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* 4. NET IMPACT (Diverging Bar) */}
        <motion.div 
          initial="hidden" 
          whileInView="visible" 
          whileTap={{ scale: 0.98 }}
          viewport={{ once: true, margin: "-50px" }}
          variants={scrollVariant}
          className="rounded-3xl border border-white/5 bg-white/[0.02] p-5 active:border-white/10 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <h3 className="font-bold text-sm text-zinc-200">Net Impact</h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 font-medium">Who owes what</span>
          </div>

          <div className="mt-4">
            <ChartInView height={250}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={netBalanceData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={80} 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#e4e4e7', fontSize: 11, fontWeight: 500 }} 
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                  <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
                  <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={20} animationDuration={1500}>
                    {netBalanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartInView>
          </div>
          <p className="text-[10px] text-center text-zinc-500 mt-2">
            <span className="text-emerald-400 font-bold">Green</span> receives money • <span className="text-rose-400 font-bold">Red</span> needs to pay
          </p>
        </motion.div>

        {/* 5. CONTRIBUTION MATRIX (Stacked Bar) */}
        <motion.div 
          initial="hidden" 
          whileInView="visible" 
          whileTap={{ scale: 0.98 }}
          viewport={{ once: true, margin: "-50px" }}
          variants={scrollVariant}
          className="rounded-3xl border border-white/5 bg-white/[0.02] p-5 active:border-white/10 transition-colors"
        >
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="h-4 w-4 text-purple-400" />
            <h3 className="font-bold text-sm text-zinc-200">Paid vs Fair Share</h3>
          </div>
          
          <div>
            <ChartInView height={250}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={members} margin={{top: 0, left: -20, right: 0, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 10}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 10}} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '11px', paddingTop: '10px'}} />
                  <Bar dataKey="paid" name="Paid" fill="#00A896" radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={1500} />
                  <Bar dataKey="share" name="Share" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            </ChartInView>
          </div>
        </motion.div>

        {/* 6. INSIGHT FOOTER */}
        <motion.div 
          initial="hidden" 
          whileInView="visible" 
          whileTap={{ scale: 0.98 }}
          viewport={{ once: true, margin: "-50px" }}
          variants={scrollVariant}
          className="p-5 rounded-3xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 text-center space-y-2 active:opacity-80 transition-opacity"
        >
          <Sparkles className="h-6 w-6 text-indigo-300 mx-auto mb-2" />
          <h4 className="font-bold text-indigo-100">Trip Burn Rate</h4>
          <p className="text-sm text-indigo-200/80">
            The group is spending an average of <span className="text-white font-bold">₹{Math.round(totalSpent / (activeDays || 1)).toLocaleString()}</span> per day.
          </p>
        </motion.div>

      </div>
    </div>
  )
}