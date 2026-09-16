import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { EntityPayload, FinancialEntity } from './entity.model';

@Injectable({ providedIn: 'root' })
export class EntitiesService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/entities`;

  list() {
    return this.http.get<FinancialEntity[]>(this.baseUrl);
  }

  create(payload: EntityPayload) {
    return this.http.post<FinancialEntity>(this.baseUrl, payload);
  }

  update(id: string, payload: EntityPayload & { isActive: boolean }) {
    return this.http.put<FinancialEntity>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
