"use client"

import { exportToExcel } from "@/lib/export-excel"
import { FileSpreadsheet } from "lucide-react"
import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Group } from "@/components/views/groups-view"
import { 
  Loader2, Receipt, ArrowRightLeft, AlertCircle, Search, Download, 
  Calendar, User, CreditCard, Tag, Users, Trash2, Pencil, Sparkles 
} from "lucide-react"
import { ExpenseToEdit } from "@/components/add-expense-drawer"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { motion, AnimatePresence } from "framer-motion"

// --- ANIMATION VARIANTS ---
const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
}

const listItemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: "spring" as const, // <--- ADD THIS HERE
      stiffness: 260, 
      damping: 20 
    }
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
}
interface ActivityViewProps {
  activeGroup: Group | null
  onEditExpense?: (expense: ExpenseToEdit) => void
}

const ITEMS_PER_PAGE = 20

export function ActivityView({ activeGroup, onEditExpense }: ActivityViewProps) {
  const supabase = createClient()
  
  // --- STATE MANAGEMENT ---
  const [activities, setActivities] = useState<any[]>([])
  const [filteredActivities, setFilteredActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [showUpdateNotification, setShowUpdateNotification] = useState(false)

  // Infinite Scroll Ref
  const observerTarget = useRef<HTMLDivElement>(null)

  // Detail Dialog State
  const [selectedActivity, setSelectedActivity] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [splitDetails, setSplitDetails] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // 1. Init User
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
        if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  // 2. Reset on Group Change
  useEffect(() => {
    if (activeGroup) {
      setActivities([])
      setFilteredActivities([])
      setPage(0)
      setHasMore(true)
      fetchActivity(0, true)
    }
  }, [activeGroup])

  // 3. REAL-TIME SUBSCRIPTION LOGIC
  useEffect(() => {
    if (!activeGroup) return

    const channel = supabase
      .channel(`activity-${activeGroup.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `group_id=eq.${activeGroup.id}`
        },
        async (payload) => {
          console.log('Real-time update:', payload)

          if (payload.eventType === 'INSERT') {
            const { data: newExpense } = await supabase
              .from('expenses')
              .select(`*, profiles(full_name)`)
              .eq('id', payload.new.id)
              .single()

            if (newExpense) {
              setActivities(prev => [newExpense, ...prev])
              setFilteredActivities(prev => [newExpense, ...prev])
              
              setShowUpdateNotification(true)
              toast.success("New expense added")
              setTimeout(() => setShowUpdateNotification(false), 3000)
            }
          } 
          else if (payload.eventType === 'DELETE') {
            setActivities(prev => prev.filter(item => item.id !== payload.old.id))
            setFilteredActivities(prev => prev.filter(item => item.id !== payload.old.id))
          }
          else if (payload.eventType === 'UPDATE') {
            const { data: updatedExpense } = await supabase
              .from('expenses')
              .select(`*, profiles(full_name)`)
              .eq('id', payload.new.id)
              .single()

            if (updatedExpense) {
              setActivities(prev => prev.map(item => 
                item.id === updatedExpense.id ? updatedExpense : item
              ))
              setFilteredActivities(prev => prev.map(item => 
                item.id === updatedExpense.id ? updatedExpense : item
              ))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeGroup])

  // 4. Search Filter Logic
  useEffect(() => {
    if (searchTerm.trim() === "") {
        setFilteredActivities(activities)
    } else {
        const lowerSearch = searchTerm.toLowerCase()
        const filtered = activities.filter(item => 
            item.description.toLowerCase().includes(lowerSearch) ||
            item.profiles?.full_name?.toLowerCase().includes(lowerSearch) ||
            item.amount.toString().includes(lowerSearch) ||
            item.category?.toLowerCase().includes(lowerSearch)
        )
        setFilteredActivities(filtered)
    }
  }, [searchTerm, activities])

  // 5. Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && searchTerm === "") {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, loading, loadingMore, searchTerm])

  // 6. Data Fetching
  async function fetchActivity(pageNum: number, isInitial: boolean = false) {
    if (isInitial) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const from = pageNum * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      const { data, error, count } = await supabase
        .from('expenses')
        .select(`*, profiles(full_name)`, { count: 'exact' })
        .eq('group_id', activeGroup?.id)
        .order('created_at', { ascending: false })
        .range(from, to)
      
      if (error) throw error

      const newActivities = data || []
      
      if (isInitial) {
        setActivities(newActivities)
        setFilteredActivities(newActivities)
      } else {
        setActivities(prev => [...prev, ...newActivities])
        setFilteredActivities(prev => [...prev, ...newActivities])
      }

      if (count !== null) {
        setHasMore((pageNum + 1) * ITEMS_PER_PAGE < count)
      } else {
        setHasMore(newActivities.length === ITEMS_PER_PAGE)
      }

    } catch (err) {
      console.error("Error fetching activity", err)
      toast.error("Failed to load expenses")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMore = useCallback(() => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchActivity(nextPage, false)
  }, [page, activeGroup])

  // 7. Click & Detail Logic
  const handleActivityClick = async (activity: any) => {
    setSelectedActivity(activity)
    setDetailOpen(true)
    setSplitDetails([])
    
    if (!activity.is_settlement) {
        setLoadingDetails(true)
        try {
            const { data, error } = await supabase
                .from('expense_splits')
                .select('amount_owed, profiles(full_name)')
                .eq('expense_id', activity.id)
            
            if (error) throw error
            setSplitDetails(data || [])
        } catch (err) {
            console.error("Error fetching splits", err)
        } finally {
            setLoadingDetails(false)
        }
    }
  }

  // 8. Delete Logic
  const handleDelete = async () => {
    if (!selectedActivity) return
    if (!confirm("Delete this expense permanently?")) return

    try {
        const { error } = await supabase.from('expenses').delete().eq('id', selectedActivity.id)
        if (error) throw error
        
        toast.success("Expense deleted")
        setDetailOpen(false)
    } catch (err: any) {
        toast.error("Failed to delete")
    }
  }

  // 9. Edit Logic
  const handleEdit = () => {
    if (!selectedActivity || !onEditExpense) return
    onEditExpense({
        id: selectedActivity.id,
        description: selectedActivity.description,
        amount: selectedActivity.amount,
        paid_by: selectedActivity.paid_by,
        category: selectedActivity.category,
        payment_method: selectedActivity.payment_method
    })
    setDetailOpen(false)
  }

  // 10. PDF Generation Logic (Preserved)
  const handleDownloadPDF = () => {
    // 🔍 1. PRE-PROCESS DATA
    const realExpenses = activities.filter(e => !e.is_settlement);
    const settlements = activities.filter(e => e.is_settlement);
    const totalTripCost = realExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    // Member Analytics Logic
    const personMap: Record<string, { paid_exp: number, paid_settle: number }> = {};
    activities.forEach(e => {
        const name = e.profiles?.full_name || 'Unknown';
        if (!personMap[name]) personMap[name] = { paid_exp: 0, paid_settle: 0 };
        if (e.is_settlement) personMap[name].paid_settle += Number(e.amount);
        else personMap[name].paid_exp += Number(e.amount);
    });
    const memberCount = Object.keys(personMap).length;
    const sharePerHead = memberCount > 0 ? totalTripCost / memberCount : 0;

    // Category Logic
    const catMap: Record<string, number> = {};
    realExpenses.forEach(e => {
        const c = e.category || 'Other';
        catMap[c] = (catMap[c] || 0) + Number(e.amount);
    });

    // Payment Mode Logic
    const modeMap: Record<string, { amount: number, count: number }> = {};
    realExpenses.forEach(e => {
        const m = e.payment_mode || 'UPI';
        if (!modeMap[m]) modeMap[m] = { amount: 0, count: 0 };
        modeMap[m].amount += Number(e.amount);
        modeMap[m].count += 1;
    });

    // Daily Velocity Logic
    const dayMap: Record<string, { amount: number, count: number }> = {};
    realExpenses.forEach(e => {
        const d = new Date(e.created_at).toLocaleDateString('en-GB');
        if (!dayMap[d]) dayMap[d] = { amount: 0, count: 0 };
        dayMap[d].amount += Number(e.amount);
        dayMap[d].count += 1;
    });

    const printContent = `
      <html>
        <head>
          <title>${activeGroup?.name || "Trip"} - Full Expedition Report</title>
          <style>
            body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 30px; color: #1f2937; line-height: 1.5; font-size: 11px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #00A896; padding-bottom: 15px; }
            h1 { color: #00A896; margin: 0; font-size: 24px; text-transform: uppercase; }
            h2 { color: #111827; border-left: 4px solid #00A896; padding-left: 10px; margin-top: 30px; font-size: 14px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
            th, td { text-align: left; padding: 8px; border: 1px solid #e5e7eb; word-wrap: break-word; }
            th { background-color: #f9fafb; color: #4b5563; font-weight: bold; }
            .amount { text-align: right; font-weight: bold; }
            .summary-card { background: #f0fdfa; border: 1px solid #ccfbf1; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; }
            .settlement-text { color: #2563eb; font-style: italic; }
            .page-break { page-break-before: always; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${activeGroup?.name || "Trip"} EXPEDITION REPORT</h1>
            <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
          </div>

          <h2>1. Executive Summary</h2>
          <div class="summary-card">
            <div><strong>Trip Cost:</strong> ₹${totalTripCost.toLocaleString()}</div>
            <div><strong>Transactions:</strong> ${activities.length}</div>
            <div><strong>Avg/Head:</strong> ₹${sharePerHead.toFixed(0)}</div>
          </div>

          <h2>2. Member Financial Status</h2>
          <table>
            <thead><tr><th>Name</th><th>Paid (Exp)</th><th>Paid (Settle)</th><th>Fair Share</th><th>Balance</th></tr></thead>
            <tbody>
              ${Object.entries(personMap).map(([name, s]) => `
                <tr>
                  <td>${name}</td>
                  <td class="amount">₹${s.paid_exp.toFixed(0)}</td>
                  <td class="amount">₹${s.paid_settle.toFixed(0)}</td>
                  <td class="amount">₹${sharePerHead.toFixed(0)}</td>
                  <td class="amount" style="color: ${(s.paid_exp + s.paid_settle - sharePerHead) >= 0 ? '#10b981' : '#ef4444'}">
                    ₹${(s.paid_exp + s.paid_settle - sharePerHead).toFixed(0)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2>3. Detailed Transaction Ledger</h2>
          <table>
            <thead><tr><th style="width: 80px;">Date</th><th>Description</th><th>Paid By</th><th style="width: 80px;">Amount</th></tr></thead>
            <tbody>
              ${activities.map(item => `
                <tr>
                  <td>${new Date(item.created_at).toLocaleDateString('en-GB')}</td>
                  <td class="${item.is_settlement ? 'settlement-text' : ''}">${item.is_settlement ? 'Debt Settlement' : item.description}</td>
                  <td>${item.profiles?.full_name || 'Unknown'}</td>
                  <td class="amount">₹${Number(item.amount).toFixed(0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="page-break"></div>

          <h2>4. Spending by Category</h2>
          <table>
            <thead><tr><th>Category</th><th>Total Amount</th><th>Percentage</th></tr></thead>
            <tbody>
              ${Object.entries(catMap).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => `
                <tr><td>${cat}</td><td class="amount">₹${amt.toFixed(0)}</td><td>${((amt/totalTripCost)*100).toFixed(1)}%</td></tr>
              `).join('')}
            </tbody>
          </table>

          <h2>5. Payment Liquidity (Mode)</h2>
          <table>
            <thead><tr><th>Mode</th><th>Volume</th><th>Count</th><th>Trip %</th></tr></thead>
            <tbody>
              ${Object.entries(modeMap).map(([mode, data]) => `
                <tr><td>${mode}</td><td class="amount">₹${data.amount.toFixed(0)}</td><td>${data.count}</td><td>${((data.amount/totalTripCost)*100).toFixed(1)}%</td></tr>
              `).join('')}
            </tbody>
          </table>

          <h2>6. Daily Spending Timeline</h2>
          <table>
            <thead><tr><th>Date</th><th>Daily Total</th><th>Transactions</th></tr></thead>
            <tbody>
              ${Object.entries(dayMap).sort().map(([date, data]) => `
                <tr><td>${date}</td><td class="amount">₹${data.amount.toFixed(0)}</td><td>${data.count}</td></tr>
              `).join('')}
            </tbody>
          </table>

          <h2>7. Debt Settlement History</h2>
          <table>
            <thead><tr><th>Date</th><th>Payer</th><th>Receiver / Description</th><th>Amount</th></tr></thead>
            <tbody>
              ${settlements.length > 0 ? settlements.map(s => `
                <tr>
                  <td>${new Date(s.created_at).toLocaleDateString('en-GB')}</td>
                  <td>${s.profiles?.full_name || 'Unknown'}</td>
                  <td class="settlement-text">Settlement Payment</td>
                  <td class="amount">₹${Number(s.amount).toFixed(0)}</td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="text-align:center">No settlements recorded.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '', 'width=1000,height=900');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 1000);
    }
}
  // --- RENDER ---
  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-4 text-center text-zinc-500 bg-[#020617]">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
            <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm sm:text-base px-4">Please select a trip from the <b>Groups</b> tab to view activity.</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-3 sm:p-4 pb-24 relative overflow-hidden">
      
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[15%] left-[-15%] w-[40%] h-[40%] bg-[#00A896]/10 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        className="relative z-10 space-y-4 max-w-3xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        
        {/* Real-time Update Notification */}
        <AnimatePresence>
            {showUpdateNotification && (
                <motion.div 
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
                >
                    <div className="bg-[#00A896] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-white/20 backdrop-blur-md">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        <span className="text-sm font-bold">Activity updated!</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">Activity</h2>
            <div className="flex gap-2">
                <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleDownloadPDF} 
                    className="flex-1 sm:flex-none bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-full text-xs"
                >
                    <Download className="h-3 w-3 mr-2" /> PDF
                </Button>
                <Button 
                    size="sm" 
                    onClick={() => exportToExcel(activities, activeGroup?.name || 'Trip', true)}
                    className="flex-1 sm:flex-none bg-[#00A896]/10 border border-[#00A896]/50 text-[#00A896] hover:bg-[#00A896]/20 rounded-full text-xs"
                >
                    <FileSpreadsheet className="h-3 w-3 mr-2" /> Excel
                </Button>
            </div>
        </div>

        {/* Search */}
        <motion.div 
            className="relative"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
        >
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
            <Input 
                placeholder="Search expenses..." 
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-2xl h-11 focus-visible:ring-[#00A896]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </motion.div>

        {/* Content List */}
        {loading ? (
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-20 w-full bg-white/5 rounded-2xl animate-pulse border border-white/5" />
                ))}
            </div>
        ) : filteredActivities.length === 0 ? (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="text-center py-20 px-4 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]"
            >
                <p className="text-zinc-500 text-sm">No matching activity found.</p>
            </motion.div>
        ) : (
            <>
            <motion.div 
                className="space-y-3"
                variants={listContainerVariants}
                initial="hidden"
                animate="visible"
            >
                <AnimatePresence initial={false} mode="popLayout">
                {filteredActivities.map((item) => (
                    <motion.div 
                        key={item.id} 
                        variants={listItemVariants}
                        layout
                        onClick={() => handleActivityClick(item)}
                        whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
                        whileTap={{ scale: 0.99 }}
                        className="group cursor-pointer rounded-2xl bg-[#020617]/60 backdrop-blur-md border border-white/5 p-4 flex items-center gap-4 transition-colors duration-200"
                    >
                        {/* Icon */}
                        <div className={`p-3 rounded-xl shrink-0 ${item.is_settlement ? 'bg-blue-500/10 text-blue-400' : 'bg-[#00A896]/10 text-[#00A896]'}`}>
                            {item.is_settlement ? <ArrowRightLeft className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <p className="font-semibold text-white truncate max-w-[70%]">
                                    {item.is_settlement ? <span className="text-blue-400">Payment made</span> : item.description}
                                </p>
                                <span className={`font-bold text-sm ${item.is_settlement ? 'text-blue-400' : 'text-white'}`}>
                                    ₹{Number(item.amount).toFixed(0)}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-end mt-1">
                                <p className="text-xs text-zinc-500 truncate">
                                    <span className="text-zinc-300">{item.profiles?.full_name?.split(' ')[0] || "Unknown"}</span> • {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </p>
                                {!item.is_settlement && (
                                    <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-zinc-400 border border-white/5">
                                        {item.category || "General"}
                                    </span>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
                </AnimatePresence>
            </motion.div>

            {searchTerm === "" && (
                <div ref={observerTarget} className="py-6 flex justify-center">
                {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-[#00A896]" />}
                {!hasMore && !loadingMore && activities.length > 0 && (
                    <div className="h-1 w-12 bg-white/10 rounded-full" />
                )}
                </div>
            )}
            </>
        )}

        {/* DETAILS DIALOG */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
            <DialogContent className="bg-[#020617]/95 backdrop-blur-xl border-white/10 text-white w-[95vw] max-w-md rounded-2xl p-0 overflow-hidden shadow-2xl">
                
                {/* Header */}
                <div className="p-6 pb-4 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl shrink-0 ${selectedActivity?.is_settlement ? 'bg-blue-500/20 text-blue-400' : 'bg-[#00A896]/20 text-[#00A896]'}`}>
                            {selectedActivity?.is_settlement ? <ArrowRightLeft className="h-6 w-6" /> : <Receipt className="h-6 w-6" />}
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-white leading-tight">
                                {selectedActivity?.description || "Expense Details"}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-zinc-400 mt-1">
                                Added on {selectedActivity && new Date(selectedActivity.created_at).toLocaleString()}
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                {/* Body */}
                {selectedActivity && (
                    <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        
                        {/* Amount Box */}
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="flex flex-col items-center justify-center py-6 rounded-2xl bg-white/5 border border-white/5"
                        >
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Total Amount</span>
                            <span className={`text-4xl font-black ${selectedActivity.is_settlement ? 'text-blue-400' : 'text-white'}`}>
                                ₹{Number(selectedActivity.amount).toLocaleString()}
                            </span>
                        </motion.div>

                        {/* Meta Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1"><User className="w-3 h-3"/> Paid By</span>
                                <p className="text-sm font-medium text-zinc-200">{selectedActivity.profiles?.full_name || "Unknown"}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1"><CreditCard className="w-3 h-3"/> Method</span>
                                <p className="text-sm font-medium text-zinc-200">{selectedActivity.payment_mode || "UPI"}</p>
                            </div>
                            {!selectedActivity.is_settlement && (
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1"><Tag className="w-3 h-3"/> Category</span>
                                    <p className="text-sm font-medium text-zinc-200">{selectedActivity.category}</p>
                                </div>
                            )}
                        </div>

                        {/* Splits */}
                        {!selectedActivity.is_settlement && (
                            <div className="pt-2">
                                <h4 className="text-xs font-bold text-zinc-400 uppercase mb-3 flex items-center gap-2">
                                    <Users className="w-3 h-3" /> Split Details
                                </h4>
                                {loadingDetails ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full bg-white/5 rounded-lg" />
                                        <Skeleton className="h-10 w-full bg-white/5 rounded-lg" />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {splitDetails.map((split, i) => (
                                            <motion.div 
                                                key={i} 
                                                initial={{ x: -10, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: 0.2 + (i * 0.05) }}
                                                className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5"
                                            >
                                                <span className="text-sm text-zinc-300">{split.profiles?.full_name || "Unknown"}</span>
                                                <span className="text-sm font-bold text-[#00A896]">₹{Number(split.amount_owed).toFixed(2)}</span>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Actions */}
                <DialogFooter className="p-4 bg-[#020617] border-t border-white/5">
                    {currentUserId === selectedActivity?.paid_by && !selectedActivity?.is_settlement ? (
                        <div className="grid grid-cols-3 gap-2 w-full">
                            <Button variant="ghost" className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-10" onClick={handleDelete}>
                                <Trash2 className="w-4 h-4 mr-1" /> Delete
                            </Button>
                            <Button variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs h-10" onClick={handleEdit}>
                                <Pencil className="w-4 h-4 mr-1" /> Edit
                            </Button>
                            <Button className="bg-white/10 hover:bg-white/20 text-white text-xs h-10" onClick={() => setDetailOpen(false)}>
                                Close
                            </Button>
                        </div>
                    ) : (
                        <Button className="w-full bg-[#00A896] hover:bg-[#00A896]/90 text-white rounded-xl h-11" onClick={() => setDetailOpen(false)}>
                            Done
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  )
}