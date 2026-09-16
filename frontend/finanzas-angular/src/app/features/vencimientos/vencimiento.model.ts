export type Moneda = 'ARS' | 'USD';
export type Confianza = 'Alta' | 'Media' | 'Baja';

export interface ConnectionStatus {
  connected: boolean;
  email: string | null;
  ultimaSync: string | null;
}

export interface Remitente {
  id: string;
  email: string;
  empresa: string;
  activo: boolean;
  ultimoProcesado: string | null;
}

export interface Vencimiento {
  id: string;
  empresa: string;
  remitenteEmail: string;
  asunto: string | null;
  fechaMail: string;
  montoTotal: number | null;
  moneda: Moneda;
  fechaVencimiento: string | null;   // 'YYYY-MM-DD'
  fechaVencimiento2: string | null;
  periodo: string | null;
  confianza: Confianza;
  procesadoCon: string;
  procesadoOk: boolean;
}

export interface RemitentePayload {
  email: string;
  empresa: string;
  activo: boolean;
}

export interface SyncResult {
  procesados: number;
  nuevos: number;
  mensaje?: string;
}
