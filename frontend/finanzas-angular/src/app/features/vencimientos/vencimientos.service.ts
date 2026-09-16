import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ConnectionStatus, Remitente, RemitentePayload, Vencimiento, SyncResult
} from './vencimiento.model';

@Injectable({ providedIn: 'root' })
export class VencimientosService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/vencimientos`;

  // Conexión Gmail
  connection() { return this.http.get<ConnectionStatus>(`${this.base}/connection`); }
  disconnect() { return this.http.delete<void>(`${this.base}/connection`); }
  authUrl() { return this.http.get<{ url: string }>(`${this.base}/oauth/url`); }

  // Remitentes
  remitentes() { return this.http.get<Remitente[]>(`${this.base}/remitentes`); }
  seedDefaults() { return this.http.post<{ agregados: number }>(`${this.base}/remitentes/defaults`, {}); }
  createRemitente(p: RemitentePayload) { return this.http.post<Remitente>(`${this.base}/remitentes`, p); }
  updateRemitente(id: string, p: RemitentePayload) { return this.http.put<Remitente>(`${this.base}/remitentes/${id}`, p); }
  deleteRemitente(id: string) { return this.http.delete<void>(`${this.base}/remitentes/${id}`); }

  // Vencimientos
  list() { return this.http.get<Vencimiento[]>(this.base); }
  sync() { return this.http.post<SyncResult>(`${this.base}/sync`, {}); }
}
