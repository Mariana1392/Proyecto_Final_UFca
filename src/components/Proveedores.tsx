import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Search, Filter, Plus, Eye, ChevronLeft, ChevronRight, Truck, Edit, Trash2, Phone, Mail, Building2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { toast } from 'sonner';

import { supabase } from '../lib/supabase';
import { proveedoresApi } from '../lib/api';

export default function Proveedores() {
  const [searchTerm, setSearchTerm]                     = useState('');
  const [currentPage, setCurrentPage]                   = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen]       = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen]       = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]     = useState(false);
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor]       = useState<any>(null);
  const itemsPerPage = 10;

  // Formulario
  const emptyForm = { nombre: '', nit: '', contacto: '', telefono: '', email: '', direccion: '', categoria: '' };
  const [form, setForm] = useState(emptyForm);
  const setF = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => { cargarProveedores(); }, []);

  async function cargarProveedores() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('proveedores')
        .select('*, compras(count)')
        .order('nombre');
      if (error) throw error;

      const mapeados = (data || []).map((p: any, i: number) => ({
        id:               p.id,
        codigo:           `PROV-${String(i + 1).padStart(3, '0')}`,
        nombre:           p.nombre,
        categoria:        'General',
        contacto:         p.nombre,
        telefono:         p.telefono  ?? '',
        email:            p.email     ?? '',
        direccion:        p.direccion ?? '',
        nit:              p.nit       ?? '',
        comprasMensuales: p.compras?.[0]?.count ?? 0,
        totalComprado:    0,
        estado:           p.activo,
      }));
      setProveedores(mapeados);
    } catch (err: any) {
      toast.error('Error al cargar proveedores: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredProveedores = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages         = Math.ceil(filteredProveedores.length / itemsPerPage);
  const startIndex         = (currentPage - 1) * itemsPerPage;
  const endIndex           = startIndex + itemsPerPage;
  const currentProveedores = filteredProveedores.slice(startIndex, endIndex);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const handleToggleEstado = async (id: string) => {
    const prov = proveedores.find(p => p.id === id);
    if (!prov) return;
    try {
      await proveedoresApi.update(id, { activo: !prov.estado });
      setProveedores(prev => prev.map(p => p.id === id ? { ...p, estado: !p.estado } : p));
      toast.success(`Proveedor "${prov.nombre}" ${!prov.estado ? 'activado' : 'desactivado'} exitosamente`);
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
    setIsToggleEstadoDialogOpen(false);
    setSelectedProveedor(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }

    // ── EDITAR ────────────────────────────────────────────────────────────────
    if (selectedProveedor) {
      try {
        await proveedoresApi.update(selectedProveedor.id, {
          nombre:    form.nombre.trim(),
          nit:       form.nit.trim()       || null,
          telefono:  form.telefono.trim()  || null,
          email:     form.email.trim()     || null,
          direccion: form.direccion.trim() || null,
        });
        setProveedores(prev => prev.map(p => p.id === selectedProveedor.id
          ? { ...p, nombre: form.nombre, contacto: form.contacto, telefono: form.telefono, email: form.email, direccion: form.direccion, nit: form.nit, categoria: form.categoria || 'General' }
          : p
        ));
        toast.success('Proveedor actualizado exitosamente');
        setIsCreateModalOpen(false);
        setSelectedProveedor(null);
        setForm(emptyForm);
      } catch (err: any) {
        toast.error('Error al actualizar proveedor: ' + err.message);
      }
      return;
    }

    // ── CREAR ─────────────────────────────────────────────────────────────────
    try {
      const nuevo = await proveedoresApi.create({
        nombre:    form.nombre.trim(),
        nit:       form.nit.trim()       || null,
        telefono:  form.telefono.trim()  || null,
        email:     form.email.trim()     || null,
        direccion: form.direccion.trim() || null,
        activo:    true,
      });
      setProveedores(prev => [...prev, {
        id: nuevo.id, codigo: `PROV-${String(prev.length + 1).padStart(3, '0')}`,
        nombre: form.nombre, categoria: form.categoria || 'General',
        contacto: form.contacto, telefono: form.telefono,
        email: form.email, direccion: form.direccion, nit: form.nit,
        comprasMensuales: 0, totalComprado: 0, estado: true,
      }]);
      toast.success('Proveedor registrado exitosamente');
      setIsCreateModalOpen(false);
      setForm(emptyForm);
    } catch (err: any) {
      toast.error('Error al crear proveedor: ' + err.message);
    }
  };

  const handleViewDetails = (proveedor: any) => {
    setSelectedProveedor(proveedor);
    setIsDetailModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedProveedor) return;
    try {
      await proveedoresApi.delete(selectedProveedor.id);
      setProveedores(prev => prev.filter(p => p.id !== selectedProveedor.id));
      toast.success(`Proveedor "${selectedProveedor.nombre}" eliminado exitosamente`);
    } catch (err: any) {
      toast.error('Error al eliminar proveedor: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedProveedor(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando proveedores...</p>
        </div>
      </div>
    );
  }

  // JSX original desde aquí
  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Gestión de Proveedores</h1>
            <p className="text-slate-600">Administra los proveedores del sistema</p>
          </div>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="size-4" />
            Nuevo proveedor
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Lista de Proveedores</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar proveedor..."
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
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Compras</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentProveedores.map((proveedor) => (
                    <TableRow key={proveedor.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-teal-100 rounded-lg">
                            <Building2 className="size-4 text-teal-600" />
                          </div>
                          <p className="text-slate-900">{proveedor.codigo}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-900">{proveedor.nombre}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                          {proveedor.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-slate-900">{proveedor.contacto}</p>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="size-3" />
                            {proveedor.telefono}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="size-3" />
                            {proveedor.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-slate-900">{formatCurrency(proveedor.totalComprado)}</p>
                          <p className="text-sm text-slate-500">{proveedor.comprasMensuales} compras/mes</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={proveedor.estado}
                            onCheckedChange={() => {
                              setSelectedProveedor(proveedor);
                              setIsToggleEstadoDialogOpen(true);
                            }}
                          />
                          <span className="text-sm text-slate-600">
                            {proveedor.estado ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => handleViewDetails(proveedor)}>
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                            setSelectedProveedor(proveedor);
                            setForm({
                              nombre:    proveedor.nombre    ?? '',
                              nit:       proveedor.nit       ?? '',
                              contacto:  proveedor.contacto  ?? '',
                              telefono:  proveedor.telefono  ?? '',
                              email:     proveedor.email     ?? '',
                              direccion: proveedor.direccion ?? '',
                              categoria: proveedor.categoria ?? '',
                            });
                            setIsCreateModalOpen(true);
                          }}>
                            <Edit className="size-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                            setSelectedProveedor(proveedor);
                            setIsDeleteDialogOpen(true);
                          }}>
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredProveedores.length)} de {filteredProveedores.length} proveedores
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
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          if (!open) { setSelectedProveedor(null); setForm(emptyForm); }
          setIsCreateModalOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedProveedor ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
            <DialogDescription>
              {selectedProveedor ? 'Actualiza la información del proveedor' : 'Completa los datos del nuevo proveedor'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre <span className="text-red-500">*</span></Label>
                <Input id="nombre" placeholder="Distribuidora ABC" value={form.nombre} onChange={setF('nombre')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría</Label>
                <Input id="categoria" placeholder="Alimentos" value={form.categoria} onChange={setF('categoria')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contacto">Persona de contacto</Label>
                <Input id="contacto" placeholder="Carlos Martínez" value={form.contacto} onChange={setF('contacto')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" placeholder="+57 320 111 2222" value={form.telefono} onChange={setF('telefono')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="ventas@proveedor.com" value={form.email} onChange={setF('email')} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsCreateModalOpen(false);
                setSelectedProveedor(null);
                setForm(emptyForm);
              }}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                {selectedProveedor ? 'Actualizar' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del proveedor</DialogTitle>
          </DialogHeader>
          {selectedProveedor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Código</Label>
                  <p className="text-slate-900 mt-1">{selectedProveedor.codigo}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Categoría</Label>
                  <p className="text-slate-900 mt-1">{selectedProveedor.categoria}</p>
                </div>
              </div>
              <div>
                <Label className="text-slate-600">Nombre</Label>
                <p className="text-slate-900 mt-1">{selectedProveedor.nombre}</p>
              </div>
              <div>
                <Label className="text-slate-600">Contacto</Label>
                <p className="text-slate-900 mt-1">{selectedProveedor.contacto}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Teléfono</Label>
                  <p className="text-slate-900 mt-1">{selectedProveedor.telefono}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Email</Label>
                  <p className="text-slate-900 mt-1">{selectedProveedor.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Compras mensuales</Label>
                  <p className="text-slate-900 mt-1">{selectedProveedor.comprasMensuales}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Total comprado</Label>
                  <p className="text-slate-900 mt-1">{formatCurrency(selectedProveedor.totalComprado)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el proveedor "{selectedProveedor?.nombre}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProveedor(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isToggleEstadoDialogOpen} onOpenChange={setIsToggleEstadoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se cambiará el estado del proveedor "{selectedProveedor?.nombre}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProveedor(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleToggleEstado(selectedProveedor?.id)} className="bg-emerald-600 hover:bg-emerald-700">
              Cambiar estado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}