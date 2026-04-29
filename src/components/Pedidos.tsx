import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Search, Filter, Plus, Eye, ChevronLeft, ChevronRight, ShoppingBag, Edit, Trash2, Package, XCircle, FileText, History, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';

import { supabase } from '../lib/supabase';
import { pedidosApi } from '../lib/api';

interface PedidosProps {
  userRole?: 'admin' | 'asociado' | null;
}

export default function Pedidos({ userRole }: PedidosProps) {
  const [searchTerm, setSearchTerm]                     = useState('');
  const [currentPage, setCurrentPage]                   = useState(1);
  const [currentPageAnulados, setCurrentPageAnulados]   = useState(1);
  const [isDetailModalOpen, setIsDetailModalOpen]       = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen]         = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]     = useState(false);
  const [selectedPedido, setSelectedPedido]             = useState<any>(null);
  const itemsPerPage = 10;

  const [pedidos, setPedidos]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [guardando, setGuardando]       = useState(false);
  const [isNuevoPedidoOpen, setIsNuevoPedidoOpen] = useState(false);
  const [detalleProductos, setDetalleProductos]       = useState<any[]>([]);
  const [loadingDetalle, setLoadingDetalle]           = useState(false);
  const [isConfirmPagoOpen, setIsConfirmPagoOpen]     = useState(false);
  const [pedidoPendientePago, setPedidoPendientePago] = useState<any>(null);

  // Filtros
  const [showFiltros, setShowFiltros]   = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroEvento, setFiltroEvento] = useState('');
  const [filtroDesde, setFiltroDesde]   = useState('');
  const [filtroHasta, setFiltroHasta]   = useState('');

  // Auditoría del detalle
  const [auditoriaLogs, setAuditoriaLogs]       = useState<any[]>([]);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);

  // Editor de pedido
  const [editItems, setEditItems]               = useState<{ producto_id: string; nombre: string; cantidad: number; precio_unitario: number }[]>([]);
  const [editNotas, setEditNotas]               = useState('');
  const [editEventoId, setEditEventoId]         = useState('');
  const [editProdSelId, setEditProdSelId]       = useState('');
  const [editCantidad, setEditCantidad]         = useState(1);
  const [loadingEdit, setLoadingEdit]           = useState(false);
  const [guardandoEdit, setGuardandoEdit]       = useState(false);

  // Catálogos
  const [catalogoAsociados, setCatalogoAsociados] = useState<any[]>([]);
  const [catalogoProductos, setCatalogoProductos] = useState<any[]>([]);
  const [catalogoEventos, setCatalogoEventos]     = useState<any[]>([]);

  // Formulario nuevo pedido
  const emptyPedido = { asociado_id: '', evento_id: '', fechaRequerida: '', notas: '' };
  const [formPedido, setFormPedido]   = useState(emptyPedido);

  // ── CORRECCIÓN 1: el ítem del carrito ahora incluye precio_unitario ────────
  const [itemsPedido, setItemsPedido] = useState<{
    producto_id: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;   // ← agregado
  }[]>([]);

  const [productoSelId, setProductoSelId] = useState('');
  const [cantidadItem, setCantidadItem]   = useState(1);

  useEffect(() => { cargarTodo(); }, []);

  async function cargarTodo() {
    setLoading(true);
    try {
      const [{ data: asoc }, { data: prods }, { data: evts }, { data: peds, error: pedErr }] = await Promise.all([
        supabase.from('asociados').select('id, nombre').eq('estado', 'activo').order('nombre'),
        supabase.from('productos').select('id, nombre, precio_venta').order('nombre'),
        supabase.from('eventos').select('id, titulo, fecha').neq('estado', 'cancelado').order('fecha', { ascending: false }),
        supabase.from('pedidos').select(`*, asociados(nombre), pedidos_detalle(cantidad, precio_unitario, subtotal, productos(nombre))`).order('fecha', { ascending: false }),
      ]);
      if (pedErr) throw pedErr;

      const eventosLista = evts || [];
      setCatalogoAsociados(asoc || []);
      setCatalogoProductos(prods || []);
      setCatalogoEventos(eventosLista);

      const mapeados = (peds || []).map((p: any) => {
        const detalle   = p.pedidos_detalle || [];
        const cantTotal = detalle.reduce((s: number, d: any) => s + (d.cantidad || 0), 0);
        return {
          id:          p.id,
          numero:      `PED-${p.id.slice(0, 8).toUpperCase()}`,
          cliente:     p.asociados?.nombre ?? 'Sin nombre',
          asociado_id: p.asociado_id,
          evento_id:   p.evento_id ?? null,
          evento:      eventosLista.find((e: any) => e.id === p.evento_id)?.titulo ?? null,
          fecha:       p.fecha,
          productos:   cantTotal,
          total:       p.total,
          estado:      p.estado ?? 'pendiente',
          metodoPago:  p.notas ?? 'Transferencia',
          anulado:     p.estado === 'anulado',
          detalle,
        };
      });
      setPedidos(mapeados);
    } catch (err: any) {
      toast.error('Error al cargar pedidos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function cargarCatalogos() {
    const [{ data: asoc }, { data: prods }, { data: evts }] = await Promise.all([
      supabase.from('asociados').select('id, nombre').eq('estado', 'activo').order('nombre'),
      supabase.from('productos').select('id, nombre, precio_venta').order('nombre'),
      supabase.from('eventos').select('id, titulo, fecha').neq('estado', 'cancelado').order('fecha', { ascending: false }),
    ]);
    setCatalogoAsociados(asoc || []);
    setCatalogoProductos(prods || []);
    setCatalogoEventos(evts || []);
  }

  function agregarItemPedido() {
    if (!productoSelId) { toast.error('Selecciona un producto'); return; }
    if (cantidadItem <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }

    const prod = catalogoProductos.find(p => p.id === productoSelId);
    if (!prod) return;

    const existe = itemsPedido.find(i => i.producto_id === productoSelId);
    if (existe) {
      setItemsPedido(prev => prev.map(i =>
        i.producto_id === productoSelId
          ? { ...i, cantidad: i.cantidad + cantidadItem }
          : i
      ));
    } else {
      // ── CORRECCIÓN 3: guardar precio_unitario al agregar al carrito ─────────
      setItemsPedido(prev => [...prev, {
        producto_id:     prod.id,
        nombre:          prod.nombre,
        cantidad:        cantidadItem,
        precio_unitario: prod.precio_venta ?? 0,   // ← agregado
      }]);
    }
    setProductoSelId('');
    setCantidadItem(1);
  }

  async function handleGuardarPedido() {
    if (!formPedido.asociado_id) { toast.error('Selecciona un asociado'); return; }
    if (itemsPedido.length === 0) { toast.error('Agrega al menos un producto'); return; }
    if (itemsPedido.some(i => i.cantidad <= 0)) {
      toast.error('La cantidad de cada producto debe ser mayor a 0');
      return;
    }

    setGuardando(true);
    try {
      const { data: pedidoData, error: pedErr } = await supabase
        .from('pedidos')
        .insert({
          asociado_id: formPedido.asociado_id,
          evento_id:   formPedido.evento_id || null,
          estado:      'pendiente',
          fecha:       new Date().toISOString().split('T')[0],
          notas:       formPedido.notas || null,
        })
        .select()
        .single();
      if (pedErr) throw pedErr;

      // ── CORRECCIÓN 4: incluir precio_unitario y subtotal en el detalle ───────
      const detalle = itemsPedido.map(i => ({
        pedido_id:       pedidoData.id,
        producto_id:     i.producto_id,
        cantidad:        i.cantidad,
        precio_unitario: i.precio_unitario ?? 0,              // asegurar valor no nulo
        subtotal:        (i.cantidad ?? 0) * (i.precio_unitario ?? 0), // calcular robustamente
      }));

      const { error: detErr } = await supabase.from('pedidos_detalle').insert(detalle);
      if (detErr) throw detErr;

      // Actualizar el total del pedido en la cabecera usando los detalles calculados
      const totalPedido = (itemsPedido.reduce((s, it) => s + ((it.cantidad ?? 0) * (it.precio_unitario ?? 0)), 0)) || 0;
      await supabase.from('pedidos').update({ total: totalPedido }).eq('id', pedidoData.id);

      await registrarAuditoria(pedidoData.id, formPedido.asociado_id, 'CREAR', `Pedido PED-${pedidoData.id.slice(0,8).toUpperCase()} creado con ${itemsPedido.length} producto(s). Total: $${totalPedido}`);
      toast.success('Pedido registrado exitosamente');
      setIsNuevoPedidoOpen(false);
      setFormPedido(emptyPedido);
      setItemsPedido([]);
      cargarTodo();
    } catch (err: any) {
      toast.error('Error al registrar pedido: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }


  const pedidosActivos  = pedidos.filter(p => !p.anulado);
  const filteredPedidos = pedidosActivos.filter(p => {
    const matchSearch  = p.numero.toLowerCase().includes(searchTerm.toLowerCase()) || p.cliente.toLowerCase().includes(searchTerm.toLowerCase());
    const matchEstado  = !filtroEstado  || p.estado === filtroEstado;
    const matchEvento  = !filtroEvento  || p.evento_id === filtroEvento;
    const matchDesde   = !filtroDesde   || p.fecha >= filtroDesde;
    const matchHasta   = !filtroHasta   || p.fecha <= filtroHasta;
    return matchSearch && matchEstado && matchEvento && matchDesde && matchHasta;
  });

  const pedidosAnulados         = pedidos.filter(p => p.anulado);
  const filteredPedidosAnulados = pedidosAnulados.filter(p =>
    p.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cliente.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hayFiltrosActivos = filtroEstado || filtroEvento || filtroDesde || filtroHasta;
  const limpiarFiltros = () => { setFiltroEstado(''); setFiltroEvento(''); setFiltroDesde(''); setFiltroHasta(''); };

  const totalPages      = Math.ceil(filteredPedidos.length / itemsPerPage);
  const startIndex      = (currentPage - 1) * itemsPerPage;
  const endIndex        = startIndex + itemsPerPage;
  const currentPedidos  = filteredPedidos.slice(startIndex, endIndex);

  const totalPagesAnulados     = Math.ceil(filteredPedidosAnulados.length / itemsPerPage);
  const startIndexAnulados     = (currentPageAnulados - 1) * itemsPerPage;
  const endIndexAnulados       = startIndexAnulados + itemsPerPage;
  const currentPedidosAnulados = filteredPedidosAnulados.slice(startIndexAnulados, endIndexAnulados);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const getEstadoColor = (estado: string) => {
    const c: Record<string, string> = {
      'pagado':    'bg-emerald-100 text-emerald-700',
      'pendiente': 'bg-amber-100 text-amber-700',
      'anulado':   'bg-red-100 text-red-700',
    };
    return c[estado] || 'bg-slate-100 text-slate-700';
  };

  const handleAnular = async () => {
    if (!selectedPedido) return;
    try {
      await pedidosApi.updateEstado(selectedPedido.id, 'anulado');
      await registrarAuditoria(selectedPedido.id, selectedPedido.asociado_id, 'ANULAR', `Pedido ${selectedPedido.numero} anulado`);
      setPedidos(prev => prev.map(p => p.id === selectedPedido.id ? { ...p, anulado: true } : p));
      toast.success(`Pedido "${selectedPedido.numero}" anulado exitosamente`);
    } catch (err: any) {
      toast.error('Error al anular pedido: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedPedido(null);
  };

  async function abrirEditarPedido(pedido: any) {
    setSelectedPedido(pedido);
    setIsEditDialogOpen(true);
    setEditItems([]);
    setEditNotas(pedido.metodoPago === 'Transferencia' ? '' : pedido.metodoPago ?? '');
    setEditEventoId(pedido.evento_id ?? '');
    setEditProdSelId('');
    setEditCantidad(1);
    setLoadingEdit(true);
    try {
      const { data, error } = await supabase
        .from('pedidos_detalle')
        .select('producto_id, cantidad, precio_unitario, productos(nombre)')
        .eq('pedido_id', pedido.id);
      if (error) throw error;
      setEditItems((data || []).map((d: any) => ({
        producto_id:     d.producto_id,
        nombre:          d.productos?.nombre ?? 'Producto',
        cantidad:        d.cantidad,
        precio_unitario: d.precio_unitario,
      })));
    } catch (err: any) {
      toast.error('Error al cargar productos: ' + err.message);
    } finally {
      setLoadingEdit(false);
    }
  }

  async function handleGuardarEdicion() {
    if (!selectedPedido) return;
    if (editItems.length === 0) { toast.error('Agrega al menos un producto'); return; }
    if (editItems.some(i => i.cantidad <= 0)) { toast.error('Las cantidades deben ser mayores a 0'); return; }

    setGuardandoEdit(true);
    try {
      const nuevoTotal = editItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);

      // 1. Eliminar detalles anteriores e insertar los nuevos
      const { error: delErr } = await supabase.from('pedidos_detalle').delete().eq('pedido_id', selectedPedido.id);
      if (delErr) throw delErr;

      const nuevosDetalles = editItems.map(i => ({
        pedido_id:       selectedPedido.id,
        producto_id:     i.producto_id,
        cantidad:        i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal:        i.cantidad * i.precio_unitario,
      }));
      const { error: insErr } = await supabase.from('pedidos_detalle').insert(nuevosDetalles);
      if (insErr) throw insErr;

      // 2. Actualizar cabecera del pedido
      const { error: updErr } = await supabase.from('pedidos').update({
        total:     nuevoTotal,
        evento_id: editEventoId || null,
        notas:     editNotas || null,
      }).eq('id', selectedPedido.id);
      if (updErr) throw updErr;

      // 3. Auditoría
      await registrarAuditoria(selectedPedido.id, selectedPedido.asociado_id, 'EDITAR',
        `Pedido editado. Productos: ${editItems.length}, nuevo total: $${nuevoTotal.toLocaleString('es-CO')}`);

      toast.success('Pedido actualizado correctamente');
      setIsEditDialogOpen(false);
      setSelectedPedido(null);
      cargarTodo();
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setGuardandoEdit(false);
    }
  }

  // ── Auditoría: registrar acción sobre un pedido ──────────────────────────
  async function registrarAuditoria(pedidoId: string, asociadoId: string | null, accion: string, detalle: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('auditoria').insert({
        tabla:       'pedidos',
        registro_id: pedidoId,
        asociado_id: asociadoId ?? null,
        usuario_id:  user?.id ?? null,
        accion,
        detalle,
      });
    } catch { /* No interrumpir el flujo si falla la auditoría */ }
  }

  // CA_95_02 — consulta fresca a Supabase al abrir el detalle
  async function abrirDetallePedido(pedido: any) {
    setSelectedPedido(pedido);
    setIsDetailModalOpen(true);
    setDetalleProductos([]);
    setAuditoriaLogs([]);
    setLoadingDetalle(true);
    setLoadingAuditoria(true);
    try {
      const [{ data: prods, error: prodErr }, { data: logs, error: logErr }] = await Promise.all([
        supabase.from('pedidos_detalle').select('cantidad, precio_unitario, subtotal, productos(nombre)').eq('pedido_id', pedido.id),
        supabase.from('auditoria').select('accion, detalle, created_at, usuario_id').eq('registro_id', pedido.id).order('created_at', { ascending: false }),
      ]);
      if (prodErr) throw prodErr;
      if (logErr) throw logErr;
      setDetalleProductos(prods || []);
      setAuditoriaLogs(logs || []);
    } catch (err: any) {
      toast.error('Error al cargar detalle del pedido: ' + err.message);
    } finally {
      setLoadingDetalle(false);
      setLoadingAuditoria(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  const renderTable = (pedidosList: any[], isAnulados: boolean = false) => (
    <>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Asociado</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Método de pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidosList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                  {isAnulados ? 'No hay pedidos anulados' : 'No hay pedidos registrados'}
                </TableCell>
              </TableRow>
            ) : (
              pedidosList.map((pedido) => (
                <TableRow key={pedido.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {pedido.numero}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isAnulados ? 'bg-slate-100' : 'bg-indigo-100'}`}>
                        <ShoppingBag className={`size-4 ${isAnulados ? 'text-slate-600' : 'text-indigo-600'}`} />
                      </div>
                      <p className="text-slate-900">{pedido.cliente}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {pedido.evento
                      ? <Badge variant="outline" className="text-indigo-700 border-indigo-200 bg-indigo-50">{pedido.evento}</Badge>
                      : <span className="text-slate-400 text-sm">—</span>
                    }
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{pedido.fecha}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                      {pedido.productos} items
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-900">{formatCurrency(pedido.total)}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{pedido.metodoPago}</Badge>
                  </TableCell>
                  <TableCell>
                    {isAnulados ? (
                      <Badge className="bg-red-100 text-red-700">Anulado</Badge>
                    ) : pedido.estado === 'pagado' ? (
                      // Pagado es estado final — no se puede revertir
                      <Badge className="bg-emerald-100 text-emerald-700">Pagado</Badge>
                    ) : (
                      <Select
                        value={pedido.estado}
                        onValueChange={(value: string) => {
                          if (value === 'pagado') {
                            // Guardar pedido y abrir confirmación
                            setPedidoPendientePago(pedido);
                            setIsConfirmPagoOpen(true);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendiente">Pendiente</SelectItem>
                          <SelectItem value="pagado">Pagado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirDetallePedido(pedido)}
                        title="Ver detalles"
                      >
                        <Eye className="size-4" />
                      </Button>
                      {!isAnulados && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => abrirEditarPedido(pedido)}
                            title="Editar pedido"
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setSelectedPedido(pedido); setIsDeleteDialogOpen(true); }}
                            title="Anular pedido"
                          >
                            <Trash2 className="size-4 text-amber-600" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast.info('Generación de PDF de pedidos próximamente')}
                        title="Descargar comprobante"
                        className="hover:bg-emerald-50"
                      >
                        <FileText className="size-4 text-emerald-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Gestión de Pedidos</h1>
            <p className="text-slate-600">Administra los pedidos de los asociados</p>
          </div>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsNuevoPedidoOpen(true)}>
            <Plus className="size-4" />
            Nuevo pedido
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Lista de Pedidos</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                      setCurrentPageAnulados(1);
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  className={`gap-2 ${hayFiltrosActivos ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : ''}`}
                  onClick={() => setShowFiltros(v => !v)}
                >
                  <Filter className="size-4" />
                  Filtros
                  {hayFiltrosActivos && <Badge className="ml-1 bg-emerald-600 text-white text-[10px] px-1.5 py-0">ON</Badge>}
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* ── Panel de filtros ──────────────────────────────────────── */}
          {showFiltros && (
            <div className="px-6 pb-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Estado</Label>
                  <Select value={filtroEstado} onValueChange={v => { setFiltroEstado(v === '__all__' ? '' : v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="pagado">Pagado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Evento</Label>
                  <Select value={filtroEvento} onValueChange={v => { setFiltroEvento(v === '__all__' ? '' : v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {catalogoEventos.map(e => <SelectItem key={e.id} value={e.id}>{e.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Fecha desde</Label>
                  <Input type="date" className="h-8 text-sm" value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setCurrentPage(1); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Fecha hasta</Label>
                  <Input type="date" className="h-8 text-sm" value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setCurrentPage(1); }} />
                </div>
              </div>
              {hayFiltrosActivos && (
                <Button variant="ghost" size="sm" className="mt-2 text-slate-500 gap-1" onClick={limpiarFiltros}>
                  <X className="size-3" /> Limpiar filtros
                </Button>
              )}
            </div>
          )}

          <CardContent>
            <Tabs defaultValue="activos" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="activos" className="gap-2">
                  <ShoppingBag className="size-4" />
                  Pedidos Activos ({filteredPedidos.length})
                </TabsTrigger>
                <TabsTrigger value="anulados" className="gap-2">
                  <FileText className="size-4" />
                  Pedidos Anulados ({filteredPedidosAnulados.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="activos" className="space-y-4">
                {renderTable(currentPedidos, false)}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredPedidos.length)} de {filteredPedidos.length} pedidos
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={currentPage === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="anulados" className="space-y-4">
                {renderTable(currentPedidosAnulados, true)}
                {filteredPedidosAnulados.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Mostrando {startIndexAnulados + 1} a {Math.min(endIndexAnulados, filteredPedidosAnulados.length)} de {filteredPedidosAnulados.length} pedidos
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPageAnulados(prev => Math.max(1, prev - 1))} disabled={currentPageAnulados === 1}>
                        <ChevronLeft className="size-4" />
                      </Button>
                      {Array.from({ length: totalPagesAnulados }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={currentPageAnulados === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPageAnulados(page)}
                          className={currentPageAnulados === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setCurrentPageAnulados(prev => Math.min(totalPagesAnulados, prev + 1))} disabled={currentPageAnulados === totalPagesAnulados}>
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Detalles */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del pedido</DialogTitle>
            <DialogDescription>Información completa del pedido</DialogDescription>
          </DialogHeader>
          {selectedPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Número de pedido</Label>
                  <p className="text-slate-900 mt-1">{selectedPedido.numero}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Fecha</Label>
                  <p className="text-slate-900 mt-1">{selectedPedido.fecha}</p>
                </div>
              </div>
              <div>
                <Label className="text-slate-600">Asociado</Label>
                <p className="text-slate-900 mt-1">{selectedPedido.cliente}</p>
              </div>
              {selectedPedido.evento && (
                <div>
                  <Label className="text-slate-600">Evento</Label>
                  <p className="text-slate-900 mt-1">{selectedPedido.evento}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Método de pago</Label>
                  <p className="text-slate-900 mt-1">{selectedPedido.metodoPago}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Estado</Label>
                  <Badge className={selectedPedido.anulado ? 'bg-red-100 text-red-700' : getEstadoColor(selectedPedido.estado)}>
                    {selectedPedido.anulado ? 'Anulado' : selectedPedido.estado}
                  </Badge>
                </div>
              </div>

              {/* Tabla de productos — CA_95_02 */}
              <div>
                <Label className="text-slate-600">Productos del pedido</Label>
                {loadingDetalle ? (
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                    <div className="size-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    Cargando productos...
                  </div>
                ) : (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="text-left px-3 py-2">Producto</th>
                          <th className="text-center px-3 py-2">Cant.</th>
                          <th className="text-right px-3 py-2">Precio unit.</th>
                          <th className="text-right px-3 py-2">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalleProductos.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-4 text-slate-400">Sin productos registrados</td>
                          </tr>
                        ) : (
                          detalleProductos.map((d: any, i: number) => (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-2 font-medium">{d.productos?.nombre ?? '—'}</td>
                              <td className="px-3 py-2 text-center">{d.cantidad}</td>
                              <td className="px-3 py-2 text-right text-slate-500">{formatCurrency(d.precio_unitario)}</td>
                              <td className="px-3 py-2 text-right font-semibold">{formatCurrency(d.subtotal)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right font-semibold text-slate-600">Total:</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">
                            {formatCurrency(selectedPedido.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Auditoría del pedido */}
              <div>
                <Label className="text-slate-600 flex items-center gap-1.5">
                  <History className="size-3.5" /> Historial de cambios
                </Label>
                {loadingAuditoria ? (
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                    <div className="size-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    Cargando historial...
                  </div>
                ) : auditoriaLogs.length === 0 ? (
                  <p className="text-sm text-slate-400 mt-2">Sin registros de cambios</p>
                ) : (
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {auditoriaLogs.map((log: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <span className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded font-semibold ${
                          log.accion === 'CREAR'         ? 'bg-emerald-100 text-emerald-700' :
                          log.accion === 'ANULAR'        ? 'bg-red-100 text-red-700' :
                          log.accion === 'CAMBIO_ESTADO' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{log.accion}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-700">{log.detalle}</p>
                          <p className="text-slate-400 mt-0.5">{new Date(log.created_at).toLocaleString('es-CO')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={open => { setIsEditDialogOpen(open); if (!open) setSelectedPedido(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="size-4 text-emerald-600" /> Editar pedido {selectedPedido?.numero}
            </DialogTitle>
            <DialogDescription>Modifica los productos, el evento o las notas del pedido</DialogDescription>
          </DialogHeader>

          {selectedPedido && (
            <div className="space-y-4 py-2">

              {/* Info fija */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg text-sm">
                <div><span className="text-slate-500">Asociado:</span> <span className="font-medium">{selectedPedido.cliente}</span></div>
                <div><span className="text-slate-500">Fecha:</span> <span className="font-medium">{selectedPedido.fecha}</span></div>
              </div>

              {/* Evento */}
              <div className="space-y-1.5">
                <Label>Evento asociado <span className="text-slate-400 text-xs">(opcional)</span></Label>
                <Select value={editEventoId} onValueChange={v => setEditEventoId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin evento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin evento</SelectItem>
                    {catalogoEventos.map(e => <SelectItem key={e.id} value={e.id}>{e.titulo} — {e.fecha}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Notas */}
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Input value={editNotas} onChange={e => setEditNotas(e.target.value)} placeholder="Observaciones opcionales..." />
              </div>

              {/* Productos */}
              <div className="space-y-2">
                <Label>Productos <span className="text-red-500">*</span></Label>

                {/* Agregar producto */}
                <div className="flex gap-2">
                  <Select value={editProdSelId} onValueChange={setEditProdSelId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
                    <SelectContent>
                      {catalogoProductos.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre}{p.precio_venta ? ` — ${formatCurrency(p.precio_venta)}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" min={1}
                    value={editCantidad}
                    onChange={e => setEditCantidad(Number(e.target.value))}
                    className={`w-20 ${editCantidad <= 0 ? 'border-red-500' : ''}`}
                  />
                  <Button type="button" className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
                    onClick={() => {
                      if (!editProdSelId) { toast.error('Selecciona un producto'); return; }
                      if (editCantidad <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }
                      const prod = catalogoProductos.find(p => p.id === editProdSelId);
                      if (!prod) return;
                      const existe = editItems.find(i => i.producto_id === editProdSelId);
                      if (existe) {
                        setEditItems(prev => prev.map(i => i.producto_id === editProdSelId ? { ...i, cantidad: i.cantidad + editCantidad } : i));
                      } else {
                        setEditItems(prev => [...prev, { producto_id: prod.id, nombre: prod.nombre, cantidad: editCantidad, precio_unitario: prod.precio_venta ?? 0 }]);
                      }
                      setEditProdSelId(''); setEditCantidad(1);
                    }}
                  >Agregar</Button>
                </div>

                {/* Lista de productos */}
                {loadingEdit ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
                    <div className="size-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> Cargando productos...
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="text-left px-3 py-2">Producto</th>
                          <th className="text-center px-3 py-2">Cantidad</th>
                          <th className="text-right px-3 py-2">Precio unit.</th>
                          <th className="text-right px-3 py-2">Subtotal</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editItems.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-4 text-slate-400">Sin productos — agrega al menos uno</td></tr>
                        ) : editItems.map(i => (
                          <tr key={i.producto_id} className="border-t">
                            <td className="px-3 py-2 font-medium">{i.nombre}</td>
                            <td className="px-3 py-2 text-center">
                              <Input
                                type="number" min={1}
                                value={i.cantidad}
                                onChange={e => setEditItems(prev => prev.map(x => x.producto_id === i.producto_id ? { ...x, cantidad: Number(e.target.value) } : x))}
                                className="w-16 h-7 text-center mx-auto"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-slate-500">{formatCurrency(i.precio_unitario)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(i.cantidad * i.precio_unitario)}</td>
                            <td className="px-2 py-2">
                              <button onClick={() => setEditItems(prev => prev.filter(x => x.producto_id !== i.producto_id))} className="text-red-400 hover:text-red-600">
                                <XCircle className="size-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {editItems.length > 0 && (
                        <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-right font-semibold text-slate-600">Total:</td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700">
                              {formatCurrency(editItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setSelectedPedido(null); }} disabled={guardandoEdit}>
              Cerrar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={handleGuardarEdicion} disabled={guardandoEdit || loadingEdit}>
              {guardandoEdit
                ? <><div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
                : <><Package className="size-4" />Guardar cambios</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para Anular */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              El pedido será marcado como anulado y se moverá a la pestaña de "Pedidos Anulados". El registro se conservará en el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPedido(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnular} className="bg-amber-600 hover:bg-amber-700">
              Anular pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmación: Marcar como Pagado ─────────────────────────────── */}
      <AlertDialog open={isConfirmPagoOpen} onOpenChange={open => {
        setIsConfirmPagoOpen(open);
        if (!open) setPedidoPendientePago(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar pedido como pagado?</AlertDialogTitle>
            <AlertDialogDescription>
              El pedido <span className="font-semibold">{pedidoPendientePago?.numero}</span> quedará
              como <span className="font-semibold text-emerald-700">Pagado</span> y se registrará
              automáticamente en ventas. Esta acción no se puede revertir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={async () => {
                if (!pedidoPendientePago) return;
                try {
                  await pedidosApi.updateEstado(pedidoPendientePago.id, 'pagado');
                  await registrarAuditoria(pedidoPendientePago.id, pedidoPendientePago.asociado_id, 'CAMBIO_ESTADO', `Estado cambiado de Pendiente → Pagado. Venta registrada automáticamente`);
                  setPedidos(prev => prev.map(p =>
                    p.id === pedidoPendientePago.id ? { ...p, estado: 'pagado' } : p
                  ));
                  toast.success('Pedido marcado como pagado y registrado en ventas');
                } catch (err: any) {
                  toast.error('Error al actualizar estado: ' + err.message);
                } finally {
                  setPedidoPendientePago(null);
                  setIsConfirmPagoOpen(false);
                }
              }}
            >
              Confirmar pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Diálogo: Nuevo Pedido ─────────────────────────────────────────── */}
      <Dialog open={isNuevoPedidoOpen} onOpenChange={open => {
        setIsNuevoPedidoOpen(open);
        if (!open) { setFormPedido(emptyPedido); setItemsPedido([]); setProductoSelId(''); setCantidadItem(1); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="size-5 text-emerald-600" /> Registrar Nuevo Pedido
            </DialogTitle>
            <DialogDescription>Indica el asociado, los productos y la fecha requerida.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Asociado <span className="text-red-500">*</span></Label>
                <Select value={formPedido.asociado_id} onValueChange={v => setFormPedido(p => ({ ...p, asociado_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar asociado..." /></SelectTrigger>
                  <SelectContent>
                    {catalogoAsociados.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha requerida</Label>
                <Input
                  type="date"
                  value={formPedido.fechaRequerida}
                  onChange={e => setFormPedido(p => ({ ...p, fechaRequerida: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Evento asociado <span className="text-slate-400 text-xs">(opcional)</span></Label>
              <Select value={formPedido.evento_id} onValueChange={v => setFormPedido(p => ({ ...p, evento_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar evento..." /></SelectTrigger>
                <SelectContent>
                  {catalogoEventos.length === 0 ? (
                    <SelectItem value="__none__" disabled>No hay eventos disponibles</SelectItem>
                  ) : (
                    catalogoEventos.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.titulo} — {e.fecha}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Productos <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Select value={productoSelId} onValueChange={setProductoSelId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogoProductos.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {/* ── CORRECCIÓN 5: mostrar precio en el selector ─── */}
                        {p.nombre}{p.precio_venta ? ` — ${formatCurrency(p.precio_venta)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={cantidadItem}
                  onChange={e => setCantidadItem(Number(e.target.value))}
                  className={`w-20 ${cantidadItem <= 0 ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
                />
                <Button type="button" onClick={agregarItemPedido} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                  Agregar
                </Button>
              </div>

              {itemsPedido.length > 0 && (
                <div className="border rounded-lg overflow-hidden mt-1">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-3 py-2">Producto</th>
                        <th className="text-center px-3 py-2">Cantidad</th>
                        <th className="text-right px-3 py-2">Precio unit.</th>
                        <th className="text-right px-3 py-2">Subtotal</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsPedido.map(i => (
                        <tr key={i.producto_id} className="border-t">
                          <td className="px-3 py-2 font-medium">{i.nombre}</td>
                          <td className="px-3 py-2 text-center">{i.cantidad}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{formatCurrency(i.precio_unitario)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(i.cantidad * i.precio_unitario)}</td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => setItemsPedido(prev => prev.filter(x => x.producto_id !== i.producto_id))}
                              className="text-red-400 hover:text-red-600"
                            >
                              <XCircle className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right font-semibold text-slate-600">Total:</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">
                          {formatCurrency(itemsPedido.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input
                value={formPedido.notas}
                onChange={e => setFormPedido(p => ({ ...p, notas: e.target.value }))}
                placeholder="Observaciones opcionales..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNuevoPedidoOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarPedido} disabled={guardando} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              {guardando
                ? <><div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
                : <><Package className="size-4" />Registrar pedido</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
