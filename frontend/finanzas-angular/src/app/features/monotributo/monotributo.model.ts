export interface Category {
  id: string;
  letter: string;
  maxAnnualIncome: number;
  integratedTax: number;
  sipaContribution: number;
  socialSecurity: number;
  totalMonthly: number;
  validFrom: string;
  validTo: string | null;
}

export interface MonthlyGoalDto {
  amount: number;
}

export interface MonthDetail {
  month: number;
  monthName: string;
  facturado: number;
  meta: number;
  aFavor: number;
  acumuladoAFavor: number | null;  // null = mes futuro, no computado
  computable: boolean;
}

export interface CategoryStatus {
  current: Category | null;
  next: Category | null;
  accumulated: number;
  remainingToNext: number | null;
  progressPct: number;     // dentro de la categoría actual
  overTop: boolean;        // superó la última categoría (K)
}
