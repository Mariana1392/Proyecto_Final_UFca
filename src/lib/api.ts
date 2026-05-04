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
  async getAll() {
    const { data, error } = await supabase
      .from('asociados')
      .select('*')
      .order('nombre');
    if (error) throw error;
    return data;
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
      .select('*')
      .eq('referido_por_id', asociadoId);
    if (error) throw error;
    return data;
  },
};

// ═══════════════════════════════════════
// AHORRO PERMANENTE
// ═══════════════════════════════════════

export const ahorroPermanenteApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('ahorro_permanente')
      .select('*, asociados(nombre, cedula)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByAsociado(asociadoId: string) {
    const { data, error } = await supabase
      .from('ahorro_permanente')
      .select('*')
      .eq('asociado_id', asociadoId);
    if (error) throw error;
    return data;
  },

  async create(ahorro: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('ahorro_permanente')
      .insert(ahorro)
      .select('*, asociados(nombre, cedula)')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<any>) {
    const { data, error } = await supabase
      .from('ahorro_permanente')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async anular(id: string, motivo: string) {
    return ahorroPermanenteApi.update(id, { anulado: true, estado: false, motivo_anulacion: motivo });
  },
};

// ═══════════════════════════════════════
// AHORRO VOLUNTARIO
// ═══════════════════════════════════════

export const ahorroVoluntarioApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('ahorro_voluntario')
      .select('*, asociados(nombre, cedula)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByAsociado(asociadoId: string) {
    const { data, error } = await supabase
      .from('ahorro_voluntario')
      .select('*')
      .eq('asociado_id', asociadoId);
    if (error) throw error;
    return data;
  },

  async create(ahorro: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('ahorro_voluntario')
      .insert(ahorro)
      .select('*, asociados(nombre, cedula)')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<any>) {
    const { data, error } = await supabase
      .from('ahorro_voluntario')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async anular(id: string, motivo: string) {
    return ahorroVoluntarioApi.update(id, { anulado: true, estado: false, motivo_anulacion: motivo });
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

  async anular(id: string, motivo: string) {
    // Usamos solo las columnas que siempre existen en el schema base.
    // Sin .select().single() para evitar fallos de RLS en el SELECT posterior.
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
      .select('*')
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
    registrado_por:  string;
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

    if (!rpcError && rpcData) return rpcData;

    // ── Fallback: inserción directa + actualización (requiere permisos RLS) ──
    const { data, error } = await supabase
      .from('pagos_credito')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    const updatePayload: any = { saldo: Math.max(0, pago.saldo_despues) };
    if (pago.saldo_despues <= 0) {
      updatePayload.estado               = 'pagado';
      updatePayload.fecha_estado_cambio  = new Date().toISOString();
      updatePayload.motivo_estado_cambio = 'Crédito pagado en su totalidad';
    }
    // Actualizar saldo — si RLS lo bloquea fuerza igual el saldo local
    await supabase.from('creditos').update(updatePayload).eq('id', pago.credito_id);

    return data;
  },
};

// ═══════════════════════════════════════
// PRODUCTOS
// ═══════════════════════════════════════

export const productosApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('productos')
      .select('*, categorias(nombre), proveedores(nombre)')
      .order('nombre');
    if (error) throw error;
    return data;
  },

  async create(producto: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('productos')
      .insert(producto)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<any>) {
    const { data, error } = await supabase
      .from('productos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) throw error;
  },
};

// ═══════════════════════════════════════
// CATEGORÍAS
// ═══════════════════════════════════════

export const categoriasApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nombre');
    if (error) throw error;
    return data;
  },

  async create(categoria: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('categorias')
      .insert(categoria)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<any>) {
    const { data, error } = await supabase
      .from('categorias')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (error) throw error;
  },
};

// ═══════════════════════════════════════
// PROVEEDORES
// ═══════════════════════════════════════

export const proveedoresApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre');
    if (error) throw error;
    return data;
  },

  async create(proveedor: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('proveedores')
      .insert(proveedor)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<any>) {
    const { data, error } = await supabase
      .from('proveedores')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from('proveedores').delete().eq('id', id);
    if (error) throw error;
  },
};

// ═══════════════════════════════════════
// VENTAS
// ═══════════════════════════════════════

export const ventasApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('ventas')
      .select('*, asociados(nombre), ventas_detalle(*, productos(nombre))')
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(venta: any, detalle: any[]) {
    // Insertar venta principal
    const { data: ventaData, error: ventaError } = await supabase
      .from('ventas')
      .insert(venta)
      .select()
      .single();
    if (ventaError) throw ventaError;

    // Insertar detalle con el id de la venta
    const detalleConId = detalle.map(d => ({ ...d, venta_id: ventaData.id }));
    const { error: detalleError } = await supabase
      .from('ventas_detalle')
      .insert(detalleConId);
    if (detalleError) throw detalleError;

    return ventaData;
  },

  async anular(id: string, motivo: string, anuladoPor: string) {
    const { data, error } = await supabase
      .from('ventas')
      .update({
        estado:           'anulada',
        motivo_anulacion: motivo,
        anulado_at:       new Date().toISOString(),
        anulado_por:      anuladoPor,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ═══════════════════════════════════════
// COMPRAS
// ═══════════════════════════════════════

export const comprasApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('compras')
      .select('*, proveedores(nombre), compras_detalle(*, productos(nombre))')
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(compra: any, detalle: any[]) {
    const { data: compraData, error: compraError } = await supabase
      .from('compras')
      .insert(compra)
      .select()
      .single();
    if (compraError) throw compraError;

    const detalleConId = detalle.map(d => ({ ...d, compra_id: compraData.id }));
    const { error: detalleError } = await supabase
      .from('compras_detalle')
      .insert(detalleConId);
    if (detalleError) throw detalleError;

    return compraData;
  },

  async update(id: string, updates: Partial<any>) {
    const { data, error } = await supabase
      .from('compras')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ═══════════════════════════════════════
// PEDIDOS
// ═══════════════════════════════════════

export const pedidosApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, asociados(nombre, cedula), pedidos_detalle(*, productos(nombre))')
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByAsociado(asociadoId: string) {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, pedidos_detalle(*, productos(nombre))')
      .eq('asociado_id', asociadoId);
    if (error) throw error;
    return data;
  },

  async create(pedido: any, detalle: any[]) {
    const { data: pedidoData, error: pedidoError } = await supabase
      .from('pedidos')
      .insert(pedido)
      .select()
      .single();
    if (pedidoError) throw pedidoError;

    const detalleConId = detalle.map(d => ({ ...d, pedido_id: pedidoData.id }));
    const { error: detalleError } = await supabase
      .from('pedidos_detalle')
      .insert(detalleConId);
    if (detalleError) throw detalleError;

    return pedidoData;
  },

  async updateEstado(id: string, estado: string) {
    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Si el estado queda en pagado, registrar automáticamente una venta
    try {
      if (typeof estado === 'string' && estado === 'pagado') {
        const { data: pedidoWithDet, error: pedDetErr } = await supabase
          .from('pedidos')
          .select('*, pedidos_detalle(*, productos(nombre))')
          .eq('id', id)
          .maybeSingle();

        if (!pedidoWithDet || pedDetErr) {
          // No hay datos suficientes para generar la venta; salir sin error crítico
          return data;
        }

        // Crear venta — usando los campos reales de la tabla ventas
        const ventaPayload: any = {
          asociado_id: pedidoWithDet.asociado_id ?? null,
          evento_id:   pedidoWithDet.evento_id   ?? null,
          fecha:       new Date().toISOString().split('T')[0],
          subtotal:    pedidoWithDet.total ?? 0,
          descuento:   0,
          total:       pedidoWithDet.total ?? 0,
          estado:      'completada',
          metodo_pago: null,
          notas:       `Generada automáticamente desde pedido PED-${id.slice(0, 8).toUpperCase()}${pedidoWithDet.notas ? ` · ${pedidoWithDet.notas}` : ''}`,
        };

        const { data: ventaData, error: ventaErr } = await supabase
          .from('ventas')
          .insert(ventaPayload)
          .select()
          .single();

        if (ventaErr) throw new Error('Error al crear venta: ' + ventaErr.message);

        // Insertar detalles de la venta
        const detalles = (pedidoWithDet.pedidos_detalle || []).map((d: any) => ({
          venta_id:        ventaData.id,
          producto_id:     d.producto_id,
          cantidad:        d.cantidad ?? 0,
          precio_unitario: d.precio_unitario ?? 0,
          subtotal:        d.subtotal ?? (d.cantidad ?? 0) * (d.precio_unitario ?? 0),
        }));
        if (detalles.length > 0) {
          const { error: detErr } = await supabase.from('ventas_detalle').insert(detalles);
          if (detErr) throw new Error('Error al crear detalle de venta: ' + detErr.message);
        }
      }
    } catch (err: any) {
      // Relanzar para que el componente muestre el error al usuario
      throw err;
    }

    return data;
  },
};

// ═══════════════════════════════════════
// EVENTOS
// ═══════════════════════════════════════

export const eventosApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('eventos')
      .select('*, eventos_inscritos(count)')
      .order('fecha', { ascending: true });
    if (error) throw error;
    return data;
  },

  async create(evento: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
    // Intentar con RPC SECURITY DEFINER (bypasea RLS e inscribe asociados automáticamente)
    const { data: rpcData, error: rpcError } = await supabase.rpc('crear_evento_con_inscritos', {
      p_titulo:      evento.titulo,
      p_descripcion: evento.descripcion ?? '',
      p_fecha:       evento.fecha,
      p_lugar:       evento.lugar ?? '',
      p_capacidad:   evento.capacidad ?? 0,
      p_estado:      evento.estado ?? 'programado',
    });

    if (!rpcError && rpcData) return rpcData;

    // Fallback: insert directo + inscribir asociados manualmente
    const { data, error } = await supabase
      .from('eventos')
      .insert(evento)
      .select()
      .single();
    if (error) throw error;

    // Inscribir todos los asociados activos al evento recién creado
    const { data: asociados } = await supabase
      .from('asociados')
      .select('id')
      .eq('estado', true)
      .eq('anulado', false);

    if (asociados && asociados.length > 0) {
      const inscritos = asociados.map((a: any) => ({
        evento_id:   data.id,
        asociado_id: a.id,
      }));
      await supabase.from('eventos_inscritos').insert(inscritos);
    }

    return data;
  },

  async update(id: string, updates: Partial<any>) {
    const { data, error } = await supabase
      .from('eventos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async inscribir(eventoId: string, asociadoId: string) {
    const { data, error } = await supabase
      .from('eventos_inscritos')
      .insert({ evento_id: eventoId, asociado_id: asociadoId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async desinscribir(eventoId: string, asociadoId: string) {
    const { error } = await supabase
      .from('eventos_inscritos')
      .delete()
      .eq('evento_id', eventoId)
      .eq('asociado_id', asociadoId);
    if (error) throw error;
  },
};

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
    // Inicio del mes actual para intereses
    const hoy = new Date();
    const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;

    const [
      { count: totalAsociados },
      { count: totalUsuarios },
      { count: totalCreditos },
      { data: ahorrosPerm },
      { data: ahorrosVol },
      { count: totalPedidos },
      { count: solicitudesPend },
      { count: liquidacionesPend },
      { data: carteraData },
      { data: interesesData },
    ] = await Promise.all([
      // Asociados activos (estado es string 'activo')
      supabase.from('asociados').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
      // Usuarios con cuenta activa
      supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('activo', true),
      // Créditos activos (no anulados, en estados productivos)
      supabase.from('creditos').select('*', { count: 'exact', head: true })
        .eq('anulado', false)
        .in('estado', ['activo', 'aprobado', 'desembolsado', 'en_mora']),
      // Suma de ahorros permanentes activos
      supabase.from('ahorro_permanente').select('monto_ahorrado').eq('estado', true).eq('anulado', false),
      // Suma de ahorros voluntarios activos
      supabase.from('ahorro_voluntario').select('monto_ahorrado').eq('estado', true).eq('anulado', false),
      // Pedidos pendientes
      supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      // Solicitudes de asociación pendientes
      supabase.from('solicitudes').select('*', { count: 'exact', head: true }).eq('tipo', 'afiliacion').eq('estado', 'pendiente'),
      // Liquidaciones en proceso (no pagadas ni rechazadas)
      supabase.from('liquidaciones').select('*', { count: 'exact', head: true })
        .not('detalle->>estado', 'in', '("Pagada","Rechazada","Borrador")'),
      // Cartera activa: saldo total que los asociados deben al negocio
      supabase.from('creditos').select('saldo')
        .eq('anulado', false)
        .in('estado', ['activo', 'aprobado', 'desembolsado', 'en_mora']),
      // Intereses cobrados este mes
      supabase.from('pagos_credito').select('interes').gte('fecha_pago', inicioMes),
    ]);

    const totalAhorrosPerm     = ahorrosPerm?.reduce((s, a) => s + (a.monto_ahorrado || 0), 0) ?? 0;
    const totalAhorrosVol      = ahorrosVol?.reduce((s, a)  => s + (a.monto_ahorrado || 0), 0) ?? 0;
    const totalCarteraCreditos = carteraData?.reduce((s, c) => s + (c.saldo || 0), 0) ?? 0;
    const totalInteresesMes    = interesesData?.reduce((s, p) => s + (p.interes || 0), 0) ?? 0;

    return {
      totalAsociados:        totalAsociados  ?? 0,
      totalUsuarios:         totalUsuarios   ?? 0,
      totalCreditos:         totalCreditos   ?? 0,
      totalAhorrosPerm,
      totalAhorrosVol,
      totalAhorros:          totalAhorrosPerm + totalAhorrosVol,
      pedidosPendientes:     totalPedidos    ?? 0,
      solicitudesPendientes: solicitudesPend ?? 0,
      liquidacionesPend:     liquidacionesPend ?? 0,
      totalCarteraCreditos,
      totalInteresesMes,
    };
  },
};
