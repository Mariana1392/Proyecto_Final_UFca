// Modelo de Asociado - Compatible con MongoDB Atlas
export interface Asociado {
  _id: string; // ID único e irrepetible
  codigo: string; // Código único del asociado
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono: string;
  email: string;
  direccion?: string;
  ocupacion?: string;
  ingresoMensual?: number;
  fechaAfiliacion: string; // ISO date
  estado: 'activo' | 'inactivo' | 'suspendido' | 'retirado';
  esReferido: boolean; // No puede afiliarse si es referido
  referidoPor?: string; // ID del asociado que lo refirió
  motivoSuspension?: string;
  fechaSuspension?: string;
  fechaRetiro?: string;
  motivoRetiro?: string;
  cuotasIncumplidas: number; // Control automático
  createdAt: string;
  updatedAt: string;
}

export interface Afiliacion {
  _id: string;
  asociadoId: string;
  fechaAfiliacion: string;
  estado: 'activa' | 'retirada' | 'suspendida';
  aporteMinimo: number; // Parametrizable
  aprobadoPor: string; // ID del usuario administrador
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Aporte {
  _id: string;
  asociadoId: string;
  tipo: 'permanente' | 'voluntario';
  monto: number;
  fecha: string;
  periodo: string; // Ej: "2024-01"
  estado: 'registrado' | 'validado' | 'anulado';
  registradoPor: string;
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Suspension {
  _id: string;
  asociadoId: string;
  fechaInicio: string;
  fechaFin?: string;
  motivo: 'cuotas_incumplidas' | 'solicitud_propia' | 'administrativa' | 'otros';
  descripcion: string;
  cuotasIncumplidasCount: number;
  suspendidoPor: string;
  levantadaPor?: string;
  estado: 'activa' | 'levantada';
  createdAt: string;
  updatedAt: string;
}

export interface Retiro {
  _id: string;
  asociadoId: string;
  fechaSolicitud: string;
  fechaRetiro?: string;
  montoTotal: number;
  descuentos: {
    concepto: string;
    monto: number;
  }[];
  montoNeto: number;
  requierePazYSalvo: boolean;
  tienePazYSalvo: boolean;
  tieneDeudas: boolean;
  deudaPendiente?: number;
  estado: 'solicitado' | 'aprobado' | 'rechazado' | 'pagado';
  aprobadoPor?: string;
  motivoRechazo?: string;
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
}

// Funciones de utilidad
export const generateCodigoAsociado = (asociados: Asociado[]): string => {
  const maxCodigo = asociados.reduce((max, a) => {
    const num = parseInt(a.codigo.replace(/\D/g, '')) || 0;
    return num > max ? num : max;
  }, 0);
  return `ASC-${String(maxCodigo + 1).padStart(5, '0')}`;
};

export const validateAsociado = (asociado: Partial<Asociado>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!asociado.nombres?.trim()) errors.push('Nombres es requerido');
  if (!asociado.apellidos?.trim()) errors.push('Apellidos es requerido');
  if (!asociado.cedula?.trim()) errors.push('Cédula es requerida');
  if (!asociado.telefono?.trim()) errors.push('Teléfono es requerido');
  if (!asociado.email?.trim()) errors.push('Email es requerido');
  if (asociado.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asociado.email)) {
    errors.push('Email inválido');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};
