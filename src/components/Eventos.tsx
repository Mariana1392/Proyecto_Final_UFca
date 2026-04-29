import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Search, Filter, Plus, Eye, ChevronLeft, ChevronRight, Edit, Trash2,
  Calendar, MapPin, Users, DollarSign, User
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

// ── Supabase ─────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { eventosApi } from '../lib/api';

interface EventosProps {
  userRole?: 'admin' | 'asociado' | null;
  userData?: any;
}

export default function Eventos({ userRole, userData }: EventosProps) {
  const [searchTerm, setSearchTerm]               = useState('');
  const [currentPage, setCurrentPage]             = useState(1);
  const [currentPageAnulados, setCurrentPageAnulados] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen]     = useState(false);
  const [isEditModalOpen, setIsEditModalOpen]         = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen]     = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]   = useState(false);
  const [selectedEvento, setSelectedEvento]       = useState<any>(null);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    nombre: '', tipo: '', fecha: '', lugar: '',
    participantes: '', presupuesto: '', responsable: '', descripcion: '', estado: 'Programado'
  });

  const tiposEvento   = ['Celebración', 'Administrativo', 'Capacitación', 'Educación', 'Reunión', 'Otro'];
  const estadosEvento = ['Programado', 'En proceso', 'Realizado', 'Cancelado'];

  // ── Estado Supabase ───────────────────────────────────────────────────────
  const [eventos, setEventos]                     = useState<any[]>([]);
  const [loading, setLoading]                     = useState(true);

  useEffect(() => { cargarEventos(); }, []);

  async function cargarEventos() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('eventos')
        .select('*, eventos_inscritos(count)')
        .order('fecha', { ascending: true });
      if (error) throw error;

      // Mapear al formato que espera el JSX original
      const estadoMap: Record<string, string> = {
        programado:  'Programado',
        en_curso:    'En proceso',
        finalizado:  'Realizado',
        cancelado:   'Cancelado',
      };

      const mapeados = (data || []).map((e: any) => ({
        id:           e.id,
        nombre:       e.titulo,
        tipo:         e.descripcion?.split('|')[0]?.trim() || 'Otro', // convención guardada al crear
        fecha:        e.fecha,
        lugar:        e.lugar ?? '',
        participantes: e.capacidad ?? 0,
        presupuesto:  0,                    // no existe en el schema, se puede agregar después
        responsable:  e.descripcion?.split('|')[1]?.trim() || 'Sin asignar',
        descripcion:  e.descripcion?.split('|')[2]?.trim() || '',
        estado:       estadoMap[e.estado] ?? e.estado,
        anulado:      e.estado === 'cancelado',
      }));

      setEventos(mapeados);
    } catch (err: any) {
      toast.error('Error al cargar eventos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Filtros y paginación ──────────────────────────────────────────────────
  const eventosActivos  = eventos.filter(e => !e.anulado);
  const filteredEventos = eventosActivos.filter(e =>
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.lugar.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const eventosAnulados  = eventos.filter(e => e.anulado);
  const filteredEventosAnulados = eventosAnulados.filter(e =>
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.lugar.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages      = Math.ceil(filteredEventos.length / itemsPerPage);
  const startIndex      = (currentPage - 1) * itemsPerPage;
  const endIndex        = startIndex + itemsPerPage;
  const currentEventos  = filteredEventos.slice(startIndex, endIndex);

  const totalPagesAnulados   = Math.ceil(filteredEventosAnulados.length / itemsPerPage);
  const startIndexAnulados   = (currentPageAnulados - 1) * itemsPerPage;
  const endIndexAnulados     = startIndexAnulados + itemsPerPage;
  const currentEventosAnulados = filteredEventosAnulados.slice(startIndexAnulados, endIndexAnulados);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const getEstadoColor = (estado: string) => {
    const c: Record<string,string> = {
      'Programado': 'bg-blue-100 text-blue-700',
      'En proceso': 'bg-amber-100 text-amber-700',
      'Realizado':  'bg-emerald-100 text-emerald-700',
      'Cancelado':  'bg-red-100 text-red-700',
    };
    return c[estado] || 'bg-slate-100 text-slate-700';
  };

  const getTipoColor = (tipo: string) => {
    const c: Record<string,string> = {
      'Celebración':   'bg-pink-100 text-pink-700',
      'Administrativo':'bg-slate-100 text-slate-700',
      'Capacitación':  'bg-purple-100 text-purple-700',
      'Educación':     'bg-cyan-100 text-cyan-700',
      'Reunión':       'bg-indigo-100 text-indigo-700',
      'Otro':          'bg-gray-100 text-gray-700',
    };
    return c[tipo] || 'bg-gray-100 text-gray-700';
  };

  // Helper para convertir estado visible → valor de BD
  const estadoToDb = (e: string) =>
    e === 'Programado' ? 'programado'
    : e === 'En proceso' ? 'en_curso'
    : e === 'Realizado'  ? 'finalizado'
    : 'cancelado';

  // Helper para empaquetar tipo, responsable y descripción en el campo descripcion de la BD
  // Formato: "tipo | responsable | descripcion"
  const packDescripcion = (tipo: string, responsable: string, descripcion: string) =>
    `${tipo} | ${responsable} | ${descripcion}`;

  // ── Handlers con Supabase ─────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setFormData({ nombre: '', tipo: '', fecha: '', lugar: '', participantes: '',
      presupuesto: '', responsable: '', descripcion: '', estado: 'Programado' });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (evento: any) => {
    setSelectedEvento(evento);
    setFormData({
      nombre: evento.nombre, tipo: evento.tipo, fecha: evento.fecha,
      lugar: evento.lugar, participantes: String(evento.participantes),
      presupuesto: String(evento.presupuesto), responsable: evento.responsable,
      descripcion: evento.descripcion, estado: evento.estado,
    });
    setIsEditModalOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.nombre.trim() || !formData.tipo || !formData.fecha || !formData.lugar.trim()) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    try {
      const nuevo = await eventosApi.create({
        titulo:      formData.nombre,
        descripcion: packDescripcion(formData.tipo, formData.responsable || 'Sin asignar', formData.descripcion),
        fecha:       formData.fecha,
        lugar:       formData.lugar,
        capacidad:   Number(formData.participantes) || 0,
        estado:      estadoToDb(formData.estado),
      });

      setEventos(prev => [{
        id:           nuevo.id,
        nombre:       formData.nombre,
        tipo:         formData.tipo,
        fecha:        formData.fecha,
        lugar:        formData.lugar,
        participantes: Number(formData.participantes) || 0,
        presupuesto:  Number(formData.presupuesto) || 0,
        responsable:  formData.responsable || 'Sin asignar',
        descripcion:  formData.descripcion,
        estado:       formData.estado,
        anulado:      false,
      }, ...prev]);

      toast.success(`Evento "${formData.nombre}" creado exitosamente`);
    } catch (err: any) {
      toast.error('Error al crear evento: ' + err.message);
    }
    setIsCreateModalOpen(false);
  };

  const handleEdit = async () => {
    if (!formData.nombre.trim() || !formData.tipo || !formData.fecha || !formData.lugar.trim()) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    try {
      await eventosApi.update(selectedEvento.id, {
        titulo:      formData.nombre,
        descripcion: packDescripcion(formData.tipo, formData.responsable || 'Sin asignar', formData.descripcion),
        fecha:       formData.fecha,
        lugar:       formData.lugar,
        capacidad:   Number(formData.participantes) || 0,
        estado:      estadoToDb(formData.estado),
      });

      setEventos(prev => prev.map(e =>
        e.id === selectedEvento.id ? {
          ...e, nombre: formData.nombre, tipo: formData.tipo, fecha: formData.fecha,
          lugar: formData.lugar, participantes: Number(formData.participantes) || 0,
          presupuesto: Number(formData.presupuesto) || 0,
          responsable: formData.responsable, descripcion: formData.descripcion,
          estado: formData.estado,
        } : e
      ));
      toast.success('Evento actualizado exitosamente');
    } catch (err: any) {
      toast.error('Error al actualizar evento: ' + err.message);
    }
    setIsEditModalOpen(false);
    setSelectedEvento(null);
  };

  const handleAnular = async () => {
    if (!selectedEvento) return;
    try {
      await eventosApi.update(selectedEvento.id, { estado: 'cancelado' });
      setEventos(prev => prev.map(e =>
        e.id === selectedEvento.id ? { ...e, anulado: true, estado: 'Cancelado' } : e
      ));
      toast.success(`Evento "${selectedEvento.nombre}" anulado exitosamente`);
    } catch (err: any) {
      toast.error('Error al anular evento: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedEvento(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando eventos...</p>
        </div>
      </div>
    );
  }

  // ── JSX original desde aquí (sin cambios) ────────────────────────────────
  const renderTable = (eventosList: any[], isAnulados: boolean = false) => (
    <>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Lugar</TableHead>
              <TableHead>Participantes</TableHead>
              <TableHead>Presupuesto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventosList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                  {isAnulados ? 'No hay eventos anulados' : 'No hay eventos registrados'}
                </TableCell>
              </TableRow>
            ) : (
              eventosList.map((evento) => (
                <TableRow key={evento.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isAnulados ? 'bg-slate-100' : 'bg-pink-100'}`}>
                        <Calendar className={`size-4 ${isAnulados ? 'text-slate-600' : 'text-pink-600'}`} />
                      </div>
                      <p className="text-slate-900">{evento.nombre}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTipoColor(evento.tipo)}>
                      {evento.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{evento.fecha}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="size-3 text-slate-400" />
                      <p className="text-slate-600 text-sm">{evento.lugar}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="size-3 text-slate-400" />
                      <p className="text-slate-600">{evento.participantes}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-900">{formatCurrency(evento.presupuesto)}</p>
                  </TableCell>
                  <TableCell>
                    {isAnulados ? (
                      <Badge className="bg-red-100 text-red-700">
                        Anulado
                      </Badge>
                    ) : (
                      <Select
                        defaultValue={evento.estado}
                        onValueChange={(value: any) => {
                          setEventos(prev => prev.map(e =>
                            e.id === evento.id ? { ...e, estado: value } : e
                          ));
                          toast.success(`Estado actualizado a "${value}"`);
                        }}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Programado">Programado</SelectItem>
                          <SelectItem value="En proceso">En proceso</SelectItem>
                          <SelectItem value="Realizado">Realizado</SelectItem>
                          <SelectItem value="Cancelado">Cancelado</SelectItem>
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
                          setSelectedEvento(evento);
                          setIsDetailModalOpen(true);
                        }}
                        title="Ver detalles"
                      >
                        <Eye className="size-4" />
                      </Button>
                      {!isAnulados && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleOpenEdit(evento)}
                            title="Editar evento"
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedEvento(evento);
                              setIsDeleteDialogOpen(true);
                            }}
                            title="Eliminar evento"
                          >
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
                        </>
                      )}
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
            <h1 className="text-slate-900 mb-2">Gestión de Eventos</h1>
            <p className="text-slate-600">Organiza y administra los eventos de la asociación</p>
          </div>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleOpenCreate}>
            <Plus className="size-4" />
            Nuevo evento
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Lista de Eventos</CardTitle>
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
                <Button variant="outline" className="gap-2">
                  <Filter className="size-4" />
                  Filtros
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="activos" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="activos" className="gap-2">
                  <Calendar className="size-4" />
                  Eventos Activos ({filteredEventos.length})
                </TabsTrigger>
                <TabsTrigger value="anulados" className="gap-2">
                  <Trash2 className="size-4" />
                  Eventos Anulados ({filteredEventosAnulados.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="activos" className="space-y-4">
                {renderTable(currentEventos, false)}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredEventos.length)} de {filteredEventos.length} eventos
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

              <TabsContent value="anulados" className="space-y-4">
                {renderTable(currentEventosAnulados, true)}
                {filteredEventosAnulados.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Mostrando {startIndexAnulados + 1} a {Math.min(endIndexAnulados, filteredEventosAnulados.length)} de {filteredEventosAnulados.length} eventos
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPageAnulados(prev => Math.max(1, prev - 1))} disabled={currentPageAnulados === 1}>
                        <ChevronLeft className="size-4" />
                      </Button>
                      {Array.from({ length: totalPagesAnulados }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={currentPageAnulados === page ? "default" : "outline"}
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

      {/* Dialog de Crear */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear nuevo evento</DialogTitle>
            <DialogDescription>
              Completa la información del evento
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del evento *</Label>
                <Input 
                  id="nombre" 
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  placeholder="Ej: Día de la familia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(value: any) => setFormData({...formData, tipo: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposEvento.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha *</Label>
                <Input 
                  id="fecha" 
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lugar">Lugar *</Label>
                <Input 
                  id="lugar" 
                  value={formData.lugar}
                  onChange={(e) => setFormData({...formData, lugar: e.target.value})}
                  placeholder="Ej: Parque Central"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="participantes">Participantes</Label>
                <Input 
                  id="participantes" 
                  type="number"
                  value={formData.participantes}
                  onChange={(e) => setFormData({...formData, participantes: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="presupuesto">Presupuesto</Label>
                <Input 
                  id="presupuesto" 
                  type="number"
                  value={formData.presupuesto}
                  onChange={(e) => setFormData({...formData, presupuesto: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsable">Responsable</Label>
                <Input 
                  id="responsable" 
                  value={formData.responsable}
                  onChange={(e) => setFormData({...formData, responsable: e.target.value})}
                  placeholder="Nombre"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea 
                id="descripcion" 
                value={formData.descripcion}
                onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                placeholder="Describe el evento..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreate}>Crear evento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Editar */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar evento</DialogTitle>
            <DialogDescription>
              Actualiza la información del evento
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre">Nombre del evento *</Label>
                <Input 
                  id="edit-nombre" 
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tipo">Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(value: any) => setFormData({...formData, tipo: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposEvento.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-fecha">Fecha *</Label>
                <Input 
                  id="edit-fecha" 
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lugar">Lugar *</Label>
                <Input 
                  id="edit-lugar" 
                  value={formData.lugar}
                  onChange={(e) => setFormData({...formData, lugar: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-participantes">Participantes</Label>
                <Input 
                  id="edit-participantes" 
                  type="number"
                  value={formData.participantes}
                  onChange={(e) => setFormData({...formData, participantes: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-presupuesto">Presupuesto</Label>
                <Input 
                  id="edit-presupuesto" 
                  type="number"
                  value={formData.presupuesto}
                  onChange={(e) => setFormData({...formData, presupuesto: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-responsable">Responsable</Label>
                <Input 
                  id="edit-responsable" 
                  value={formData.responsable}
                  onChange={(e) => setFormData({...formData, responsable: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-estado">Estado</Label>
              <Select value={formData.estado} onValueChange={(value: any) => setFormData({...formData, estado: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {estadosEvento.map((estado) => (
                    <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-descripcion">Descripción</Label>
              <Textarea 
                id="edit-descripcion" 
                value={formData.descripcion}
                onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditModalOpen(false);
              setSelectedEvento(null);
            }}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleEdit}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalles */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del evento</DialogTitle>
            <DialogDescription>
              Información completa del evento
            </DialogDescription>
          </DialogHeader>
          {selectedEvento && (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-600">Nombre del evento</Label>
                <p className="text-slate-900 mt-1">{selectedEvento.nombre}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Tipo</Label>
                  <Badge className={`${getTipoColor(selectedEvento.tipo)} mt-1`}>
                    {selectedEvento.tipo}
                  </Badge>
                </div>
                <div>
                  <Label className="text-slate-600">Estado</Label>
                  <Badge className={`${selectedEvento.anulado ? 'bg-red-100 text-red-700' : getEstadoColor(selectedEvento.estado)} mt-1`}>
                    {selectedEvento.anulado ? 'Anulado' : selectedEvento.estado}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Fecha</Label>
                  <p className="text-slate-900 mt-1">{selectedEvento.fecha}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Lugar</Label>
                  <p className="text-slate-900 mt-1">{selectedEvento.lugar}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Participantes</Label>
                  <p className="text-slate-900 mt-1">{selectedEvento.participantes} personas</p>
                </div>
                <div>
                  <Label className="text-slate-600">Presupuesto</Label>
                  <p className="text-slate-900 mt-1">{formatCurrency(selectedEvento.presupuesto)}</p>
                </div>
              </div>
              <div>
                <Label className="text-slate-600">Responsable</Label>
                <p className="text-slate-900 mt-1">{selectedEvento.responsable}</p>
              </div>
              <div>
                <Label className="text-slate-600">Descripción</Label>
                <p className="text-slate-600 mt-1">{selectedEvento.descripcion || 'Sin descripción'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para Eliminar */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              El evento será eliminado y movido a la pestaña de "Eventos Anulados". El registro se conservará en el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedEvento(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnular} className="bg-red-600 hover:bg-red-700">
              Eliminar evento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}