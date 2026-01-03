// lib/settlement-logic.ts

export interface BalanceEntry {
    userId: string;
    userName: string;
    amount: number; // In RUPEES (can have decimals from DB)
  }
  
  export interface SettlementTransaction {
    from: string;
    fromName: string;
    to: string;
    toName: string;
    amount: number; // In RUPEES (Clean numbers)
  }
  
  /**
   * CORE ALGORITHM: Minimizes transaction count (Greedy Approach).
   * Uses PAISE (Integers) internally for safety, returns RUPEES.
   */
  export function calculateMinimalSettlements(balances: BalanceEntry[]): SettlementTransaction[] {
    // 1. Convert Rupees to Paise (Integer) to avoid floating point math errors
    // e.g. 100.50 -> 10050 paise
    const paiseBalances = balances.map(b => ({
      ...b,
      amount: Math.round(b.amount * 100)
    }));
  
    // 2. Separate Debtors (-ve) and Creditors (+ve)
    const debtors = paiseBalances
      .filter(b => b.amount < 0)
      .sort((a, b) => a.amount - b.amount); // Ascending (biggest debtor first)
  
    const creditors = paiseBalances
      .filter(b => b.amount > 0)
      .sort((a, b) => b.amount - a.amount); // Descending (biggest creditor first)
  
    const settlements: SettlementTransaction[] = [];
    let i = 0; // Debtor ptr
    let j = 0; // Creditor ptr
  
    // 3. Greedy Matching
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
  
      // Find min amount to settle between the two
      // e.g. Debtor owes 5000 paise, Creditor needs 2000 paise -> Settle 2000.
      const amountPaise = Math.min(Math.abs(debtor.amount), creditor.amount);
  
      // 4. Update internal state
      debtor.amount += amountPaise;
      creditor.amount -= amountPaise;
  
      // 5. Record Transaction (Only if > 1 Rupee / 100 Paise)
      // We filter tiny amounts because Indians don't transact 50 paise via UPI.
      if (amountPaise >= 100) {
        settlements.push({
          from: debtor.userId,
          fromName: debtor.userName,
          to: creditor.userId,
          toName: creditor.userName,
          amount: amountPaise / 100 // Convert back to Rupees
        });
      }
  
      // 6. Advance pointers
      if (Math.abs(debtor.amount) < 1) i++;
      if (creditor.amount < 1) j++;
    }
  
    return settlements;
  }
  
  /**
   * HELPER: Compute Net Balances from Expense List (Offline/Client-Side)
   * Handles the "remainder" paise so money doesn't disappear.
   */
  export function computeBalancesFromExpenses(
    expenses: any[], 
    members: { id: string; name: string }[]
  ): BalanceEntry[] {
    const balanceMap = new Map<string, number>(); // Stores PAISE
  
    // Init 0
    members.forEach(m => balanceMap.set(m.id, 0));
  
    expenses.forEach(exp => {
      // 1. Payer gets credit (+ve)
      const amountPaise = Math.round(exp.amount * 100);
      const payerBalance = balanceMap.get(exp.paid_by) || 0;
      balanceMap.set(exp.paid_by, payerBalance + amountPaise);
  
      // 2. Splitters get debt (-ve)
      // "Splits" array usually contains user_ids.
      // If your DB structure is different, adjust this access.
      // Assuming: exp.splits = ["user_id_1", "user_id_2"] OR explicit split table
      
      // NOTE: This logic assumes EQUAL split for simplicity. 
      // If you have unequal splits, map over them directly.
      const splitIds = exp.splits || []; // Ensure you pass the split array
      const splitCount = splitIds.length;
  
      if (splitCount > 0) {
        const splitAmount = Math.floor(amountPaise / splitCount);
        let remainder = amountPaise % splitCount;
  
        splitIds.forEach((uid: string) => {
          let debit = splitAmount;
          if (remainder > 0) {
            debit += 1; // Distribute the dust
            remainder--;
          }
          const currentBal = balanceMap.get(uid) || 0;
          balanceMap.set(uid, currentBal - debit);
        });
      }
    });
  
    // Return as Rupees
    return Array.from(balanceMap.entries()).map(([userId, paise]) => ({
      userId,
      userName: members.find(m => m.id === userId)?.name || "Unknown",
      amount: paise / 100
    }));
  }