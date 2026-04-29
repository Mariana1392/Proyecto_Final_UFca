// Modelo de Excepciones Administrativas - Sistema de Reglas Flexibles
export interface ExcepcionAdministrativa {
  _id: string;
  tipo: ExcepcionTipo;
  entidad: 'asociado' | 'credito' | 'pago' | 'retiro' | 'aporte';
  entidadId: string; // ID del documento relacionado
  reglaViolada: string;
  descripcionRegla: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  
  // Solicitud
  solicitadoPor: string; // Usuario que generó la excepción
  fechaSolicitud: string;
  motivo: string;
  datosRelevantes: Record<string, any>; // Información contextual
  
  // Decisión administrativa
  revisadoPor?: string; // Administrador que revisó
  fechaRevision?: string;
  decision?: 'aprobar' | 'rechazar';
  observacionesAdmin?: string;
  
  // Auditoría
  impacto: 'bajo' | 'medio' | 'alto' | 'critico';
  requiereJustificacion: boolean;
  
  createdAt: string;
  updatedAt: string;
}

export type ExcepcionTipo =
  | 'asociado_referido' // Persona referida intenta afiliarse
  | 'aporte_menor_minimo' // Aporte menor al mínimo estatutario
  | 'credito_con_mora' // Nuevo crédito con crédito en mora
  | 'credito_asociado_inactivo' // Crédito para asociado inactivo
  | 'pago_credito_no_desembolsado' // Pago a crédito no desembolsado
  | 'retiro_con_deudas' // Retiro con deudas pendientes
  | 'retiro_parcial' // Retiro parcial solicitado
  | 'operacion_periodo_cerrado' // Operación en periodo cerrado
  | 'suspension_menos_dos_cuotas' // Suspensión con menos de 2 cuotas incumplidas
  | 'eliminacion_credito_con_pagos' // Intento de eliminar crédito con pagos
  | 'multiple_afiliacion' // Intento de múltiple afiliación activa
  | 'otra'; // Otro tipo de excepción

export interface ConfiguracionReglas {
  _id: string;
  nombre: string;
  descripcion: string;
  parametros: {
    aporteMinimo: number; // Aporte mínimo mensual
    cuotasMaximasIncumplidas: number; // Cuotas antes de suspensión (default: 2)
    diasMoraMaximo: number; // Días para considerar mora (default: 30)
    permitirRetirosParcialesDefecto: boolean; // Si se permiten retiros parciales
    periodoActualCerrado: boolean; // Si el periodo actual está cerrado
    fechaCierrePeriodo?: string; // Fecha del último cierre
  };
  modificadoPor: string;
  fechaModificacion: string;
  createdAt: string;
  updatedAt: string;
}

// Sistema de alertas
export interface Alerta {
  _id: string;
  tipo: 'excepcion' | 'mora' | 'suspension' | 'informativa';
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  titulo: string;
  mensaje: string;
  entidad: string; // Ej: "credito", "asociado"
  entidadId: string;
  destinatario: string; // ID del usuario destinatario (admin)
  leida: boolean;
  fechaLectura?: string;
  accionRequerida: boolean;
  excepcionId?: string; // Si está relacionada con una excepción
  createdAt: string;
  updatedAt: string;
}

// Auditoría completa
export interface AuditoriaLog {
  _id: string;
  accion: 'crear' | 'actualizar' | 'eliminar' | 'aprobar' | 'rechazar' | 'autorizar_excepcion';
  entidad: string;
  entidadId: string;
  usuario: string; // ID del usuario
  usuarioNombre: string;
  usuarioRol: string;
  
  // Datos de la acción
  datosAnteriores?: Record<string, any>;
  datosNuevos?: Record<string, any>;
  cambios?: { campo: string; antes: any; despues: any }[];
  
  // Contexto
  ip?: string;
  userAgent?: string;
  motivoAccion?: string;
  excepcionRelacionada?: string;
  
  timestamp: string;
}

// Utilidades para excepciones
export const crearExcepcion = (
  tipo: ExcepcionTipo,
  entidad: ExcepcionAdministrativa['entidad'],
  entidadId: string,
  reglaViolada: string,
  descripcionRegla: string,
  solicitadoPor: string,
  motivo: string,
  datosRelevantes: Record<string, any>
): ExcepcionAdministrativa => {
  return {
    _id: `exc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    tipo,
    entidad,
    entidadId,
    reglaViolada,
    descripcionRegla,
    estado: 'pendiente',
    solicitadoPor,
    fechaSolicitud: new Date().toISOString(),
    motivo,
    datosRelevantes,
    impacto: calcularImpacto(tipo),
    requiereJustificacion: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const calcularImpacto = (tipo: ExcepcionTipo): ExcepcionAdministrativa['impacto'] => {
  const impactosAltos: ExcepcionTipo[] = [
    'credito_con_mora',
    'retiro_con_deudas',
    'operacion_periodo_cerrado',
    'eliminacion_credito_con_pagos'
  ];
  
  const impactosMedios: ExcepcionTipo[] = [
    'credito_asociado_inactivo',
    'pago_credito_no_desembolsado',
    'multiple_afiliacion'
  ];
  
  if (impactosAltos.includes(tipo)) return 'alto';
  if (impactosMedios.includes(tipo)) return 'medio';
  return 'bajo';
};

export const crearAlerta = (
  tipo: Alerta['tipo'],
  prioridad: Alerta['prioridad'],
  titulo: string,
  mensaje: string,
  entidad: string,
  entidadId: string,
  destinatario: string,
  accionRequerida: boolean,
  excepcionId?: string
): Alerta => {
  return {
    _id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    tipo,
    prioridad,
    titulo,
    mensaje,
    entidad,
    entidadId,
    destinatario,
    leida: false,
    accionRequerida,
    excepcionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

export const registrarAuditoria = (
  accion: AuditoriaLog['accion'],
  entidad: string,
  entidadId: string,
  usuario: string,
  usuarioNombre: string,
  usuarioRol: string,
  datosAnteriores?: Record<string, any>,
  datosNuevos?: Record<string, any>,
  motivoAccion?: string,
  excepcionRelacionada?: string
): AuditoriaLog => {
  const cambios = calcularCambios(datosAnteriores, datosNuevos);
  
  return {
    _id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    accion,
    entidad,
    entidadId,
    usuario,
    usuarioNombre,
    usuarioRol,
    datosAnteriores,
    datosNuevos,
    cambios,
    motivoAccion,
    excepcionRelacionada,
    timestamp: new Date().toISOString()
  };
};

const calcularCambios = (
  antes?: Record<string, any>,
  despues?: Record<string, any>
): { campo: string; antes: any; despues: any }[] => {
  if (!antes || !despues) return [];
  
  const cambios: { campo: string; antes: any; despues: any }[] = [];
  const campos = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  
  campos.forEach(campo => {
    if (JSON.stringify(antes[campo]) !== JSON.stringify(despues[campo])) {
      cambios.push({
        campo,
        antes: antes[campo],
        despues: despues[campo]
      });
    }
  });
  
  return cambios;
};
