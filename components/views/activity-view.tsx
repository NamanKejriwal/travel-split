"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Icons
import { 
  FileSpreadsheet, Loader2, Receipt, ArrowRightLeft, AlertCircle, 
  Search, Download, User, CreditCard, 
  Tag, Users, Trash2, Pencil, Sparkles, X, Info, Wallet, Smartphone, Banknote, ArrowRight
} from "lucide-react"

// Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, 
  DialogTitle, DialogFooter 
} from "@/components/ui/dialog"
import { Group } from "@/components/views/groups-view"
import { ExpenseToEdit } from "@/components/add-expense-drawer"
import { exportToExcel } from "@/lib/export-excel"
import { generatePDF } from "@/lib/generate-pdf" 
import { SettleUpDialog } from "@/components/settle-up-dialog"

const supabase = createClient()

// --- ANIMATION VARIANTS ---
const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
}

const listItemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 } as const
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
}

interface ActivityViewProps {
  activeGroup: Group | null
  onEditExpense?: (expense: ExpenseToEdit) => void
}

const ITEMS_PER_PAGE = 20

export function ActivityView({ activeGroup, onEditExpense }: ActivityViewProps) {
  
  // --- STATE ---
  const [activities, setActivities] = useState<any[]>([])
  
  // UI States
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [showUpdateNotification, setShowUpdateNotification] = useState(false)

  // Detail Dialogs
  const [selectedActivity, setSelectedActivity] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [splitDetails, setSplitDetails] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Edit Settlement Dialog
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false)
  const [paymentToEdit, setPaymentToEdit] = useState<any | null>(null)

  // Infinite Scroll
  const observerTarget = useRef<HTMLDivElement>(null)

  // --- DERIVED STATE (SEARCH LOGIC) ---
  const filteredActivities = useMemo(() => {
    const trimmedSearch = searchTerm.trim().toLowerCase()
    
    if (!trimmedSearch) return activities

    return activities.filter(item => {
      const description = (item.description || "").toLowerCase()
      const userName = (item.profiles?.full_name || "").toLowerCase()
      const amount = (item.amount || "").toString()
      const category = (item.category || "").toLowerCase()

      return (
        description.includes(trimmedSearch) ||
        userName.includes(trimmedSearch) ||
        amount.includes(trimmedSearch) ||
        category.includes(trimmedSearch)
      )
    })
  }, [activities, searchTerm])

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
      setPage(0)
      setHasMore(true)
      setSearchTerm("")
      fetchActivity(0, true)
    }
  }, [activeGroup?.id])

  // 3. Real-time Subscription
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
          if (payload.eventType === 'INSERT') {
            const { data: newExpense } = await supabase
              .from('expenses')
              .select(`*, profiles(full_name)`)
              .eq('id', payload.new.id)
              .single()
            
            if (newExpense) {
              setActivities(prev => [newExpense, ...prev])
              setShowUpdateNotification(true)
              setTimeout(() => setShowUpdateNotification(false), 3000)
            }
          } 
          else if (payload.eventType === 'DELETE') {
             setActivities(prev => prev.filter(item => item.id !== payload.old.id))
          } 
          else if (payload.eventType === 'UPDATE') {
             const { data: updated } = await supabase
               .from('expenses')
               .select(`*, profiles(full_name)`)
               .eq('id', payload.new.id)
               .single()
             
             if (updated) {
               setActivities(prev => prev.map(item => item.id === updated.id ? updated : item))
             }
          }
        }
      )
      .subscribe()
    
    return () => { 
      supabase.removeChannel(channel) 
    }
  }, [activeGroup?.id])

  // 4. Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting && 
          hasMore && 
          !loading && 
          !loadingMore && 
          searchTerm === ""
        ) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }
    
    return () => { 
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current) 
      }
    }
  }, [hasMore, loading, loadingMore, searchTerm])

  // 6. Data Fetching
  async function fetchActivity(pageNum: number, isInitial: boolean = false) {
    if (isInitial) setLoading(true)
    else setLoadingMore(true)
    
    try {
      const { data, error, count } = await supabase
        .from('expenses')
        .select(`*, profiles(full_name)`, { count: 'exact' })
        .eq('group_id', activeGroup?.id)
        .order('created_at', { ascending: false })
        .range(
          pageNum * ITEMS_PER_PAGE, 
          (pageNum * ITEMS_PER_PAGE) + ITEMS_PER_PAGE - 1
        )
      
      if (error) throw error
      
      const newItems = data || []
      
      if (isInitial) {
        setActivities(newItems)
      } else {
        setActivities(prev => {
            const existingIds = new Set(prev.map(i => i.id))
            const uniqueNew = newItems.filter(i => !existingIds.has(i.id))
            return [...prev, ...uniqueNew]
        })
      }
      
      if (count !== null) {
        setHasMore(((pageNum + 1) * ITEMS_PER_PAGE) < count)
      } else {
        setHasMore(newItems.length === ITEMS_PER_PAGE)
      }

    } catch (err) { 
      console.error("Fetch error:", err)
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

  // 7. Click Handlers
  const handleActivityClick = async (activity: any) => {
    setSelectedActivity(activity)
    setDetailOpen(true)
    setSplitDetails([])
    
    setLoadingDetails(true)
    
    // FIX: Fetch email along with name so we can notify on delete
    const { data } = await supabase
      .from('expense_splits')
      .select('amount_owed, profiles(full_name, email)') 
      .eq('expense_id', activity.id)
    
    setSplitDetails(data || [])
    setLoadingDetails(false)
  }

  const handleDelete = async () => {
    if (!selectedActivity) return
    if (!confirm("Delete this permanently?")) return
    
    setDetailOpen(false)
    setLoading(true)

    try {
      // === 1. FORCE FETCH EMAILS BEFORE DELETING ===
      // We fetch this explicitly to ensure we don't miss anyone
      const { data: splits } = await supabase
        .from('expense_splits')
        .select('profiles(full_name, email)') 
        .eq('expense_id', selectedActivity.id)

      // === 2. PREPARE NOTIFICATION DATA ===
      const notificationData = {
         type: selectedActivity.is_settlement ? 'SETTLEMENT' : 'EXPENSE',
         action: 'DELETED',
         amount: selectedActivity.amount,
         description: selectedActivity.description || "Settlement",
         groupName: activeGroup?.name || "Trip",
         payerName: selectedActivity.profiles?.full_name || "A friend",
         recipients: [] as any[]
      }

      const rawRecipients = (splits || []).map((s: any) => s.profiles)

      if (selectedActivity.is_settlement) {
         // For settlements, notify the person who was getting paid
         // (The first person in the split list is the receiver)
         const receiver = rawRecipients[0]
         if (receiver?.email) {
            notificationData.recipients.push({ email: receiver.email, name: receiver.full_name })
         }
      } else {
         // For expenses, notify everyone involved (except the person deleting)
         notificationData.recipients = rawRecipients
            .filter((p: any) => p?.email && p?.email !== currentUserId)
            .map((p: any) => ({ email: p.email, name: p.full_name }))
      }

      // === 3. PERFORM DELETE ===
      await supabase.from('expense_splits').delete().eq('expense_id', selectedActivity.id)
      await supabase.from('expenses').delete().eq('id', selectedActivity.id)
      
      // === 4. SEND NOTIFICATION ===
      if (notificationData.recipients.length > 0) {
         // Fire and forget
         fetch('/api/notify', {
            method: 'POST',
            body: JSON.stringify(notificationData)
         })
      }

      toast.success("Deleted successfully")
      await fetchActivity(0, true)

    } catch (err) {
      console.error(err)
      toast.error("Failed to delete")
      setLoading(false)
    }
  }

  const handleEdit = () => {
    if (!selectedActivity) return

    if (selectedActivity.is_settlement) {
      setPaymentToEdit(selectedActivity)
      setEditPaymentDialogOpen(true)
    } else if (onEditExpense) {
      onEditExpense(selectedActivity)
    }
    setDetailOpen(false)
  }

  const handlePaymentUpdated = useCallback(async () => {
    await fetchActivity(0, true)
    setPaymentToEdit(null)
  }, [])

  const handleDownloadPDF = () => {
    generatePDF(activities, activeGroup);
  }

  // ... (REST OF THE RENDER LOGIC REMAINS THE SAME)
  // Just copying the render part to ensure the file is complete
  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-6 text-center text-zinc-500 bg-[#020617]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }} 
          animate={{ opacity: 1, scale: 1 }}
        >
          <AlertCircle className="h-12 w-12 mb-4 opacity-20 mx-auto" />
          <p className="text-sm sm:text-base px-4">
            Please select a trip from the <b>Groups</b> tab to view activity.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 pb-24 relative overflow-hidden">
      
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[15%] left-[-15%] w-[40%] h-[40%] bg-[#00A896]/10 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        className="relative z-10 space-y-5 max-w-3xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-3xl font-black tracking-tight">Activity</h2>
            <p className="text-zinc-500 text-sm mt-1">All transactions during the trip</p>
          </div>
          
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
              onClick={() => exportToExcel(activities, activeGroup?.name || 'Trip')}
              className="flex-1 sm:flex-none bg-[#00A896]/10 border border-[#00A896]/50 text-[#00A896] hover:bg-[#00A896]/20 rounded-full text-xs"
            >
              <FileSpreadsheet className="h-3 w-3 mr-2" /> Excel
            </Button>
          </div>
        </div>

        <motion.div 
          className="flex flex-col sm:flex-row gap-3"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
            <Input 
              placeholder="Search expenses..." 
              className="pl-12 pr-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-2xl h-12 focus-visible:ring-[#00A896] text-base"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <AnimatePresence>
              {searchTerm && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-full transition-colors group"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-zinc-400 group-hover:text-white transition-colors" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {activities.length > 0 && (
          <p className="text-center text-xs text-zinc-500 flex items-center justify-center gap-2 opacity-60 ">
            <Info className="w-3 h-3" /> Tap a transaction to view its details, make edits, or delete it.
          </p>
        )}

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
            <Receipt className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-base font-semibold mb-2">
              {searchTerm ? "No matching activity found" : "No expenses yet"}
            </p>
            <p className="text-zinc-600 text-sm mb-4">
              {searchTerm 
                ? "Try adjusting your search" 
                : "Start adding expenses to track your trip"}
            </p>
            {searchTerm && (
              <Button 
                variant="link" 
                onClick={() => setSearchTerm("")} 
                className="text-[#00A896] text-sm"
              >
                Clear search
              </Button>
            )}
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
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="group cursor-pointer rounded-2xl bg-[#0f172a]/80 backdrop-blur-md border border-white/5 p-4 flex items-center gap-4 transition-all hover:bg-white/5"
                  >
                    <div className={cn(
                      "p-3 rounded-xl shrink-0 shadow-inner",
                      item.is_settlement 
                        ? 'bg-blue-500/10 text-blue-400' 
                        : 'bg-[#00A896]/10 text-[#00A896]'
                    )}>
                      {item.is_settlement ? (
                        <ArrowRightLeft className="h-5 w-5" />
                      ) : (
                        <Receipt className="h-5 w-5" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-3">
                        <p className="font-semibold text-white truncate">
                          {item.is_settlement ? (
                            <span className="text-blue-400">Payment made</span>
                          ) : (
                            item.description
                          )}
                        </p>
                        <span className={cn(
                          "font-bold text-base shrink-0",
                          item.is_settlement ? 'text-blue-400' : 'text-white'
                        )}>
                          ₹{Number(item.amount).toLocaleString('en-IN')}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-end mt-1">
                        <p className="text-xs text-zinc-500 truncate flex items-center gap-1">
                          <span className="text-zinc-300 font-medium">
                            {item.profiles?.full_name?.split(' ')[0] || "Unknown"}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(item.created_at).toLocaleDateString([], { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                        </p>
                        {!item.is_settlement && item.category && (
                          <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-zinc-400 border border-white/5 uppercase tracking-wide">
                            {item.category}
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
                {loadingMore && (
                  <Loader2 className="h-5 w-5 animate-spin text-[#00A896]" />
                )}
                {!hasMore && !loadingMore && activities.length > 0 && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-1 w-12 bg-white/10 rounded-full" />
                    <span className="text-xs text-zinc-600">End of list</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          {selectedActivity?.is_settlement ? (
            <DialogContent className="bg-[#020617]/95 backdrop-blur-2xl border-white/10 text-white w-[95vw] max-w-md rounded-3xl p-0 overflow-hidden shadow-2xl">
              
              <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-[#00A896]/10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#00A896] text-white shadow-lg shadow-[#00A896]/30">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold">Payment Record</DialogTitle>
                    <DialogDescription className="text-xs text-[#00A896]/80 font-medium">
                      {selectedActivity && new Date(selectedActivity.created_at).toLocaleString()}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 py-6 space-y-6">
                <div className="flex flex-col items-center justify-center p-6 bg-white/[0.03] border border-white/5 rounded-2xl">
                  <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">
                    Amount Paid
                  </span>
                  <div className="flex items-baseline gap-1 text-4xl font-black text-white">
                    <span className="text-2xl text-zinc-500">₹</span>
                    {Number(selectedActivity.amount).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="flex flex-col items-center p-3 bg-white/[0.03] rounded-xl border border-white/5">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">From</span>
                    <div className="h-8 w-8 rounded-full bg-[#00A896]/20 flex items-center justify-center text-[#00A896] font-bold text-xs mb-1">
                      {selectedActivity.profiles?.full_name?.charAt(0)}
                    </div>
                    <span className="text-xs font-medium text-center line-clamp-1">
                      {selectedActivity.profiles?.full_name?.split(' ')[0]}
                    </span>
                  </div>

                  <ArrowRight className="w-5 h-5 text-zinc-600" />

                  <div className="flex flex-col items-center p-3 bg-white/[0.03] rounded-xl border border-white/5">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">To</span>
                    {loadingDetails ? (
                      <Skeleton className="h-8 w-8 rounded-full bg-white/10" />
                    ) : (
                      <>
                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs mb-1">
                          {splitDetails[0]?.profiles?.full_name?.charAt(0) || "?"}
                        </div>
                        <span className="text-xs font-medium text-center line-clamp-1">
                          {splitDetails[0]?.profiles?.full_name?.split(' ')[0] || "Unknown"}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl border border-white/5">
                  <span className="text-xs text-zinc-400 font-medium">Payment Method</span>
                  <div className="flex items-center gap-2 text-xs font-bold text-white bg-white/5 px-2.5 py-1 rounded-lg">
                    {selectedActivity.payment_mode || "Cash"}
                  </div>
                </div>
              </div>

              <DialogFooter className="p-4 bg-[#020617] border-t border-white/5">
                {(currentUserId === selectedActivity?.paid_by || currentUserId === selectedActivity?.created_by) ? (
                  <div className="grid grid-cols-3 gap-2 w-full">
                    <Button 
                      variant="ghost" 
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-10" 
                      onClick={handleDelete}
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs h-10" 
                      onClick={handleEdit}
                    >
                      <Pencil className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    <Button 
                      className="bg-white/10 hover:bg-white/20 text-white text-xs h-10" 
                      onClick={() => setDetailOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="w-full bg-white/10 text-white hover:bg-white/20 h-11 rounded-xl" 
                    onClick={() => setDetailOpen(false)}
                  >
                    Close
                  </Button>
                )}
              </DialogFooter>

            </DialogContent>
          ) : (
            <DialogContent className="bg-[#020617]/95 backdrop-blur-xl border-white/10 text-white w-[95vw] max-w-md rounded-3xl p-0 overflow-hidden shadow-2xl">
              <div className="p-6 pb-4 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl shrink-0 bg-[#00A896]/20 text-[#00A896]">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-white leading-tight">
                      {selectedActivity?.description || "Expense Details"}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-400 mt-1">
                      {selectedActivity && new Date(selectedActivity.created_at).toLocaleString()}
                    </DialogDescription>
                  </div>
                </div>
              </div>

              {selectedActivity && (
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col items-center justify-center py-6 rounded-2xl bg-white/5 border border-white/5"
                  >
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">
                      Total Amount
                    </span>
                    <span className="text-4xl font-black text-white">
                      ₹{Number(selectedActivity.amount).toLocaleString('en-IN')}
                    </span>
                  </motion.div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                        <User className="w-3 h-3"/> Paid By
                      </span>
                      <p className="text-sm font-medium text-zinc-200">
                        {selectedActivity.profiles?.full_name || "Unknown"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                        <CreditCard className="w-3 h-3"/> Method
                      </span>
                      <p className="text-sm font-medium text-zinc-200">
                        {selectedActivity.payment_mode || "UPI"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                        <Tag className="w-3 h-3"/> Category
                      </span>
                      <p className="text-sm font-medium text-zinc-200">
                        {selectedActivity.category}
                      </p>
                    </div>
                  </div>

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
                            <span className="text-sm text-zinc-300">
                              {split.profiles?.full_name || "Unknown"}
                            </span>
                            <span className="text-sm font-bold text-[#00A896]">
                              ₹{Number(split.amount_owed).toFixed(2)}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter className="p-4 bg-[#020617] border-t border-white/5">
                {(currentUserId === selectedActivity?.paid_by || currentUserId === selectedActivity?.created_by) ? (
                  <div className="grid grid-cols-3 gap-2 w-full">
                    <Button 
                      variant="ghost" 
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-10" 
                      onClick={handleDelete}
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs h-10" 
                      onClick={handleEdit}
                    >
                      <Pencil className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    <Button 
                      className="bg-white/10 hover:bg-white/20 text-white text-xs h-10" 
                      onClick={() => setDetailOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="w-full bg-[#00A896] hover:bg-[#00A896]/90 text-white rounded-xl h-11" 
                    onClick={() => setDetailOpen(false)}
                  >
                    Done
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
        
        <SettleUpDialog
          open={editPaymentDialogOpen}
          onOpenChange={setEditPaymentDialogOpen}
          activeGroup={activeGroup}
          onSettled={handlePaymentUpdated}
          paymentToEdit={paymentToEdit}
        />

      </motion.div>
    </div>
  )
}