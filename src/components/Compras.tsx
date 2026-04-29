import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Search, Filter, Plus, Eye, ChevronLeft, ChevronRight, Trash2,
  ShoppingBasket, Package, FileText,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { generateCompraPDF } from './utils/pdfGenerator';

// ── Supabase ─────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { comprasApi, proveedoresApi } from '../lib/api';

export default function Compras() {
  const [searchTerm, setSearchTerm]               = useState('');
  const [currentPage, setCurrentPage]             = useState(1);
  const [currentPageAnuladas, setCurrentPageAnuladas] = useState(1);
  const [isDetailDialogOpen, setIsDetailDialogOpen]   = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen]       = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]   = useState(false);
  const [selectedItem, setSelectedItem]           = useState<any>(null);
  const itemsPerPage = 10;

  // ── Estado Supabase ───────────────────────────────────────────────────────
  const [compras, setCompras]                     = useState<any[]>([]);
  const [proveedores, setProveedores]             = useState<any[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [guardando, setGuardando]                 = useState(false);
  const [isNuevaCompraOpen, setIsNuevaCompraOpen] = useState(false);
  const [catalogoProductos, setCatalogoProductos] = useState<any[]>([]);

  const emptyCompra = { proveedor_id: '', fechaEstimada: '', notas: '' };
  const [formCompra, setFormCompra]       = useState(emptyCompra);
  const [itemsCompra, setItemsCompra]     = useState<{ producto_id: string; nombre: string; cantidad: number; precio_unit: number; subtotal: number }[]>([]);
  const [productoSelId, setProductoSelId] = useState('');
  const [cantidadItem, setCantidadItem]   = useState(1);
  const [precioItem, setPrecioItem]       = useState(0);

  const totalCompra = itemsCompra.reduce((s, i) => s + i.subtotal, 0);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

  function agregarItemCompra() {
    if (!productoSelId) { toast.error('Selecciona un producto'); return; }
    if (cantidadItem <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }
    if (precioItem <= 0) { toast.error('El precio debe ser mayor a 0'); return; }
    const prod = catalogoProductos.find(p => p.id === productoSelId);
    if (!prod) return;
    const existe = itemsCompra.find(i => i.producto_id === productoSelId);
    if (existe) {
      setItemsCompra(prev => prev.map(i => i.producto_id === productoSelId
        ? { ...i, cantidad: i.cantidad + cantidadItem, subtotal: (i.cantidad + cantidadItem) * i.precio_unit }
        : i));
    } else {
      setItemsCompra(prev => [...prev, { producto_id: prod.id, nombre: prod.nombre, cantidad: cantidadItem, precio_unit: precioItem, subtotal: cantidadItem * precioItem }]);
    }
    setProductoSelId(''); setCantidadItem(1); setPrecioItem(0);
  }

  async function handleGuardarCompra() {
    if (!formCompra.proveedor_id) { toast.error('Selecciona un proveedor'); return; }
    if (itemsCompra.length === 0) { toast.error('Agrega al menos un producto'); return; }
    setGuardando(true);
    try {
      const { data: compraData, error: cErr } = await supabase
        .from('compras')
        .insert({ proveedor_id: formCompra.proveedor_id, total: totalCompra, estado: 'pendiente', fecha: new Date().toISOString().split('T')[0], notas: formCompra.notas || null })
        .select().single();
      if (cErr) throw cErr;

      const detalle = itemsCompra.map(i => ({
        compra_id:    compraData.id,
        producto_id:  i.producto_id,
        cantidad:     i.cantidad,
        precio_unit:  i.precio_unit,
        subtotal:     i.subtotal,
      }));
      const { error: dErr } = await supabase.from('compras_detalle').insert(detalle);
      if (dErr) {
        // Si la columna precio_unit aún no existe en la BD, intentar sin ella
        if (dErr.message?.includes('precio_unit')) {
          const detalleSimple = itemsCompra.map(i => ({
            compra_id:   compraData.id,
            producto_id: i.producto_id,
            cantidad:    i.cantidad,
            subtotal:    i.subtotal,
          }));
          const { error: dErr2 } = await supabase.from('compras_detalle').insert(detalleSimple);
          if (dErr2) throw dErr2;
          toast.warning('Compra registrada. Ejecuta la migración SQL para guardar el precio unitario.');
        } else {
          throw dErr;
        }
      }

      toast.success('Orden de compra registrada exitosamente');
      setIsNuevaCompraOpen(false);
      setFormCompra(emptyCompra);
      setItemsCompra([]);
      cargarDatos();
    } catch (err: any) {
      toast.error('Error al registrar compra: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  useEffect(() => { cargarDatos(); cargarProductos(); }, []);

  async function cargarProductos() {
    const { data } = await supabase.from('productos').select('id, nombre').order('nombre');
    setCatalogoProductos(data || []);
  }

  async function cargarDatos() {
    try {
      setLoading(true);
      const [{ data, error }, provData] = await Promise.all([
        supabase
          .from('compras')
          .select(`
            *,
            proveedores(nombre),
            compras_detalle(*, productos(nombre))
          `)
          .order('fecha', { ascending: false }),
        proveedoresApi.getAll(),
      ]);
      if (error) throw error;

      const mapeadas = (data || []).map((c: any) => {
        const detalle = c.compras_detalle || [];
        const productos = detalle.map((d: any) => d.productos?.nombre ?? 'Producto').join(', ');
        const cantidad  = detalle.reduce((s: number, d: any) => s + (d.cantidad || 0), 0);
        return {
          id:         c.id,
          numero:     `COM-${c.id.slice(0, 8).toUpperCase()}`,
          proveedor:  c.proveedores?.nombre ?? 'Sin proveedor',
          proveedor_id: c.proveedor_id,
          fecha:      c.fecha,
          productos:  productos || 'Sin productos',
          cantidad,
          total:      c.total,
          estado:     c.estado === 'recibida' ? 'Recibida'
                    : c.estado === 'pendiente' ? 'Pendiente'
                    : c.estado,
          anulado:    c.estado === 'anulada',
          notas:      c.notas,
          detalle,
        };
      });

      setCompras(mapeadas);
      setProveedores(provData || []);
    } catch (err: any) {
      toast.error('Error al cargar compras: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Filtros y paginación ──────────────────────────────────────────────────
  const comprasActivas  = compras.filter(c => !c.anulado);
  const filteredCompras = comprasActivas.filter(c =>
    c.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.proveedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.productos.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const comprasAnuladas  = compras.filter(c => c.anulado);
  const filteredComprasAnuladas = comprasAnuladas.filter(c =>
    c.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.proveedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.productos.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages      = Math.ceil(filteredCompras.length / itemsPerPage);
  const startIndex      = (currentPage - 1) * itemsPerPage;
  const endIndex        = startIndex + itemsPerPage;
  const currentCompras  = filteredCompras.slice(startIndex, endIndex);

  const totalPagesAnuladas   = Math.ceil(filteredComprasAnuladas.length / itemsPerPage);
  const startIndexAnuladas   = (currentPageAnuladas - 1) * itemsPerPage;
  const endIndexAnuladas     = startIndexAnuladas + itemsPerPage;
  const currentComprasAnuladas = filteredComprasAnuladas.slice(startIndexAnuladas, endIndexAnuladas);

  const getEstadoColor = (estado: string) => {
    const colores: { [key: string]: string } = {
      'Recibida':    'bg-emerald-100 text-emerald-700',
      'Pendiente':   'bg-amber-100 text-amber-700',
      'En tránsito': 'bg-blue-100 text-blue-700',
      'Cancelada':   'bg-red-100 text-red-700',
    };
    return colores[estado] || 'bg-slate-100 text-slate-700';
  };

  // ── Handlers con Supabase ─────────────────────────────────────────────────
  const handleAnular = async () => {
    if (!selectedItem) return;
    try {
      await comprasApi.update(selectedItem.id, { estado: 'anulada' });
      setCompras(prev => prev.map(c =>
        c.id === selectedItem.id ? { ...c, anulado: true, estado: 'Anulada' } : c
      ));
      toast.success(`Compra "${selectedItem.numero}" anulada exitosamente`);
    } catch (err: any) {
      toast.error('Error al anular compra: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedItem(null);
  };

  const handleEdit = async () => {
    if (!selectedItem) return;
    try {
      await comprasApi.update(selectedItem.id, { estado: selectedItem.estado?.toLowerCase() });
      toast.success('Compra actualizada exitosamente');
    } catch (err: any) {
      toast.error('Error al actualizar compra: ' + err.message);
    }
    setIsEditDialogOpen(false);
    setSelectedItem(null);
  };

  // Cambio de estado inline desde el Select de la tabla
  const handleCambioEstado = async (id: string, nuevoEstado: string) => {
    const estadoDb = nuevoEstado === 'Recibida'    ? 'recibida'
                   : nuevoEstado === 'Pendiente'   ? 'pendiente'
                   : nuevoEstado === 'En tránsito' ? 'en_transito'
                   : nuevoEstado === 'Cancelada'   ? 'cancelada'
                   : nuevoEstado.toLowerCase();
    try {
      await comprasApi.update(id, { estado: estadoDb });
      setCompras(prev => prev.map(c => c.id === id ? { ...c, estado: nuevoEstado } : c));
      toast.success(`Estado actualizado a "${nuevoEstado}"`);
    } catch (err: any) {
      toast.error('Error al actualizar estado: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando compras...</p>
        </div>
      </div>
    );
  }

  // ── JSX original desde aquí (sin cambios) ────────────────────────────────
  // NOTA: en el Select inline de estado dentro de renderTable, reemplaza:
  //   onValueChange={(value) => { setCompras(prev => prev.map(c => c.id === compra.id ? {...c, estado: value} : c)); }}
  // por:
  //   onValueChange={(value) => handleCambioEstado(compra.id, value)}
  const renderTable = (comprasList: any[], isAnuladas: boolean = false) => (
    <>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comprasList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                  {isAnuladas ? 'No hay compras anuladas' : 'No hay compras registradas'}
                </TableCell>
              </TableRow>
            ) : (
              comprasList.map((compra) => (
                <TableRow key={compra.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {compra.numero}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isAnuladas ? 'bg-slate-100' : 'bg-teal-100'}`}>
                        <ShoppingBasket className={`size-4 ${isAnuladas ? 'text-slate-600' : 'text-teal-600'}`} />
                      </div>
                      <p className="text-slate-900">{compra.proveedor}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{compra.fecha}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{compra.productos}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-cyan-100 text-cyan-700">
                      {compra.cantidad} items
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-900">{formatCurrency(compra.total)}</p>
                  </TableCell>
                  <TableCell>
                    {isAnuladas ? (
                      <Badge className="bg-red-100 text-red-700">
                        Anulada
                      </Badge>
                    ) : (
                      <Select
                        defaultValue={compra.estado}
                        onValueChange={(value: string) => handleCambioEstado(compra.id, value)}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pendiente">Pendiente</SelectItem>
                          <SelectItem value="En tránsito">En tránsito</SelectItem>
                          <SelectItem value="Recibida">Recibida</SelectItem>
                          <SelectItem value="Cancelada">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedItem(compra);
                          setIsDetailDialogOpen(true);
                        }}
                        title="Ver detalles"
                      >
                        <Eye className="size-4" />
                      </Button>
                      {!isAnuladas && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedItem(compra);
                              setIsDeleteDialogOpen(true);
                            }}
                            title="Anular compra"
                          >
                            <Trash2 className="size-4 text-amber-600" />
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const pdfData = {
                            numero: compra.numero,
                            proveedor: compra.proveedor,
                            fecha: compra.fecha,
                            productos: compra.productos,
                            cantidad: compra.cantidad,
                            total: compra.total,
                            estado: compra.estado
                          };
                          const success = generateCompraPDF(pdfData);
                          if (success) {
                            toast.success('Orden de compra descargada');
                          } else {
                            toast.error('Error al generar la orden');
                          }
                        }}
                        title="Descargar orden de compra"
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
            <h1 className="text-slate-900 mb-2">Gestión de Compras</h1>
            <p className="text-slate-600">Administra las órdenes de compra a proveedores</p>
          </div>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsNuevaCompraOpen(true)}>
            <Plus className="size-4" />
            Nueva compra
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Lista de Compras</CardTitle>
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
                      setCurrentPageAnuladas(1);
                    }}
                  />
                </div>
                <Button variant="outline" className="gap-2">
                  <Filter className="size-4" />
                  Filtros
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="activas" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="activas" className="gap-2">
                  <ShoppingBasket className="size-4" />
                  Compras Activas ({filteredCompras.length})
                </TabsTrigger>
                <TabsTrigger value="anuladas" className="gap-2">
                  <FileText className="size-4" />
                  Compras Anuladas ({filteredComprasAnuladas.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="activas" className="space-y-4">
                {renderTable(currentCompras, false)}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredCompras.length)} de {filteredCompras.length} compras
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
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

              <TabsContent value="anuladas" className="space-y-4">
                {renderTable(currentComprasAnuladas, true)}
                {filteredComprasAnuladas.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Mostrando {startIndexAnuladas + 1} a {Math.min(endIndexAnuladas, filteredComprasAnuladas.length)} de {filteredComprasAnuladas.length} compras
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPageAnuladas(prev => Math.max(1, prev - 1))} disabled={currentPageAnuladas === 1}>
                        <ChevronLeft className="size-4" />
                      </Button>
                      {Array.from({ length: totalPagesAnuladas }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={currentPageAnuladas === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPageAnuladas(page)}
                          className={currentPageAnuladas === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setCurrentPageAnuladas(prev => Math.min(totalPagesAnuladas, prev + 1))} disabled={currentPageAnuladas === totalPagesAnuladas}>
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
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBasket className="size-5 text-emerald-600" />
              Detalle de la compra
            </DialogTitle>
            <DialogDescription>
              Información completa de la orden de compra
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wide">Número de orden</Label>
                  <p className="text-slate-900 mt-1 font-mono font-semibold">{selectedItem.numero}</p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wide">Fecha</Label>
                  <p className="text-slate-900 mt-1">{selectedItem.fecha}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wide">Proveedor</Label>
                  <p className="text-slate-900 mt-1">{selectedItem.proveedor}</p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wide">Estado</Label>
                  <div className="mt-1">
                    <Badge className={selectedItem.anulado ? 'bg-red-100 text-red-700' : getEstadoColor(selectedItem.estado)}>
                      {selectedItem.anulado ? 'Anulada' : selectedItem.estado}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Tabla de productos */}
              <div>
                <Label className="text-slate-500 text-xs uppercase tracking-wide">Productos incluidos</Label>
                <div className="border rounded-lg overflow-hidden mt-2">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">Producto</th>
                        <th className="text-center px-3 py-2 text-slate-500 font-medium">Cant.</th>
                        <th className="text-right px-3 py-2 text-slate-500 font-medium">P. Unit.</th>
                        <th className="text-right px-3 py-2 text-slate-500 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedItem.detalle || []).length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-4 text-slate-400">Sin detalle disponible</td></tr>
                      ) : (
                        (selectedItem.detalle || []).map((d: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2 font-medium">{d.productos?.nombre ?? 'Producto'}</td>
                            <td className="px-3 py-2 text-center">{d.cantidad}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(d.precio_unit ?? 0)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(d.subtotal ?? 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-emerald-50 border-t-2 border-emerald-100">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right font-semibold text-slate-700">Total:</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(selectedItem.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedItem.notas && (
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wide">Notas</Label>
                  <p className="text-slate-700 mt-1 text-sm bg-slate-50 rounded p-2">{selectedItem.notas}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar compra</DialogTitle>
            <DialogDescription>
              Actualiza la información de la orden de compra
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="proveedor">Proveedor</Label>
                <Input id="proveedor" defaultValue={selectedItem.proveedor} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productos">Productos</Label>
                <Input id="productos" defaultValue={selectedItem.productos} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cantidad">Cantidad</Label>
                  <Input id="cantidad" type="number" defaultValue={selectedItem.cantidad} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total">Total</Label>
                  <Input id="total" type="number" defaultValue={selectedItem.total} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input id="estado" defaultValue={selectedItem.estado} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setSelectedItem(null);
            }}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleEdit}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para Anular */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular esta orden de compra?</AlertDialogTitle>
            <AlertDialogDescription>
              La compra será marcada como anulada y se moverá a la pestaña de "Compras Anuladas". El registro se conservará en el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnular} className="bg-amber-600 hover:bg-amber-700">
              Anular compra
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Diálogo: Nueva Compra (CA_104) ───────────────────────────────── */}
      <Dialog open={isNuevaCompraOpen} onOpenChange={open => { setIsNuevaCompraOpen(open); if (!open) { setFormCompra(emptyCompra); setItemsCompra([]); setProductoSelId(''); setCantidadItem(1); setPrecioItem(0); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingBasket className="size-5 text-emerald-600" /> Registrar Orden de Compra</DialogTitle>
            <DialogDescription>Registra una nueva compra indicando proveedor, productos y cantidades recibidas.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Proveedor <span className="text-red-500">*</span></Label>
                <Select value={formCompra.proveedor_id} onValueChange={v => setFormCompra(p => ({ ...p, proveedor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar proveedor..." /></SelectTrigger>
                  <SelectContent>{proveedores.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha estimada de entrega</Label>
                <Input type="date" value={formCompra.fechaEstimada} onChange={e => setFormCompra(p => ({ ...p, fechaEstimada: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Productos recibidos <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Select value={productoSelId} onValueChange={setProductoSelId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Producto..." /></SelectTrigger>
                  <SelectContent>{catalogoProductos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" min={1} value={cantidadItem} onChange={e => setCantidadItem(Number(e.target.value))} className="w-20" placeholder="Cant." />
                <Input type="number" min={0} value={precioItem || ''} onChange={e => setPrecioItem(Number(e.target.value))} className="w-28" placeholder="Precio unit." />
                <Button type="button" onClick={agregarItemCompra} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">Agregar</Button>
              </div>

              {itemsCompra.length > 0 && (
                <div className="border rounded-lg overflow-hidden mt-1">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr><th className="text-left px-3 py-2">Producto</th><th className="text-center px-3 py-2">Cant.</th><th className="text-right px-3 py-2">P. unit.</th><th className="text-right px-3 py-2">Subtotal</th><th className="px-2"></th></tr>
                    </thead>
                    <tbody>
                      {itemsCompra.map(i => (
                        <tr key={i.producto_id} className="border-t">
                          <td className="px-3 py-2 font-medium">{i.nombre}</td>
                          <td className="px-3 py-2 text-center">{i.cantidad}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(i.precio_unit)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(i.subtotal)}</td>
                          <td className="px-2 py-2"><button onClick={() => setItemsCompra(prev => prev.filter(x => x.producto_id !== i.producto_id))} className="text-red-400 hover:text-red-600"><Trash2 className="size-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-emerald-50">
                      <tr><td colSpan={3} className="px-3 py-2 text-right font-semibold">Total:</td><td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(totalCompra)}</td><td></td></tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input value={formCompra.notas} onChange={e => setFormCompra(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones opcionales..." />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNuevaCompraOpen(false)} disabled={guardando}>Cancelar</Button>
            <Button onClick={handleGuardarCompra} disabled={guardando} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              {guardando ? <><div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</> : <><Package className="size-4" />Registrar compra</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}