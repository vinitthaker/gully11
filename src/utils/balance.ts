import type { Transaction, Debt } from '../types';

// Calculate net balance per user from transactions
// Positive = net winner (others owe them), Negative = net loser (they owe others)
export function calculateBalances(transactions: Transaction[]): Record<string, number> {
  const balances: Record<string, number> = {};

  for (const tx of transactions) {
    balances[tx.userId] = (balances[tx.userId] || 0) + tx.amount;
  }

  return balances;
}

// Simplify debts: minimize number of transactions needed to settle
// Uses greedy matching: largest creditor <-> largest debtor
export function simplifyDebts(balances: Record<string, number>): Debt[] {
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, balance] of Object.entries(balances)) {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0) {
      creditors.push({ id, amount: rounded });
    } else if (rounded < 0) {
      debtors.push({ id, amount: Math.abs(rounded) });
    }
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const debts: Debt[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].amount, debtors[di].amount);
    if (amount > 0.01) {
      debts.push({
        from: debtors[di].id,
        to: creditors[ci].id,
        amount: Math.round(amount * 100) / 100,
      });
    }

    creditors[ci].amount -= amount;
    debtors[di].amount -= amount;

    if (creditors[ci].amount < 0.01) ci++;
    if (debtors[di].amount < 0.01) di++;
  }

  return debts;
}
