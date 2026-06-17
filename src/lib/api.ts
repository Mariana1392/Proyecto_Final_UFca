// src/lib/api.ts
// ─────────────────────────────────────────────────────────
// Funciones de acceso a datos para cada módulo de UFCA
// Reemplaza los useState con datos mock en cada componente
// ─────────────────────────────────────────────────────────

import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

// ═══════════════════════════════════════
// TIPOS — basados en el schema real de Supabase
// ═══════════════════════════════════════

export interface AsociadoRow {
  id: string;
  nombre: string;
  cedula: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  ocupacion?: string | null;
  fecha_ingreso?: string | null;
  /** Campo real de la tabla usuarios — determina si la cuenta está operativa */
  estado_cuenta?: 'activo' | 'inactivo' | 'suspendido';
  referido_por_id?: string | null;
  periodo_ingreso_id?: string | null;
  anulado: boolean;
  motivo_anulacion?: string | null;
  created_at: string;
  updated_at: string;
}

/** Fila de cuentas_ahorro — unifica permanente y voluntario */
export interface CuentaAhorroRow {
  id: string;
  tipo: 'permanente' | 'voluntario';
  asociado_id: string;
  periodo_id: string;
  monto_ahorrado: number;
  cuota_mensual?: number | null;     // Solo permanente
  fecha_retiro?: string | null;      // Solo voluntario
  monto_al_cierre?: number | null;   // Solo voluntario
  estado: string;
  fecha_cierre?: string | null;
  anulado: boolean;
  motivo_anulacion?: string | null;
  observaciones?: string | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated Usar CuentaAhorroRow */
export type AhorroPermanenteRow = CuentaAhorroRow;
/** @deprecated Usar CuentaAhorroRow */
export type AhorroVoluntarioRow = CuentaAhorroRow;

export interface CreditoRow {
  id: string;
  asociado_id: string;
  tipo: string;
  monto: number;
  plazo_meses: number;
  tipo_interes?: string | null;
  tasa_interes: number;
  cuota_mensual: number;
  saldo: number;
  estado: string;
  anulado: boolean;
  motivo_anulacion?:           string | null;
  fecha_desembolso?:           string | null;
  observaciones?:              string | null;
  url_comprobante_solicitud?:  string | null;
  fecha_estado_cambio?:        string | null;
  motivo_estado_cambio?:       string | null;
  created_at: string;
  updated_at: string;
}

export interface ExcepcionRow {
  id: string;
  tipo: string;
  descripcion: string;
  estado: string;
  asociado_id?: string | null;
  resuelto_por?: string | null;
  created_at: string;
  updated_at: string;
}

// Helpers para inferir tipos de Insert y Update desde cada Row
type DbInsert<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;
type DbUpdate<T> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>;

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════

export const auth = {
  /** Iniciar sesión con email y contraseña */
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Obtener datos del usuario (rol vinculado)
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('*, roles(*)')
      .eq('id', data.user.id)
      .single();

    if (userError) throw userError;
    return usuario;
  },

  /** Cerrar sesión */
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /** Obtener sesión activa */
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /** Escuchar cambios de sesión (para AuthContext) */
  onAuthChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },
};

// ═══════════════════════════════════════
// ASOCIADOS
// ═══════════════════════════════════════

export const asociadosApi = {
  /** Devuelve todos los usuarios con rol 'asociado' (antes tabla asociados). */
  async getAll() {
    const { data: rolAsoc } = await supabase
      .from('roles').select('id').eq('nombre', 'asociado').limit(1).maybeSingle();
    const rolAsociadoId = rolAsoc?.id ?? null;
    let query = supabase
      .from('usuarios')
      .select('id,nombre,cedula,telefono,email,fecha_ingreso,estado_cuenta,activo,created_at')
      .order('nombre');
    if (rolAsociadoId) query = (query as any).eq('rol_id', rolAsociadoId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * Versión paginada de asociados (usuarios con rol 'asociado').
   */
  async getPaginated(
    page     = 0,
    pageSize = 20,
    search   = '',
    estado?: string,
  ) {
    const { data: rolAsoc } = await supabase
      .from('roles').select('id').eq('nombre', 'asociado').limit(1).maybeSingle();
    const rolAsociadoId = rolAsoc?.id ?? null;
    let query = supabase
      .from('usuarios')
      .select('id,nombre,cedula,telefono,email,fecha_ingreso,estado_cuenta,referido_por_id', { count: 'exact' })
      .order('nombre')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (rolAsociadoId) query = (query as any).eq('rol_id', rolAsociadoId);
    if (search.trim()) {
      query = (query as any).or(`nombre.ilike.%${search.trim()}%,cedula.ilike.%${search.trim()}%`);
    }
    if (estado) {
      query = (query as any).eq('estado_cuenta', estado);
    }
    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, pageSize };
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: DbUpdate<AsociadoRow>) {
    const { data, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Activa o desactiva un asociado (campo estado_cuenta en usuarios). */
  async toggleEstado(id: string, activo: boolean) {
    return asociadosApi.update(id, { estado_cuenta: activo ? 'activo' : 'inactivo' });
  },

  async getReferidos(asociadoId: string) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, cedula, telefono, fecha_ingreso, estado_cuenta')
      .eq('referido_por_id', asociadoId)
      .order('fecha_ingreso', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};

// ═══════════════════════════════════════
// AHORRO PERMANENTE
// ═══════════════════════════════════════

export const ahorroPermanenteApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('cuentas_ahorro')
      .select('*')
      .eq('tipo', 'permanente')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const ids = [...new Set(rows.map((r: any) => r.asociado_id).filter(Boolean))];
    const uMap: Record<string, any> = {};
    if (ids.length > 0) {
      const { data: usrs } = await supabase.from('usuarios').select('id, nombre, cedula').in('id', ids);
      (usrs || []).forEach((u: any) => { uMap[u.id] = u; });
    }
    return rows.map((r: any) => ({ ...r, usuarios: uMap[r.asociado_id] ?? null }));
  },

  async getByAsociado(asociadoId: string) {
    const { data, error } = await supabase
      .from('cuentas_ahorro')
      .select('*')
      .eq('tipo', 'permanente')
      .eq('asociado_id', asociadoId);
    if (error) throw error;
    return data;
  },

  async create(ahorro: Omit<DbInsert<CuentaAhorroRow>, 'tipo'>) {
    const { data, error } = await supabase
      .from('cuentas_ahorro')
      .insert({ ...ahorro, tipo: 'permanente' })
      .select('*')
      .single();
    if (error) throw error;
    const { data: usr } = await supabase.from('usuarios').select('id, nombre, cedula').eq('id', data.asociado_id).maybeSingle();
    return { ...data, usuarios: usr ?? null };
  },

  async update(id: string, updates: DbUpdate<CuentaAhorroRow>) {
    const { data, error } = await supabase
      .from('cuentas_ahorro')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async anular(id: string, motivo: string): Promise<any> {
    return ahorroPermanenteApi.update(id, { anulado: true, estado: 'inactivo', motivo_anulacion: motivo });
  },
};

// ═══════════════════════════════════════
// AHORRO VOLUNTARIO
// ═══════════════════════════════════════

export const ahorroVoluntarioApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('cuentas_ahorro')
      .select('*')
      .eq('tipo', 'voluntario')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const ids = [...new Set(rows.map((r: any) => r.asociado_id).filter(Boolean))];
    const uMap: Record<string, any> = {};
    if (ids.length > 0) {
      const { data: usrs } = await supabase.from('usuarios').select('id, nombre, cedula').in('id', ids);
      (usrs || []).forEach((u: any) => { uMap[u.id] = u; });
    }
    return rows.map((r: any) => ({ ...r, usuarios: uMap[r.asociado_id] ?? null }));
  },

  async getByAsociado(asociadoId: string) {
    const { data, error } = await supabase
      .from('cuentas_ahorro')
      .select('*')
      .eq('tipo', 'voluntario')
      .eq('asociado_id', asociadoId);
    if (error) throw error;
    return data;
  },

  async create(ahorro: Omit<DbInsert<CuentaAhorroRow>, 'tipo'>) {
    const { data, error } = await supabase
      .from('cuentas_ahorro')
      .insert({ ...ahorro, tipo: 'voluntario' })
      .select('*')
      .single();
    if (error) throw error;
    const { data: usr } = await supabase.from('usuarios').select('id, nombre, cedula').eq('id', data.asociado_id).maybeSingle();
    return { ...data, usuarios: usr ?? null };
  },

  async update(id: string, updates: DbUpdate<CuentaAhorroRow>) {
    const { data, error } = await supabase
      .from('cuentas_ahorro')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async anular(id: string, motivo: string): Promise<any> {
    return ahorroVoluntarioApi.update(id, { anulado: true, estado: 'retirado', motivo_anulacion: motivo });
  },
};

// ═══════════════════════════════════════
// CRÉDITOS
// ═══════════════════════════════════════

export const creditosApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('creditos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const ids = [...new Set(rows.map((r: any) => r.asociado_id).filter(Boolean))];
    const uMap: Record<string, any> = {};
    if (ids.length > 0) {
      const { data: usrs } = await supabase.from('usuarios').select('id, nombre, cedula').in('id', ids);
      (usrs || []).forEach((u: any) => { uMap[u.id] = u; });
    }
    return rows.map((r: any) => ({ ...r, usuarios: uMap[r.asociado_id] ?? null }));
  },

  async getByAsociado(asociadoId: string) {
    const { data, error } = await supabase
      .from('creditos')
      .select('*')
      .eq('asociado_id', asociadoId);
    if (error) throw error;
    return data;
  },

  async create(credito: DbInsert<CreditoRow>) {
    const { data, error } = await supabase
      .from('creditos')
      .insert(credito)
      .select('*')
      .single();
    if (error) throw error;
    const { data: usr } = await supabase.from('usuarios').select('id, nombre, cedula').eq('id', data.asociado_id).maybeSingle();
    return { ...data, usuarios: usr ?? null };
  },

  async update(id: string, updates: DbUpdate<CreditoRow>) {
    const { data, error } = await supabase
      .from('creditos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Retorna void intencionalmente: omite .select() para evitar fallos de RLS
   *  en el SELECT posterior al UPDATE. Los callers no deben usar el valor de retorno. */
  async anular(id: string, motivo: string): Promise<void> {
    const { error } = await supabase
      .from('creditos')
      .update({
        anulado:          true,
        motivo_anulacion: motivo,
      })
      .eq('id', id);

    if (error) {
      // Lanzar con código y mensaje completo para diagnóstico
      const msg = error.message ?? error.details ?? JSON.stringify(error);
      throw new Error(`[${error.code ?? 'ERR'}] ${msg}`);
    }
  },

  /** Elimina definitivamente un crédito (solo si está anulado o saldo = 0) */
  async eliminar(id: string) {
    // Eliminar transacciones asociadas primero (CASCADE también lo hace, pero explicitamos)
    await supabase.from('transacciones').delete().eq('credito_id', id);
    const { error } = await supabase.from('creditos').delete().eq('id', id);
    if (error) throw error;
  },
};

// ═══════════════════════════════════════
// PAGOS DE CRÉDITO
// ═══════════════════════════════════════

export const pagosCreditoApi = {
  /** Obtiene todos los pagos de un crédito, ordenados del más reciente al más antiguo */
  async getByCredito(creditoId: string) {
    const { data, error } = await supabase
      .from('transacciones')
      .select('*')
      .eq('credito_id', creditoId)
      .in('tipo', ['pago_credito', 'abono_capital', 'cancelacion_total'])
      .order('fecha_pago', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const regIds = [...new Set(rows.map((r: any) => r.registrado_por).filter(Boolean))];
    const regMap: Record<string, string> = {};
    if (regIds.length > 0) {
      const { data: usrs } = await supabase.from('usuarios').select('id, nombre').in('id', regIds);
      (usrs || []).forEach((u: any) => { regMap[u.id] = u.nombre; });
    }
    return rows.map((r: any) => ({
      ...r,
      usuarios: r.registrado_por ? { nombre: regMap[r.registrado_por] ?? '' } : null,
    }));
  },

  /** Registra un pago y actualiza el saldo del crédito en una sola operación */
  async registrar(pago: {
    credito_id:      string;
    asociado_id?:    string;
    monto_pagado:    number;
    capital:         number;
    interes:         number;
    saldo_antes:     number;
    saldo_despues:   number;
    num_cuota:       number;
    fecha_pago:      string;
    metodo_pago:     string;
    observacion?:    string;
    registrado_por:  string | null;
    url_comprobante?: string;
  }) {
    // Construir payload solo con columnas seguras (sin asociado_id para evitar
    // conflictos de tipo uuid vs text según cómo esté guardado el crédito)
    const payload: Record<string, unknown> = {
      credito_id:     pago.credito_id,
      monto_pagado:   pago.monto_pagado,
      capital:        pago.capital,
      interes:        pago.interes,
      saldo_antes:    pago.saldo_antes,
      saldo_despues:  pago.saldo_despues,
      num_cuota:      pago.num_cuota,
      fecha_pago:     pago.fecha_pago,
      metodo_pago:    pago.metodo_pago,
      registrado_por: pago.registrado_por,
    };
    if (pago.observacion)    payload.observacion    = pago.observacion;
    if (pago.url_comprobante) payload.url_comprobante = pago.url_comprobante;

    // ── Intentar con RPC SECURITY DEFINER (bypasea RLS) ─────────────────────
    const { data: rpcData, error: rpcError } = await supabase.rpc('registrar_pago_credito', {
      p_credito_id:      pago.credito_id,
      p_monto_pagado:    pago.monto_pagado,
      p_capital:         pago.capital,
      p_interes:         pago.interes,
      p_saldo_antes:     pago.saldo_antes,
      p_saldo_despues:   pago.saldo_despues,
      p_num_cuota:       pago.num_cuota,
      p_fecha_pago:      pago.fecha_pago,
      p_metodo_pago:     pago.metodo_pago,
      p_registrado_por:  pago.registrado_por,
      p_observacion:     pago.observacion    ?? null,
      p_url_comprobante: pago.url_comprobante ?? null,
    });

    // S-08: sin fallback — las operaciones financieras deben ser atómicas en el RPC.
    // Si el RPC falla, propagar el error; nunca bypassear RLS con inserciones directas.
    if (rpcError || !rpcData) {
      throw rpcError ?? new Error(
        'No se pudo registrar el pago. Verifique que el procedimiento `registrar_pago_credito` esté creado en Supabase.'
      );
    }

    return rpcData;
  },
};

// ═══════════════════════════════════════
// EXCEPCIONES
// ═══════════════════════════════════════

export const excepcionesApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('excepciones')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const ids = [...new Set(rows.map((r: any) => r.asociado_id).filter(Boolean))];
    const uMap: Record<string, any> = {};
    if (ids.length > 0) {
      const { data: usrs } = await supabase.from('usuarios').select('id, nombre, cedula').in('id', ids);
      (usrs || []).forEach((u: any) => { uMap[u.id] = u; });
    }
    return rows.map((r: any) => ({ ...r, usuarios: uMap[r.asociado_id] ?? null }));
  },

  async getByAsociado(asociadoId: string) {
    const { data, error } = await supabase
      .from('excepciones')
      .select('*')
      .eq('asociado_id', asociadoId);
    if (error) throw error;
    return data;
  },

  async create(excepcion: DbInsert<ExcepcionRow>) {
    const { data, error } = await supabase
      .from('excepciones')
      .insert(excepcion)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async resolver(id: string, estado: 'aprobada' | 'rechazada', resueltoPor: string) {
    const { data, error } = await supabase
      .from('excepciones')
      .update({ estado, resuelto_por: resueltoPor })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ═══════════════════════════════════════
// DASHBOARD (stats)
// ═══════════════════════════════════════

export const dashboardApi = {
  async getStats() {
    // R-01: intentar con RPC (1 query server-side) en lugar de 9 queries + JS reduce
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats');

    if (!rpcError && rpcData) {
      return {
        totalAsociados:        rpcData.totalAsociados        ?? 0,
        totalUsuarios:         rpcData.totalUsuarios         ?? 0,
        totalCreditos:         rpcData.totalCreditos         ?? 0,
        totalAhorrosPerm:      rpcData.totalAhorrosPerm      ?? 0,
        totalAhorrosVol:       rpcData.totalAhorrosVol       ?? 0,
        totalAhorros:          rpcData.totalAhorros          ?? 0,
        solicitudesPendientes: rpcData.solicitudesPendientes ?? 0,
        liquidacionesPend:     rpcData.liquidacionesPend     ?? 0,
        totalCarteraCreditos:  rpcData.totalCarteraCreditos  ?? 0,
        totalInteresesMes:     rpcData.totalInteresesMes     ?? 0,
      };
    }

    // Fallback: queries individuales si el RPC aún no está creado en Supabase
    console.warn('[dashboardApi] RPC get_dashboard_stats no disponible, usando fallback. Ejecutar supabase_rpc_dashboard_stats.sql');
    const hoy = new Date();
    const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;

    const [
      { count: totalAsociados },
      { count: totalUsuarios },
      { count: totalCreditos },
      { data: ahorrosPerm },
      { data: ahorrosVol },
      { count: solicitudesPend },
      { count: liquidacionesPend },
      { data: carteraData },
      { data: interesesData },
    ] = await Promise.all([
      supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('estado_cuenta', 'activo'),
      supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('creditos').select('*', { count: 'exact', head: true })
        .eq('anulado', false).in('estado', ['activo', 'aprobado', 'desembolsado', 'en_mora']),
      supabase.from('cuentas_ahorro').select('monto_ahorrado').eq('tipo', 'permanente').eq('estado', 'activo').eq('anulado', false),
      supabase.from('cuentas_ahorro').select('monto_ahorrado').eq('tipo', 'voluntario').eq('estado', 'activo').eq('anulado', false),
      supabase.from('solicitudes_asociados').select('*', { count: 'exact', head: true }).in('estado', ['pendiente', 'pendiente_activacion']),
      // R-03: filtro sobre columna real 'estado' (post-migración JSONB→columnas)
      supabase.from('liquidaciones').select('*', { count: 'exact', head: true })
        .not('estado', 'in', '("Pagada","Rechazada","Borrador")'),
      supabase.from('creditos').select('saldo').eq('anulado', false)
        .in('estado', ['activo', 'aprobado', 'desembolsado', 'en_mora']),
      supabase.from('transacciones').select('interes').in('tipo', ['pago_credito','abono_capital']).gte('fecha_pago', inicioMes),
    ]);

    const totalAhorrosPerm     = ahorrosPerm?.reduce((s, a) => s + (a.monto_ahorrado || 0), 0) ?? 0;
    const totalAhorrosVol      = ahorrosVol?.reduce((s, a)  => s + (a.monto_ahorrado || 0), 0) ?? 0;
    const totalCarteraCreditos = carteraData?.reduce((s, c) => s + (c.saldo || 0), 0) ?? 0;
    const totalInteresesMes    = interesesData?.reduce((s, p) => s + (p.interes || 0), 0) ?? 0;

    return {
      totalAsociados:        totalAsociados   ?? 0,
      totalUsuarios:         totalUsuarios    ?? 0,
      totalCreditos:         totalCreditos    ?? 0,
      totalAhorrosPerm,
      totalAhorrosVol,
      totalAhorros:          totalAhorrosPerm + totalAhorrosVol,
      solicitudesPendientes: solicitudesPend  ?? 0,
      liquidacionesPend:     liquidacionesPend ?? 0,
      totalCarteraCreditos,
      totalInteresesMes,
    };
  },

  async getUtilidadesMora() {
    const { data, error } = await supabase
      .from('transacciones')
      .select('id, tipo, monto_mora, fecha_pago, asociado_id')
      .eq('anulado', false)
      .gt('monto_mora', 0);
      
    if (error) throw error;
    
    // Obtener información de los asociados para el historial
    const rows = data ?? [];
    const asocIds = [...new Set(rows.map((r: any) => r.asociado_id).filter(Boolean))];
    const asocMap: Record<string, any> = {};
    if (asocIds.length > 0) {
      const { data: asocs } = await supabase.from('usuarios').select('id, nombre, cedula').in('id', asocIds);
      (asocs || []).forEach((a: any) => { asocMap[a.id] = a; });
    }

    let utilidadCreditos = 0;
    let utilidadAhorros = 0;

    const historial = rows.map((r: any) => {
      if (['pago_credito', 'abono_capital', 'cancelacion_total'].includes(r.tipo)) {
        utilidadCreditos += r.monto_mora || 0;
      } else if (['aporte_permanente', 'aporte_voluntario', 'mora_permanente'].includes(r.tipo)) {
        utilidadAhorros += r.monto_mora || 0;
      }
      return {
        ...r,
        asociado: asocMap[r.asociado_id] ?? null
      };
    }).sort((a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime());

    return {
      utilidadTotal: utilidadCreditos + utilidadAhorros,
      utilidadCreditos,
      utilidadAhorros,
      historial
    };
  }
};
