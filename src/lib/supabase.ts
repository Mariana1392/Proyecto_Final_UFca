import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno de Supabase.\n' +
    'Crea un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─────────────────────────────────────────────────────────
// Tipos base reutilizables
// ─────────────────────────────────────────────────────────

type Timestamps = {
  created_at: string;
  updated_at: string;
};

type Anulable = {
  anulado: boolean;
  motivo_anulacion?: string;
};

// ─────────────────────────────────────────────────────────
// Tipos del esquema
// ─────────────────────────────────────────────────────────

export type Permiso = {
  accion: string;
  recurso: string;
};

export type Rol = Timestamps & {
  id: string;
  nombre: string;
  descripcion?: string;
  permisos?: Permiso[];       // ✅ tipado en lugar de any[]
  activo: boolean;
};

export type Asociado = Timestamps & {
  id: string;
  nombre: string;
  cedula: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  fecha_ingreso: string;
  estado: 'activo' | 'inactivo';  // ✅ más descriptivo que boolean
  referido_por_id?: string;
};

export type Usuario = Timestamps & {
  id: string;
  asociado_id?: string;
  rol_id: string;
  nombre: string;
  email: string;
  activo: boolean;
};

// ✅ Base compartida para ahorros (evita duplicación)
type AhorroBase = Timestamps & Anulable & {
  id: string;
  asociado_id: string;
  cuota_mensual: number;
  monto_ahorrado: number;
  fecha_inicio: string;
  estado: 'activo' | 'inactivo';
};

export type AhorroPermanente = AhorroBase;
export type AhorroVoluntario = AhorroBase;

export type Credito = Timestamps & Anulable & {
  id: string;
  asociado_id: string;
  monto: number;
  plazo_meses: number;
  cuota_mensual: number;
  saldo: number;
  fecha_desembolso: string;
  estado: 'activo' | 'inactivo' | 'pagado';  // ✅ más descriptivo
};

export type Categoria = Timestamps & {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
};

export type Proveedor = Timestamps & {
  id: string;
  nombre: string;
  nit?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  activo: boolean;
};

export type Producto = Timestamps & {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria_id?: string;
  proveedor_id?: string;
  precio_compra: number;
  precio_venta: number;
  stock: number;
  stock_minimo: number;
  estado: 'Disponible' | 'Stock bajo' | 'Agotado';
};

export type Venta = Timestamps & {
  id: string;
  asociado_id?: string;
  total: number;
  fecha: string;
  estado: 'pendiente' | 'completada' | 'anulada';
  notas?: string;
  created_by?: string;
};

export type Pedido = Timestamps & {
  id: string;
  asociado_id: string;
  total: number;
  fecha: string;
  estado: 'pendiente' | 'aprobado' | 'entregado' | 'anulado';
  notas?: string;
};

export type Evento = Timestamps & {
  id: string;
  titulo: string;
  descripcion?: string;
  fecha: string;
  hora?: string;
  lugar?: string;
  capacidad?: number;
  estado: 'programado' | 'en_curso' | 'finalizado' | 'cancelado';
  created_by?: string;
};

export type Excepcion = Timestamps & {
  id: string;
  asociado_id: string;
  tipo: string;
  descripcion: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  resuelto_por?: string;
  fecha: string;
};