import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Group } from "@/components/views/groups-view"
import { Loader2, Receipt, ArrowRightLeft, AlertCircle, Search, Download } from "lucide-react"

interface ActivityViewProps {
  activeGroup: Group | null
}

export function ActivityView({ activeGroup }: ActivityViewProps) {
  const [activities, setActivities] = useState<any[]>([])
  const [filteredActivities, setFilteredActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

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

  // --- ENHANCED PDF EXPORT ---
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
                <Card key={item.id} className="border-l-4 border-l-transparent hover:border-l-emerald-500 transition-all">
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
    </div>
  )
}