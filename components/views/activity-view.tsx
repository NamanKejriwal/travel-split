import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Group } from "@/components/views/groups-view"
import { Loader2, Receipt, ArrowRightLeft, AlertCircle, Search, Download, Calendar, User, CreditCard, Tag, Users, Trash2, Pencil } from "lucide-react"
import { ExpenseToEdit } from "@/components/add-expense-drawer"
import { toast } from "sonner"

interface ActivityViewProps {
  activeGroup: Group | null
  onEditExpense?: (expense: ExpenseToEdit) => void // New Prop
}

export function ActivityView({ activeGroup, onEditExpense }: ActivityViewProps) {
  const [activities, setActivities] = useState<any[]>([])
  const [filteredActivities, setFilteredActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

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
      fetchActivity()
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

  async function fetchActivity() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`*, profiles(full_name)`)
        .eq('group_id', activeGroup?.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setActivities(data || [])
      setFilteredActivities(data || [])
    } catch (err) {
      console.error("Error fetching activity", err)
    } finally {
      setLoading(false)
    }
  }

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
        fetchActivity()
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
        <p>Please select a trip from the <b>Groups</b> tab to view its activity.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Activity</h2>
        <Button size="sm" variant="outline" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" /> PDF
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
        <Input 
            placeholder="Search expenses, people..." 
            className="pl-9"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-zinc-400" /></div>
      ) : filteredActivities.length === 0 ? (
        <div className="text-center py-10 space-y-2">
            <p className="text-zinc-500">No matching activity.</p>
        </div>
      ) : (
        <div className="space-y-3">
            {filteredActivities.map((item) => (
                <Card 
                    key={item.id} 
                    className="border-l-4 border-l-transparent hover:border-l-emerald-500 transition-all cursor-pointer active:scale-[0.99]"
                    onClick={() => handleActivityClick(item)}
                >
                    <CardContent className="flex items-center p-4 gap-4">
                        <div className={`p-2.5 rounded-full shrink-0 ${item.is_settlement ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {item.is_settlement ? <ArrowRightLeft className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-zinc-900 truncate">
                                {item.is_settlement ? <span className="text-blue-700">Payment made</span> : item.description}
                            </p>
                            <p className="text-xs text-zinc-500 truncate">
                                {item.profiles?.full_name || "Unknown"} • {new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {!item.is_settlement && item.category && (
                                <span className="inline-block mt-1 text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border mr-1">
                                    {item.category}
                                </span>
                            )}
                            <span className="inline-block mt-1 text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border">
                                {item.payment_mode || "UPI"}
                            </span>
                        </div>
                        <div className={`font-bold whitespace-nowrap ${item.is_settlement ? 'text-blue-600' : 'text-zinc-900'}`}>
                            ₹{Number(item.amount).toFixed(2)}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      )}

      {/* ACTIVITY DETAILS DIALOG */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    {selectedActivity?.is_settlement ? (
                        <div className="bg-blue-100 p-2 rounded-full"><ArrowRightLeft className="h-5 w-5 text-blue-600" /></div>
                    ) : (
                        <div className="bg-emerald-100 p-2 rounded-full"><Receipt className="h-5 w-5 text-emerald-600" /></div>
                    )}
                    <span className="truncate">{selectedActivity?.description || "Expense Details"}</span>
                </DialogTitle>
                <DialogDescription>
                    Recorded on {selectedActivity && new Date(selectedActivity.created_at).toLocaleString()}
                </DialogDescription>
            </DialogHeader>

            {selectedActivity && (
                <div className="space-y-6">
                    {/* Amount & Main Info */}
                    <div className="flex flex-col items-center justify-center py-4 bg-zinc-50/50 rounded-lg border border-dashed border-zinc-200">
                        <span className="text-sm text-zinc-500 uppercase tracking-wide">Total Amount</span>
                        <span className={`text-3xl font-bold ${selectedActivity.is_settlement ? 'text-blue-600' : 'text-zinc-900'}`}>
                            ₹{Number(selectedActivity.amount).toFixed(2)}
                        </span>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <span className="flex items-center text-zinc-500 text-xs"><User className="w-3 h-3 mr-1"/> Paid By</span>
                            <p className="font-medium">{selectedActivity.profiles?.full_name || "Unknown"}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="flex items-center text-zinc-500 text-xs"><CreditCard className="w-3 h-3 mr-1"/> Method</span>
                            <p className="font-medium">{selectedActivity.payment_mode || "UPI"}</p>
                        </div>
                        {!selectedActivity.is_settlement && (
                            <>
                                <div className="space-y-1">
                                    <span className="flex items-center text-zinc-500 text-xs"><Tag className="w-3 h-3 mr-1"/> Category</span>
                                    <p className="font-medium">{selectedActivity.category}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="flex items-center text-zinc-500 text-xs"><Calendar className="w-3 h-3 mr-1"/> Date</span>
                                    <p className="font-medium">{new Date(selectedActivity.created_at).toLocaleDateString()}</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Splits Section */}
                    {!selectedActivity.is_settlement && (
                        <div className="border-t pt-4">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Users className="w-4 h-4 text-zinc-500" /> Split With
                            </h4>
                            {loadingDetails ? (
                                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
                            ) : (
                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                    {splitDetails.map((split, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm p-2 bg-zinc-50 rounded border border-zinc-100">
                                            <span className="text-zinc-700">{split.profiles?.full_name || "Unknown"}</span>
                                            <span className="font-medium">₹{Number(split.amount_owed).toFixed(2)}</span>
                                        </div>
                                    ))}
                                    {splitDetails.length === 0 && <p className="text-xs text-zinc-400 italic">No split details found.</p>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <DialogFooter className="flex gap-2 sm:justify-between">
                <div className="flex gap-2 w-full">
                    {currentUserId === selectedActivity?.paid_by && !selectedActivity?.is_settlement && (
                        <>
                            <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </Button>
                            <Button variant="outline" className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={handleEdit}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit
                            </Button>
                        </>
                    )}
                    <Button onClick={() => setDetailOpen(false)} className="flex-1">Close</Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}