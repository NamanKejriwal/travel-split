import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Group } from "@/components/views/groups-view"
import { Loader2, ArrowRight, CheckCircle2, Wallet, Scale } from "lucide-react"

interface BalanceViewProps {
  activeGroup: Group | null
  onSettleUp: () => void
}

interface Transaction {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}

export function BalanceView({ activeGroup, onSettleUp }: BalanceViewProps) {
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [myBalance, setMyBalance] = useState(0)
  const [currentUserId, setCurrentUserId] = useState("")

  useEffect(() => {
    if (activeGroup) {
      calculateBalances()
    }
  }, [activeGroup])

  async function calculateBalances() {
    if (!activeGroup) return
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      // Use RPC for scalable calculation
      const { data: balances, error } = await supabase
        .rpc('get_trip_balances', { p_group_id: activeGroup.id })

      if (error) throw error

      if (!balances) return

      // Logic to simplify debts (Greedy algorithm)
      // Balances array contains { user_id, full_name, net_balance }
      const debtors = balances.filter((b: any) => b.net_balance < -0.01)
                              .map((b: any) => ({ ...b, amount: Math.abs(b.net_balance) }))
                              .sort((a: any, b: any) => b.amount - a.amount)
                              
      const creditors = balances.filter((b: any) => b.net_balance > 0.01)
                                .map((b: any) => ({ ...b, amount: b.net_balance }))
                                .sort((a: any, b: any) => b.amount - a.amount)

      const proposedTransactions: Transaction[] = []
      
      let i = 0
      let j = 0

      while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i]
        const creditor = creditors[j]

        const amount = Math.min(debtor.amount, creditor.amount)

        proposedTransactions.push({
            from: debtor.user_id,
            fromName: debtor.full_name || "Unknown",
            to: creditor.user_id,
            toName: creditor.full_name || "Unknown",
            amount: amount
        })

        debtor.amount -= amount
        creditor.amount -= amount

        if (debtor.amount < 0.01) i++
        if (creditor.amount < 0.01) j++
      }

      setTransactions(proposedTransactions)

      if (user) {
        const myData = balances.find((b: any) => b.user_id === user.id)
        setMyBalance(myData ? myData.net_balance : 0)
      }

    } catch (error) {
      console.error("Error calculating balances:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!activeGroup) return <div className="p-8 text-center text-zinc-500">Select a trip to view balances.</div>

  return (
    <div className="space-y-6 p-4 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Balances</h2>
        <Button onClick={onSettleUp} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            Settle Up
        </Button>
      </div>

      <Card className={`border-l-4 ${myBalance >= 0 ? 'border-l-emerald-500 bg-emerald-50/50' : 'border-l-red-500 bg-red-50/50'}`}>
        <CardContent className="flex items-center justify-between p-6">
            <div>
                <p className="text-sm font-medium text-zinc-600">Your Net Position</p>
                <h3 className={`text-2xl font-bold ${myBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {myBalance >= 0 ? "You are owed" : "You owe"} ₹{Math.abs(myBalance).toFixed(2)}
                </h3>
            </div>
            {myBalance >= 0 ? (
                <Wallet className="h-8 w-8 text-emerald-500" />
            ) : (
                <Scale className="h-8 w-8 text-red-500" />
            )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-semibold text-zinc-900">Suggested Repayments</h3>
        <p className="text-xs text-zinc-500 -mt-3">Based on simplified debt calculation</p>
        
        {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-zinc-400" /></div>
        ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-zinc-50/50">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
                <p className="text-zinc-600 font-medium">All settled up!</p>
                <p className="text-xs text-zinc-400">No pending debts in this group.</p>
            </div>
        ) : (
            <div className="grid gap-3">
                {transactions.map((t, idx) => {
                    const isMePaying = t.from === currentUserId
                    const isMeReceiving = t.to === currentUserId
                    
                    return (
                        <Card key={idx} className="overflow-hidden border shadow-sm">
                            <CardContent className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                    <div className="flex flex-col min-w-0 max-w-[30%]">
                                        <span className={`text-sm font-bold truncate ${isMePaying ? 'text-red-600' : 'text-zinc-900'}`}>
                                            {isMePaying ? "You" : t.fromName}
                                        </span>
                                    </div>
                                    
                                    <div className="flex flex-col items-center px-1 shrink-0">
                                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider mb-0.5">Pays</span>
                                        <ArrowRight className="h-4 w-4 text-zinc-300" />
                                    </div>

                                    <div className="flex flex-col min-w-0 max-w-[30%]">
                                        <span className={`text-sm font-bold truncate ${isMeReceiving ? 'text-emerald-600' : 'text-zinc-900'}`}>
                                            {isMeReceiving ? "You" : t.toName}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="font-bold text-zinc-900 ml-2">
                                    ₹{t.amount.toFixed(2)}
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        )}
      </div>
    </div>
  )
}