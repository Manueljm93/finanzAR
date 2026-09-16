export type Currency = 'ARS' | 'USD';

export interface Income {
  id: string;
  amount: number;
  currency: Currency;
  date: string;          // ISO 'YYYY-MM-DD'
  description: string;
  entityId: string | null;
  month: number;
  year: number;
}

export interface IncomeSummary {
  year: number;
  month: number;
  totalARS: number;
  totalUSD: number;
  count: number;
}

export interface IncomePayload {
  amount: number;
  currency: Currency;
  date: string;          // 'YYYY-MM-DD'
  description: string;
  entityId: string | null;
}
