// =============================================================================
// api.unimplemented.ts
// A-05: Módulos de API para funcionalidades no activadas en la UI actual.
// Estos módulos NO tienen vistas en App.tsx ni permisos asignados en BD.
// Mover de vuelta a api.ts cuando se implementen sus respectivas vistas.
// =============================================================================

import { supabase } from './supabase';

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
    const { data: ventaData, error: ventaError } = await supabase
      .from('ventas')
      .insert(venta)
      .select()
      .single();
    if (ventaError) throw ventaError;

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
    const { data: rpcData, error: rpcError } = await supabase.rpc('crear_evento_con_inscritos', {
      p_titulo:      evento.titulo,
      p_descripcion: evento.descripcion ?? '',
      p_fecha:       evento.fecha,
      p_lugar:       evento.lugar ?? '',
      p_capacidad:   evento.capacidad ?? 0,
      p_estado:      evento.estado ?? 'programado',
    });
    if (!rpcError && rpcData) return rpcData;

    const { data, error } = await supabase
      .from('eventos')
      .insert(evento)
      .select()
      .single();
    if (error) throw error;
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
