export interface DolarRate {
  casa: string;                 // clave: oficial, blue, bolsa, contadoconliqui, mayorista, cripto, tarjeta
  nombre: string;               // nombre para mostrar
  compra: number;
  venta: number;
  fechaActualizacion: string;   // ISO
}
