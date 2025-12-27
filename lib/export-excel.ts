import * as XLSX from 'xlsx'
import { toast } from 'sonner'

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  payment_mode: string
  created_at: string
  is_settlement: boolean
  profiles?: {
    full_name: string
  }
}

export function exportToExcel(
  expenses: Expense[],
  groupName: string
) {
  try {
    const wb = XLSX.utils.book_new()

    // 🔍 Pre-process data for accuracy
    const realExpenses = expenses.filter(e => !e.is_settlement)
    const settlements = expenses.filter(e => e.is_settlement)
    const totalTripCost = realExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const totalCashFlow = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

    // --- SHEET 1: EXECUTIVE SUMMARY ---
    const summaryData: (string | number)[][] = [
      ['TRAVELSPLIT MASTER REPORT'],
      [''],
      ['TRIP PARAMETERS', 'VALUE'],
      ['Trip Name', groupName],
      ['Report Generation Date', new Date().toLocaleString('en-IN')],
      ['Currency', 'INR (₹)'],
      [''],
      ['FINANCIAL OVERVIEW', ''],
      ['Actual Trip Cost (Net)', totalTripCost],
      ['Total Cash Moved (Inc. Settlements)', totalCashFlow],
      ['Total Transactions', expenses.length],
      ['Average Expense Value', realExpenses.length > 0 ? Number((totalTripCost / realExpenses.length).toFixed(2)) : 0],
      [''],
      ['SYSTEM STATUS', 'Verified'],
    ]
    const summaryWS = XLSX.utils.aoa_to_sheet(summaryData)
    summaryWS['!cols'] = [{ wch: 30 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, summaryWS, 'Executive Summary')

    // --- SHEET 2: ALL TRANSACTIONS (RAW DATA) ---
    const rawData: (string | number)[][] = [['Date', 'Time', 'Description', 'Category', 'Paid By', 'Mode', 'Amount', 'Transaction Type']]

    expenses.forEach(e => {
      const d = new Date(e.created_at)
      rawData.push([
        d.toLocaleDateString('en-GB'),
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase(),
        e.description,
        e.category || 'Other',
        e.profiles?.full_name || 'Unknown',
        e.payment_mode || 'UPI',
        Number(e.amount),
        e.is_settlement ? 'Settlement / Debt Clear' : 'Direct Expense'
      ])
    })
    const rawWS = XLSX.utils.aoa_to_sheet(rawData)
    rawWS['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, rawWS, 'Transaction Ledger')

    // --- SHEET 3: PER PERSON ANALYTICS ---
    const personMap: Record<string, { paid_exp: number, paid_settle: number, share: number }> = {}
    
    expenses.forEach(e => {
      const name = e.profiles?.full_name || 'Unknown'
      if (!personMap[name]) personMap[name] = { paid_exp: 0, paid_settle: 0, share: 0 }
    })

    expenses.forEach(e => {
      const name = e.profiles?.full_name || 'Unknown'
      if (e.is_settlement) personMap[name].paid_settle += Number(e.amount)
      else personMap[name].paid_exp += Number(e.amount)
    })

    const memberCount = Object.keys(personMap).length
    const sharePerHead = memberCount > 0 ? totalTripCost / memberCount : 0
    Object.keys(personMap).forEach(name => personMap[name].share = sharePerHead)

    const personData: (string | number)[][] = [['Member Name', 'Expenses Paid (A)', 'Settlements Paid (B)', 'Total Outflow (A+B)', 'Fair Share (C)', 'Net Balance (A+B-C)']]
    Object.entries(personMap).forEach(([name, s]) => {
      personData.push([
        name, 
        s.paid_exp, 
        s.paid_settle, 
        s.paid_exp + s.paid_settle, 
        s.share, 
        (s.paid_exp + s.paid_settle) - s.share
      ])
    })
    const personWS = XLSX.utils.aoa_to_sheet(personData)
    personWS['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, personWS, 'User Balances')

    // --- SHEET 4: CATEGORY RECON ---
    const catData: (string | number)[][] = [['Category', 'Total Spend', 'Contribution %']]
    const catMap: Record<string, number> = {}
    realExpenses.forEach(e => {
      const c = e.category || 'Other'
      catMap[c] = (catMap[c] || 0) + Number(e.amount)
    })
    Object.entries(catMap).sort((a,b) => b[1]-a[1]).forEach(([c, amt]) => {
      const percentage = totalTripCost > 0 ? ((amt/totalTripCost)*100).toFixed(1) : "0"
      catData.push([c, amt, `${percentage}%`])
    })
    const catWS = XLSX.utils.aoa_to_sheet(catData)
    catWS['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, catWS, 'Category Insights')

    // --- SHEET 5: MODE & LIQUIDITY ---
    const modeData: (string | number)[][] = [['Payment Mode', 'Total Processed', 'Volume %', 'Count']]
    const modeMap: Record<string, number> = {}
    realExpenses.forEach(e => {
      const m = e.payment_mode || 'UPI'
      modeMap[m] = (modeMap[m] || 0) + Number(e.amount)
    })
    Object.entries(modeMap).forEach(([m, amt]) => {
      const percentage = totalTripCost > 0 ? ((amt/totalTripCost)*100).toFixed(1) : "0"
      const count = realExpenses.filter(x => (x.payment_mode||'UPI') === m).length
      modeData.push([m, amt, `${percentage}%`, count])
    })
    const modeWS = XLSX.utils.aoa_to_sheet(modeData)
    XLSX.utils.book_append_sheet(wb, modeWS, 'Payment Modes')

    // --- SHEET 6: DAILY VELOCITY ---
    const dailyData: (string | number)[][] = [['Date', 'Daily Spend', 'Transaction Count']]
    const dayMap: Record<string, number> = {}
    realExpenses.forEach(e => {
      const d = new Date(e.created_at).toLocaleDateString('en-GB')
      dayMap[d] = (dayMap[d] || 0) + Number(e.amount)
    })
    Object.entries(dayMap).forEach(([d, amt]) => {
      const count = realExpenses.filter(x => new Date(x.created_at).toLocaleDateString('en-GB') === d).length
      dailyData.push([d, amt, count])
    })
    const dailyWS = XLSX.utils.aoa_to_sheet(dailyData)
    XLSX.utils.book_append_sheet(wb, dailyWS, 'Daily Spending')

    // --- SHEET 7: SETTLEMENT LOG ---
    const settleData: (string | number)[][] = [['Date', 'From (Payer)', 'Amount Cleared', 'Mode']]
    settlements.forEach(s => {
      settleData.push([
        new Date(s.created_at).toLocaleDateString('en-GB'),
        s.profiles?.full_name || 'Unknown',
        Number(s.amount),
        s.payment_mode || 'UPI'
      ])
    })
    const settleWS = XLSX.utils.aoa_to_sheet(settleData)
    settleWS['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, settleWS, 'Debt Settlements')

    const fileName = `${groupName.replace(/\s+/g, '_')}_Comprehensive_Report.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success('Excel created')

    return true
  } catch (error) {
    console.error('Export error:', error)
    toast.error('Failed to create file')
    return false
  }
}