import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Search, Filter, Plus, Eye, ChevronLeft, ChevronRight, Package, DollarSign, TrendingUp, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { toast } from 'sonner';

import { supabase } from '../lib/supabase';
import { productosApi, categoriasApi, proveedoresApi } from '../lib/api';

export default function Productos() {
  const [searchTerm, setSearchTerm]                       = useState('');
  const [currentPage, setCurrentPage]                     = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen]         = useState(false);
  const [isEditModalOpen, setIsEditModalOpen]             = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen]         = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]       = useState(false);
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [pendingEstadoCambio, setPendingEstadoCambio]     = useState<{ productoId: string; nuevoEstado: string } | null>(null);
  const [selectedProducto, setSelectedProducto]           = useState<any>(null);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    codigo: '', nombre: '', categoria: '', proveedor: '',
    precioCompra: '', precioVenta: '', stock: '', stockMinimo: '', descripcion: ''
  });

  const [productos, setProductos]     = useState<any[]>([]);
  const [categoriasList, setCategorias] = useState<any[]>([]);
  const [proveedoresList, setProveedores] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      const [{ data: prods, error }, cats, provs] = await Promise.all([
        supabase.from('productos').select('*, categorias(nombre), proveedores(nombre)').order('nombre'),
        categoriasApi.getAll(),
        proveedoresApi.getAll(),
      ]);
      if (error) throw error;

      const mapeados = (prods || []).map((p: any) => ({
        id:           p.id,
        codigo:       p.codigo,
        nombre:       p.nombre,
        categoria:    p.categorias?.nombre   ?? '',
        categoria_id: p.categoria_id,
        proveedor:    p.proveedores?.nombre  ?? '',
        proveedor_id: p.proveedor_id,
        precioCompra: p.precio_compra,
        precioVenta:  p.precio_venta,
        stock:        p.stock,
        stockMinimo:  p.stock_minimo,
        estado:       p.estado,
        descripcion:  p.descripcion ?? '',
      }));
      setProductos(mapeados);
      setCategorias(cats || []);
      setProveedores(provs || []);
    } catch (err: any) {
      toast.error('Error al cargar productos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const categorias  = categoriasList.map(c => c.nombre);
  const proveedores = proveedoresList.map(p => p.nombre);

  const filteredProductos = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages      = Math.ceil(filteredProductos.length / itemsPerPage);
  const startIndex      = (currentPage - 1) * itemsPerPage;
  const endIndex        = startIndex + itemsPerPage;
  const currentProductos = filteredProductos.slice(startIndex, endIndex);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const stats = [
    { label: 'Total productos', value: productos.length,                                       icon: Package,     color: 'emerald' },
    { label: 'Stock total',     value: productos.reduce((s, p) => s + p.stock, 0),             icon: TrendingUp,  color: 'blue' },
    { label: 'Stock bajo',      value: productos.filter(p => p.estado === 'Stock bajo').length, icon: AlertCircle, color: 'amber' },
    { label: 'Agotados',        value: productos.filter(p => p.estado === 'Agotado').length,    icon: Package,     color: 'red' },
  ];

  const getEstadoProducto = (producto: any) => {
    if (producto.stock === 0)                           return 'Agotado';
    if (producto.stock <= producto.stockMinimo)         return 'Stock bajo';
    return 'Disponible';
  };

  const handleOpenCreate = () => {
    setFormData({ codigo:'', nombre:'', categoria:'', proveedor:'', precioCompra:'', precioVenta:'', stock:'', stockMinimo:'', descripcion:'' });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (producto: any) => {
    setSelectedProducto(producto);
    setFormData({
      codigo: producto.codigo, nombre: producto.nombre, categoria: producto.categoria,
      proveedor: producto.proveedor, precioCompra: String(producto.precioCompra),
      precioVenta: String(producto.precioVenta), stock: String(producto.stock),
      stockMinimo: String(producto.stockMinimo), descripcion: producto.descripcion || ''
    });
    setIsEditModalOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.codigo.trim())   { toast.error('El código es obligatorio'); return; }
    if (!formData.nombre.trim())   { toast.error('El nombre es obligatorio'); return; }
    if (!formData.categoria)       { toast.error('Debes seleccionar una categoría'); return; }
    if (!formData.proveedor)       { toast.error('Debes seleccionar un proveedor'); return; }

    const cat  = categoriasList.find(c => c.nombre === formData.categoria);
    const prov = proveedoresList.find(p => p.nombre === formData.proveedor);
    const stockNum = Number(formData.stock) || 0;
    const minStock = Number(formData.stockMinimo) || 0;
    const estado   = stockNum === 0 ? 'Agotado' : stockNum <= minStock ? 'Stock bajo' : 'Disponible';

    try {
      const nuevo = await productosApi.create({
        codigo:       formData.codigo.trim(),
        nombre:       formData.nombre.trim(),
        descripcion:  formData.descripcion,
        categoria_id: cat?.id,
        proveedor_id: prov?.id,
        precio_compra: Number(formData.precioCompra) || 0,
        precio_venta:  Number(formData.precioVenta)  || 0,
        stock:         stockNum,
        stock_minimo:  minStock,
        estado,
      });
      setProductos(prev => [...prev, {
        id: nuevo.id, codigo: formData.codigo, nombre: formData.nombre,
        categoria: formData.categoria, proveedor: formData.proveedor,
        precioCompra: Number(formData.precioCompra) || 0,
        precioVenta: Number(formData.precioVenta) || 0,
        stock: stockNum, stockMinimo: minStock,
        estado, descripcion: formData.descripcion,
      }]);
      toast.success(`Producto "${formData.nombre}" creado exitosamente`);
      setIsCreateModalOpen(false);
    } catch (err: any) {
      toast.error('Error al crear producto: ' + err.message);
    }
  };

  const handleEdit = async () => {
    if (!selectedProducto) return;
    const cat  = categoriasList.find(c => c.nombre === formData.categoria);
    const prov = proveedoresList.find(p => p.nombre === formData.proveedor);
    const stockNum = Number(formData.stock) || 0;
    const minStock = Number(formData.stockMinimo) || 0;
    const estado   = stockNum === 0 ? 'Agotado' : stockNum <= minStock ? 'Stock bajo' : 'Disponible';

    try {
      await productosApi.update(selectedProducto.id, {
        codigo:       formData.codigo, nombre: formData.nombre, descripcion: formData.descripcion,
        categoria_id: cat?.id, proveedor_id: prov?.id,
        precio_compra: Number(formData.precioCompra) || 0,
        precio_venta:  Number(formData.precioVenta)  || 0,
        stock: stockNum, stock_minimo: minStock, estado,
      });
      setProductos(prev => prev.map(p =>
        p.id === selectedProducto.id ? {
          ...p, codigo: formData.codigo, nombre: formData.nombre,
          categoria: formData.categoria, proveedor: formData.proveedor,
          precioCompra: Number(formData.precioCompra) || 0,
          precioVenta: Number(formData.precioVenta) || 0,
          stock: stockNum, stockMinimo: minStock, estado, descripcion: formData.descripcion,
        } : p
      ));
      toast.success(`Producto "${formData.nombre}" actualizado exitosamente`);
      setIsEditModalOpen(false);
      setSelectedProducto(null);
    } catch (err: any) {
      toast.error('Error al actualizar producto: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedProducto) return;
    try {
      await productosApi.delete(selectedProducto.id);
      setProductos(prev => prev.filter(p => p.id !== selectedProducto.id));
      toast.success(`Producto "${selectedProducto.nombre}" eliminado exitosamente`);
    } catch (err: any) {
      toast.error('Error al eliminar producto: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedProducto(null);
  };

  const handleConfirmEstadoCambio = async () => {
    if (!pendingEstadoCambio) return;
    try {
      await productosApi.update(pendingEstadoCambio.productoId, { estado: pendingEstadoCambio.nuevoEstado });
      setProductos(prev => prev.map(p =>
        p.id === pendingEstadoCambio.productoId ? { ...p, estado: pendingEstadoCambio.nuevoEstado } : p
      ));
      toast.success(`Estado actualizado a "${pendingEstadoCambio.nuevoEstado}"`);
    } catch (err: any) {
      toast.error('Error al actualizar estado: ' + err.message);
    }
    setIsToggleEstadoDialogOpen(false);
    setPendingEstadoCambio(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando productos...</p>
        </div>
      </div>
    );
  }

  function handleCambiarEstado(id: any, value: string) {
    throw new Error('Function not implemented.');
  }

  function getEstadoColor(estado: any) {
    throw new Error('Function not implemented.');
  }

  // JSX original desde aquí
  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2 flex items-center gap-3">
              <Package className="size-8 text-emerald-600" />
              Gestión de Productos
            </h1>
            <p className="text-slate-600">Administra el inventario de productos</p>
          </div>
          <Button 
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleOpenCreate}
          >
            <Plus className="size-4" />
            Nuevo producto
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">{stat.label}</p>
                    <p className="text-2xl mt-1 text-slate-900">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg bg-${stat.color}-100`}>
                    <stat.icon className={`size-6 text-${stat.color}-600`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Lista de Productos</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar producto..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
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
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>P. Compra</TableHead>
                    <TableHead>P. Venta</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentProductos.map((producto) => (
                    <TableRow key={producto.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {producto.codigo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Package className="size-4 text-purple-600" />
                          </div>
                          <p className="text-slate-900">{producto.nombre}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                          {producto.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-600">{producto.proveedor}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-900">{formatCurrency(producto.precioCompra)}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-900">{formatCurrency(producto.precioVenta)}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          producto.stock === 0 ? 'bg-red-50 text-red-700' :
                          producto.stock <= producto.stockMinimo ? 'bg-amber-50 text-amber-700' :
                          'bg-emerald-50 text-emerald-700'
                        }>
                          {producto.stock} uds
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={producto.estado}
                          onValueChange={(value: string) => handleCambiarEstado(producto.id, value)}
                        >
                          <SelectTrigger className={`w-[140px] ${
                            producto.estado === 'Disponible' ? 'bg-emerald-50 border-emerald-200' :
                            producto.estado === 'Stock bajo' ? 'bg-amber-50 border-amber-200' :
                            'bg-red-50 border-red-200'
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Disponible">
                              <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-emerald-500" />
                                Disponible
                              </div>
                            </SelectItem>
                            <SelectItem value="Stock bajo">
                              <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-amber-500" />
                                Stock bajo
                              </div>
                            </SelectItem>
                            <SelectItem value="Agotado">
                              <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-red-500" />
                                Agotado
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedProducto(producto);
                              setIsDetailModalOpen(true);
                            }}
                            title="Ver detalles"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleOpenEdit(producto)}
                            title="Editar producto"
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedProducto(producto);
                              setIsDeleteDialogOpen(true);
                            }}
                            title="Eliminar producto"
                          >
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredProductos.length)} de {filteredProductos.length} productos
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  disabled={currentPage === 1}
                >
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Crear Producto */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-emerald-600" />
              Crear Nuevo Producto
            </DialogTitle>
            <DialogDescription>
              Completa los datos del nuevo producto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input 
                  id="codigo" 
                  placeholder="PROD-001"
                  value={formData.codigo}
                  onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del producto *</Label>
                <Input 
                  id="nombre" 
                  placeholder="Laptop HP Pavilion"
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría *</Label>
                <Select 
                  value={formData.categoria}
                  onValueChange={(value: string) => setFormData(prev => ({ ...prev, categoria: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="proveedor">Proveedor *</Label>
                <Select 
                  value={formData.proveedor}
                  onValueChange={(value: string) => setFormData(prev => ({ ...prev, proveedor: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map(prov => (
                      <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="precioCompra">Precio de compra</Label>
                <Input 
                  id="precioCompra" 
                  type="number"
                  placeholder="100000"
                  value={formData.precioCompra}
                  onChange={(e) => setFormData(prev => ({ ...prev, precioCompra: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="precioVenta">Precio de venta</Label>
                <Input 
                  id="precioVenta" 
                  type="number"
                  placeholder="150000"
                  value={formData.precioVenta}
                  onChange={(e) => setFormData(prev => ({ ...prev, precioVenta: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock inicial</Label>
                <Input 
                  id="stock" 
                  type="number"
                  placeholder="10"
                  value={formData.stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stockMinimo">Stock mínimo</Label>
                <Input 
                  id="stockMinimo" 
                  type="number"
                  placeholder="5"
                  value={formData.stockMinimo}
                  onChange={(e) => setFormData(prev => ({ ...prev, stockMinimo: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea 
                id="descripcion" 
                placeholder="Descripción del producto..."
                rows={3}
                value={formData.descripcion}
                onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreate}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Crear producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Producto */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="size-5 text-emerald-600" />
              Editar Producto: {selectedProducto?.nombre}
            </DialogTitle>
            <DialogDescription>
              Actualiza los datos del producto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-codigo">Código *</Label>
                <Input 
                  id="edit-codigo" 
                  placeholder="PROD-001"
                  value={formData.codigo}
                  onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nombre">Nombre del producto *</Label>
                <Input 
                  id="edit-nombre" 
                  placeholder="Laptop HP Pavilion"
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-categoria">Categoría *</Label>
                <Select 
                  value={formData.categoria}
                  onValueChange={(value: string) => setFormData(prev => ({ ...prev, categoria: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-proveedor">Proveedor *</Label>
                <Select 
                  value={formData.proveedor}
                  onValueChange={(value: string) => setFormData(prev => ({ ...prev, proveedor: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map(prov => (
                      <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-precioCompra">Precio de compra</Label>
                <Input 
                  id="edit-precioCompra" 
                  type="number"
                  placeholder="100000"
                  value={formData.precioCompra}
                  onChange={(e) => setFormData(prev => ({ ...prev, precioCompra: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-precioVenta">Precio de venta</Label>
                <Input 
                  id="edit-precioVenta" 
                  type="number"
                  placeholder="150000"
                  value={formData.precioVenta}
                  onChange={(e) => setFormData(prev => ({ ...prev, precioVenta: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-stock">Stock actual</Label>
                <Input 
                  id="edit-stock" 
                  type="number"
                  placeholder="10"
                  value={formData.stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-stockMinimo">Stock mínimo</Label>
                <Input 
                  id="edit-stockMinimo" 
                  type="number"
                  placeholder="5"
                  value={formData.stockMinimo}
                  onChange={(e) => setFormData(prev => ({ ...prev, stockMinimo: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-descripcion">Descripción</Label>
              <Textarea 
                id="edit-descripcion" 
                placeholder="Descripción del producto..."
                rows={3}
                value={formData.descripcion}
                onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedProducto(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleEdit}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Actualizar producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ver Detalles */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-emerald-600" />
              Detalle del Producto
            </DialogTitle>
            <DialogDescription>
              Información completa del producto
            </DialogDescription>
          </DialogHeader>
          {selectedProducto && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="p-4 bg-purple-100 rounded-full">
                  <Package className="size-8 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-slate-900">{selectedProducto.nombre}</h3>
                  <p className="text-sm text-slate-600 mt-1">{selectedProducto.codigo}</p>
                  <Badge className={`mt-2 ${getEstadoColor(selectedProducto.estado)}`}>
                    {selectedProducto.estado}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Categoría</Label>
                  <p className="text-slate-900 mt-1">{selectedProducto.categoria}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Proveedor</Label>
                  <p className="text-slate-900 mt-1">{selectedProducto.proveedor}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Precio de compra</Label>
                  <p className="text-slate-900 mt-1">{formatCurrency(selectedProducto.precioCompra)}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Precio de venta</Label>
                  <p className="text-slate-900 mt-1">{formatCurrency(selectedProducto.precioVenta)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Stock actual</Label>
                  <p className="text-slate-900 mt-1">{selectedProducto.stock} unidades</p>
                </div>
                <div>
                  <Label className="text-slate-600">Stock mínimo</Label>
                  <p className="text-slate-900 mt-1">{selectedProducto.stockMinimo} unidades</p>
                </div>
              </div>

              <div>
                <Label className="text-slate-600">Margen de ganancia</Label>
                <p className="text-emerald-600 mt-1">
                  {formatCurrency(selectedProducto.precioVenta - selectedProducto.precioCompra)} 
                  <span className="text-sm text-slate-600 ml-2">
                    ({Math.round((selectedProducto.precioVenta - selectedProducto.precioCompra) / selectedProducto.precioCompra * 100)}%)
                  </span>
                </p>
              </div>

              {selectedProducto.descripcion && (
                <div>
                  <Label className="text-slate-600">Descripción</Label>
                  <p className="text-slate-900 mt-1">{selectedProducto.descripcion}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setIsDetailModalOpen(false);
                setSelectedProducto(null);
              }}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Eliminar Producto */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de eliminar este producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El producto "{selectedProducto?.nombre}" será eliminado permanentemente del inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProducto(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar producto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Cambiar Estado Producto */}
      <AlertDialog open={isToggleEstadoDialogOpen} onOpenChange={(open: boolean) => {
        setIsToggleEstadoDialogOpen(open);
        if (!open) { setPendingEstadoCambio(null); setSelectedProducto(null); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de estado?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de cambiar el estado del producto "{selectedProducto?.nombre}" a{' '}
              <strong>"{pendingEstadoCambio?.nuevoEstado}"</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingEstadoCambio(null); setSelectedProducto(null); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmEstadoCambio}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirmar cambio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}