import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DolarRate } from './dolar.model';

@Injectable({ providedIn: 'root' })
export class DolarService {
  private http = inject(HttpClient);

  getAll() {
    return this.http.get<DolarRate[]>(`${environment.dolarApiUrl}/dolares`);
  }
}
