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
  id:               string;   // Mismo UUID que auth.users
  nombre:           string;
  email:            string;
  username?:        string;
  activo:           boolean;
  rol_id?:          string;   // → roles.id
  ultimo_acceso?:   string;
  // Campos financieros (antes en tabla asociados)
  cedula?:          string;
  telefono?:        string;
  direccion?:       string;
  fecha_ingreso?:   string;
  estado_cuenta?:   'activo' | 'inactivo' | 'suspendido';
  referido_por_id?: string;   // → usuarios.id
};

// ── AHORROS ───────────────────────────────────────────────────────────────────

/**
 * Tabla: cuentas_ahorro
 * Unifica ahorros permanentes y voluntarios mediante el campo `tipo`.
 * Permanente: cuota_mensual obligatorio.
 * Voluntario:  fecha_retiro y monto_al_cierre opcionales.
 */
export type CuentaAhorro = Timestamps & Anulable & {
  id:               string;
  tipo:             'permanente' | 'voluntario';
  asociado_id:      string;   // → usuarios.id
  periodo_id:       string;   // → periodos.id
  monto_ahorrado:   number;
  cuota_mensual?:   number;   // Solo permanente
  fecha_retiro?:    string;   // Solo voluntario
  monto_al_cierre?: number;   // Solo voluntario
  estado:           'activo' | 'cerrado' | 'suspendido' | 'retirado';
  fecha_cierre?:    string;
  observaciones?:   string;   // Notas internas sobre la cuenta
  anulado_por?:     string;   // → usuarios.id
  anulado_en?:      string;
};

// Alias para compatibilidad con código existente que aún importe estos tipos
/** @deprecated Usar CuentaAhorro con tipo='permanente' */
export type AhorroPermanente = CuentaAhorro;
/** @deprecated Usar CuentaAhorro con tipo='voluntario' */
export type AhorroVoluntario = CuentaAhorro;

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

/**
 * Tabla: transacciones
 * Unifica todos los movimientos de dinero: aportes de ahorro y pagos de crédito.
 * El campo `tipo` discrimina el subtipo del movimiento.
 */
export type Transaccion = Timestamps & {
  id:               string;
  tipo:             'aporte_permanente' | 'aporte_voluntario' | 'pago_credito' | 'abono_capital' | 'cancelacion_total';
  asociado_id:      string;   // → usuarios.id
  registrado_por?:  string;   // → usuarios.id
  ahorro_id?:       string;   // → cuentas_ahorro.id (aportes)
  credito_id?:      string;   // → creditos.id (pagos crédito)
  cuota_id?:        string;   // → cuotas_credito.id
  periodo_id?:      string;   // → periodos.id
  monto:            number;
  capital:          number;
  interes:          number;
  monto_mora:       number;
  dias_mora:        number;
  saldo_antes?:     number;
  saldo_despues?:   number;
  mes_correspondiente?: string;
  fecha_pago:       string;
  metodo_pago?:     string;
  url_comprobante?: string;
  observacion?:     string;
  anulado:          boolean;
  anulado_por?:     string;
  anulado_en?:      string;
  motivo_anulacion?: string;
};

/** @deprecated Usar Transaccion con tipo='pago_credito' */
export type PagoCredito = Transaccion;

// ── LIQUIDACIONES ─────────────────────────────────────────────────────────────

/** Tabla: liquidaciones (schema post-migración JSONB→columnas) */
export type Liquidacion = Timestamps & {
  id:                     string;
  asociado_id:            string;    // → asociados.id
  usuario_id?:            string;    // → usuarios.id (quien procesó)
  tipo:                   'retiro' | 'cesantias' | 'expulsion' | 'fallecimiento' | 'otro';
  monto_total?:           number;

  // ── Columnas reales (antes vivían en detalle JSONB) ──────────
  estado:                 string;    // 'En proceso' | 'Aprobada' | 'Pagada' | 'Rechazada'
  fecha_corte?:           string;    // date ISO
  fecha_liquidacion?:     string;    // date ISO, nullable
  motivo?:                string;
  observaciones?:         string;
  anulado:                boolean;
  justificacion_anulacion?: string;
  anulado_por?:           string;    // nombre del admin que anuló
  anulado_en?:            string;    // timestamptz ISO

  // ── JSONB dedicados (datos estructurados que justifican jsonb) ──
  conceptos:              Record<string, unknown>[];  // lista de conceptos {id, nombre, monto, tipo}
  documentos:             Record<string, unknown>[];  // lista de docs {id, nombre, url, ...}

  // ── Residual histórico (calculo, metadata) ───────────────────
  detalle?:               Record<string, unknown>;
};

// ── SOLICITUDES DE AFILIACIÓN ─────────────────────────────────────────────────

/** Tabla: solicitudes_asociados */
export type SolicitudAsociado = Timestamps & {
  id:                     string;
  usuario_id?:            string;   // → usuarios.id
  nombres:                string;
  apellidos:              string;
  cedula:                 string;
  tipo_identificacion?:   string;
  telefono?:              string;
  email?:                 string;
  direccion?:             string;
  ocupacion?:             string;
  ingreso_mensual?:       number;
  monto_ahorro_propuesto?: number;
  motivacion?:            string;
  estado:                 'pendiente' | 'aprobada' | 'rechazada';
  evaluacion?:            Record<string, any>;  // jsonb
  documentos?:            string[];             // jsonb: array de URLs
  observaciones?:         string;
  fecha_solicitud?:       string;
  fecha_resolucion?:      string;
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
