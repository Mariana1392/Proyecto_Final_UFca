import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Search, Filter, Plus, Eye, ChevronLeft, ChevronRight, Users, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { toast } from 'sonner';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ReferidosProps {
  userData?: any;
}

export default function Referidos({ userData }: ReferidosProps) {
  const { can } = useAuth();

  const [searchTerm, setSearchTerm]                             = useState('');
  const [currentPage, setCurrentPage]                           = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen]             = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen]             = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]             = useState(false);
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem]                         = useState<any>(null);
  const itemsPerPage = 10;

  const [referidos, setReferidos]                 = useState<any[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [saving, setSaving]                       = useState(false);
  const [bonificacionReferido, setBonificacionReferido] = useState<number>(50_000);

  // Lista de asociados activos para el selector
  const [asociadosList, setAsociadosList] = useState<{ id: string; nombre: string; cedula: string }[]>([]);

  // Campos del formulario
  const [formAsociadoId,   setFormAsociadoId]   = useState('');
  const [formNombre,       setFormNombre]       = useState('');
  const [formCedula,       setFormCedula]       = useState('');
  const [formTelefono,     setFormTelefono]     = useState('');
  const [formObservaciones,setFormObservaciones]= useState('');

  useEffect(() => { cargarReferidos(); }, []);

  // ── Carga lista de asociados activos para el selector ────────────────────────
  async function cargarAsociadosList() {
    const { data } = await supabase
      .from('asociados')
      .select('id, nombre, cedula')
      .eq('estado', 'activo')
      .eq('anulado', false)
      .order('nombre');
    setAsociadosList(data ?? []);
  }

  // ── Abrir formulario (nuevo o editar) ────────────────────────────────────────
  function abrirFormulario(item?: any) {
    if (item) {
      setSelectedItem(item);
      setFormAsociadoId(item.asociado_id ?? '');
      setFormNombre(item.nombre ?? '');
      setFormCedula(item.cedula ?? '');
      setFormTelefono(item.telefono ?? '');
      setFormObservaciones(item.observaciones ?? '');
    } else {
      setSelectedItem(null);
      setFormAsociadoId('');
      setFormNombre('');
      setFormCedula('');
      setFormTelefono('');
      setFormObservaciones('');
    }
    cargarAsociadosList();
    setIsCreateDialogOpen(true);
  }

  // ── Guardar referido ─────────────────────────────────────────────────────────
  async function handleGuardar() {
    if (!formAsociadoId) { toast.error('Selecciona el asociado responsable'); return; }
    if (!formNombre.trim()) { toast.error('Escribe el nombre del referido'); return; }
    if (!formCedula.trim()) { toast.error('Escribe la cédula del referido'); return; }

    try {
      setSaving(true);
      const payload = {
        asociado_id:   formAsociadoId,
        nombre:        formNombre.trim(),
        cedula:        formCedula.trim(),
        telefono:      formTelefono.trim() || null,
        observaciones: formObservaciones.trim() || null,
      };

      if (selectedItem) {
        const { error } = await supabase.from('referidos').update(payload).eq('id', selectedItem.id);
        if (error) throw error;
        toast.success('Referido actualizado correctamente');
      } else {
        const { error } = await supabase.from('referidos').insert(payload);
        if (error) throw error;
        toast.success('Referido registrado correctamente');
      }

      setIsCreateDialogOpen(false);
      setSelectedItem(null);
      cargarReferidos();
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Cargar referidos ─────────────────────────────────────────────────────────
  async function cargarReferidos() {
    try {
      setLoading(true);

      const [{ data, error }, { data: cfgData }] = await Promise.all([
        supabase
          .from('referidos')
          .select(`
            id, nombre, cedula, telefono, estado, observaciones, created_at,
            asociado:asociados!asociado_id(id, nombre, cedula)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', 'bonificacion_referido')
          .maybeSingle(),
      ]);

      if (error) throw error;

      const bonif = cfgData?.valor ? Number(cfgData.valor) : 50_000;
      setBonificacionReferido(bonif);

      const mapeados = (data || []).map((r: any) => ({
        id:            r.id,
        asociado_id:   r.asociado?.id,
        asociado:      r.asociado?.nombre ?? 'Desconocido',
        asociadoCedula:r.asociado?.cedula ?? '',
        nombre:        r.nombre,
        cedula:        r.cedula,
        telefono:      r.telefono ?? '',
        estado:        r.estado === 'activo',
        observaciones: r.observaciones ?? '',
        bonificacion:  bonif,
        fechaRegistro: r.created_at,
      }));

      setReferidos(mapeados);
    } catch (err: any) {
      toast.error('Error al cargar referidos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Cambiar estado + pago automático de bonificación ────────────────────────
  const handleToggleEstado = async (id: string) => {
    const ref = referidos.find(r => r.id === id);
    if (!ref) return;
    try {
      const nuevoEstado = !ref.estado;

      // 1. Actualizar estado del referido
      const { error } = await supabase
        .from('referidos')
        .update({ estado: nuevoEstado ? 'activo' : 'inactivo' })
        .eq('id', id);
      if (error) throw error;

      // 2. Si se está ACTIVANDO, acreditar bonificación al ahorro voluntario del asociado
      if (nuevoEstado && ref.asociado_id) {
        const bonif = bonificacionReferido;

        // Buscar el ahorro voluntario activo del asociado referente
        const { data: ahorroVol } = await supabase
          .from('ahorros_voluntarios')
          .select('id, monto_ahorrado, asociado_id')
          .eq('asociado_id', ref.asociado_id)
          .eq('estado', 'activo')
          .eq('anulado', false)
          .order('monto_ahorrado', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ahorroVol) {
          const saldoAnterior = Number(ahorroVol.monto_ahorrado) || 0;
          const saldoNuevo    = saldoAnterior + bonif;

          // Registrar el movimiento
          await supabase.from('pagos_ahorro_voluntario').insert({
            ahorro_voluntario_id: ahorroVol.id,
            asociado_id:          ref.asociado_id,
            fecha_pago:           new Date().toISOString().split('T')[0],
            monto:                bonif,
            observacion:          `Bonificación por referido aprobado: ${ref.nombre} (CC ${ref.cedula})`,
          });

          // Actualizar saldo
          await supabase
            .from('ahorros_voluntarios')
            .update({ monto_ahorrado: saldoNuevo })
            .eq('id', ahorroVol.id);

          toast.success(`Referido "${ref.nombre}" activado`, {
            description: `Bonificación de ${formatCurrency(bonif)} acreditada al ahorro voluntario de ${ref.asociado}.`,
          });
        } else {
          // El asociado no tiene ahorro voluntario — avisar pero no bloquear
          toast.success(`Referido "${ref.nombre}" activado`, {
            description: `⚠ ${ref.asociado} no tiene ahorro voluntario activo. La bonificación de ${formatCurrency(bonif)} deberá registrarse manualmente.`,
          });
        }
      } else {
        toast.success(`Referido "${ref.nombre}" ${nuevoEstado ? 'activado' : 'desactivado'}`);
      }

      setReferidos(prev => prev.map(r => r.id === id ? { ...r, estado: nuevoEstado } : r));
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
    setIsToggleEstadoDialogOpen(false);
    setSelectedItem(null);
  };

  // ── Eliminar ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      const { error } = await supabase.from('referidos').delete().eq('id', selectedItem.id);
      if (error) throw error;
      setReferidos(prev => prev.filter(r => r.id !== selectedItem.id));
      toast.success(`Referido "${selectedItem.nombre}" eliminado`);
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedItem(null);
  };

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const esVistaPropia = !can('asociados');
  const referidosVisibles = esVistaPropia && userData
    ? referidos.filter(r => r.asociado === (userData.name || userData.nombre))
    : referidos;

  const filteredReferidos = referidosVisibles.filter(r =>
    r.asociado.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.cedula.includes(searchTerm)
  );

  const totalPages       = Math.ceil(filteredReferidos.length / itemsPerPage);
  const startIndex       = (currentPage - 1) * itemsPerPage;
  const currentReferidos = filteredReferidos.slice(startIndex, startIndex + itemsPerPage);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Gestión de Referidos</h1>
            <p className="text-slate-600">
              {esVistaPropia ? 'Consulta tus referidos' : 'Personas externas referenciadas por asociados'}
            </p>
          </div>
          {!esVistaPropia && (
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => abrirFormulario()}>
              <Plus className="size-4" />
              Nuevo referido
            </Button>
          )}
        </div>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Lista de Referidos</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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
                    <TableHead>Asociado responsable</TableHead>
                    <TableHead>Referido (externo)</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Bonificación</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentReferidos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        No hay referidos registrados
                      </TableCell>
                    </TableRow>
                  ) : currentReferidos.map(ref => (
                    <TableRow key={ref.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Users className="size-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-slate-900 font-medium">{ref.asociado}</p>
                            <p className="text-xs text-slate-400">{ref.asociadoCedula}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-900">{ref.nombre}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-600">{ref.cedula}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-600">{ref.telefono || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-900">{formatCurrency(ref.bonificacion)}</p>
                      </TableCell>
                      <TableCell>
                        {!esVistaPropia ? (
                          <Switch
                            checked={ref.estado}
                            onCheckedChange={() => { setSelectedItem(ref); setIsToggleEstadoDialogOpen(true); }}
                          />
                        ) : (
                          <Badge variant={ref.estado ? 'default' : 'secondary'} className={ref.estado ? 'bg-emerald-600' : ''}>
                            {ref.estado ? 'Activo' : 'Inactivo'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedItem(ref); setIsDetailDialogOpen(true); }}>
                            <Eye className="size-4" />
                          </Button>
                          {!esVistaPropia && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => abrirFormulario(ref)}>
                                <Edit className="size-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => { setSelectedItem(ref); setIsDeleteDialogOpen(true); }}>
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

            {/* Paginación */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-600">
                Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredReferidos.length)} de {filteredReferidos.length} referidos
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
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
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog: Crear / Editar ────────────────────────────────────────────── */}
      <Dialog open={isCreateDialogOpen} onOpenChange={open => { setIsCreateDialogOpen(open); if (!open) setSelectedItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Editar referido' : 'Nuevo referido'}</DialogTitle>
            <DialogDescription>
              El asociado seleccionado será el responsable si el referido no paga.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">

            {/* Asociado responsable */}
            <div className="space-y-2">
              <Label>Asociado responsable <span className="text-red-500">*</span></Label>
              <Select value={formAsociadoId} onValueChange={setFormAsociadoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar asociado..." />
                </SelectTrigger>
                <SelectContent>
                  {asociadosList.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre} — {a.cedula}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">Este asociado responde por el referido ante la cooperativa.</p>
            </div>

            {/* Datos del referido externo */}
            <div className="space-y-2">
              <Label htmlFor="ref-nombre">Nombre del referido <span className="text-red-500">*</span></Label>
              <Input
                id="ref-nombre"
                placeholder="Nombre completo"
                value={formNombre}
                onChange={e => setFormNombre(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ref-cedula">Cédula <span className="text-red-500">*</span></Label>
                <Input
                  id="ref-cedula"
                  placeholder="1234567890"
                  value={formCedula}
                  onChange={e => setFormCedula(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref-telefono">Teléfono</Label>
                <Input
                  id="ref-telefono"
                  placeholder="+57 315 000 0000"
                  value={formTelefono}
                  onChange={e => setFormTelefono(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ref-obs">Observaciones</Label>
              <Textarea
                id="ref-obs"
                placeholder="Información adicional..."
                value={formObservaciones}
                onChange={e => setFormObservaciones(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); setSelectedItem(null); }}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleGuardar}
              disabled={saving || !formAsociadoId || !formNombre.trim() || !formCedula.trim()}
            >
              {saving ? 'Guardando...' : selectedItem ? 'Actualizar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Detalle ───────────────────────────────────────────────────── */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del referido</DialogTitle>
            <DialogDescription>Información completa del referido externo</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <p className="text-xs text-purple-600 font-medium mb-1">Asociado responsable</p>
                <p className="text-slate-900 font-semibold">{selectedItem.asociado}</p>
                <p className="text-sm text-slate-500">CC {selectedItem.asociadoCedula}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500 text-xs">Nombre referido</Label>
                  <p className="text-slate-900 mt-1 font-medium">{selectedItem.nombre}</p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs">Cédula</Label>
                  <p className="text-slate-900 mt-1">{selectedItem.cedula}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500 text-xs">Teléfono</Label>
                  <p className="text-slate-900 mt-1">{selectedItem.telefono || '—'}</p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs">Bonificación</Label>
                  <p className="text-slate-900 mt-1">{formatCurrency(selectedItem.bonificacion)}</p>
                </div>
              </div>
              {selectedItem.observaciones && (
                <div>
                  <Label className="text-slate-500 text-xs">Observaciones</Label>
                  <p className="text-slate-700 mt-1 text-sm">{selectedItem.observaciones}</p>
                </div>
              )}
              <div>
                <Label className="text-slate-500 text-xs">Estado</Label>
                <div className="mt-1">
                  <Badge className={selectedItem.estado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                    {selectedItem.estado ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Eliminar ─────────────────────────────────────────────── */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar referido?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el referido <strong>"{selectedItem?.nombre}"</strong>. Esta acción no se puede deshacer.
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

      {/* ── AlertDialog: Toggle estado ────────────────────────────────────────── */}
      <AlertDialog open={isToggleEstadoDialogOpen} onOpenChange={open => { setIsToggleEstadoDialogOpen(open); if (!open) setSelectedItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de estado?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de {selectedItem?.estado ? 'desactivar' : 'activar'} al referido <strong>"{selectedItem?.nombre}"</strong>.
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
