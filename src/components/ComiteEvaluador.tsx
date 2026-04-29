import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Search, FileText, CheckCircle, XCircle, Clock,
  Eye, Mail, Phone, Briefcase, MessageSquare,
  Users, AlertTriangle, Shield, Award,
  Calculator, FileCheck, UserPlus, Edit, Trash2,
  UserCheck, Crown, CalendarDays, Paperclip, ExternalLink,
  ChevronRight, Flame,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import { Textarea } from './ui/textarea';
import { supabase } from '../lib/supabase';
import { asociadosApi } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface EvaluacionComite {
  scoreCredito: number;
  nivelRiesgo: 'bajo' | 'medio' | 'alto';
  capacidadPago: number;
  verificaciones: { documentacion: boolean; ingresos: boolean; referencias: boolean; antecedentes: boolean };
  comentariosComite: string;
  evaluadoPor?: string;
}

interface Solicitud {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  tipoIdentificacion: string;
  telefono: string;
  email: string;
  direccion: string;
  ocupacion: string;
  ingresoMensual: string;
  motivacion: string;
  documentos: string[];       // URLs guardadas en la columna documentos (jsonb)
  urlDocumento?: string;      // campo legacy
  fechaSolicitud: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  fechaResolucion?: string;
  observaciones?: string;
  evaluacion?: EvaluacionComite | null;
}

interface MiembroComite {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  cargo: 'presidente' | 'secretario' | 'vocal' | 'suplente';
  email: string;
  telefono: string;
  fechaVinculacion: string;
  estado: 'activo' | 'inactivo';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getEstadoBadge = (estado: string) => {
  switch (estado) {
    case 'pendiente':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200 gap-1"><Clock className="size-3" />Pendiente</Badge>;
    case 'aprobada':
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 gap-1"><CheckCircle className="size-3" />Aprobada</Badge>;
    case 'rechazada':
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border border-red-200 gap-1"><XCircle className="size-3" />Rechazada</Badge>;
    default: return null;
  }
};

const getRiesgoBadge = (nivel: 'bajo' | 'medio' | 'alto') => {
  switch (nivel) {
    case 'bajo':  return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1"><Shield className="size-3" />Riesgo Bajo</Badge>;
    case 'medio': return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 gap-1"><AlertTriangle className="size-3" />Riesgo Medio</Badge>;
    case 'alto':  return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1"><AlertTriangle className="size-3" />Riesgo Alto</Badge>;
  }
};

const formatFecha = (fecha?: string) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatFechaHora = (fecha?: string) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' } as any);
};

/** Días transcurridos desde una fecha hasta hoy */
const diasDesde = (fecha?: string): number => {
  if (!fecha) return 0;
  const diff = Date.now() - new Date(fecha).getTime();
  return Math.floor(diff / 86_400_000);
};

// ── Campos del formulario de miembro — componente EXTERNO para evitar remounts ──
interface MiembroFormProps {
  form: { nombres: string; apellidos: string; cedula: string; cargo: string; email: string; telefono: string };
  onChange: (field: string, value: string) => void;
}
function MiembroFormFields({ form, onChange }: MiembroFormProps) {
  return (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Nombres <span className="text-red-500">*</span></Label>
          <Input value={form.nombres} onChange={e => onChange('nombres', e.target.value)} placeholder="Nombres" />
        </div>
        <div className="space-y-1.5">
          <Label>Apellidos <span className="text-red-500">*</span></Label>
          <Input value={form.apellidos} onChange={e => onChange('apellidos', e.target.value)} placeholder="Apellidos" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Cédula <span className="text-red-500">*</span></Label>
          <Input value={form.cedula} onChange={e => onChange('cedula', e.target.value)} placeholder="Número de cédula" />
        </div>
        <div className="space-y-1.5">
          <Label>Cargo</Label>
          <Select value={form.cargo} onValueChange={v => onChange('cargo', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="presidente">Presidente</SelectItem>
              <SelectItem value="secretario">Secretario</SelectItem>
              <SelectItem value="vocal">Vocal</SelectItem>
              <SelectItem value="suplente">Suplente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Email <span className="text-red-500">*</span></Label>
        <Input type="email" value={form.email} onChange={e => onChange('email', e.target.value)} placeholder="correo@ejemplo.com" />
      </div>
      <div className="space-y-1.5">
        <Label>Teléfono <span className="text-red-500">*</span></Label>
        <Input value={form.telefono} onChange={e => onChange('telefono', e.target.value)} placeholder="300 000 0000" />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ComiteEvaluador() {

  // ── Data ──────────────────────────────────────────────────────────────────
  const [solicitudes, setSolicitudes]                 = useState<Solicitud[]>([]);
  const [filteredSolicitudes, setFilteredSolicitudes] = useState<Solicitud[]>([]);
  const [miembros, setMiembros]                       = useState<MiembroComite[]>([]);
  const [loading, setLoading]                         = useState(true);

  // ── Search / Filter ───────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterEstado, setFilterEstado] = useState<'todas' | 'pendiente' | 'aprobada' | 'rechazada'>('todas');

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedSolicitud, setSelectedSolicitud] = useState<Solicitud | null>(null);

  // ── Dialogs: solicitudes ──────────────────────────────────────────────────
  const [isDetailOpen, setIsDetailOpen]     = useState(false);
  const [isApproveOpen, setIsApproveOpen]   = useState(false);
  const [isRejectOpen, setIsRejectOpen]     = useState(false);
  const [isDeleteOpen, setIsDeleteOpen]     = useState(false);
  const [isNewSolicitudOpen, setIsNewSolicitudOpen] = useState(false);

  // ── Action state ──────────────────────────────────────────────────────────
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [approving, setApproving]         = useState(false);
  const [rejecting, setRejecting]         = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [savingNew, setSavingNew]         = useState(false);

  // ── Evaluation form ───────────────────────────────────────────────────────
  const [scoreCredito, setScoreCredito]     = useState(70);
  const [verificaciones, setVerificaciones] = useState({
    documentacion: false, ingresos: false, referencias: false, antecedentes: false,
  });
  const [comentariosComite, setComentariosComite] = useState('');

  // ── Nueva solicitud form ──────────────────────────────────────────────────
  const emptyNueva = { nombres: '', apellidos: '', cedula: '', telefono: '', email: '', direccion: '', ocupacion: '', ingresoMensual: '', motivacion: '' };
  const [formNueva, setFormNueva] = useState(emptyNueva);

  // ── Documentos desde Supabase Storage ────────────────────────────────────
  const [docsStorage, setDocsStorage] = useState<{ name: string; url: string; label: string; esImagen: boolean }[]>([]);
  const [loadingDocs, setLoadingDocs]   = useState(false);
  const [errorDocs,   setErrorDocs]     = useState<string | null>(null);

  // ── Dialogs: miembros ─────────────────────────────────────────────────────
  const [showCreateMiembroModal, setShowCreateMiembroModal] = useState(false);
  const [showEditMiembroModal, setShowEditMiembroModal]     = useState(false);
  const [showDeleteMiembroModal, setShowDeleteMiembroModal] = useState(false);
  const [selectedMiembro, setSelectedMiembro]               = useState<MiembroComite | null>(null);
  const emptyMiembro = { nombres: '', apellidos: '', cedula: '', cargo: 'vocal', email: '', telefono: '' };
  const [formMiembro, setFormMiembro] = useState(emptyMiembro);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { applyFilter(); }, [solicitudes, searchTerm, filterEstado]);

  // ── Load ──────────────────────────────────────────────────────────────────
  async function loadAll() {
    setLoading(true);
    await Promise.all([loadSolicitudes(), loadMiembros()]);
    setLoading(false);
  }

  async function loadSolicitudes() {
    try {
      const { data, error } = await supabase
        .from('solicitudes_asociados')
        .select('*')
        .order('fecha_solicitud', { ascending: false });
      if (error) throw error;
      setSolicitudes((data || []).map((s: any) => ({
        id:                 s.id,
        nombres:            s.nombres             ?? '',
        apellidos:          s.apellidos           ?? '',
        cedula:             s.cedula              ?? '',
        tipoIdentificacion: s.tipo_identificacion ?? '',
        telefono:           s.telefono            ?? '',
        email:              s.email               ?? '',
        direccion:          s.direccion           ?? '',
        ocupacion:          s.ocupacion           ?? '',
        ingresoMensual:     s.ingreso_mensual      ?? '',
        motivacion:         s.motivacion           ?? '',
        documentos:         Array.isArray(s.documentos) ? s.documentos : [],
        urlDocumento:       s.url_documento        ?? '',
        fechaSolicitud:     s.fecha_solicitud      ?? '',
        estado:             s.estado               ?? 'pendiente',
        fechaResolucion:    s.fecha_resolucion     ?? '',
        observaciones:      s.observaciones        ?? '',
        evaluacion:         s.evaluacion           ?? null,
      })));
    } catch (err: any) {
      toast.error('Error al cargar solicitudes: ' + err.message);
    }
  }

  async function loadMiembros() {
    try {
      const { data, error } = await supabase
        .from('miembros_comite')
        .select('*')
        .order('cargo');
      if (error) throw error;
      setMiembros((data || []).map((m: any) => ({
        id:               m.id,
        nombres:          m.nombres           ?? '',
        apellidos:        m.apellidos         ?? '',
        cedula:           m.cedula            ?? '',
        cargo:            m.cargo             ?? 'vocal',
        email:            m.email             ?? '',
        telefono:         m.telefono          ?? '',
        fechaVinculacion: m.fecha_vinculacion ?? '',
        estado:           m.estado            ?? 'activo',
      })));
    } catch {
      // Tabla puede no existir aún — no mostramos error crítico
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  function applyFilter() {
    let list = [...solicitudes];
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      list = list.filter(s =>
        s.nombres.toLowerCase().includes(t) ||
        s.apellidos.toLowerCase().includes(t) ||
        s.cedula.includes(searchTerm) ||
        s.email.toLowerCase().includes(t)
      );
    }
    if (filterEstado !== 'todas') {
      list = list.filter(s => s.estado === filterEstado);
    }
    // Pendientes primero, luego las demás por fecha desc
    list.sort((a, b) => {
      if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
      if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
      return new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime();
    });
    setFilteredSolicitudes(list);
  }

  // ── Cargar documentos desde las URLs guardadas en la solicitud ───────────
  function fetchDocsStorage(cedula: string, solicitud?: Solicitud | null) {
    const src = solicitud ?? selectedSolicitud;
    setDocsStorage([]);
    setErrorDocs(null);

    const IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    // Prioridad 1: columna documentos (array de URLs nuevas)
    const urls: string[] = src?.documentos?.length ? src.documentos : [];

    // Prioridad 2: campo legacy url_documento
    if (urls.length === 0 && src?.urlDocumento) {
      urls.push(src.urlDocumento);
    }

    if (urls.length === 0) {
      // Sin documentos disponibles — no mostrar error, solo "sin adjuntos"
      return;
    }

    const items = urls.map((url, i) => {
      const fileName = url.split('/').pop() ?? `documento-${i + 1}`;
      const ext      = fileName.split('.').pop()?.toLowerCase() ?? '';
      const esImagen = IMG_EXTS.includes(ext);
      const label    = esImagen
        ? `Foto / Imagen ${i + 1}`
        : `Documento PDF ${i + 1}`;
      return { name: fileName, url, label, esImagen };
    });

    setDocsStorage(items);
  }

  // ── Open detail ───────────────────────────────────────────────────────────
  function handleVerDetalle(s: Solicitud) {
    setSelectedSolicitud(s);
    if (s.evaluacion) {
      setScoreCredito(s.evaluacion.scoreCredito);
      setVerificaciones(s.evaluacion.verificaciones);
      setComentariosComite(s.evaluacion.comentariosComite);
    } else {
      setScoreCredito(70);
      setVerificaciones({ documentacion: false, ingresos: false, referencias: false, antecedentes: false });
      setComentariosComite('');
    }
    fetchDocsStorage(s.cedula, s);  // cargar documentos desde URLs guardadas
    setIsDetailOpen(true);
  }

  // ── Evaluación ────────────────────────────────────────────────────────────
  const calcularNivelRiesgo = (score: number): 'bajo' | 'medio' | 'alto' =>
    score >= 75 ? 'bajo' : score >= 50 ? 'medio' : 'alto';

  const calcularCapacidadPago = () => {
    if (!selectedSolicitud?.ingresoMensual) return 0;
    const n = parseFloat(selectedSolicitud.ingresoMensual.replace(/[^0-9.]/g, '')) || 0;
    return n * 0.3;
  };

  const verificacionesCompletas = Object.values(verificaciones).filter(Boolean).length;

  async function handleGuardarEvaluacion() {
    if (!selectedSolicitud) return;
    const evaluacion = {
      scoreCredito,
      nivelRiesgo:      calcularNivelRiesgo(scoreCredito),
      capacidadPago:    calcularCapacidadPago(),
      verificaciones,
      comentariosComite,
      evaluadoPor:      'Comité Evaluador',
    };
    try {
      const { error } = await supabase
        .from('solicitudes_asociados')
        .update({ evaluacion })
        .eq('id', selectedSolicitud.id);
      if (error) throw error;
      setSolicitudes(prev => prev.map(s =>
        s.id === selectedSolicitud.id ? { ...s, evaluacion } : s
      ));
      setSelectedSolicitud(prev => prev ? { ...prev, evaluacion } : prev);
      toast.success('Evaluación guardada exitosamente');
    } catch (err: any) {
      toast.error('Error al guardar evaluación: ' + err.message);
    }
  }

  // ── Aprobar ───────────────────────────────────────────────────────────────
  async function handleAprobar() {
    if (!selectedSolicitud || selectedSolicitud.estado !== 'pendiente') return;
    setApproving(true);
    try {
      const fechaRes = new Date().toISOString();

      // 1. Marcar solicitud como aprobada
      const { error: upErr } = await supabase
        .from('solicitudes_asociados')
        .update({ estado: 'aprobada', fecha_resolucion: fechaRes, observaciones: 'Aprobada por el comité evaluador' })
        .eq('id', selectedSolicitud.id);
      if (upErr) throw upErr;

      // 2. Crear o actualizar registro en tabla asociados (upsert por cedula)
      const { data: nuevoAsociado, error: asocErr } = await supabase
        .from('asociados')
        .upsert({
          nombre:        `${selectedSolicitud.nombres} ${selectedSolicitud.apellidos}`,
          cedula:        selectedSolicitud.cedula,
          telefono:      selectedSolicitud.telefono,
          email:         selectedSolicitud.email,
          direccion:     selectedSolicitud.direccion,
          fecha_ingreso: new Date().toISOString().split('T')[0],
          estado:        'activo',
        }, { onConflict: 'cedula', ignoreDuplicates: false })
        .select()
        .single();
      if (asocErr) throw asocErr;

      // 3. Promover al usuario registrado al rol "asociado"
      const { data: solData } = await supabase
        .from('solicitudes_asociados')
        .select('usuario_id')
        .eq('id', selectedSolicitud.id)
        .single();

      if (solData?.usuario_id) {
        // Buscar el id del rol "asociado" en la tabla roles
        const { data: rolAsociado, error: rolErr } = await supabase
          .from('roles')
          .select('id')
          .eq('nombre', 'asociado')
          .limit(1)
          .single();

        if (rolErr || !rolAsociado) {
          throw new Error('No se encontró el rol "asociado" en la base de datos. Verifique que exista en la tabla roles.');
        }

        const { error: updateUserErr } = await supabase
          .from('usuarios')
          .update({
            rol_id:      rolAsociado.id,
            asociado_id: nuevoAsociado?.id ?? null,
          })
          .eq('id', solData.usuario_id);

        if (updateUserErr) throw updateUserErr;
      }

      setSolicitudes(prev => prev.map(s =>
        s.id === selectedSolicitud.id
          ? { ...s, estado: 'aprobada', fechaResolucion: fechaRes, observaciones: 'Aprobada por el comité evaluador' }
          : s
      ));
      toast.success(`${selectedSolicitud.nombres} ${selectedSolicitud.apellidos} es ahora asociado activo.`);
      setIsApproveOpen(false);
      setIsDetailOpen(false);
      setSelectedSolicitud(null);
    } catch (err: any) {
      toast.error('Error al aprobar: ' + err.message);
    } finally {
      setApproving(false);
    }
  }

  // ── Rechazar ──────────────────────────────────────────────────────────────
  async function handleRechazar() {
    if (!selectedSolicitud || !motivoRechazo.trim() || selectedSolicitud.estado !== 'pendiente') return;
    setRejecting(true);
    try {
      const fechaRes = new Date().toISOString();
      const { error } = await supabase
        .from('solicitudes_asociados')
        .update({ estado: 'rechazada', fecha_resolucion: fechaRes, observaciones: motivoRechazo.trim() })
        .eq('id', selectedSolicitud.id);
      if (error) throw error;

      setSolicitudes(prev => prev.map(s =>
        s.id === selectedSolicitud.id
          ? { ...s, estado: 'rechazada', fechaResolucion: fechaRes, observaciones: motivoRechazo.trim() }
          : s
      ));
      toast.success('Solicitud rechazada y registrada en el historial.');
      setIsRejectOpen(false);
      setIsDetailOpen(false);
      setMotivoRechazo('');
      setSelectedSolicitud(null);
    } catch (err: any) {
      toast.error('Error al rechazar: ' + err.message);
    } finally {
      setRejecting(false);
    }
  }

  // ── Eliminar solicitud ────────────────────────────────────────────────────
  async function handleEliminar() {
    if (!selectedSolicitud || selectedSolicitud.estado !== 'rechazada') return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('solicitudes_asociados')
        .delete()
        .eq('id', selectedSolicitud.id);
      if (error) throw error;
      setSolicitudes(prev => prev.filter(s => s.id !== selectedSolicitud.id));
      toast.success('Solicitud eliminada del sistema.');
      setIsDeleteOpen(false);
      setSelectedSolicitud(null);
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  // ── Registrar nueva solicitud (manual por admin) ──────────────────────────
  async function handleCrearSolicitud() {
    if (!formNueva.nombres.trim() || !formNueva.apellidos.trim() || !formNueva.cedula.trim()) {
      toast.error('Nombres, apellidos y cédula son obligatorios.');
      return;
    }
    setSavingNew(true);
    try {
      const { data, error } = await supabase
        .from('solicitudes_asociados')
        .insert({
          nombres:         formNueva.nombres.trim(),
          apellidos:       formNueva.apellidos.trim(),
          cedula:          formNueva.cedula.trim(),
          telefono:        formNueva.telefono.trim(),
          email:           formNueva.email.trim(),
          direccion:       formNueva.direccion.trim(),
          ocupacion:       formNueva.ocupacion.trim(),
          ingreso_mensual: formNueva.ingresoMensual.trim(),
          motivacion:      formNueva.motivacion.trim(),
          fecha_solicitud: new Date().toISOString(),
          estado:          'pendiente',
        })
        .select()
        .single();
      if (error) throw error;

      const nueva: Solicitud = {
        id:              data.id,
        nombres:         data.nombres         ?? '',
        apellidos:       data.apellidos       ?? '',
        cedula:          data.cedula          ?? '',
        telefono:        data.telefono        ?? '',
        email:           data.email           ?? '',
        direccion:       data.direccion       ?? '',
        ocupacion:       data.ocupacion       ?? '',
        ingresoMensual:  data.ingreso_mensual ?? '',
        motivacion:      data.motivacion      ?? '',
        urlDocumento:    '',
        fechaSolicitud:  data.fecha_solicitud ?? '',
        estado:          'pendiente',
        fechaResolucion: '',
        observaciones:   '',
        evaluacion:      null,
      };
      setSolicitudes(prev => [nueva, ...prev]);
      toast.success(`Solicitud de ${nueva.nombres} ${nueva.apellidos} registrada correctamente.`);
      setIsNewSolicitudOpen(false);
      setFormNueva(emptyNueva);
    } catch (err: any) {
      toast.error('Error al registrar solicitud: ' + err.message);
    } finally {
      setSavingNew(false);
    }
  }

  // ── Miembros CRUD ─────────────────────────────────────────────────────────
  async function handleCreateMiembro() {
    if (!formMiembro.nombres || !formMiembro.apellidos || !formMiembro.cedula || !formMiembro.email || !formMiembro.telefono) {
      toast.error('Completa todos los campos obligatorios.'); return;
    }
    try {
      const { data, error } = await supabase
        .from('miembros_comite')
        .insert({ ...formMiembro, fecha_vinculacion: new Date().toISOString().split('T')[0], estado: 'activo' })
        .select()
        .single();
      if (error) throw error;
      setMiembros(prev => [...prev, {
        id: data.id, nombres: formMiembro.nombres, apellidos: formMiembro.apellidos,
        cedula: formMiembro.cedula, cargo: formMiembro.cargo as any,
        email: formMiembro.email, telefono: formMiembro.telefono,
        fechaVinculacion: data.fecha_vinculacion, estado: 'activo',
      }]);
      toast.success(`${formMiembro.nombres} ${formMiembro.apellidos} agregado al comité.`);
      setShowCreateMiembroModal(false);
      setFormMiembro(emptyMiembro);
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  }

  async function handleEditMiembro() {
    if (!selectedMiembro) return;
    if (!formMiembro.nombres || !formMiembro.apellidos || !formMiembro.cedula || !formMiembro.email || !formMiembro.telefono) {
      toast.error('Completa todos los campos obligatorios.'); return;
    }
    try {
      const { error } = await supabase
        .from('miembros_comite')
        .update(formMiembro)
        .eq('id', selectedMiembro.id);
      if (error) throw error;
      setMiembros(prev => prev.map(m => m.id === selectedMiembro.id ? { ...m, ...formMiembro, cargo: formMiembro.cargo as any } : m));
      toast.success('Miembro actualizado correctamente.');
      setShowEditMiembroModal(false);
      setSelectedMiembro(null);
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  }

  async function handleDeleteMiembro() {
    if (!selectedMiembro) return;
    try {
      const { error } = await supabase
        .from('miembros_comite')
        .update({ estado: 'inactivo' })
        .eq('id', selectedMiembro.id);
      if (error) throw error;
      setMiembros(prev => prev.map(m => m.id === selectedMiembro.id ? { ...m, estado: 'inactivo' } : m));
      toast.success('Miembro removido del comité activo.');
      setShowDeleteMiembroModal(false);
      setSelectedMiembro(null);
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    total:      solicitudes.length,
    pendientes: solicitudes.filter(s => s.estado === 'pendiente').length,
    aprobadas:  solicitudes.filter(s => s.estado === 'aprobada').length,
    rechazadas: solicitudes.filter(s => s.estado === 'rechazada').length,
  };
  const miembrosActivos = miembros.filter(m => m.estado === 'activo');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Encabezado ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-slate-900 mb-1">Comité Evaluador</h1>
            <p className="text-slate-500 text-sm">Gestiona las solicitudes de ingreso a la asociación</p>
          </div>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            onClick={() => { setFormNueva(emptyNueva); setIsNewSolicitudOpen(true); }}
          >
            <UserPlus className="size-4" /> Registrar solicitud
          </Button>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Total */}
          <Card
            className={`border-0 shadow-sm cursor-pointer transition-all hover:shadow-md ${filterEstado === 'todas' ? 'ring-2 ring-slate-400' : ''}`}
            onClick={() => setFilterEstado('todas')}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
                  <p className="text-xs text-slate-400 mt-0.5">solicitudes</p>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl"><FileText className="size-5 text-slate-600" /></div>
              </div>
            </CardContent>
          </Card>

          {/* Pendientes */}
          <Card
            className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${
              filterEstado === 'pendiente'
                ? 'ring-2 ring-amber-400 border-amber-300 bg-amber-50'
                : 'border-amber-200 bg-amber-50/60'
            }`}
            onClick={() => setFilterEstado('pendiente')}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-700">Pendientes</p>
                  <p className="text-3xl font-bold text-amber-600">{stats.pendientes}</p>
                  <p className="text-xs text-amber-500 mt-0.5">requieren evaluación</p>
                </div>
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Clock className="size-5 text-amber-600" />
                </div>
              </div>
              {stats.pendientes > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <Flame className="size-3" /> Atención requerida
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aprobadas */}
          <Card
            className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${
              filterEstado === 'aprobada'
                ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50'
                : 'border-emerald-200 bg-emerald-50/40'
            }`}
            onClick={() => setFilterEstado('aprobada')}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-700">Aprobadas</p>
                  <p className="text-3xl font-bold text-emerald-600">{stats.aprobadas}</p>
                  <p className="text-xs text-emerald-500 mt-0.5">nuevos asociados</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl"><CheckCircle className="size-5 text-emerald-600" /></div>
              </div>
            </CardContent>
          </Card>

          {/* Rechazadas */}
          <Card
            className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${
              filterEstado === 'rechazada'
                ? 'ring-2 ring-red-400 border-red-300 bg-red-50'
                : 'border-red-200 bg-red-50/40'
            }`}
            onClick={() => setFilterEstado('rechazada')}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Rechazadas</p>
                  <p className="text-3xl font-bold text-red-600">{stats.rechazadas}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-xl"><XCircle className="size-5 text-red-600" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Alerta de pendientes urgentes ── */}
        {stats.pendientes > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
            <Flame className="size-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800 flex-1">
              <span className="font-bold">{stats.pendientes} solicitud{stats.pendientes > 1 ? 'es' : ''} pendiente{stats.pendientes > 1 ? 's' : ''}</span>{' '}
              de evaluación. Las solicitudes más antiguas aparecen primero.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0 gap-1"
              onClick={() => setFilterEstado('pendiente')}
            >
              Ver pendientes <ChevronRight className="size-3" />
            </Button>
          </div>
        )}

        {/* ── Miembros del Comité ── */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-xl"><Users className="size-5 text-purple-600" /></div>
                <div>
                  <CardTitle className="text-purple-900">Miembros del Comité Evaluador</CardTitle>
                  <p className="text-sm text-purple-600 mt-0.5">{miembrosActivos.length} miembro{miembrosActivos.length !== 1 ? 's' : ''} activo{miembrosActivos.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <Button
                className="bg-purple-600 hover:bg-purple-700 gap-2"
                onClick={() => { setFormMiembro(emptyMiembro); setShowCreateMiembroModal(true); }}
              >
                <UserPlus className="size-4" /> Agregar miembro
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {miembrosActivos.length === 0 ? (
              <div className="text-center py-8">
                <Users className="size-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No hay miembros activos en el comité.</p>
                <p className="text-slate-400 text-xs mt-1">Agrega el primer miembro para comenzar.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                {miembrosActivos.map(m => (
                  <div
                    key={m.id}
                    className="bg-white border-2 border-purple-100 rounded-xl p-4 hover:border-purple-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-full ${
                          m.cargo === 'presidente' ? 'bg-yellow-100'
                          : m.cargo === 'secretario' ? 'bg-blue-100'
                          : m.cargo === 'vocal' ? 'bg-emerald-100'
                          : 'bg-slate-100'
                        }`}>
                          {m.cargo === 'presidente'
                            ? <Crown className="size-4 text-yellow-600" />
                            : <UserCheck className={`size-4 ${
                                m.cargo === 'secretario' ? 'text-blue-600'
                                : m.cargo === 'vocal' ? 'text-emerald-600'
                                : 'text-slate-600'
                              }`} />
                          }
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{m.nombres} {m.apellidos}</p>
                          <Badge className={`mt-1 text-xs ${
                            m.cargo === 'presidente' ? 'bg-yellow-100 text-yellow-700'
                            : m.cargo === 'secretario' ? 'bg-blue-100 text-blue-700'
                            : m.cargo === 'vocal' ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-700'
                          }`}>
                            {m.cargo.charAt(0).toUpperCase() + m.cargo.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => {
                            setSelectedMiembro(m);
                            setFormMiembro({ nombres: m.nombres, apellidos: m.apellidos, cedula: m.cedula, cargo: m.cargo, email: m.email, telefono: m.telefono });
                            setShowEditMiembroModal(true);
                          }}
                        >
                          <Edit className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => { setSelectedMiembro(m); setShowDeleteMiembroModal(true); }}
                        >
                          <Trash2 className="size-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-500">
                      <div className="flex items-center gap-2"><FileText className="size-3" /> {m.cedula}</div>
                      <div className="flex items-center gap-2 truncate"><Mail className="size-3 shrink-0" /> {m.email}</div>
                      <div className="flex items-center gap-2"><Phone className="size-3" /> {m.telefono}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Búsqueda y filtros ── */}
        <Card className="border-0 shadow-sm">
          <CardContent className="py-4 px-5">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4 pointer-events-none" />
                <Input
                  className="pl-10"
                  placeholder="Buscar por nombre, cédula o email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {([
                  ['todas',     'Todas',      'slate',   stats.total],
                  ['pendiente', 'Pendientes', 'amber',   stats.pendientes],
                  ['aprobada',  'Aprobadas',  'emerald', stats.aprobadas],
                  ['rechazada', 'Rechazadas', 'red',     stats.rechazadas],
                ] as const).map(([val, label, color, count]) => (
                  <Button
                    key={val}
                    variant={filterEstado === val ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterEstado(val)}
                    className={filterEstado === val ? (
                      color === 'amber'   ? 'bg-amber-500 hover:bg-amber-600 text-white' :
                      color === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' :
                      color === 'red'     ? 'bg-red-600 hover:bg-red-700 text-white' :
                      'bg-slate-700 hover:bg-slate-800 text-white'
                    ) : ''}
                  >
                    {label}
                    <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      filterEstado === val ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Lista de solicitudes ── */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {filterEstado === 'todas' ? 'Todas las solicitudes' :
                 filterEstado === 'pendiente' ? 'Solicitudes pendientes de evaluación' :
                 filterEstado === 'aprobada'  ? 'Solicitudes aprobadas' :
                 'Solicitudes rechazadas'}
              </CardTitle>
              <span className="text-xs text-slate-400">{filteredSolicitudes.length} resultado{filteredSolicitudes.length !== 1 ? 's' : ''}</span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3" />
                <p className="text-slate-500">Cargando solicitudes...</p>
              </div>
            ) : filteredSolicitudes.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="size-12 text-slate-300 mx-auto mb-3" />
                <p className="font-medium text-slate-600">
                  {searchTerm ? 'Sin resultados para la búsqueda' : 'No hay solicitudes en esta categoría'}
                </p>
                {searchTerm && (
                  <p className="text-sm text-slate-400 mt-1">Ninguna coincide con "{searchTerm}"</p>
                )}
                {!searchTerm && filterEstado !== 'todas' && (
                  <Button
                    variant="outline" size="sm" className="mt-3"
                    onClick={() => setFilterEstado('todas')}
                  >
                    Ver todas las solicitudes
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSolicitudes.map(s => {
                  const dias = diasDesde(s.fechaSolicitud);
                  const urgente = s.estado === 'pendiente' && dias > 7;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleVerDetalle(s)}
                      className={`border rounded-xl p-4 transition-all cursor-pointer hover:shadow-md ${
                        urgente
                          ? 'border-orange-300 bg-orange-50/50 hover:border-orange-400'
                          : s.estado === 'pendiente'
                          ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
                          : s.estado === 'aprobada'
                          ? 'border-emerald-100 bg-white hover:border-emerald-200'
                          : 'border-red-100 bg-white hover:border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Indicador de estado lateral */}
                        <div className={`mt-1 w-1 self-stretch rounded-full shrink-0 ${
                          urgente          ? 'bg-orange-400'
                          : s.estado === 'pendiente'  ? 'bg-amber-400'
                          : s.estado === 'aprobada'   ? 'bg-emerald-500'
                          : 'bg-red-400'
                        }`} />

                        {/* Info principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="font-semibold text-slate-900">{s.nombres} {s.apellidos}</h3>
                            {getEstadoBadge(s.estado)}
                            {urgente && (
                              <Badge className="bg-orange-100 text-orange-700 border border-orange-200 gap-1">
                                <Flame className="size-3" /> {dias}d en espera
                              </Badge>
                            )}
                            {s.evaluacion && getRiesgoBadge(s.evaluacion.nivelRiesgo)}
                          </div>

                          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-1 text-sm text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <FileText className="size-3.5 shrink-0" /> C.C. {s.cedula}
                            </span>
                            <span className="flex items-center gap-1.5 truncate">
                              <Mail className="size-3.5 shrink-0" /> {s.email || '—'}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Phone className="size-3.5 shrink-0" /> {s.telefono || '—'}
                            </span>
                            {s.ocupacion && (
                              <span className="flex items-center gap-1.5">
                                <Briefcase className="size-3.5 shrink-0" /> {s.ocupacion}
                              </span>
                            )}
                          </div>

                          {/* Fechas de envío y evaluación */}
                          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs">
                            <span className="flex items-center gap-1.5 text-slate-500">
                              <CalendarDays className="size-3.5 shrink-0 text-blue-400" />
                              <span className="text-slate-400">Enviada:</span>
                              <span className="font-medium text-slate-600">{formatFecha(s.fechaSolicitud)}</span>
                              {s.estado === 'pendiente' && (
                                <span className="text-amber-600 font-semibold">
                                  ({dias === 0 ? 'hoy' : `hace ${dias} día${dias !== 1 ? 's' : ''}`})
                                </span>
                              )}
                            </span>

                            {s.fechaResolucion ? (
                              <span className="flex items-center gap-1.5">
                                {s.estado === 'aprobada'
                                  ? <CheckCircle className="size-3.5 shrink-0 text-emerald-500" />
                                  : <XCircle className="size-3.5 shrink-0 text-red-400" />
                                }
                                <span className="text-slate-400">Evaluada:</span>
                                <span className="font-medium text-slate-600">{formatFecha(s.fechaResolucion)}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-amber-500">
                                <Clock className="size-3.5 shrink-0" />
                                <span className="italic">Pendiente de evaluación</span>
                              </span>
                            )}

                            {s.estado === 'rechazada' && s.observaciones && (
                              <span className="flex items-center gap-1 text-red-400 max-w-xs truncate">
                                <XCircle className="size-3 shrink-0" /> {s.observaciones}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Solo botón eliminar (rechazadas) — detener propagación para no abrir detalle */}
                        {s.estado === 'rechazada' && (
                          <button
                            type="button"
                            title="Eliminar solicitud — solo disponible para solicitudes rechazadas"
                            onClick={e => { e.stopPropagation(); setSelectedSolicitud(s); setIsDeleteOpen(true); }}
                            className="p-2 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors shrink-0"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}

                        {/* Indicador visual de que el card es clickeable */}
                        <ChevronRight className={`size-4 shrink-0 self-center transition-colors ${
                          s.estado === 'pendiente' ? 'text-amber-400' : 'text-slate-300'
                        }`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Dialog: Registrar nueva solicitud ────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isNewSolicitudOpen} onOpenChange={open => { setIsNewSolicitudOpen(open); if (!open) setFormNueva(emptyNueva); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 -mx-6 -mt-6 px-6 py-5 rounded-t-lg mb-2">
              <DialogTitle className="text-white text-lg flex items-center gap-2">
                <UserPlus className="size-5" /> Registrar solicitud de ingreso
              </DialogTitle>
              <DialogDescription className="text-emerald-100 mt-0.5 text-sm">
                Completa los datos del aspirante. Los campos marcados con * son obligatorios.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Datos personales */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users className="size-3.5" /> Datos personales
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombres <span className="text-red-500">*</span></Label>
                  <Input value={formNueva.nombres} onChange={e => setFormNueva(p => ({ ...p, nombres: e.target.value }))} placeholder="Ej. Carlos Alberto" />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellidos <span className="text-red-500">*</span></Label>
                  <Input value={formNueva.apellidos} onChange={e => setFormNueva(p => ({ ...p, apellidos: e.target.value }))} placeholder="Ej. García Pérez" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cédula <span className="text-red-500">*</span></Label>
                  <Input value={formNueva.cedula} onChange={e => setFormNueva(p => ({ ...p, cedula: e.target.value }))} placeholder="Número de documento" />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input value={formNueva.telefono} onChange={e => setFormNueva(p => ({ ...p, telefono: e.target.value }))} placeholder="300 000 0000" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={formNueva.email} onChange={e => setFormNueva(p => ({ ...p, email: e.target.value }))} placeholder="correo@ejemplo.com" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Dirección</Label>
                  <Input value={formNueva.direccion} onChange={e => setFormNueva(p => ({ ...p, direccion: e.target.value }))} placeholder="Dirección de residencia" />
                </div>
              </div>
            </div>

            {/* Datos laborales */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Briefcase className="size-3.5" /> Información laboral
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ocupación</Label>
                  <Input value={formNueva.ocupacion} onChange={e => setFormNueva(p => ({ ...p, ocupacion: e.target.value }))} placeholder="Cargo o profesión" />
                </div>
                <div className="space-y-1.5">
                  <Label>Ingreso mensual</Label>
                  <Input value={formNueva.ingresoMensual} onChange={e => setFormNueva(p => ({ ...p, ingresoMensual: e.target.value }))} placeholder="Ej. 1500000" />
                </div>
              </div>
            </div>

            {/* Motivación */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MessageSquare className="size-3.5" /> Motivación
              </p>
              <Textarea
                rows={3}
                className="resize-none text-sm"
                placeholder="¿Por qué desea ingresar a la asociación?"
                value={formNueva.motivacion}
                onChange={e => setFormNueva(p => ({ ...p, motivacion: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsNewSolicitudOpen(false)} disabled={savingNew}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              onClick={handleCrearSolicitud}
              disabled={savingNew || !formNueva.nombres.trim() || !formNueva.apellidos.trim() || !formNueva.cedula.trim()}
            >
              {savingNew ? 'Registrando...' : <><UserPlus className="size-4" /> Registrar solicitud</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Dialog: Detalle / Evaluación ─────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isDetailOpen} onOpenChange={open => { setIsDetailOpen(open); if (!open) { setSelectedSolicitud(null); setDocsStorage([]); setErrorDocs(null); } }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          {selectedSolicitud && (
            <>
              <DialogHeader>
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 -mx-6 -mt-6 px-6 py-5 rounded-t-lg mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <DialogTitle className="text-white text-xl">
                        {selectedSolicitud.nombres} {selectedSolicitud.apellidos}
                      </DialogTitle>
                      <DialogDescription className="text-emerald-100 mt-0.5">
                        C.C. {selectedSolicitud.cedula} · Solicitud de ingreso
                      </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {getEstadoBadge(selectedSolicitud.estado)}
                      {selectedSolicitud.evaluacion && getRiesgoBadge(selectedSolicitud.evaluacion.nivelRiesgo)}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5">

                {/* Fechas de seguimiento */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  {/* Fecha de envío */}
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                      <CalendarDays className="size-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                        Fecha de envío
                      </p>
                      <p className="font-semibold text-slate-800 text-sm">
                        {selectedSolicitud.fechaSolicitud ? formatFechaHora(selectedSolicitud.fechaSolicitud) : '—'}
                      </p>
                      <p className="text-xs text-blue-500 mt-0.5">
                        {diasDesde(selectedSolicitud.fechaSolicitud) === 0
                          ? 'Recibida hoy'
                          : `Hace ${diasDesde(selectedSolicitud.fechaSolicitud)} día${diasDesde(selectedSolicitud.fechaSolicitud) !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>

                  {/* Fecha de evaluación */}
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      selectedSolicitud.fechaResolucion
                        ? selectedSolicitud.estado === 'aprobada' ? 'bg-emerald-100' : 'bg-red-100'
                        : 'bg-amber-100'
                    }`}>
                      {selectedSolicitud.fechaResolucion
                        ? selectedSolicitud.estado === 'aprobada'
                          ? <CheckCircle className="size-4 text-emerald-600" />
                          : <XCircle className="size-4 text-red-500" />
                        : <Clock className="size-4 text-amber-500" />
                      }
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                        Fecha de evaluación
                      </p>
                      <p className={`font-semibold text-sm ${selectedSolicitud.fechaResolucion ? 'text-slate-800' : 'text-amber-500 italic'}`}>
                        {selectedSolicitud.fechaResolucion
                          ? formatFechaHora(selectedSolicitud.fechaResolucion)
                          : 'Sin evaluar aún'}
                      </p>
                      {selectedSolicitud.fechaResolucion && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {selectedSolicitud.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'} el {formatFecha(selectedSolicitud.fechaResolucion)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Información personal + laboral */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="size-4 text-emerald-600" /> Información personal
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5 text-sm">
                      {([
                        ['Nombres',    selectedSolicitud.nombres],
                        ['Apellidos',  selectedSolicitud.apellidos],
                        selectedSolicitud.tipoIdentificacion
                          ? ['Tipo de ID', selectedSolicitud.tipoIdentificacion]
                          : null,
                        ['Cédula / ID', selectedSolicitud.cedula],
                        selectedSolicitud.telefono ? ['Teléfono', selectedSolicitud.telefono] : null,
                        selectedSolicitud.email    ? ['Email',    selectedSolicitud.email]    : null,
                        selectedSolicitud.direccion ? ['Dirección', selectedSolicitud.direccion] : null,
                      ] as ([string,string] | null)[])
                        .filter((row): row is [string, string] => row !== null)
                        .map(([k, v]) => (
                        <div key={k} className="flex justify-between border-b border-slate-50 pb-1.5 last:border-0">
                          <span className="text-slate-500">{k}:</span>
                          <span className="font-medium text-slate-800 text-right max-w-[55%] break-words">{v}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Briefcase className="size-4 text-emerald-600" /> Información laboral
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5 text-sm">
                      {selectedSolicitud.ocupacion || selectedSolicitud.ingresoMensual ? (
                        <>
                          {([
                            selectedSolicitud.ocupacion      ? ['Ocupación',      selectedSolicitud.ocupacion]      : null,
                            selectedSolicitud.ingresoMensual ? ['Ingreso mensual', selectedSolicitud.ingresoMensual] : null,
                          ] as ([string,string] | null)[])
                            .filter((row): row is [string,string] => row !== null)
                            .map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-slate-50 pb-1.5">
                              <span className="text-slate-500">{k}:</span>
                              <span className="font-medium text-slate-800">{v}</span>
                            </div>
                          ))}
                          {selectedSolicitud.ingresoMensual && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                              <p className="text-xs text-blue-600 font-medium">Capacidad de pago estimada (30%)</p>
                              <p className="text-lg font-bold text-blue-700">
                                ${(parseFloat(selectedSolicitud.ingresoMensual.replace(/[^0-9.]/g, '')) * 0.3 || 0).toLocaleString('es-CO')}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-slate-400 text-xs italic">El aspirante no proporcionó información laboral.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Motivación */}
                {selectedSolicitud.motivacion && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <MessageSquare className="size-3.5" /> Motivación del aspirante
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">{selectedSolicitud.motivacion}</p>
                  </div>
                )}

                {/* ── Documentos adjuntos ─────────────────────────────── */}
                <div className="rounded-xl border-2 border-slate-200 overflow-hidden">
                  {/* Cabecera */}
                  <div className={`flex items-center justify-between px-4 py-3 ${docsStorage.length > 0 ? 'bg-blue-600' : 'bg-slate-500'}`}>
                    <div className="flex items-center gap-2 text-white">
                      <Paperclip className="size-4" />
                      <span className="text-sm font-semibold">Documentos adjuntos del aspirante</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!loadingDocs && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${docsStorage.length > 0 ? 'bg-white text-blue-600' : 'bg-slate-400 text-white'}`}>
                          {docsStorage.length} {docsStorage.length === 1 ? 'archivo' : 'archivos'}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={loadingDocs}
                        onClick={() => selectedSolicitud && fetchDocsStorage(selectedSolicitud.cedula, selectedSolicitud)}
                        className="text-xs text-white/80 hover:text-white underline disabled:opacity-50"
                        title="Recargar documentos"
                      >
                        {loadingDocs ? 'Cargando...' : 'Recargar'}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-white">
                    {/* Cargando */}
                    {loadingDocs && (
                      <div className="flex items-center justify-center gap-3 py-6 text-slate-400">
                        <div className="size-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                        <span className="text-sm">Buscando documentos en el servidor...</span>
                      </div>
                    )}

                    {/* Error */}
                    {!loadingDocs && errorDocs && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5 text-red-500" />
                        <span>{errorDocs}</span>
                      </div>
                    )}

                    {/* Sin documentos */}
                    {!loadingDocs && !errorDocs && docsStorage.length === 0 && (
                      <div className="flex flex-col items-center justify-center gap-2 py-6 text-slate-400">
                        <Paperclip className="size-8 text-slate-300" />
                        <p className="text-sm font-medium">Sin documentos adjuntos</p>
                        <p className="text-xs text-center text-slate-400 max-w-xs">
                          El aspirante no carg\u00f3 archivos en su solicitud o a\u00fan no han sido procesados.
                        </p>
                      </div>
                    )}

                    {/* Lista de documentos */}
                    {!loadingDocs && !errorDocs && docsStorage.length > 0 && (
                      <div className="space-y-3">
                        {docsStorage.map(doc => (
                          <div key={doc.name} className="rounded-lg border border-slate-200 overflow-hidden">
                            {/* Si es imagen → previsualización */}
                            {doc.esImagen && (
                              <div className="bg-slate-100 flex items-center justify-center h-36 overflow-hidden">
                                <img
                                  src={doc.url}
                                  alt={doc.label}
                                  className="h-full object-contain"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              </div>
                            )}
                            {/* Fila de info + botón */}
                            <div className="flex items-center gap-3 p-3 bg-white">
                              <div className={`p-2 rounded-lg shrink-0 ${doc.esImagen ? 'bg-amber-100' : 'bg-blue-100'}`}>
                                {doc.esImagen
                                  ? <Award className="size-4 text-amber-600" />
                                  : <FileText className="size-4 text-blue-600" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{doc.label}</p>
                                <p className="text-xs text-slate-400 truncate">{doc.name}</p>
                              </div>
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                              >
                                <ExternalLink className="size-3" />
                                Ver
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Resultado (si ya fue evaluada) */}
                {selectedSolicitud.estado !== 'pendiente' && (
                  <div className={`p-4 rounded-xl border ${selectedSolicitud.estado === 'aprobada' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      {selectedSolicitud.estado === 'aprobada'
                        ? <CheckCircle className="size-4 text-emerald-600" />
                        : <XCircle className="size-4 text-red-500" />
                      }
                      <p className={`text-xs font-bold uppercase tracking-wider ${selectedSolicitud.estado === 'aprobada' ? 'text-emerald-700' : 'text-red-600'}`}>
                        Resultado: {selectedSolicitud.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                      </p>
                    </div>
                    {selectedSolicitud.observaciones && (
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">{selectedSolicitud.estado === 'rechazada' ? 'Motivo del rechazo:' : 'Observaciones:'}</span>{' '}
                        {selectedSolicitud.observaciones}
                      </p>
                    )}
                    {selectedSolicitud.evaluacion && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="p-3 bg-white rounded-lg border">
                          <p className="text-xs text-slate-400 mb-1">Score de crédito</p>
                          <p className="text-xl font-bold text-blue-600">{selectedSolicitud.evaluacion.scoreCredito}/100</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg border">
                          <p className="text-xs text-slate-400 mb-1">Nivel de riesgo</p>
                          {getRiesgoBadge(selectedSolicitud.evaluacion.nivelRiesgo)}
                        </div>
                        {selectedSolicitud.evaluacion.comentariosComite && (
                          <div className="col-span-2 p-3 bg-white rounded-lg border">
                            <p className="text-xs text-slate-400 mb-1">Comentarios del comité</p>
                            <p className="text-sm text-slate-700">{selectedSolicitud.evaluacion.comentariosComite}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Formulario de evaluación (solo pendientes) */}
                {selectedSolicitud.estado === 'pendiente' && (
                  <>
                    {/* Score crediticio */}
                    <Card className="border-blue-200 bg-blue-50/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Calculator className="size-4 text-blue-600" /> Score de crédito
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-3xl font-bold text-blue-600">{scoreCredito}<span className="text-base font-normal text-slate-400">/100</span></p>
                            <p className="text-xs text-slate-500">Calificación crediticia asignada</p>
                          </div>
                          {getRiesgoBadge(calcularNivelRiesgo(scoreCredito))}
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 block mb-2">Ajustar score ({scoreCredito})</label>
                          <input
                            type="range" min="0" max="100" value={scoreCredito}
                            onChange={e => setScoreCredito(Number(e.target.value))}
                            className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>0 — Alto riesgo</span>
                            <span>50 — Medio</span>
                            <span>100 — Bajo riesgo</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Verificaciones */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileCheck className="size-4 text-emerald-600" /> Lista de verificación del comité
                          <Badge className="ml-auto bg-slate-100 text-slate-600 text-xs">{verificacionesCompletas}/4</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {[
                          { key: 'documentacion', label: 'Documentación completa y válida' },
                          { key: 'ingresos',       label: 'Verificación de ingresos' },
                          { key: 'referencias',    label: 'Referencias personales verificadas' },
                          { key: 'antecedentes',   label: 'Antecedentes crediticios revisados' },
                        ].map(({ key, label }) => (
                          <label
                            key={key}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                              verificaciones[key as keyof typeof verificaciones]
                                ? 'bg-emerald-50 border border-emerald-200'
                                : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={verificaciones[key as keyof typeof verificaciones]}
                              onChange={e => setVerificaciones(p => ({ ...p, [key]: e.target.checked }))}
                              className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm font-medium flex-1">{label}</span>
                            {verificaciones[key as keyof typeof verificaciones] && (
                              <CheckCircle className="size-4 text-emerald-500 shrink-0" />
                            )}
                          </label>
                        ))}
                        <div className="p-3 bg-emerald-50 rounded-lg mt-1">
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="font-medium text-emerald-800">Progreso de verificación</span>
                            <span className="font-bold text-emerald-600">{verificacionesCompletas * 25}%</span>
                          </div>
                          <div className="w-full bg-emerald-200 rounded-full h-2">
                            <div
                              className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${verificacionesCompletas * 25}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Comentarios + guardar borrador */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MessageSquare className="size-4 text-emerald-600" /> Comentarios del comité
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Textarea
                          value={comentariosComite}
                          onChange={e => setComentariosComite(e.target.value)}
                          rows={3}
                          className="resize-none text-sm"
                          placeholder="Observaciones internas del comité sobre esta solicitud..."
                        />
                        <Button variant="outline" className="w-full gap-2" onClick={handleGuardarEvaluacion}>
                          <FileCheck className="size-4" /> Guardar evaluación (borrador)
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setIsDetailOpen(false); setSelectedSolicitud(null); setDocsStorage([]); setErrorDocs(null); }}
                >
                  Cerrar
                </Button>

                {/* Solo rechazadas se pueden eliminar */}
                {selectedSolicitud.estado === 'rechazada' && (
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50 gap-1.5"
                    onClick={() => setIsDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" /> Eliminar solicitud
                  </Button>
                )}

                {/* Pendientes: aprobar o rechazar */}
                {selectedSolicitud.estado === 'pendiente' && (
                  <>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50 gap-1.5"
                      onClick={() => { setMotivoRechazo(''); setIsRejectOpen(true); }}
                    >
                      <XCircle className="size-4" /> Rechazar
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                      onClick={() => setIsApproveOpen(true)}
                    >
                      <CheckCircle className="size-4" /> Aprobar solicitud
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── AlertDialog: Confirmar aprobación ────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Award className="size-5 text-emerald-600" /> ¿Aprobar esta solicitud?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Estás a punto de <span className="font-bold text-emerald-700">aprobar</span> la solicitud de:</p>
                {selectedSolicitud && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Aspirante:</span>
                      <span className="font-semibold">{selectedSolicitud.nombres} {selectedSolicitud.apellidos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cédula:</span>
                      <span className="font-semibold">{selectedSolicitud.cedula}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Solicitud enviada:</span>
                      <span className="font-semibold">{formatFecha(selectedSolicitud.fechaSolicitud)}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-500 bg-slate-50 border rounded-lg p-2.5">
                  El aspirante pasará a ser <strong>asociado activo</strong> y su solicitud quedará registrada como <strong>Aprobada</strong> en el historial del proceso de evaluación.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAprobar}
              disabled={approving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {approving ? 'Aprobando...' : 'Confirmar aprobación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Dialog: Rechazar solicitud ───────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isRejectOpen} onOpenChange={open => { setIsRejectOpen(open); if (!open) setMotivoRechazo(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-500" /> Rechazar solicitud
            </DialogTitle>
            <DialogDescription>
              La solicitud quedará registrada como <strong>Rechazada</strong> con el motivo que ingreses.
            </DialogDescription>
          </DialogHeader>

          {selectedSolicitud && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Aspirante:</span>
                <span className="font-semibold">{selectedSolicitud.nombres} {selectedSolicitud.apellidos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cédula:</span>
                <span className="font-semibold">{selectedSolicitud.cedula}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-medium">
              Motivo del rechazo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Describe el motivo por el que se rechaza esta solicitud (mínimo 10 caracteres)..."
              rows={4}
              className="resize-none text-sm"
              value={motivoRechazo}
              onChange={e => setMotivoRechazo(e.target.value)}
              autoFocus
            />
            {motivoRechazo.trim().length > 0 && motivoRechazo.trim().length < 10 && (
              <p className="text-xs text-amber-600">El motivo debe ser más descriptivo (mínimo 10 caracteres).</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsRejectOpen(false); setMotivoRechazo(''); }}>Cancelar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 gap-1.5"
              onClick={handleRechazar}
              disabled={motivoRechazo.trim().length < 10 || rejecting}
            >
              <XCircle className="size-4" />
              {rejecting ? 'Rechazando...' : 'Confirmar rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── AlertDialog: Eliminar solicitud ──────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={isDeleteOpen} onOpenChange={open => { setIsDeleteOpen(open); if (!open) setSelectedSolicitud(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" /> ¿Eliminar esta solicitud?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Estás a punto de <span className="font-bold text-red-600">eliminar definitivamente</span> la solicitud de:</p>
                {selectedSolicitud && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Aspirante:</span>
                      <span className="font-semibold">{selectedSolicitud.nombres} {selectedSolicitud.apellidos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cédula:</span>
                      <span className="font-semibold">{selectedSolicitud.cedula}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Estado:</span>
                      {getEstadoBadge(selectedSolicitud.estado)}
                    </div>
                  </div>
                )}

                {/* Reglas de eliminación */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">¿Cuándo se puede eliminar una solicitud?</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start gap-2">
                      <XCircle className="size-3.5 text-red-400 mt-0.5 shrink-0" />
                      <span><span className="font-medium text-slate-700">Rechazada:</span> sí se puede eliminar. El comité ya tomó una decisión y la solicitud fue denegada.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <span><span className="font-medium text-slate-700">Pendiente:</span> no se puede eliminar. Debe aprobarse o rechazarse primero.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span><span className="font-medium text-slate-700">Aprobada:</span> nunca se elimina. La persona ya es asociada activa y el registro es permanente.</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-red-500 font-medium">⚠ Esta acción es irreversible y no se puede deshacer.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar solicitud'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Dialog: Crear miembro del comité ─────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showCreateMiembroModal} onOpenChange={open => { setShowCreateMiembroModal(open); if (!open) setFormMiembro(emptyMiembro); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-purple-600" /> Agregar miembro al comité
            </DialogTitle>
          </DialogHeader>
          <MiembroFormFields
            form={formMiembro}
            onChange={(field, value) => setFormMiembro(p => ({ ...p, [field]: value }))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateMiembroModal(false)}>Cancelar</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleCreateMiembro}>
              Agregar miembro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar miembro ── */}
      <Dialog open={showEditMiembroModal} onOpenChange={open => { setShowEditMiembroModal(open); if (!open) setSelectedMiembro(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="size-5 text-purple-600" /> Editar miembro del comité
            </DialogTitle>
          </DialogHeader>
          <MiembroFormFields
            form={formMiembro}
            onChange={(field, value) => setFormMiembro(p => ({ ...p, [field]: value }))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditMiembroModal(false)}>Cancelar</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleEditMiembro}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Remover miembro ── */}
      <AlertDialog open={showDeleteMiembroModal} onOpenChange={open => { setShowDeleteMiembroModal(open); if (!open) setSelectedMiembro(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" /> ¿Remover este miembro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMiembro && (
                <span>
                  <strong>{selectedMiembro.nombres} {selectedMiembro.apellidos}</strong> será marcado como inactivo
                  y no aparecerá en el listado activo del comité. Su registro histórico se conserva.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMiembro} className="bg-red-600 hover:bg-red-700">
              Remover del comité
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
