import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Category, MonthlyGoalDto } from './monotributo.model';

@Injectable({ providedIn: 'root' })
export class MonotributoService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/monotributo`;

  getCategories() {
    return this.http.get<Category[]>(`${this.baseUrl}/categories`);
  }

  getGoal() {
    return this.http.get<MonthlyGoalDto>(`${this.baseUrl}/goal`);
  }

  setGoal(amount: number) {
    return this.http.put<MonthlyGoalDto>(`${this.baseUrl}/goal`, { amount });
  }
}
