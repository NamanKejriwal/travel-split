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

interface Split {
  profiles?: {
    full_name: string
  }
  amount_owed: number
}

// 📊 Export expenses to Excel with professional formatting
export function exportToExcel(
  expenses: Expense[],
  groupName: string,
  includeDetails: boolean = true
) {
  try {
    // Create workbook
    const wb = XLSX.utils.book_new()

    // 📄 SHEET 1: Summary
    const summaryData = [
      ['TravelSplit Expense Report'],
      [''],
      ['Trip Name:', groupName],
      ['Generated:', new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })],
      ['Total Expenses:', expenses.filter(e => !e.is_settlement).length],
      ['Total Settlements:', expenses.filter(e => e.is_settlement).length],
      [''],
      ['Total Amount:', `₹${expenses.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2)}`],
      [''],
    ]

    const summaryWS = XLSX.utils.aoa_to_sheet(summaryData)
    
    // Set column widths
    summaryWS['!cols'] = [
      { wch: 20 }, // Column A
      { wch: 30 }, // Column B
    ]

    XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary')

    // 📋 SHEET 2: All Expenses
    const expenseData = [
      ['Date', 'Time', 'Description', 'Category', 'Paid By', 'Payment Method', 'Amount', 'Type']
    ]

    expenses.forEach(expense => {
      const date = new Date(expense.created_at)
      expenseData.push([
        date.toLocaleDateString('en-IN'),
        date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        expense.description,
        expense.category || '-',
        expense.profiles?.full_name || 'Unknown',
        expense.payment_mode || 'UPI',
        Number(expense.amount).toFixed(2),
        expense.is_settlement ? 'Settlement' : 'Expense'
      ])
    })

    const expenseWS = XLSX.utils.aoa_to_sheet(expenseData)
    
    // Set column widths
    expenseWS['!cols'] = [
      { wch: 12 }, // Date
      { wch: 8 },  // Time
      { wch: 30 }, // Description
      { wch: 15 }, // Category
      { wch: 15 }, // Paid By
      { wch: 15 }, // Payment Method
      { wch: 10 }, // Amount
      { wch: 12 }, // Type
    ]

    XLSX.utils.book_append_sheet(wb, expenseWS, 'All Expenses')

    // 📊 SHEET 3: Category Breakdown
    const categoryTotals: Record<string, number> = {}
    expenses
      .filter(e => !e.is_settlement)
      .forEach(e => {
        const cat = e.category || 'Uncategorized'
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount)
      })

    const categoryData = [
      ['Category', 'Total Amount', 'Percentage']
    ]

    const totalAmount = Object.values(categoryTotals).reduce((a, b) => a + b, 0)
    
    Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1]) // Sort by amount descending
      .forEach(([category, amount]) => {
        const percentage = ((amount / totalAmount) * 100).toFixed(1)
        categoryData.push([
          category,
          amount.toFixed(2),
          `${percentage}%`
        ])
      })

    const categoryWS = XLSX.utils.aoa_to_sheet(categoryData)
    categoryWS['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
    ]

    XLSX.utils.book_append_sheet(wb, categoryWS, 'By Category')

    // 💰 SHEET 4: Payment Methods
    const paymentTotals: Record<string, number> = {}
    expenses.forEach(e => {
      const method = e.payment_mode || 'UPI'
      paymentTotals[method] = (paymentTotals[method] || 0) + Number(e.amount)
    })

    const paymentData = [
      ['Payment Method', 'Total Amount', 'Transaction Count']
    ]

    Object.entries(paymentTotals).forEach(([method, amount]) => {
      const count = expenses.filter(e => (e.payment_mode || 'UPI') === method).length
      paymentData.push([
        method,
        amount.toFixed(2),
        count.toString()
      ])
    })

    const paymentWS = XLSX.utils.aoa_to_sheet(paymentData)
    paymentWS['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 18 },
    ]

    XLSX.utils.book_append_sheet(wb, paymentWS, 'By Payment Method')

    // 📅 SHEET 5: Daily Breakdown
    const dailyTotals: Record<string, number> = {}
    expenses
      .filter(e => !e.is_settlement)
      .forEach(e => {
        const date = new Date(e.created_at).toLocaleDateString('en-IN')
        dailyTotals[date] = (dailyTotals[date] || 0) + Number(e.amount)
      })

    const dailyData = [
      ['Date', 'Total Spent', 'Number of Expenses']
    ]

    Object.entries(dailyTotals)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .forEach(([date, amount]) => {
        const count = expenses.filter(e => 
          !e.is_settlement && 
          new Date(e.created_at).toLocaleDateString('en-IN') === date
        ).length
        dailyData.push([
          date,
          amount.toFixed(2),
          count.toString()
        ])
      })

    const dailyWS = XLSX.utils.aoa_to_sheet(dailyData)
    dailyWS['!cols'] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
    ]

    XLSX.utils.book_append_sheet(wb, dailyWS, 'Daily Breakdown')

    // 💾 Generate and download file
    const fileName = `${groupName.replace(/[^a-z0-9]/gi, '_')}_expenses_${new Date().toISOString().split('T')[0]}.xlsx`
    
    XLSX.writeFile(wb, fileName)

    toast.success('Excel file downloaded!', {
      description: `${fileName}`,
      duration: 5000
    })

    // 📊 Track export event
    if (typeof window !== 'undefined' && (window as any).trackEvent) {
      (window as any).trackEvent.exportedPDF(expenses.length)
    }

    return true
  } catch (error) {
    console.error('Export error:', error)
    toast.error('Failed to export Excel file')
    return false
  }
}

// 📄 Export single expense with splits (detailed view)
export function exportExpenseDetail(
  expense: Expense,
  splits: Split[]
) {
  try {
    const wb = XLSX.utils.book_new()

    const data = [
      ['Expense Details'],
      [''],
      ['Description:', expense.description],
      ['Amount:', `₹${Number(expense.amount).toFixed(2)}`],
      ['Category:', expense.category || '-'],
      ['Paid By:', expense.profiles?.full_name || 'Unknown'],
      ['Payment Method:', expense.payment_mode || 'UPI'],
      ['Date:', new Date(expense.created_at).toLocaleString('en-IN')],
      [''],
      ['Split Details:'],
      ['Name', 'Amount Owed'],
    ]

    splits.forEach(split => {
      data.push([
        split.profiles?.full_name || 'Unknown',
        `₹${Number(split.amount_owed).toFixed(2)}`
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }]

    XLSX.utils.book_append_sheet(wb, ws, 'Expense Detail')

    const fileName = `expense_${expense.description.slice(0, 20)}_${Date.now()}.xlsx`
    XLSX.writeFile(wb, fileName)

    toast.success('Expense details exported!')
    return true
  } catch (error) {
    console.error('Export error:', error)
    toast.error('Failed to export details')
    return false
  }
}