import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Search, Filter, Plus, Eye, ChevronLeft, ChevronRight, FolderOpen, Edit, Trash2 } from 'lucide-react';
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
import { toast } from 'sonner';

// ── Supabase ──────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { categoriasApi } from '../lib/api';

export default function Categorias() {
  const [searchTerm, setSearchTerm]                   = useState('');
  const [currentPage, setCurrentPage]                 = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen]     = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen]     = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]   = useState(false);
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [selectedCategoria, setSelectedCategoria]     = useState<any>(null);
  const itemsPerPage = 10;

  // Formulario
  const emptyForm = { nombre: '', descripcion: '' };
  const [form, setForm] = useState(emptyForm);
  const setF = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  // ── Estado Supabase ───────────────────────────────────────────────────────
  const [categorias, setCategorias]         = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);

  useEffect(() => { cargarCategorias(); }, []);

  async function cargarCategorias() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categorias')
        .select(`
          *,
          productos(count)
        `)
        .order('nombre');
      if (error) throw error;

      const mapeadas = (data || []).map((c: any) => ({
        id:             c.id,
        codigo:         `CAT-${c.id.slice(0, 6).toUpperCase()}`,
        nombre:         c.nombre,
        descripcion:    c.descripcion || '',
        totalProductos: c.productos?.[0]?.count ?? 0,
        estado:         c.activo,
      }));
      setCategorias(mapeadas);
    } catch (err: any) {
      toast.error('Error al cargar categorías: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Filtros y paginación ──────────────────────────────────────────────────
  const filteredCategorias = categorias.filter(cat =>
    cat.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages       = Math.ceil(filteredCategorias.length / itemsPerPage);
  const startIndex       = (currentPage - 1) * itemsPerPage;
  const endIndex         = startIndex + itemsPerPage;
  const currentCategorias = filteredCategorias.slice(startIndex, endIndex);

  // ── Handlers con Supabase ─────────────────────────────────────────────────
  const handleToggleEstado = async (id: string) => {
    const cat = categorias.find(c => c.id === id);
    if (!cat) return;
    try {
      await categoriasApi.update(id, { activo: !cat.estado });
      setCategorias(prev => prev.map(c => c.id === id ? { ...c, estado: !c.estado } : c));
      toast.success(`Categoría "${cat.nombre}" ${!cat.estado ? 'activada' : 'desactivada'} exitosamente`);
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
    setIsToggleEstadoDialogOpen(false);
    setSelectedCategoria(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }

    // ── EDITAR ────────────────────────────────────────────────────────────────
    if (selectedCategoria) {
      try {
        await categoriasApi.update(selectedCategoria.id, {
          nombre:      form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
        });
        setCategorias(prev => prev.map(c => c.id === selectedCategoria.id
          ? { ...c, nombre: form.nombre, descripcion: form.descripcion }
          : c
        ));
        toast.success('Categoría actualizada exitosamente');
        setIsCreateModalOpen(false);
        setSelectedCategoria(null);
        setForm(emptyForm);
      } catch (err: any) {
        toast.error('Error al actualizar categoría: ' + err.message);
      }
      return;
    }

    // ── CREAR ─────────────────────────────────────────────────────────────────
    try {
      const nueva = await categoriasApi.create({ nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), activo: true });
      setCategorias(prev => [...prev, {
        id:             nueva.id,
        codigo:         `CAT-${nueva.id.slice(0, 6).toUpperCase()}`,
        nombre:         nueva.nombre,
        descripcion:    nueva.descripcion || '',
        totalProductos: 0,
        estado:         true,
      }]);
      toast.success('Categoría creada exitosamente');
      setIsCreateModalOpen(false);
      setForm(emptyForm);
    } catch (err: any) {
      toast.error('Error al crear categoría: ' + err.message);
    }
  };

  const handleViewDetails = (categoria: any) => {
    setSelectedCategoria(categoria);
    setIsDetailModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedCategoria) return;
    try {
      await categoriasApi.delete(selectedCategoria.id);
      setCategorias(prev => prev.filter(c => c.id !== selectedCategoria.id));
      toast.success(`Categoría "${selectedCategoria.nombre}" eliminada exitosamente`);
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedCategoria(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando categorías...</p>
        </div>
      </div>
    );
  }

  // ── JSX original desde aquí (sin cambios) ────────────────────────────────
  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Categorías de Productos</h1>
            <p className="text-slate-600">Gestiona las categorías del inventario</p>
          </div>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="size-4" />
            Nueva categoría
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Lista de Categorías</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar categoría..."
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
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Total productos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentCategorias.map((categoria) => (
                    <TableRow key={categoria.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <FolderOpen className="size-4 text-indigo-600" />
                          </div>
                          <p className="text-slate-900">{categoria.codigo}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-900">{categoria.nombre}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-600">{categoria.descripcion}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          {categoria.totalProductos} productos
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={categoria.estado}
                            onCheckedChange={() => {
                              setSelectedCategoria(categoria);
                              setIsToggleEstadoDialogOpen(true);
                            }}
                          />
                          <span className="text-sm text-slate-600">
                            {categoria.estado ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => handleViewDetails(categoria)}>
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                            setSelectedCategoria(categoria);
                            setForm({ nombre: categoria.nombre ?? '', descripcion: categoria.descripcion ?? '' });
                            setIsCreateModalOpen(true);
                          }}>
                            <Edit className="size-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                            setSelectedCategoria(categoria);
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
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredCategorias.length)} de {filteredCategorias.length} categorías
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
          if (!open) { setSelectedCategoria(null); setForm(emptyForm); }
          setIsCreateModalOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCategoria ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
            <DialogDescription>
              {selectedCategoria ? 'Actualiza la información de la categoría' : 'Completa los datos de la nueva categoría'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre <span className="text-red-500">*</span></Label>
                <Input id="nombre" placeholder="Tecnología" value={form.nombre} onChange={setF('nombre')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea id="descripcion" placeholder="Descripción..." rows={3} value={form.descripcion} onChange={setF('descripcion')} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsCreateModalOpen(false);
                setSelectedCategoria(null);
                setForm(emptyForm);
              }}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                {selectedCategoria ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de categoría</DialogTitle>
          </DialogHeader>
          {selectedCategoria && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Código</Label>
                  <p className="text-slate-900 mt-1">{selectedCategoria.codigo}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Nombre</Label>
                  <p className="text-slate-900 mt-1">{selectedCategoria.nombre}</p>
                </div>
              </div>
              <div>
                <Label className="text-slate-600">Descripción</Label>
                <p className="text-slate-900 mt-1">{selectedCategoria.descripcion}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Total productos</Label>
                  <p className="text-slate-900 mt-1">{selectedCategoria.totalProductos}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Estado</Label>
                  <p className="text-slate-900 mt-1">{selectedCategoria.estado ? 'Activa' : 'Inactiva'}</p>
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
              Esta acción no se puede deshacer. Se eliminará la categoría "{selectedCategoria?.nombre}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedCategoria(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isToggleEstadoDialogOpen} onOpenChange={(open: boolean) => {
        setIsToggleEstadoDialogOpen(open);
        if (!open) setSelectedCategoria(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de estado?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de {selectedCategoria?.estado ? 'desactivar' : 'activar'} la categoría "{selectedCategoria?.nombre}".
              {selectedCategoria?.estado && ' Los productos de esta categoría podrían verse afectados.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedCategoria(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleToggleEstado(selectedCategoria?.id)}
              className={selectedCategoria?.estado ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              {selectedCategoria?.estado ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}