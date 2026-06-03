export interface LiquidacionProps {
  userData?: any;
}

export interface Concepto {
  id: number;
  nombre: string;
  monto: string;
  tipo: 'credito' | 'debito';
}

export interface LiqDoc {
  id: string;
  nombre: string;
  url: string;
  tipo_archivo: string;
  subido_por: string | null;
  subido_por_nombre?: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  accion: string;
  detalle: string | null;
  usuario_id: string | null;
  created_at: string;
}

export interface LiquidacionRecord {
  id: string;
  asociado: string;
  cedula: string;
  asociado_id: string;
  tipo: string;
  fechaCorte: string;
  fechaLiquidacion: string;
  estado: string;
  motivo: string;
  observaciones: string;
  conceptos: Concepto[];
  documentos: LiqDoc[];
  calculo: any;
  montoFinal: number;
  anulado: boolean;
  justificacionAnulacion: string;
  anuladoPor: string;
  anuladoEn: string;
  createdAt: string;
}
