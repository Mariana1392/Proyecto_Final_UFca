import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Search, Filter, Plus, Eye, ChevronLeft, ChevronRight, Users, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { toast } from 'sonner';

import { supabase } from '../lib/supabase';

interface ReferidosProps {
  userRole?: 'admin' | 'asociado' | null;
  userData?: any;
}

export default function Referidos({ userRole, userData }: ReferidosProps) {
  const [searchTerm, setSearchTerm]                     = useState('');
  const [currentPage, setCurrentPage]                   = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen]     = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen]     = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]     = useState(false);
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem]                 = useState<any>(null);
  const itemsPerPage = 10;

  const [referidos, setReferidos] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => { cargarReferidos(); }, []);

  async function cargarReferidos() {
    try {
      setLoading(true);
      // Referido = asociado que tiene referido_por_id != null
      // Obtenemos la cadena: referente → referido
      const { data, error } = await supabase
        .from('asociados')
        .select(`
          id, nombre, cedula, telefono, fecha_ingreso, estado,
          referente:asociados!referido_por_id(id, nombre)
        `)
        .not('referido_por_id', 'is', null)
        .order('fecha_ingreso', { ascending: false });

      if (error) throw error;

      const mapeados = (data || []).map((r: any) => ({
        id:             r.id,
        referente:      r.referente?.nombre ?? 'Desconocido',
        referente_id:   r.referente?.id,
        referido:       r.nombre,
        cedula:         r.cedula,
        telefono:       r.telefono ?? '',
        fechaReferido:  r.fecha_ingreso,
        estadoReferido: r.estado ? 'Aprobado' : 'Inactivo',
        bonificacion:   50000,
        estado:         r.estado,
      }));

      setReferidos(mapeados);
    } catch (err: any) {
      toast.error('Error al cargar referidos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filtrar según rol
  const referidosVisibles = userRole === 'asociado' && userData
    ? referidos.filter(r => r.referente === (userData.name || userData.nombre))
    : referidos;

  const filteredReferidos = referidosVisibles.filter(r =>
    r.referente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.referido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.cedula.includes(searchTerm)
  );

  const totalPages       = Math.ceil(filteredReferidos.length / itemsPerPage);
  const startIndex       = (currentPage - 1) * itemsPerPage;
  const endIndex         = startIndex + itemsPerPage;
  const currentReferidos = filteredReferidos.slice(startIndex, endIndex);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const handleToggleEstado = async (id: string) => {
    const ref = referidos.find(r => r.id === id);
    if (!ref) return;
    try {
      await supabase.from('asociados').update({ estado: !ref.estado }).eq('id', id);
      setReferidos(prev => prev.map(r => r.id === id ? { ...r, estado: !r.estado, estadoReferido: !r.estado ? 'Aprobado' : 'Inactivo' } : r));
      toast.success(`Referido "${ref.referido}" ${!ref.estado ? 'activado' : 'desactivado'} exitosamente`);
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
    setIsToggleEstadoDialogOpen(false);
    setSelectedItem(null);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      // Quitar el referido_por_id del asociado (no lo eliminamos, solo desvinculamos)
      await supabase.from('asociados').update({ referido_por_id: null }).eq('id', selectedItem.id);
      setReferidos(prev => prev.filter(r => r.id !== selectedItem.id));
      toast.success(`Referido "${selectedItem.referido}" eliminado exitosamente`);
    } catch (err: any) {
      toast.error('Error al eliminar referido: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedItem(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando referidos...</p>
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
            <h1 className="text-slate-900 mb-2">Gestión de Referidos</h1>
            <p className="text-slate-600">{userRole === 'asociado' ? 'Consulta tus referidos' : 'Administra los referidos de los asociados'}</p>
          </div>
          {userRole === 'admin' && (
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="size-4" />
              Nuevo referido
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Lista de Referidos</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar referido..."
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
                    <TableHead>Referente</TableHead>
                    <TableHead>Referido</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Estado proceso</TableHead>
                    <TableHead>Bonificación</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentReferidos.map((referido) => (
                    <TableRow key={referido.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Users className="size-4 text-purple-600" />
                          </div>
                          <p className="text-slate-900">{referido.referente}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-900">{referido.referido}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-600">{referido.cedula}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-600">{referido.telefono}</p>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={
                            referido.estadoReferido === 'Aprobado' ? 'bg-emerald-100 text-emerald-700' :
                            referido.estadoReferido === 'En proceso' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }
                        >
                          {referido.estadoReferido}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-900">{formatCurrency(referido.bonificacion)}</p>
                      </TableCell>
                      <TableCell>
                        {userRole === 'admin' ? (
                          <Switch
                            checked={referido.estado}
                            onCheckedChange={() => {
                              setSelectedItem(referido);
                              setIsToggleEstadoDialogOpen(true);
                            }}
                          />
                        ) : (
                          <Badge variant={referido.estado ? "default" : "secondary"} className={referido.estado ? "bg-emerald-600" : ""}>
                            {referido.estado ? 'Activo' : 'Inactivo'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => {
                            setSelectedItem(referido);
                            setIsDetailDialogOpen(true);
                          }}>
                            <Eye className="size-4" />
                          </Button>
                          {userRole === 'admin' && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => {
                                setSelectedItem(referido);
                                setIsCreateDialogOpen(true);
                              }}>
                                <Edit className="size-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => {
                                setSelectedItem(referido);
                                setIsDeleteDialogOpen(true);
                              }}>
                                <Trash2 className="size-4 text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredReferidos.length)} de {filteredReferidos.length} referidos
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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Editar referido' : 'Nuevo referido'}</DialogTitle>
            <DialogDescription>
              {selectedItem ? 'Actualiza la información del referido' : 'Registra un nuevo referido'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="referente">Referente (Asociado)</Label>
              <Input id="referente" placeholder="Seleccionar asociado..." defaultValue={selectedItem?.referente} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referido">Referido</Label>
              <Input id="referido" placeholder="Nombre del referido" defaultValue={selectedItem?.referido} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cedula">Cédula</Label>
                <Input id="cedula" placeholder="1.555.666.777" defaultValue={selectedItem?.cedula} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" placeholder="+57 315 111 2222" defaultValue={selectedItem?.telefono} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setSelectedItem(null);
            }}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => {
              toast.success(selectedItem ? 'Referido actualizado' : 'Referido registrado');
              setIsCreateDialogOpen(false);
              setSelectedItem(null);
            }}>{selectedItem ? 'Actualizar' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del referido</DialogTitle>
            <DialogDescription>
              Información completa del referido
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Referente</Label>
                  <p className="text-slate-900 mt-1">{selectedItem.referente}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Referido</Label>
                  <p className="text-slate-900 mt-1">{selectedItem.referido}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Cédula</Label>
                  <p className="text-slate-900 mt-1">{selectedItem.cedula}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Teléfono</Label>
                  <p className="text-slate-900 mt-1">{selectedItem.telefono}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Estado del proceso</Label>
                  <p className="text-slate-900 mt-1">{selectedItem.estadoReferido}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Bonificación</Label>
                  <p className="text-slate-900 mt-1">{formatCurrency(selectedItem.bonificacion)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el referido "{selectedItem?.referido}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isToggleEstadoDialogOpen} onOpenChange={(open: boolean) => {
        setIsToggleEstadoDialogOpen(open);
        if (!open) setSelectedItem(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de estado?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de {selectedItem?.estado ? 'desactivar' : 'activar'} el referido "{selectedItem?.referido}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleToggleEstado(selectedItem?.id)}
              className={selectedItem?.estado ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              {selectedItem?.estado ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}