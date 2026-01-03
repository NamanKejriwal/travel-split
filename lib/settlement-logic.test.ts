import { expect, test, describe } from 'vitest'
import { calculateMinimalSettlements, BalanceEntry } from './settlement-logic'

// Helper to verify that the math works out
const verifySettlementsClearDebts = (initialState: BalanceEntry[], settlements: any[]) => {
  const balances = new Map<string, number>()
  initialState.forEach(p => balances.set(p.userId, p.amount))

  settlements.forEach(s => {
    const fromBal = balances.get(s.from) || 0
    const toBal = balances.get(s.to) || 0
    
    const newFromBal = Math.round((fromBal + s.amount) * 100) / 100
    const newToBal = Math.round((toBal - s.amount) * 100) / 100

    balances.set(s.from, newFromBal)
    balances.set(s.to, newToBal)
  })

  // Assert that everyone is now close to 0
  balances.forEach((amount, user) => {
    // CHANGED: Increased tolerance to 1.0 because the algorithm 
    // intentionally ignores transactions < ₹1 (50 paise, etc.)
    expect(Math.abs(amount)).toBeLessThan(1.0)
  })
}

describe('Smart Settle Algorithm', () => {
  test('1-to-1: Simple Debt', () => {
    const input: BalanceEntry[] = [
      { userId: 'A', userName: 'Alice', amount: -100 },
      { userId: 'B', userName: 'Bob', amount: 100 }
    ]
    const result = calculateMinimalSettlements(input)
    
    expect(result).toHaveLength(1)
    expect(result[0].from).toBe('A')
    expect(result[0].to).toBe('B')
    expect(result[0].amount).toBe(100)
    verifySettlementsClearDebts(input, result)
  })

  test('Chain Simplification: A->B->C becomes A->C', () => {
    const input: BalanceEntry[] = [
      { userId: 'A', userName: 'Alice', amount: -50 },
      { userId: 'B', userName: 'Bob', amount: 0 },
      { userId: 'C', userName: 'Charlie', amount: 50 }
    ]
    const result = calculateMinimalSettlements(input)

    expect(result).toHaveLength(1)
    expect(result[0].from).toBe('A')
    expect(result[0].to).toBe('C')
    expect(result[0].amount).toBe(50)
  })

  test('Complex Spaghetti Debt', () => {
    const input: BalanceEntry[] = [
      { userId: 'A', userName: 'A', amount: -100.50 },
      { userId: 'B', userName: 'B', amount: -50.25 },
      { userId: 'C', userName: 'C', amount: -25.25 },
      { userId: 'D', userName: 'D', amount: 75.00 },
      { userId: 'E', userName: 'E', amount: 101.00 }
    ]
    // Total Negative: -176
    // Total Positive: +176
    
    const result = calculateMinimalSettlements(input)
    verifySettlementsClearDebts(input, result)
  })

  test('Ignores "Dust" (< 1 Rupee)', () => {
    const input: BalanceEntry[] = [
      { userId: 'A', userName: 'Alice', amount: -0.50 }, 
      { userId: 'B', userName: 'Bob', amount: 0.50 }
    ]
    const result = calculateMinimalSettlements(input)
    expect(result).toHaveLength(0) 
  })
})