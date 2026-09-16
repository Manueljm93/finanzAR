import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Income, IncomePayload, IncomeSummary } from './income.model';

@Injectable({ providedIn: 'root' })
export class IncomesService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/incomes`;

  list(year: number, month: number) {
    return this.http.get<Income[]>(`${this.baseUrl}?year=${year}&month=${month}`);
  }

  listByYear(year: number) {
    return this.http.get<Income[]>(`${this.baseUrl}?year=${year}`);
  }

  summary(year: number, month: number) {
    return this.http.get<IncomeSummary>(`${this.baseUrl}/summary?year=${year}&month=${month}`);
  }

  create(payload: IncomePayload) {
    return this.http.post<Income>(this.baseUrl, payload);
  }

  update(id: string, payload: IncomePayload) {
    return this.http.put<Income>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
