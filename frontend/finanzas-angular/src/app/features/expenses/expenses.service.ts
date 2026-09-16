import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { FixedExpense, FixedExpensePayload, MonthlyExpense, ExpenseSummary } from './expense.model';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/expenses`;

  month(year: number, month: number) {
    return this.http.get<MonthlyExpense[]>(`${this.baseUrl}/month?year=${year}&month=${month}`);
  }

  summary(year: number, month: number) {
    return this.http.get<ExpenseSummary>(`${this.baseUrl}/summary?year=${year}&month=${month}`);
  }

  create(payload: FixedExpensePayload) {
    return this.http.post<FixedExpense>(`${this.baseUrl}/fixed`, payload);
  }

  update(id: string, payload: FixedExpensePayload) {
    return this.http.put<FixedExpense>(`${this.baseUrl}/fixed/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/fixed/${id}`);
  }

  markPaid(id: string, year: number, month: number) {
    return this.http.post<void>(`${this.baseUrl}/fixed/${id}/pay`, { year, month });
  }

  markUnpaid(id: string, year: number, month: number) {
    return this.http.delete<void>(`${this.baseUrl}/fixed/${id}/pay?year=${year}&month=${month}`);
  }
}
