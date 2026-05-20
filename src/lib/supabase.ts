import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno de Supabase.\n' +
    'Crea un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey:       'ufca-auth',        // clave única → evita conflictos entre pestañas
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: true,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DEL ESQUEMA — reflejan exactamente las tablas en Supabase
// Actualizar aquí cada vez que cambie la BD.
// ─────────────────────────────────────────────────────────────────────────────

// ── Utilidades ────────────────────────────────────────────────────────────────

/** Campos de auditoría presentes en todas las tablas */
type Timestamps = {
  created_at: string;
  updated_at?: string;
};

/** Campos de anulación lógica (en lugar de DELETE físico) */
type Anulable = {
  anulado:           boolean;
  motivo_anulacion?: string;
};

// ── ACCESO Y PERMISOS ─────────────────────────────────────────────────────────

/** Tabla: roles */
export type Rol = Timestamps & {
  id:           string;
  nombre:       string;   // Ej: 'admin', 'asociado', 'usuario'
  label:        string;   // Ej: 'Administrador', 'Asociado', 'Usuario'
  descripcion?: string;
  activo:       boolean;
  es_sistema:   boolean;  // true = no se puede eliminar ni desactivar
};

/** Tabla: permisos */
export type Permiso = Timestamps & {
  id:           string;
  clave:        string;   // Ej: 'dashboard', 'creditos', 'mis_ahorros'
  label:        string;   // Texto visible en UI
  descripcion?: string;
  grupo:        'admin' | 'asociado' | 'usuario';
  activo:       boolean;
};

/** Tabla: rol_permisos (relación N:M entre roles y permisos) */
export type RolPermiso = {
  rol_id:        string;   // → roles.id
  permiso_clave: string;   // → permisos.clave
  activo:        boolean;  // false = quitado del rol (no eliminado de BD)
};

// ── USUARIOS ──────────────────────────────────────────────────────────────────

/** Tabla: usuarios */
export type Usuario = Timestamps & {
  id:             string;   // Mismo UUID que auth.users
  nombre:         string;
  email:          string;
  username?:      string;
  identificacion?: string;
  activo:         boolean;
  rol_id?:        string;   // → roles.id
  asociado_id?:   string;   // → asociados.id (null si aún no es asociado)
  ultimo_acceso?: string;
};

// ── ASOCIADOS ─────────────────────────────────────────────────────────────────

/** Tabla: asociados */
export type Asociado = Timestamps & Anulable & {
  id:               string;
  nombre:           string;
  cedula:           string;
  telefono?:        string;
  email?:           string;
  direccion?:       string;
  estado:           'activo' | 'inactivo' | 'suspendido';
  fecha_ingreso?:   string;
  referido_por_id?: string;  // → asociados.id
};

// ── AHORROS ───────────────────────────────────────────────────────────────────

/** Tabla: ahorros_permanentes */
export type AhorroPermanente = Timestamps & Anulable & {
  id:              string;
  asociado_id:     string;  // → asociados.id
  periodo_id:      string;  // → periodos.id
  cuota_mensual:   number;
  monto_ahorrado:  number;
  estado:          'activo' | 'cerrado' | 'suspendido';
  fecha_cierre?:   string;
};

/** Tabla: ahorros_voluntarios */
export type AhorroVoluntario = Timestamps & Anulable & {
  id:              string;
  asociado_id:     string;  // → asociados.id
  periodo_id:      string;  // → periodos.id
  monto_ahorrado:  number;
  estado:          'activo' | 'retirado' | 'cerrado';
  fecha_retiro?:   string;
  fecha_cierre?:   string;
  monto_al_cierre?: number;
};

// ── CRÉDITOS ──────────────────────────────────────────────────────────────────

/** Tabla: creditos */
export type Credito = Timestamps & Anulable & {
  id:                        string;
  asociado_id:               string;  // → asociados.id
  periodo_id:                string;  // → periodos.id
  tipo:                      'libre_inversion' | 'educacion' | 'vivienda' | 'calamidad';
  monto:                     number;
  plazo_meses:               number;
  cuota_mensual:             number;
  saldo:                     number;
  tasa_interes:              number;
  tasa_mora?:                number;
  estado:                    'pendiente' | 'en_revision' | 'aprobado' | 'desembolsado' | 'activo' | 'en_mora' | 'pagado' | 'rechazado' | 'cancelado' | 'simulacion';
  fecha_desembolso?:         string;
  fecha_primera_cuota?:      string;
  fecha_ultima_cuota?:       string;
  fecha_estado_cambio?:      string;
  motivo_estado_cambio?:     string;
  url_comprobante_solicitud?: string;
  aprobado_por?:             string;  // → usuarios.id
};

/** Tabla: pagos_credito */
export type PagoCredito = Timestamps & {
  id:               string;
  credito_id:       string;   // → creditos.id
  monto_pagado:     number;
  capital:          number;
  interes:          number;
  saldo_antes:      number;
  saldo_despues:    number;
  num_cuota:        number;
  fecha_pago:       string;
  metodo_pago:      string;
  registrado_por?:  string;   // → usuarios.id
  observacion?:     string;
  url_comprobante?: string;   // URL del comprobante subido por el administrador
};

// ── LIQUIDACIONES ─────────────────────────────────────────────────────────────

/** Tabla: liquidaciones */
export type Liquidacion = Timestamps & {
  id:           string;
  asociado_id:  string;   // → asociados.id
  usuario_id?:  string;   // → usuarios.id (quien procesó)
  tipo:         'retiro' | 'cesantias' | 'expulsion' | 'fallecimiento' | 'otro';
  detalle:      Record<string, any>;  // jsonb: conceptos, montos, estado, etc.
};

// ── SOLICITUDES DE AFILIACIÓN ─────────────────────────────────────────────────

/** Tabla: solicitudes_asociados */
export type SolicitudAsociado = Timestamps & {
  id:            string;
  nombres:       string;
  apellidos:     string;
  cedula:        string;
  telefono?:     string;
  email?:        string;
  direccion?:    string;
  ocupacion?:    string;
  estado:        'pendiente' | 'aprobada' | 'rechazada';
  evaluacion?:   Record<string, any>;  // jsonb: score, nivel_riesgo, verificaciones, etc.
  documentos?:   string[];             // jsonb: array de URLs de archivos adjuntos
  observaciones?: string;
  fecha_resolucion?: string;
};

// ── EXCEPCIONES ───────────────────────────────────────────────────────────────

/** Tabla: excepciones (operaciones que violan reglas de negocio y requieren aprobación) */
export type Excepcion = Timestamps & {
  id:           string;
  asociado_id?: string;   // → asociados.id
  tipo:         string;   // Ej: 'credito_con_mora', 'retiro_parcial'
  descripcion:  string;
  estado:       'pendiente' | 'aprobada' | 'rechazada';
  resuelto_por?: string;  // → usuarios.id
};

// ── AUDITORÍA ─────────────────────────────────────────────────────────────────

/** Tabla: auditoria (registro inmutable de todas las acciones del sistema) */
export type Auditoria = Timestamps & {
  id:           string;
  usuario_id?:  string;   // → usuarios.id
  asociado_id?: string;   // → asociados.id (cuando aplica)
  tabla:        string;   // Nombre de la tabla afectada
  registro_id?: string;   // ID del registro afectado
  accion:       string;   // Ej: 'CREAR', 'EDITAR', 'ELIMINAR', 'APROBAR'
  detalle:      Record<string, any> | string;  // jsonb con contexto de la acción
};

// ── NOTIFICACIONES ────────────────────────────────────────────────────────────

/** Tabla: notificaciones */
export type Notificacion = Timestamps & {
  id:           string;
  usuario_id?:  string;   // → usuarios.id (null = para todos los admins)
  asociado_id?: string;   // → asociados.id (cuando aplica)
  tipo:         string;   // Ej: 'solicitud_afiliacion', 'excepcion', 'mora'
  titulo:       string;
  mensaje:      string;
  leida:        boolean;
  para_admin?:  boolean;  // true = se muestra a todos los administradores
};

// ── CONFIGURACIÓN ─────────────────────────────────────────────────────────────

/** Tabla: configuracion (parámetros globales del sistema — nunca hardcodeados en código) */
export type Configuracion = Timestamps & {
  id:           string;
  clave:        string;   // Ej: 'monto_obligatorio_ahorro_permanente', 'tasa_mora'
  valor:        string;   // Siempre string — convertir al tipo necesario en uso
  descripcion?: string;
};
