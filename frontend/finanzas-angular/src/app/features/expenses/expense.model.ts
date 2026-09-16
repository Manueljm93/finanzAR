export type Currency = 'ARS' | 'USD';

export type ExpenseCategory = 'Impuesto' | 'Servicio' | 'Alquiler' | 'Pago' | 'Otro';

// Plantilla de gasto fijo recurrente.
export interface FixedExpense {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  dueDay: number;
}

// Gasto fijo proyectado sobre un mes concreto, con su estado de pago.
export interface MonthlyExpense {
  fixedExpenseId: string;
  description: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  dueDay: number;
  paid: boolean;
  paidAt: string | null;
}

export interface ExpenseSummary {
  year: number;
  month: number;
  totalARS: number;
  paidARS: number;
  pendingARS: number;
  totalUSD: number;
  paidUSD: number;
  pendingUSD: number;
  count: number;
  paidCount: number;
}

export interface FixedExpensePayload {
  description: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  dueDay: number;
}
