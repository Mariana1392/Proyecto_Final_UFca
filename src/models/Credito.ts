// Modelo de Crédito/Préstamo - Compatible con MongoDB Atlas
export interface Credito {
  _id: string;
  codigo: string; // Código único del crédito
  asociadoId: string;
  asociadoNombre: string; // Desnormalizado para consultas rápidas
  tipo: 'libre_inversion' | 'educacion' | 'vivienda' | 'calamidad';
  monto: number;
  plazoMeses: number;
  tasaInteres: number; // Porcentaje anual
  tasaMensual: number; // Calculada
  cuotaMensual: number; // Calculada
  fechaSolicitud: string;
  fechaAprobacion?: string;
  fechaDesembolso?: string;
  fechaCancelacion?: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'desembolsado' | 'cancelado' | 'en_mora';
  
  // Control de mora
  enMora: boolean;
  diasMora: number;
  
  // Aprobación
  aprobadoPor?: string; // ID del administrador
  motivoRechazo?: string;
  
  // Pagos
  saldoPendiente: number;
  totalPagado: number;
  cuotasPagadas: number;
  
  // Observaciones
  observaciones?: string;
  destinoCredito?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface TablaAmortizacion {
  creditoId: string;
  cuotas: CuotaAmortizacion[];
  generadaEn: string;
}

export interface CuotaAmortizacion {
  numeroCuota: number;
  fechaVencimiento: string;
  saldoInicial: number;
  cuota: number;
  capital: number;
  interes: number;
  saldoFinal: number;
  estado: 'pendiente' | 'pagada' | 'vencida' | 'parcial';
  pagado: number; // Monto efectivamente pagado
  fechaPago?: string;
}

export interface Pago {
  _id: string;
  creditoId: string;
  asociadoId: string;
  monto: number;
  fecha: string;
  numeroCuota?: number;
  aplicadoACapital: number;
  aplicadoAInteres: number;
  saldoPendiente: number;
  registradoPor: string;
  metodoPago: 'efectivo' | 'transferencia' | 'cheque' | 'otro';
  referencia?: string;
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PazYSalvo {
  _id: string;
  asociadoId: string;
  creditoId?: string;
  fechaEmision: string;
  vigenciaHasta: string;
  emitidoPor: string;
  motivo: 'credito_cancelado' | 'retiro' | 'solicitud';
  observaciones?: string;
  documentoUrl?: string; // URL del PDF generado
  createdAt: string;
  updatedAt: string;
}

// Utilidades para créditos
export const generateCodigoCredito = (creditos: Credito[]): string => {
  const maxCodigo = creditos.reduce((max, c) => {
    const num = parseInt(c.codigo.replace(/\D/g, '')) || 0;
    return num > max ? num : max;
  }, 0);
  return `CRE-${String(maxCodigo + 1).padStart(6, '0')}`;
};

export const calcularTasaMensual = (tasaAnual: number): number => {
  return tasaAnual / 12 / 100;
};

export const calcularCuotaMensual = (monto: number, tasaMensual: number, plazoMeses: number): number => {
  if (tasaMensual === 0) return monto / plazoMeses;
  const factor = Math.pow(1 + tasaMensual, plazoMeses);
  return monto * (tasaMensual * factor) / (factor - 1);
};

// Método Francés - Cuota fija
export const generarTablaAmortizacion = (
  credito: Credito,
  fechaInicio: Date
): TablaAmortizacion => {
  const cuotas: CuotaAmortizacion[] = [];
  let saldo = credito.monto;
  const tasaMensual = calcularTasaMensual(credito.tasaInteres);
  const cuota = calcularCuotaMensual(credito.monto, tasaMensual, credito.plazoMeses);
  
  for (let i = 1; i <= credito.plazoMeses; i++) {
    const interes = saldo * tasaMensual;
    const capital = cuota - interes;
    const saldoFinal = saldo - capital;
    
    const fechaVencimiento = new Date(fechaInicio);
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + i);
    
    cuotas.push({
      numeroCuota: i,
      fechaVencimiento: fechaVencimiento.toISOString(),
      saldoInicial: saldo,
      cuota: cuota,
      capital: capital,
      interes: interes,
      saldoFinal: Math.max(0, saldoFinal),
      estado: 'pendiente',
      pagado: 0
    });
    
    saldo = Math.max(0, saldoFinal);
  }
  
  return {
    creditoId: credito._id,
    cuotas,
    generadaEn: new Date().toISOString()
  };
};

export const calcularDiasMora = (fechaVencimiento: string): number => {
  const hoy = new Date();
  const vencimiento = new Date(fechaVencimiento);
  const diferencia = hoy.getTime() - vencimiento.getTime();
  const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
  return Math.max(0, dias);
};

export const verificarMora = (cuotas: CuotaAmortizacion[]): { enMora: boolean; diasMora: number } => {
  const cuotasVencidas = cuotas.filter(c => 
    c.estado === 'pendiente' && calcularDiasMora(c.fechaVencimiento) > 30
  );
  
  if (cuotasVencidas.length === 0) {
    return { enMora: false, diasMora: 0 };
  }
  
  const maxDiasMora = Math.max(...cuotasVencidas.map(c => calcularDiasMora(c.fechaVencimiento)));
  
  return {
    enMora: true,
    diasMora: maxDiasMora
  };
};

export const validateCredito = (credito: Partial<Credito>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!credito.asociadoId) errors.push('Asociado es requerido');
  if (!credito.tipo) errors.push('Tipo de crédito es requerido');
  if (!credito.monto || credito.monto <= 0) errors.push('Monto debe ser mayor a 0');
  if (!credito.plazoMeses || credito.plazoMeses <= 0) errors.push('Plazo debe ser mayor a 0');
  if (!credito.tasaInteres || credito.tasaInteres < 0) errors.push('Tasa de interés es requerida');
  
  return {
    valid: errors.length === 0,
    errors
  };
};
