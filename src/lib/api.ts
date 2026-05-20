// src/lib/api.ts
// ─────────────────────────────────────────────────────────
// Funciones de acceso a datos para cada módulo de UFCA
// Reemplaza los useState con datos mock en cada componente
// ─────────────────────────────────────────────────────────

import { supabase } from './supabase';

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════

export const auth = {
  /** Iniciar sesión con email y contraseña */
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Obtener datos del usuario (rol, asociado vinculado)
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('*, roles(*), asociados(*)')
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
  onAuthChange(callback: (session: any) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },
};

// ═══════════════════════════════════════
// ASOCIADOS
// ═══════════════════════════════════════

export const asociadosApi = {
  /** @deprecated Carga toda la tabla — usar getPaginated() en vistas de lista (R-02) */
  async getAll() {
    // R-05: columnas específicas para listas — omite campos pesados (direccion, motivacion, etc.)
    const { data, error } = await supabase
      .from('asociados')
      .select('id,nombre,cedula,telefono,email,fecha_ingreso,estado,referido_por_id,created_at')
      .order('nombre');
    if (error) throw error;
    return data;
  },

  /**
   * R-02: Versión paginada — no descarga toda la tabla.
   * @param page      Página actual (base 0)
   * @param pageSize  Registros por página (default 20)
   * @param search    Texto para filtrar por nombre o cédula
   * @param estado    Filtro por estado ('activo' | 'inactivo' | undefined = todos)
   */
  async getPaginated(
    page     = 0,
    pageSize = 20,
    search   = '',
    estado?: string,
  ) {
    let query = supabase
      .from('asociados')
      .select('id,nombre,cedula,telefono,email,fecha_ingreso,estado,referido_por_id', { count: 'exact' })
      .order('nombre')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (search.trim()) {
      query = query.or(`nombre.ilike.%${search.trim()}%,cedula.ilike.%${search.trim()}%`);
    }
    if (estado) {
      query = query.eq('estado', estado);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, pageSize };
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('asociados')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(asociado: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('asociados')
      .insert(asociado)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<any>) {
    const { data, error } = await supabase
      .from('asociados')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleEstado(id: string, estado: boolean) {
    return asociadosApi.update(id, { estado });
  },

  async delete(id: string) {
    const { error } = await supabase.from('asociados').delete().eq('id', id);
    if (error) throw error;
  },

  async getReferidos(asociadoId: string) {
    const { data, error } = await supabase
      .from('asociados')
      .select('id, nombre, cedula, telefono, fecha_ingreso, estado')
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
      .from('ahorros_permanentes')
      .select('*, asociados(nombre, cedula)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByAsociado(asociadoId: string) {
    const { data, error } = await supabase
      .from('ahorros_permanentes')
      .select('*')
      .eq('asociado_id', asociadoId);
    if (error) throw error;
    return data;
  },

  async create(ahorro: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('ahorros_permanentes')
      .insert(ahorro)
      .select('*, asociados(nombre, cedula)')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<any>) {
    const { data, error } = await supabase
      .from('ahorros_permanentes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async anular(id: string, motivo: string): Promise<any> {
    return ahorroPermanenteApi.update(id, { anulado: true, estado: 'cerrado', motivo_anulacion: motivo });
  },
};

// ═══════════════════════════════════════
// AHORRO VOLUNTARIO
// ═══════════════════════════════════════

export const ahorroVoluntarioApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('ahorros_voluntarios')
      .select('*, asociados(nombre, cedula)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByAsociado(asociadoId: string) {
    const { data, error } = await supabase
      .from('ahorros_voluntarios')
      .select('*')
      .eq('asociado_id', asociadoId);
    if (error) throw error;
    return data;
  },

  async create(ahorro: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('ahorros_voluntarios')
      .insert(ahorro)
      .select('*, asociados(nombre, cedula)')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<any>) {
    const { data, error } = await supabase
      .from('ahorros_voluntarios')
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
      .select('*, asociados(nombre, cedula)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByAsociado(asociadoId: string) {
    const { data, error } = await supabase
      .from('creditos')
      .select('*')
      .eq('asociado_id', asociadoId);
    if (error) throw error;
    return data;
  },

  async create(credito: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('creditos')
      .insert(credito)
      .select('*, asociados(nombre, cedula)')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<any>) {
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
    // Eliminar pagos asociados primero (CASCADE también lo hace, pero explicitamos)
    await supabase.from('pagos_credito').delete().eq('credito_id', id);
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
      .from('pagos_credito')
      .select('*, usuarios!registrado_por(nombre)')
      .eq('credito_id', creditoId)
      .order('fecha_pago', { ascending: false });
    if (error) throw error;
    return data ?? [];
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
    const payload: Record<string, any> = {
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
// A-05: MÓDULOS NO IMPLEMENTADOS
// Movidos a src/lib/api.unimplemented.ts
// Importar desde allí cuando se activen las vistas correspondientes
// ═══════════════════════════════════════
export { productosApi, categoriasApi, proveedoresApi, ventasApi, comprasApi, pedidosApi, eventosApi } from './api.unimplemented';

// ═══════════════════════════════════════
// EXCEPCIONES
// ═══════════════════════════════════════

export const excepcionesApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('excepciones')
      .select('*, asociados(nombre, cedula)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByAsociado(asociadoId: string) {
    const { data, error } = await supabase
      .from('excepciones')
      .select('*')
      .eq('asociado_id', asociadoId);
    if (error) throw error;
    return data;
  },

  async create(excepcion: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
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
      supabase.from('asociados').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
      supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('creditos').select('*', { count: 'exact', head: true })
        .eq('anulado', false).in('estado', ['activo', 'aprobado', 'desembolsado', 'en_mora']),
      supabase.from('ahorros_permanentes').select('monto_ahorrado').eq('estado', 'activo').eq('anulado', false),
      supabase.from('ahorros_voluntarios').select('monto_ahorrado').eq('estado', 'activo').eq('anulado', false),
      supabase.from('solicitudes_asociados').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('liquidaciones').select('*', { count: 'exact', head: true })
        .not('detalle->>estado', 'in', '("Pagada","Rechazada","Borrador")'),
      supabase.from('creditos').select('saldo').eq('anulado', false)
        .in('estado', ['activo', 'aprobado', 'desembolsado', 'en_mora']),
      supabase.from('pagos_credito').select('interes').gte('fecha_pago', inicioMes),
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
};
