import { useEffect, useState, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Group } from "@/components/views/groups-view"
import { Loader2, Receipt, ArrowRightLeft, AlertCircle, Search, Download, Calendar, User, CreditCard, Tag, Users, Trash2, Pencil } from "lucide-react"
import { ExpenseToEdit } from "@/components/add-expense-drawer"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

interface ActivityViewProps {
  activeGroup: Group | null
  onEditExpense?: (expense: ExpenseToEdit) => void
}

const ITEMS_PER_PAGE = 20

export function ActivityView({ activeGroup, onEditExpense }: ActivityViewProps) {
  const [activities, setActivities] = useState<any[]>([])
  const [filteredActivities, setFilteredActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)

  // Intersection Observer ref
  const observerTarget = useRef<HTMLDivElement>(null)

  // Details Dialog State
  const [selectedActivity, setSelectedActivity] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [splitDetails, setSplitDetails] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
        if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (activeGroup) {
      // Reset and fetch initial data
      setActivities([])
      setFilteredActivities([])
      setPage(0)
      setHasMore(true)
      fetchActivity(0, true)
    }
  }, [activeGroup])

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

  // Infinite scroll with Intersection Observer
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

      // Check if there's more data
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

  const handleDelete = async () => {
    if (!selectedActivity) return
    if (!confirm("Delete this expense permanently?")) return

    try {
        const { error } = await supabase.from('expenses').delete().eq('id', selectedActivity.id)
        if (error) throw error
        
        toast.success("Expense deleted")
        setDetailOpen(false)
        
        // Refresh from the beginning
        setActivities([])
        setFilteredActivities([])
        setPage(0)
        setHasMore(true)
        fetchActivity(0, true)
    } catch (err: any) {
        toast.error("Failed to delete")
    }
  }

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

  const handleDownloadPDF = () => {
    const printContent = `
      <html>
        <head>
          <title>${activeGroup?.name || "Trip"} - Detailed Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 12px; }
            h1 { color: #059669; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { text-align: left; padding: 10px; border-bottom: 1px solid #ddd; }
            th { background-color: #f3f4f6; color: #444; font-weight: bold; }
            .settlement { color: #2563eb; font-style: italic; }
            .amount { text-align: right; font-weight: bold; }
            .meta { color: #666; font-size: 10px; margin-top: 5px; }
          </style>
        </head>
        <body>
          <h1>${activeGroup?.name || "Trip"} Expense Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Paid By</th>
                <th>Mode</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${activities.map(item => `
                <tr>
                  <td>
                    ${new Date(item.created_at).toLocaleDateString()}
                    <div class="meta">${new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </td>
                  <td class="${item.is_settlement ? 'settlement' : ''}">
                    ${item.is_settlement ? 'Settlement / Payment' : item.description}
                  </td>
                  <td>${item.category || '-'}</td>
                  <td>${item.profiles?.full_name || 'Unknown'}</td>
                  <td>${item.payment_mode || 'UPI'}</td>
                  <td class="amount">₹${Number(item.amount).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `
    const printWindow = window.open('', '', 'width=900,height=800')
    if (printWindow) {
        printWindow.document.write(printContent)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
            printWindow.print()
            printWindow.close()
        }, 500)
    }
  }

  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-4 text-center text-zinc-500">
        <AlertCircle className="h-10 w-10 mb-4 opacity-20" />
        <p className="text-sm sm:text-base px-4">Please select a trip from the <b>Groups</b> tab to view its activity.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 pb-20">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Activity</h2>
        <Button size="sm" variant="outline" onClick={handleDownloadPDF} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" /> Export PDF
        </Button>
      </div>

      {/* Search Bar - Responsive */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
        <Input 
            placeholder="Search expenses, people..." 
            className="pl-9 text-sm sm:text-base"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        // SKELETON LOADER - Initial load
        <div className="space-y-2 sm:space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
             <Card key={i} className="border-l-4 border-l-transparent">
                 <CardContent className="flex items-center p-3 sm:p-4 gap-3 sm:gap-4">
                    <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                        <Skeleton className="h-4 w-[120px] sm:w-[140px]" />
                        <Skeleton className="h-3 w-[80px] sm:w-[100px]" />
                    </div>
                    <Skeleton className="h-5 w-[50px] sm:w-[60px] shrink-0" />
                 </CardContent>
             </Card>
          ))}
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="text-center py-10 space-y-2 px-4">
            <p className="text-zinc-500 text-sm sm:text-base">No matching activity.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 sm:space-y-3">
              {filteredActivities.map((item) => (
                  <Card 
                      key={item.id} 
                      className="border-l-4 border-l-transparent hover:border-l-emerald-500 transition-all cursor-pointer active:scale-[0.98] touch-manipulation"
                      onClick={() => handleActivityClick(item)}
                  >
                      <CardContent className="flex items-center p-3 sm:p-4 gap-3 sm:gap-4">
                          {/* Icon - Responsive */}
                          <div className={`p-2 sm:p-2.5 rounded-full shrink-0 ${item.is_settlement ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {item.is_settlement ? <ArrowRightLeft className="h-4 w-4 sm:h-5 sm:w-5" /> : <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />}
                          </div>
                          
                          {/* Content - Responsive */}
                          <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm sm:text-base text-zinc-900 truncate">
                                  {item.is_settlement ? <span className="text-blue-700">Payment made</span> : item.description}
                              </p>
                              <p className="text-[11px] sm:text-xs text-zinc-500 truncate">
                                  {item.profiles?.full_name || "Unknown"} • {new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                              
                              {/* Tags - Responsive */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                  {!item.is_settlement && item.category && (
                                      <span className="inline-block text-[9px] sm:text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border">
                                          {item.category}
                                      </span>
                                  )}
                                  <span className="inline-block text-[9px] sm:text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border">
                                      {item.payment_mode || "UPI"}
                                  </span>
                              </div>
                          </div>
                          
                          {/* Amount - Responsive */}
                          <div className={`font-bold text-sm sm:text-base whitespace-nowrap shrink-0 ${item.is_settlement ? 'text-blue-600' : 'text-zinc-900'}`}>
                              ₹{Number(item.amount).toFixed(2)}
                          </div>
                      </CardContent>
                  </Card>
              ))}
          </div>

          {/* Infinite Scroll Trigger & Loading More Indicator */}
          {searchTerm === "" && (
            <div ref={observerTarget} className="py-4 flex justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading more expenses...</span>
                </div>
              )}
              {!hasMore && !loadingMore && activities.length > 0 && (
                <p className="text-zinc-400 text-sm">No more expenses to load</p>
              )}
            </div>
          )}
        </>
      )}

      {/* ACTIVITY DETAILS DIALOG - FULLY RESPONSIVE */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[425px] max-h-[90vh] overflow-y-auto rounded-xl p-0">
            {/* Header - Responsive */}
            <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b sticky top-0 bg-background z-10">
                <div className="flex items-start gap-3 pr-6">
                    {selectedActivity?.is_settlement ? (
                        <div className="bg-blue-100 p-2 rounded-full shrink-0">
                            <ArrowRightLeft className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                        </div>
                    ) : (
                        <div className="bg-emerald-100 p-2 rounded-full shrink-0">
                            <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <DialogTitle className="text-base sm:text-lg leading-tight break-words pr-2">
                            {selectedActivity?.description || "Expense Details"}
                        </DialogTitle>
                        <DialogDescription className="text-[11px] sm:text-xs mt-1">
                            {selectedActivity && new Date(selectedActivity.created_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            {selectedActivity && (
                <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                    {/* Amount Card - Responsive */}
                    <div className="flex flex-col items-center justify-center py-5 sm:py-6 bg-gradient-to-br from-zinc-50 to-zinc-100/50 rounded-lg border border-dashed border-zinc-200">
                        <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1">Total Amount</span>
                        <span className={`text-2xl sm:text-3xl md:text-4xl font-bold ${selectedActivity.is_settlement ? 'text-blue-600' : 'text-zinc-900'}`}>
                            ₹{Number(selectedActivity.amount).toFixed(2)}
                        </span>
                    </div>

                    {/* Metadata Grid - Responsive */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div className="space-y-1 min-w-0">
                            <span className="flex items-center text-zinc-500 text-[10px] sm:text-xs">
                                <User className="w-3 h-3 mr-1 shrink-0"/> Paid By
                            </span>
                            <p className="font-medium truncate">{selectedActivity.profiles?.full_name || "Unknown"}</p>
                        </div>
                        <div className="space-y-1 min-w-0">
                            <span className="flex items-center text-zinc-500 text-[10px] sm:text-xs">
                                <CreditCard className="w-3 h-3 mr-1 shrink-0"/> Method
                            </span>
                            <p className="font-medium truncate">{selectedActivity.payment_mode || "UPI"}</p>
                        </div>
                        {!selectedActivity.is_settlement && (
                            <>
                                <div className="space-y-1 min-w-0">
                                    <span className="flex items-center text-zinc-500 text-[10px] sm:text-xs">
                                        <Tag className="w-3 h-3 mr-1 shrink-0"/> Category
                                    </span>
                                    <p className="font-medium truncate">{selectedActivity.category}</p>
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <span className="flex items-center text-zinc-500 text-[10px] sm:text-xs">
                                        <Calendar className="w-3 h-3 mr-1 shrink-0"/> Date
                                    </span>
                                    <p className="font-medium text-[11px] sm:text-sm">
                                        {new Date(selectedActivity.created_at).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Splits Section - Responsive */}
                    {!selectedActivity.is_settlement && (
                        <div className="border-t pt-4">
                            <h4 className="text-xs sm:text-sm font-semibold mb-3 flex items-center gap-2">
                                <Users className="w-4 h-4 text-zinc-500 shrink-0" /> Split With
                            </h4>
                            {loadingDetails ? (
                                <div className="space-y-2">
                                     <Skeleton className="h-10 sm:h-12 w-full" />
                                     <Skeleton className="h-10 sm:h-12 w-full" />
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[140px] sm:max-h-[180px] overflow-y-auto pr-1">
                                    {splitDetails.map((split, i) => (
                                        <div key={i} className="flex justify-between items-center text-xs sm:text-sm p-2.5 sm:p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                                            <span className="text-zinc-700 truncate pr-2">{split.profiles?.full_name || "Unknown"}</span>
                                            <span className="font-semibold text-emerald-600 whitespace-nowrap">₹{Number(split.amount_owed).toFixed(2)}</span>
                                        </div>
                                    ))}
                                    {splitDetails.length === 0 && (
                                        <p className="text-[10px] sm:text-xs text-zinc-400 italic text-center py-2">No split details found.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Footer Actions - FULLY RESPONSIVE */}
            <DialogFooter className="p-4 sm:p-6 pt-0 border-t sm:border-t-0">
                {currentUserId === selectedActivity?.paid_by && !selectedActivity?.is_settlement ? (
                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                        <Button 
                            variant="outline" 
                            className="w-full sm:flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-sm h-10 sm:h-9 touch-manipulation" 
                            onClick={handleDelete}
                        >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full sm:flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-sm h-10 sm:h-9 touch-manipulation" 
                            onClick={handleEdit}
                        >
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                        </Button>
                        <Button 
                            onClick={() => setDetailOpen(false)} 
                            className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-sm h-10 sm:h-9 touch-manipulation"
                        >
                            Close
                        </Button>
                    </div>
                ) : (
                    <Button 
                        onClick={() => setDetailOpen(false)} 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm h-10 sm:h-9 touch-manipulation"
                    >
                        Close
                    </Button>
                )}
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}