import { useState, useEffect } from 'react';
import PiggyBankLoader from './ui/PiggyBankLoader';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
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
  CalendarDays, Paperclip, ExternalLink,
  ChevronRight, Flame, PiggyBank, WifiOff, Wifi,
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
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { formatCurrencyInput, parseCurrencyInput, formatCurrency } from '../lib/formatters';

// URL pública de la app — siempre apunta a producción, nunca a localhost.
// Viene de la variable de entorno VITE_PUBLIC_URL definida en .env y Vercel.
const APP_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, '')
  || 'https://interfaz-web-profesional-ufca-9.vercel.app';

// ── Types ─────────────────────────────────────────────────────────────────────
interface EvaluacionComite {
  scoreCredito: number;
  nivelRiesgo: 'bajo' | 'medio' | 'alto';
  capacidadPago: number;
  verificaciones: { documentacion: boolean; ingresos: boolean; referencias: boolean };
  comentariosComite: string;
  evaluadoPor?: string;
}

interface Solicitud {
  id: string;
  usuario_id?: string | null;
  nombres: string;
  apellidos: string;
  cedula: string;
  tipoIdentificacion: string;
  telefono: string;
  email: string;
  direccion: string;
  ocupacion: string;
  ingresoMensual: string;
  montoAhorroPropuesto?: string;
  motivacion: string;
  documentos: string[];       // URLs guardadas en la columna documentos (jsonb)
  urlDocumento?: string;      // campo legacy
  fechaSolicitud: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'pendiente_activacion';
  fechaResolucion?: string;
  observaciones?: string;
  evaluacion?: EvaluacionComite | null;
}

/** Helper: estados que se consideran "aprobados" (aprobada o esperando activación) */
const esAprobada = (estado: string) =>
  estado === 'aprobada' || estado === 'pendiente_activacion';

// ── Helpers ───────────────────────────────────────────────────────────────────
const getEstadoBadge = (estado: string) => {
  switch (estado) {
    case 'pendiente':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200 gap-1"><Clock className="size-3" />Pendiente</Badge>;
    case 'aprobada':
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 gap-1"><CheckCircle className="size-3" />Aprobada</Badge>;
    case 'pendiente_activacion':
      return <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 border border-teal-200 gap-1"><CheckCircle className="size-3" />Aprobada — pendiente activación</Badge>;
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function ComiteEvaluador() {

  // ── Data ──────────────────────────────────────────────────────────────────
  const [solicitudes, setSolicitudes]                 = useState<Solicitud[]>([]);
  const [filteredSolicitudes, setFilteredSolicitudes] = useState<Solicitud[]>([]);
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

  // ── Email post-rechazo ────────────────────────────────────────────────────
  const [rechazoEmailData, setRechazoEmailData] = useState<{
    email: string; nombre: string; motivo: string;
  } | null>(null);

  // ── Resultado de invitación post-aprobación ───────────────────────────────
  const [aprobacionEmailData, setAprobacionEmailData] = useState<{
    nombre: string; email: string; error?: string; inviteLink?: string;
  } | null>(null);

  // ── Temporizador de rate-limit de invitaciones ───────────────────────────
  // El estado es solo para el countdown visual; la fuente de verdad es la BD
  const [rateLimitUntil, setRateLimitUntil] = useState<number>(0);
  const [rateLimitCountdown, setRateLimitCountdown] = useState('');

  useEffect(() => {
    if (rateLimitUntil <= Date.now()) return;
    const tick = () => {
      const rem = rateLimitUntil - Date.now();
      if (rem <= 0) { setRateLimitCountdown(''); return; }
      const m = Math.floor(rem / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      setRateLimitCountdown(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [rateLimitUntil]);

  /** Marca el rate-limit en estado local Y lo persiste en BD (por solicitud) */
  const marcarRateLimit = (solId?: string) => {
    const until = Date.now() + 60 * 60 * 1000;
    setRateLimitUntil(until);
    // Persiste en BD: bypassear localStorage borrando caché ya no tiene efecto
    if (solId) {
      void supabase.from('solicitudes_asociados')
        .update({ ultima_invitacion: new Date().toISOString() })
        .eq('id', solId);
    }
  };

  const limpiarRateLimit = () => {
    setRateLimitUntil(0);
    setRateLimitCountdown('');
  };
  const [reenviadoSolicitudId, setReenviadoSolicitudId] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState(false);

  // ── Evaluation form ───────────────────────────────────────────────────────
  const [scoreCredito, setScoreCredito]     = useState(70);
  const [verificaciones, setVerificaciones] = useState({
    documentacion: false, ingresos: false, referencias: false,
  });
  const [comentariosComite, setComentariosComite] = useState('');

  // ── Pago de activación ────────────────────────────────────────────────────
  const [isPagoActivacionOpen, setIsPagoActivacionOpen] = useState(false);
  const [pagoSolicitud, setPagoSolicitud]               = useState<Solicitud | null>(null);
  const [pagoMonto, setPagoMonto]                       = useState('');
  const [pagoFecha, setPagoFecha]                       = useState('');
  const [pagoObservacion, setPagoObservacion]           = useState('');
  const [pagoComprobante, setPagoComprobante]           = useState<File | null>(null);
  const [savingPago, setSavingPago]                     = useState(false);

  // ── Nueva solicitud form ──────────────────────────────────────────────────
  const emptyNueva = { nombres: '', apellidos: '', cedula: '', telefono: '', email: '', direccion: '', ocupacion: '', ingresoMensual: '', motivacion: '' };
  const [formNueva, setFormNueva] = useState(emptyNueva);

  // ── Documentos desde Supabase Storage ────────────────────────────────────
  const [docsStorage, setDocsStorage] = useState<{ name: string; url: string; label: string; esImagen: boolean }[]>([]);
  const [loadingDocs, setLoadingDocs]   = useState(false);
  const [errorDocs,   setErrorDocs]     = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { applyFilter(); }, [solicitudes, searchTerm, filterEstado]);

  // Tiempo real: recarga al instante cuando llega un INSERT/UPDATE/DELETE
  // isConnected se usa para mostrar el indicador de reconexión en la UI (Mejora I)
  const { isConnected: wsConectado } = useRealtimeSubscription(
    'comite_solicitudes_realtime',
    ['solicitudes_asociados'],
    loadSolicitudes,
  );
  // El setInterval de polling fue eliminado — useRealtimeSubscription ya maneja
  // la reconexión automática y recarga datos al recuperar el WebSocket.

  // ── Load ──────────────────────────────────────────────────────────────────
  async function loadAll() {
    setLoading(true);
    await loadSolicitudes();
    setLoading(false);
  }

  async function loadSolicitudes() {
    try {
      const { data, error } = await supabase
        .from('solicitudes_asociados')
        .select(`
          id, usuario_id, nombres, apellidos, cedula, tipo_identificacion,
          telefono, email, direccion, ocupacion, ingreso_mensual,
          monto_ahorro_propuesto, motivacion, documentos, estado,
          observaciones, fecha_solicitud, fecha_resolucion, created_at,
          comite_evaluador!solicitud_asociado_id (
            id, decision, observacion, comentarios,
            verificaciones, score_credito, fecha
          )
        `)
        .order('fecha_solicitud', { ascending: false });
      if (error) throw error;
      setSolicitudes((data || []).map((s: any) => {
        const ev = Array.isArray(s.comite_evaluador) && s.comite_evaluador.length > 0
          ? s.comite_evaluador[0]
          : null;
        const score = ev?.score_credito ?? 70;
        return {
          id:                 s.id,
          usuario_id:         s.usuario_id         ?? null,
          nombres:            s.nombres            ?? '',
          apellidos:          s.apellidos          ?? '',
          cedula:             s.cedula             ?? '',
          tipoIdentificacion: s.tipo_identificacion ?? '',
          telefono:           s.telefono           ?? '',
          email:              s.email              ?? '',
          direccion:          s.direccion          ?? '',
          ocupacion:          s.ocupacion          ?? '',
          ingresoMensual:          s.ingreso_mensual != null ? String(s.ingreso_mensual) : '',
          montoAhorroPropuesto:    s.monto_ahorro_propuesto != null ? String(s.monto_ahorro_propuesto) : '',
          motivacion:         s.motivacion         ?? '',
          documentos:         Array.isArray(s.documentos) ? s.documentos : [],
          urlDocumento:       '',
          fechaSolicitud:     s.fecha_solicitud    ?? s.created_at ?? '',
          estado:             s.estado             ?? 'pendiente',
          fechaResolucion:    s.fecha_resolucion   ?? '',
          observaciones:      s.observaciones      ?? '',
          evaluacion: ev ? {
            scoreCredito:      score,
            nivelRiesgo:       score >= 75 ? 'bajo' : score >= 50 ? 'medio' : 'alto',
            capacidadPago:     0,
            verificaciones:    ev.verificaciones ?? { documentacion: false, ingresos: false, referencias: false },
            comentariosComite: ev.comentarios    ?? '',
            evaluadoPor:       'Comité Evaluador',
          } : null,
        };
      }));
    } catch (err: any) {
      toast.error('Error al cargar solicitudes: ' + err.message);
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
      // 'aprobada' en el filtro incluye también 'pendiente_activacion'
      list = list.filter(s =>
        filterEstado === 'aprobada'
          ? esAprobada(s.estado)
          : s.estado === filterEstado
      );
    }
    // Pendientes primero, luego las demás por fecha desc
    list.sort((a, b) => {
      if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
      if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
      return new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime();
    });
    setFilteredSolicitudes(list);
  }

  // ── Cargar documentos del aspirante (URLs guardadas o listado desde Storage) ─
  async function fetchDocsStorage(cedula: string, solicitud?: Solicitud | null) {
    const src = solicitud ?? selectedSolicitud;
    setDocsStorage([]);
    setErrorDocs(null);
    setLoadingDocs(true);

    const IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    try {
      // Prioridad 1: columna documentos (array de URLs públicas guardadas al subir)
      const urls: string[] = src?.documentos?.length ? src.documentos : [];

      if (urls.length > 0) {
        const items = urls.map((url, i) => {
          const fileName = url.split('/').pop()?.split('?')[0] ?? `documento-${i + 1}`;
          const ext      = fileName.split('.').pop()?.toLowerCase() ?? '';
          const esImagen = IMG_EXTS.includes(ext);
          const label    = fileName.startsWith('cedula')
            ? 'Copia de Cédula'
            : fileName.startsWith('carta_laboral')
            ? 'Carta Laboral / Ingresos'
            : esImagen ? `Imagen ${i + 1}` : `Documento ${i + 1}`;
          return { name: fileName, url, label, esImagen };
        });
        setDocsStorage(items);
        return;
      }

      // Prioridad 2: campo legacy url_documento
      if (src?.urlDocumento) {
        const url      = src.urlDocumento;
        const fileName = url.split('/').pop() ?? 'documento';
        const ext      = fileName.split('.').pop()?.toLowerCase() ?? '';
        const esImagen = IMG_EXTS.includes(ext);
        setDocsStorage([{ name: fileName, url, label: esImagen ? 'Imagen' : 'Documento', esImagen }]);
        return;
      }

      // Prioridad 3: listar archivos en la carpeta del aspirante dentro del bucket
      const { data: files, error } = await supabase.storage
        .from('solicitudes-documentos')
        .list(`solicitudes/${cedula}`, { limit: 20, sortBy: { column: 'name', order: 'asc' } });

      if (error) throw error;

      const filtered = (files ?? []).filter(f => f.name !== '.emptyFolderPlaceholder' && f.name.trim() !== '');

      if (filtered.length === 0) {
        setDocsStorage([]);
        return;
      }

      const items = filtered.map(f => {
        const ext      = f.name.split('.').pop()?.toLowerCase() ?? '';
        const esImagen = IMG_EXTS.includes(ext);
        const { data: { publicUrl } } = supabase.storage
          .from('solicitudes-documentos')
          .getPublicUrl(`solicitudes/${cedula}/${f.name}`);
        const label = f.name.startsWith('cedula')
          ? 'Copia de Cédula'
          : f.name.startsWith('carta_laboral')
          ? 'Carta Laboral / Ingresos'
          : f.name.startsWith('fotografia')
          ? 'Fotografía'
          : esImagen ? 'Imagen' : 'Documento';
        return { name: f.name, url: publicUrl, label, esImagen };
      });

      setDocsStorage(items);
    } catch (err: any) {
      setErrorDocs('No se pudieron cargar los documentos: ' + err.message);
    } finally {
      setLoadingDocs(false);
    }
  }

  // ── Open detail ───────────────────────────────────────────────────────────
  function handleVerDetalle(s: Solicitud) {
    setSelectedSolicitud(s);
    // Las verificaciones siempre inician en false para que el comité
    // las marque conforme revisa cada ítem (nunca se restauran del guardado).
    setVerificaciones({ documentacion: false, ingresos: false, referencias: false });
    // Solo restaurar los comentarios si ya había una evaluación previa
    setComentariosComite(s.evaluacion?.comentariosComite ?? '');
    fetchDocsStorage(s.cedula, s);
    setIsDetailOpen(true);
  }

  // ── Evaluación ────────────────────────────────────────────────────────────
  const calcularNivelRiesgo = (score: number): 'bajo' | 'medio' | 'alto' =>
    score >= 75 ? 'bajo' : score >= 50 ? 'medio' : 'alto';

  const calcularCapacidadPago = () => {
    if (!selectedSolicitud?.ingresoMensual) return 0;
    const n = parseFloat(String(selectedSolicitud.ingresoMensual).replace(/[^0-9.]/g, '')) || 0;
    return n * 0.3;
  };

  const verificacionesCompletas = Object.values(verificaciones ?? {}).filter(Boolean).length;

  async function handleGuardarEvaluacion() {
    if (!selectedSolicitud) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const score = scoreCredito;
      const { error } = await supabase
        .from('comite_evaluador')
        .upsert({
          solicitud_asociado_id: selectedSolicitud.id,
          evaluador_id:          user?.id ?? null,
          verificaciones,
          comentarios:           comentariosComite,
          score_credito:         score,
          decision:              'en_evaluacion',
          fecha:                 new Date().toISOString(),
        }, { onConflict: 'solicitud_asociado_id' });
      if (error) throw error;

      const nivelRiesgo: 'bajo' | 'medio' | 'alto' = score >= 75 ? 'bajo' : score >= 50 ? 'medio' : 'alto';
      const evaluacion = {
        scoreCredito:      score,
        nivelRiesgo,
        capacidadPago:     0,
        verificaciones,
        comentariosComite,
        evaluadoPor:       'Comité Evaluador',
      };
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
    if (verificacionesCompletas < 3) {
      toast.error('Debes completar toda la lista de verificación antes de aprobar.');
      return;
    }
    setApproving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay sesión activa');

      // ── Validar reingreso: verificar si el solicitante fue expulsado o retirado ──
      if (selectedSolicitud.cedula) {
        const { data: prevUsuario } = await supabase
          .from('usuarios')
          .select('id, nombre, fecha_suspension, estado_cuenta')
          .eq('cedula', selectedSolicitud.cedula)
          .not('fecha_suspension', 'is', null)
          .limit(1)
          .maybeSingle();

        if (prevUsuario?.fecha_suspension) {
          const añoSuspension = new Date(prevUsuario.fecha_suspension).getFullYear();
          const añoActual = new Date().getFullYear();

          if (añoActual <= añoSuspension) {
            toast.error(
              `No se puede aprobar: este solicitante fue suspendido/retirado en ${añoSuspension}. Solo puede reingresar a partir de enero de ${añoSuspension + 1}.`,
              { duration: 8000 }
            );
            setApproving(false);
            return;
          } else {
            // Permitir pero advertir
            toast.warning(
              `⚠️ Este solicitante fue suspendido/retirado en ${añoSuspension}. Al aprobar, iniciará como nuevo asociado.`,
              { duration: 6000 }
            );
          }
        }
      }

      // 1. Llamar al RPC atómico — crea asociado, ahorro permanente, actualiza solicitud y comité
      const { data: nuevoAsociadoId, error: rpcError } = await supabase.rpc('aprobar_afiliacion', {
        p_solicitud_id: selectedSolicitud.id,
        p_admin_id:     user.id,
      });
      if (rpcError) throw rpcError;

      // 2. Si el solicitante ya tenía usuario, el RPC ya lo promovió a asociado.
      //    Actualizamos cédula/dirección que puedan faltar (campos adicionales del perfil).
      if (selectedSolicitud.usuario_id) {
        await supabase.from('usuarios').update({
          cedula:    selectedSolicitud.cedula    || null,
          telefono:  selectedSolicitud.telefono  || null,
          direccion: selectedSolicitud.direccion || null,
        }).eq('id', selectedSolicitud.usuario_id);
      }

      // 3. Marcar solicitud como pendiente de pago de activación
      await supabase
        .from('solicitudes_asociados')
        .update({ estado: 'pendiente_activacion' })
        .eq('id', selectedSolicitud.id);

      // 3.5 Notificar al aspirante por campanita (queda guardada para cuando active su cuenta)
      const aspiranteId = (nuevoAsociadoId as string | null) || selectedSolicitud.usuario_id || null;
      if (aspiranteId) {
        void supabase.from('notificaciones').insert({
          titulo:      '🎉 ¡Solicitud aprobada!',
          mensaje:     `Hola ${selectedSolicitud.nombres}, tu solicitud de afiliación a UFCA ha sido aprobada. Revisa tu correo para activar tu cuenta y realizar el pago de activación.`,
          tipo:        'afiliacion_aprobada',
          leida:       false,
          asociado_id: aspiranteId,
        });
      }

      // 4. Enviar invitación por email usando el template HTML de Supabase (inviteUserByEmail).
      let inviteEnviado = false;
      let inviteError: string | undefined;

      if (selectedSolicitud.email && !selectedSolicitud.usuario_id) {
        try {
          const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            selectedSolicitud.email,
            {
              redirectTo: `${APP_URL}/?bienvenido=1`,
              data: { nombre: selectedSolicitud.nombres, rol: 'asociado' },
            }
          );

          if (invErr) {
            const msg = invErr.message.toLowerCase();
            inviteError = msg.includes('rate') || msg.includes('limit')
              ? 'RATE_LIMIT'
              : invErr.message;
            if (inviteError === 'RATE_LIMIT') marcarRateLimit(selectedSolicitud.id);
            console.warn('[ComiteEvaluador] Error al enviar invitación:', invErr.message);
          } else {
            inviteEnviado = true;
          }
        } catch (err: any) {
          inviteError = err?.message ?? 'Error desconocido';
          console.warn('[ComiteEvaluador] Error al enviar invitación:', err);
        }
      }

      // 5. Actualizar UI local
      const fechaRes = new Date().toISOString();
      setSolicitudes(prev => prev.map(s =>
        s.id === selectedSolicitud.id
          ? { ...s, estado: 'pendiente_activacion', fechaResolucion: fechaRes, observaciones: 'Aprobada — pendiente de pago de activación' }
          : s
      ));

      setIsApproveOpen(false);
      setIsDetailOpen(false);

      // 6. Mostrar diálogo con resultado de la generación del link
      if (selectedSolicitud.email && !selectedSolicitud.usuario_id) {
        setAprobacionEmailData({
          nombre:     `${selectedSolicitud.nombres} ${selectedSolicitud.apellidos}`,
          email:      selectedSolicitud.email,
          error:      inviteError,
          inviteLink: inviteEnviado ? 'sent' : undefined,
        });
      } else {
        toast.success(`✅ Solicitud de ${selectedSolicitud.nombres} aprobada correctamente.`);
        setSelectedSolicitud(null);
      }
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay sesión activa');

      // Llamar al RPC — actualiza solicitud y comité atómicamente
      const { error } = await supabase.rpc('rechazar_afiliacion', {
        p_solicitud_id: selectedSolicitud.id,
        p_admin_id:     user.id,
        p_motivo:       motivoRechazo.trim(),
      });
      if (error) throw error;

      const fechaRes = new Date().toISOString();
      const motivoFinal = motivoRechazo.trim();
      setSolicitudes(prev => prev.map(s =>
        s.id === selectedSolicitud.id
          ? { ...s, estado: 'rechazada', fechaResolucion: fechaRes, observaciones: motivoFinal }
          : s
      ));

      // Notificar al aspirante por campanita (solo si ya tenía usuario creado)
      if (selectedSolicitud.usuario_id) {
        void supabase.from('notificaciones').insert({
          titulo:      '❌ Solicitud no aprobada',
          mensaje:     `Hola ${selectedSolicitud.nombres}, lamentamos informarte que tu solicitud de afiliación a UFCA no fue aprobada. Motivo: ${motivoFinal}.`,
          tipo:        'afiliacion_rechazada',
          leida:       false,
          asociado_id: selectedSolicitud.usuario_id,
        });
      }

      toast.success('Solicitud rechazada y registrada en el historial.');
      setIsRejectOpen(false);
      setIsDetailOpen(false);

      // Activar diálogo de notificación al aspirante (si tiene email registrado)
      if (selectedSolicitud.email) {
        setRechazoEmailData({
          email:  selectedSolicitud.email,
          nombre: `${selectedSolicitud.nombres} ${selectedSolicitud.apellidos}`,
          motivo: motivoFinal,
        });
      }

      setMotivoRechazo('');
      setSelectedSolicitud(null);
    } catch (err: any) {
      toast.error('Error al rechazar: ' + err.message);
    } finally {
      setRejecting(false);
    }
  }

  // ── Reenviar invitación / recordatorio de activación ─────────────────────────
  async function handleReenviarInvitacion(sol: Solicitud) {
    if (!sol.email) { toast.error('Esta solicitud no tiene email registrado'); return; }

    // ── Verificar rate-limit por solicitud en BD (fuente de verdad) ──────────
    const { data: solRateData } = await supabase
      .from('solicitudes_asociados')
      .select('ultima_invitacion')
      .eq('id', sol.id)
      .maybeSingle();

    if (solRateData?.ultima_invitacion) {
      const ultimaMs   = new Date(solRateData.ultima_invitacion).getTime();
      const cooldownMs = ultimaMs + 60 * 60 * 1000;
      if (cooldownMs > Date.now()) {
        // Sincronizar estado local para mostrar el countdown visual correcto
        setRateLimitUntil(cooldownMs);
        const rem = cooldownMs - Date.now();
        const m   = Math.floor(rem / 60000);
        const s   = Math.floor((rem % 60000) / 1000);
        toast.error('Correo aún no disponible', {
          description: `Podrás reenviar en ${m}:${String(s).padStart(2, '0')}.`,
        });
        return;
      }
    } else if (rateLimitUntil > Date.now()) {
      // Fallback al estado local si la BD no tiene el campo aún
      toast.error('Correo aún no disponible', {
        description: `Podrás reenviar en ${rateLimitCountdown}.`,
      });
      return;
    }

    setReenviando(true);
    try {
      // Si el usuario ya tiene cuenta creada, enviar correo de recuperación
      // como recordatorio para que inicie sesión y complete el pago
      if (sol.usuario_id) {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
          sol.email,
          { redirectTo: `${APP_URL}/?bienvenido=1` },
        );
        if (resetErr) throw resetErr;

        // Registrar timestamp en BD para este solicitud
        void supabase.from('solicitudes_asociados')
          .update({ ultima_invitacion: new Date().toISOString() })
          .eq('id', sol.id);

        limpiarRateLimit();
        setReenviadoSolicitudId(sol.id);
        setAprobacionEmailData({
          nombre:     `${sol.nombres} ${sol.apellidos}`,
          email:      sol.email,
          inviteLink: 'sent',
        });
        toast.success('✅ Correo de recordatorio enviado correctamente');
        return;
      }

      // Usuario sin cuenta: enviar invitación
      const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        sol.email,
        {
          redirectTo: `${APP_URL}/?bienvenido=1`,
          data: { nombre: sol.nombres, rol: 'asociado' },
        }
      );

      // Si el email ya está registrado, el aspirante ya tiene cuenta — no se necesita correo
      const yaRegistrado = invErr && (
        invErr.message.toLowerCase().includes('already') ||
        invErr.message.toLowerCase().includes('registered')
      );
      if (yaRegistrado) {
        limpiarRateLimit();
        toast.info('Este aspirante ya tiene cuenta creada y puede iniciar sesión directamente.', {
          description: sol.email,
        });
        return;
      }

      if (invErr) throw invErr;

      // Registrar timestamp en BD para este solicitud
      void supabase.from('solicitudes_asociados')
        .update({ ultima_invitacion: new Date().toISOString() })
        .eq('id', sol.id);

      limpiarRateLimit();
      setReenviadoSolicitudId(sol.id);
      setAprobacionEmailData({
        nombre:     `${sol.nombres} ${sol.apellidos}`,
        email:      sol.email,
        inviteLink: 'sent',
      });
      toast.success('✅ Email de bienvenida enviado correctamente');
    } catch (err: any) {
      const msg = err.message ?? String(err);
      if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limit')) {
        marcarRateLimit(sol.id);
        toast.error('Límite de correos alcanzado', {
          description: 'El botón se habilitará automáticamente en 1 hora.',
        });
      } else {
        toast.error('Error al enviar correo: ' + msg);
      }
    } finally {
      setReenviando(false);
    }
  }

  // ── Registrar primer pago de activación ──────────────────────────────────
  async function handleRegistrarPrimerPago() {
    if (!pagoSolicitud?.usuario_id) return;

    // Validaciones
    const montoNum = parseCurrencyInput(pagoMonto);
    if (!montoNum || montoNum <= 0) {
      toast.error('El monto debe ser mayor a cero');
      return;
    }
    // Advertencia informativa si es menor al mínimo — no bloquea
    if (montoNum < 100_000) {
      toast.warning('El monto es menor al estipulado, pero se registrará igualmente.');
    }
    if (!pagoFecha) {
      toast.error('Selecciona la fecha del pago');
      return;
    }
    if (pagoFecha !== hoyLocal()) {
      toast.error('La fecha del pago debe ser la fecha de hoy');
      return;
    }
    if (pagoComprobante && pagoComprobante.size > 10 * 1024 * 1024) {
      toast.error('El comprobante supera los 10 MB', { description: 'Adjunta un archivo más pequeño.' });
      return;
    }
    setSavingPago(true);
    try {
      // 1. Período activo — si no hay uno, se usa null (campo nullable en la BD)
      const { data: periodo } = await supabaseAdmin
        .from('periodos').select('id').eq('estado', 'activo').order('fecha_inicio', { ascending: false }).limit(1).maybeSingle();
      const periodoId: string | null = periodo?.id ?? null;

      // 2. Subir comprobante si se adjuntó (no bloquea el flujo si falla)
      let urlComprobante: string | null = null;
      if (pagoComprobante) {
        try {
          const ext  = pagoComprobante.name.split('.').pop() ?? 'jpg';
          const path = `comprobantes-activacion/${pagoSolicitud.usuario_id}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabaseAdmin.storage
            .from('solicitudes-documentos')
            .upload(path, pagoComprobante, { upsert: true });
          if (!uploadErr) {
            const { data: { publicUrl } } = supabaseAdmin.storage
              .from('solicitudes-documentos')
              .getPublicUrl(path);
            urlComprobante = publicUrl;
          }
        } catch { /* no bloquea */ }
      }

      // 3. Buscar cuenta de ahorro permanente (puede existir del RPC aprobar_afiliacion)
      // Usamos supabaseAdmin para bypasear RLS en escrituras sobre cuentas_ahorro
      const { data: cuentaExistente } = await supabaseAdmin
        .from('cuentas_ahorro')
        .select('id, monto_ahorrado')
        .eq('asociado_id', pagoSolicitud.usuario_id)
        .eq('tipo', 'permanente')
        .eq('anulado', false)
        .maybeSingle();

      let cuentaId: string;
      const saldoAntes = Number(cuentaExistente?.monto_ahorrado) || 0;

      if (cuentaExistente) {
        const { error: updateErr } = await supabaseAdmin.from('cuentas_ahorro').update({
          estado: 'activo',
          monto_ahorrado: saldoAntes + montoNum,
          cuota_mensual: montoNum,
          updated_at: new Date().toISOString(),
        }).eq('id', cuentaExistente.id);
        if (updateErr) throw updateErr;
        cuentaId = cuentaExistente.id;
      } else {
        const { data: nuevaCuenta, error: cuentaErr } = await supabaseAdmin
          .from('cuentas_ahorro')
          .insert({
            asociado_id: pagoSolicitud.usuario_id,
            tipo: 'permanente',
            periodo_id: periodoId,
            monto_ahorrado: montoNum,
            cuota_mensual: montoNum,
            estado: 'activo',
          })
          .select('id').single();
        if (cuentaErr) throw cuentaErr;
        cuentaId = nuevaCuenta.id;
      }

      // 4. Registrar transacción (supabaseAdmin para bypasear RLS en transacciones)
      const { data: { user } } = await supabase.auth.getUser();
      const { error: txErr } = await supabaseAdmin.from('transacciones').insert({
        tipo: 'aporte_permanente',
        asociado_id: pagoSolicitud.usuario_id,
        registrado_por: user?.id ?? null,
        ahorro_id: cuentaId,
        periodo_id: periodoId,
        monto: montoNum,
        capital: montoNum,
        interes: 0,
        monto_mora: 0,
        dias_mora: 0,
        saldo_antes: saldoAntes,
        saldo_despues: saldoAntes + montoNum,
        fecha_pago: pagoFecha,
        mes_correspondiente: pagoFecha,
        url_comprobante: urlComprobante,
        observacion: pagoObservacion.trim() || 'Primer aporte de activación',
      });
      if (txErr) throw txErr;

      // 5. Marcar solicitud como aprobada — supabaseAdmin para evitar bloqueo RLS
      const { error: solErr } = await supabaseAdmin
        .from('solicitudes_asociados').update({ estado: 'aprobada' }).eq('id', pagoSolicitud.id);
      if (solErr) throw solErr;

      // 6. Actualizar UI
      setSolicitudes(prev => prev.map(s =>
        s.id === pagoSolicitud.id ? { ...s, estado: 'aprobada' } : s
      ));
      toast.success('✅ Cuenta activada', {
        description: `El primer aporte de ${pagoSolicitud.nombres} ${pagoSolicitud.apellidos} fue registrado. Ya tiene acceso completo al sistema.`,
      });
      setIsPagoActivacionOpen(false);
      setPagoSolicitud(null);
      setPagoMonto('');
      setPagoFecha('');
      setPagoObservacion('');
      setPagoComprobante(null);
      if (isDetailOpen) { setIsDetailOpen(false); setSelectedSolicitud(null); setDocsStorage([]); }
    } catch (err: any) {
      toast.error('Error al registrar el pago: ' + err.message);
    } finally {
      setSavingPago(false);
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
          telefono:        formNueva.telefono.trim()      || null,
          email:           formNueva.email.trim()         || null,
          direccion:       formNueva.direccion.trim()     || null,
          ocupacion:       formNueva.ocupacion.trim()     || null,
          ingreso_mensual: formNueva.ingresoMensual ? parseFloat(formNueva.ingresoMensual) : null,
          motivacion:      formNueva.motivacion.trim()    || null,
          estado:          'pendiente',
          documentos:      [],
        })
        .select()
        .single();
      if (error) throw error;

      const nueva: Solicitud = {
        id:              data.id,
        usuario_id:      data.usuario_id     ?? null,
        nombres:         data.nombres        ?? '',
        apellidos:       data.apellidos      ?? '',
        cedula:          data.cedula         ?? '',
        tipoIdentificacion: data.tipo_identificacion ?? '',
        telefono:        data.telefono       ?? '',
        email:           data.email          ?? '',
        direccion:       data.direccion      ?? '',
        ocupacion:       data.ocupacion      ?? '',
        ingresoMensual:        data.ingreso_mensual != null ? String(data.ingreso_mensual) : '',
        montoAhorroPropuesto:  data.monto_ahorro_propuesto != null ? String(data.monto_ahorro_propuesto) : '',
        motivacion:            data.motivacion ?? '',
        documentos:      [],
        urlDocumento:    '',
        fechaSolicitud:  data.fecha_solicitud ?? data.created_at ?? '',
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

  // Devuelve "YYYY-MM-DD" en hora local — evita desfase UTC en zonas UTC-
  const hoyLocal = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    total:      solicitudes.length,
    pendientes: solicitudes.filter(s => s.estado === 'pendiente').length,
    aprobadas:  solicitudes.filter(s => esAprobada(s.estado)).length,
    rechazadas: solicitudes.filter(s => s.estado === 'rechazada').length,
  };
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Encabezado ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-slate-900 mb-1">Comité Evaluador</h1>
            <p className="text-slate-500 text-sm">Gestiona las solicitudes de ingreso a la asociación</p>
          </div>

          {/* Indicador de conexión WebSocket (Mejora I) */}
          {wsConectado ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <Wifi className="size-3.5" />
              <span>En tiempo real</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-700 text-xs font-medium animate-pulse">
              <WifiOff className="size-3.5" />
              <span>Reconectando…</span>
            </div>
          )}
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
              <PiggyBankLoader title="Cargando solicitudes..." />
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
                          : esAprobada(s.estado)
                          ? 'border-emerald-100 bg-white hover:border-emerald-200'
                          : 'border-red-100 bg-white hover:border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Indicador de estado lateral */}
                        <div className={`mt-1 w-1 self-stretch rounded-full shrink-0 ${
                          urgente                   ? 'bg-orange-400'
                          : s.estado === 'pendiente'  ? 'bg-amber-400'
                          : esAprobada(s.estado)      ? 'bg-emerald-500'
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
                              // Tiene fecha de resolución → mostrar con ícono correcto
                              <span className="flex items-center gap-1.5">
                                {esAprobada(s.estado)
                                  ? <CheckCircle className="size-3.5 shrink-0 text-emerald-500" />
                                  : <XCircle className="size-3.5 shrink-0 text-red-400" />
                                }
                                <span className="text-slate-400">Evaluada:</span>
                                <span className="font-medium text-slate-600">{formatFecha(s.fechaResolucion)}</span>
                              </span>
                            ) : esAprobada(s.estado) ? (
                              // Aprobada pero sin fecha guardada en BD → mostrar aprobada sin fecha
                              <span className="flex items-center gap-1.5 text-emerald-600">
                                <CheckCircle className="size-3.5 shrink-0" />
                                <span className="italic">Aprobada</span>
                              </span>
                            ) : s.estado === 'rechazada' ? (
                              // Rechazada pero sin fecha guardada en BD
                              <span className="flex items-center gap-1.5 text-red-500">
                                <XCircle className="size-3.5 shrink-0" />
                                <span className="italic">Rechazada</span>
                              </span>
                            ) : (
                              // Pendiente real
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

                        {/* Botones pendiente_activacion */}
                        {s.estado === 'pendiente_activacion' && (
                          <div className="flex flex-col gap-1.5 shrink-0">
                            {/* Registrar pago — solo cuando el usuario ya aceptó el invite */}
                            {s.usuario_id && (
                              <button
                                type="button"
                                title="Registrar primer pago de activación"
                                onClick={e => {
                                  e.stopPropagation();
                                  setPagoSolicitud(s);
                                  setPagoMonto('');
                                  setPagoFecha(hoyLocal());
                                  setPagoObservacion('');
                                  setIsPagoActivacionOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
                              >
                                <PiggyBank className="size-3.5" /> Registrar pago
                              </button>
                            )}
                            {/* Reenviar correo — solo visible cuando hay rate limit activo */}
                            {s.email && rateLimitUntil > 0 && (() => {
                              const enCooldown = rateLimitUntil > Date.now();
                              return (
                                <button
                                  type="button"
                                  disabled={reenviando || enCooldown}
                                  title={enCooldown ? `Disponible en ${rateLimitCountdown}` : 'Reenviar correo de invitación'}
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleReenviarInvitacion(s);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                                >
                                  <Mail className="size-3.5" />
                                  {reenviando
                                    ? 'Enviando…'
                                    : enCooldown
                                      ? rateLimitCountdown
                                      : 'Reenviar correo'}
                                </button>
                              );
                            })()}
                          </div>
                        )}

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
      {/* ── Dialog: Detalle / Evaluación ─────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isDetailOpen} onOpenChange={open => { setIsDetailOpen(open); if (!open) { setSelectedSolicitud(null); setDocsStorage([]); setErrorDocs(null); } }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{width:'min(90vw, 1100px)', maxWidth:'min(90vw, 1100px)'}}>
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
                        ? esAprobada(selectedSolicitud.estado) ? 'bg-emerald-100' : 'bg-red-100'
                        : 'bg-amber-100'
                    }`}>
                      {selectedSolicitud.fechaResolucion
                        ? esAprobada(selectedSolicitud.estado)
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
                          {esAprobada(selectedSolicitud.estado) ? 'Aprobada' : 'Rechazada'} el {formatFecha(selectedSolicitud.fechaResolucion)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Información personal + laboral */}
                <div className="grid md:grid-cols-2 gap-6">
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
                        <div key={k} className="flex gap-4 border-b border-slate-50 pb-2 last:border-0">
                          <span className="text-slate-500 shrink-0 w-24">{k}:</span>
                          <span className="font-medium text-slate-800">{v}</span>
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
                            selectedSolicitud.ingresoMensual ? ['Ingreso mensual', `$${parseFloat(selectedSolicitud.ingresoMensual).toLocaleString('es-CO')} COP`] : null,
                          ] as ([string,string] | null)[])
                            .filter((row): row is [string,string] => row !== null)
                            .map(([k, v]) => (
                            <div key={k} className="flex gap-4 border-b border-slate-50 pb-2">
                              <span className="text-slate-500 shrink-0 w-28">{k}:</span>
                              <span className="font-medium text-slate-800">{v}</span>
                            </div>
                          ))}

                          {/* Ahorro mensual propuesto por el solicitante */}
                          {selectedSolicitud.montoAhorroPropuesto && (
                            <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                              <p className="text-xs text-emerald-700 font-semibold">Ahorro mensual propuesto</p>
                              <p className="text-xl font-bold text-emerald-700">
                                ${parseFloat(selectedSolicitud.montoAhorroPropuesto).toLocaleString('es-CO')} COP
                              </p>
                              <p className="text-[10px] text-emerald-600 mt-0.5">Monto que el solicitante propone ahorrar cada mes</p>
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
                {selectedSolicitud.estado !== 'pendiente' && (() => {
                  const aprobado = esAprobada(selectedSolicitud.estado);
                  const esPendAct = selectedSolicitud.estado === 'pendiente_activacion';
                  return (
                    <div className={`p-4 rounded-xl border ${aprobado ? (esPendAct ? 'bg-teal-50 border-teal-200' : 'bg-emerald-50 border-emerald-200') : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        {aprobado
                          ? <CheckCircle className={`size-4 ${esPendAct ? 'text-teal-600' : 'text-emerald-600'}`} />
                          : <XCircle className="size-4 text-red-500" />
                        }
                        <p className={`text-xs font-bold uppercase tracking-wider ${aprobado ? (esPendAct ? 'text-teal-700' : 'text-emerald-700') : 'text-red-600'}`}>
                          {aprobado
                            ? esPendAct
                              ? 'Resultado: Aprobada — pendiente de activación'
                              : 'Resultado: Aprobada'
                            : 'Resultado: Rechazada'
                          }
                        </p>
                      </div>
                      {esPendAct && (
                        <div className="space-y-2 mb-3">
                          <p className="text-xs text-teal-600 bg-teal-100 rounded-lg px-3 py-2">
                            ✅ El aspirante fue aprobado como asociado. Está en espera del pago de activación para quedar activo en el sistema.
                          </p>
                          {selectedSolicitud.usuario_id && (
                            <Button
                              className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2"
                              onClick={() => {
                                setPagoSolicitud(selectedSolicitud);
                                setPagoMonto('');
                                setPagoFecha(hoyLocal());
                                setPagoObservacion('');
                                setIsPagoActivacionOpen(true);
                              }}
                            >
                              <PiggyBank className="size-4" />
                              Registrar pago recibido y activar cuenta
                            </Button>
                          )}
                          {selectedSolicitud.email && !selectedSolicitud.usuario_id && (() => {
                            const enCooldown = rateLimitUntil > Date.now();
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full border-teal-300 text-teal-700 hover:bg-teal-50 gap-2 disabled:opacity-60"
                                disabled={reenviando || enCooldown}
                                onClick={() => handleReenviarInvitacion(selectedSolicitud)}
                              >
                                <Mail className="size-4" />
                                {reenviando
                                  ? 'Enviando…'
                                  : enCooldown
                                    ? `Disponible en ${rateLimitCountdown}`
                                    : 'Reenviar invitación de acceso'}
                              </Button>
                            );
                          })()}
                        </div>
                      )}
                      {selectedSolicitud.observaciones && (
                        <p className="text-sm text-slate-700">
                          <span className="font-medium">{selectedSolicitud.estado === 'rechazada' ? 'Motivo del rechazo:' : 'Observaciones:'}</span>{' '}
                          {selectedSolicitud.observaciones}
                        </p>
                      )}
                      {selectedSolicitud.evaluacion?.comentariosComite && (
                        <div className="mt-3 p-3 bg-white rounded-lg border">
                          <p className="text-xs text-slate-400 mb-1">Comentarios del comité</p>
                          <p className="text-sm text-slate-700">{selectedSolicitud.evaluacion.comentariosComite}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Formulario de evaluación (solo pendientes) */}
                {selectedSolicitud.estado === 'pendiente' && (
                  <>
                    {/* Verificaciones */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileCheck className="size-4 text-emerald-600" /> Lista de verificación del comité
                          <Badge className="ml-auto bg-slate-100 text-slate-600 text-xs">{verificacionesCompletas}/3</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {[
                          { key: 'documentacion', label: 'Documentación completa y válida' },
                          { key: 'ingresos',       label: 'Verificación de ingresos' },
                          { key: 'referencias',    label: 'Referencias personales verificadas' },
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
                            <span className="font-bold text-emerald-600">{Math.round(verificacionesCompletas * 100 / 3)}%</span>
                          </div>
                          <div className="w-full bg-emerald-200 rounded-full h-2">
                            <div
                              className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.round(verificacionesCompletas * 100 / 3)}%` }}
                            />
                          </div>
                        </div>
                        {verificacionesCompletas < 3 && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
                            ⚠️ Debes marcar los 3 ítems para poder aprobar la solicitud.
                          </p>
                        )}
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

                {/* pendiente_activacion: registrar pago (si ya tiene usuario) */}
                {selectedSolicitud.estado === 'pendiente_activacion' && selectedSolicitud.usuario_id && (
                  <Button
                    className="bg-teal-600 hover:bg-teal-700 gap-1.5"
                    onClick={() => {
                      setPagoSolicitud(selectedSolicitud);
                      setPagoMonto('');
                      setPagoFecha(hoyLocal());
                      setPagoObservacion('');
                      setIsPagoActivacionOpen(true);
                    }}
                  >
                    <PiggyBank className="size-4" /> Registrar pago recibido
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
                      className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setIsApproveOpen(true)}
                      disabled={verificacionesCompletas < 3}
                      title={verificacionesCompletas < 3 ? 'Debes completar toda la lista de verificación antes de aprobar' : undefined}
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
      <AlertDialog open={isApproveOpen} onOpenChange={(open) => { if (!approving) setIsApproveOpen(open); }}>
        <AlertDialogContent>
          {approving ? (
            <div className="py-8 flex flex-col items-center justify-center">
              <PiggyBankLoader title="Aprobando solicitud y procesando afiliación..." />
            </div>
          ) : (
            <>
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
                  Confirmar aprobación
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
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
      {/* ── Dialog: Notificar al aspirante del rechazo por correo ─────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!rechazoEmailData} onOpenChange={open => { if (!open) setRechazoEmailData(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5 text-slate-600" /> Notificar al aspirante
            </DialogTitle>
            <DialogDescription>
              La solicitud fue rechazada. ¿Deseas enviar una notificación al aspirante explicando el motivo?
            </DialogDescription>
          </DialogHeader>

          {rechazoEmailData && (
            <div className="space-y-4">
              {/* Vista previa del correo */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm">
                <div className="flex gap-2">
                  <span className="text-slate-500 shrink-0 w-12">Para:</span>
                  <span className="font-medium text-slate-800 break-all">{rechazoEmailData.email}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-500 shrink-0 w-12">Asunto:</span>
                  <span className="font-medium text-slate-800">UFCA — Resultado de su solicitud de ingreso</span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">
{`Estimado/a ${rechazoEmailData.nombre},

Hemos revisado su solicitud de ingreso a la Cooperativa de Ahorro y Crédito UFCA.

Lamentablemente, su solicitud no fue aprobada por el siguiente motivo:

"${rechazoEmailData.motivo}"

Si desea más información o desea presentar una nueva solicitud en el futuro, no dude en contactarnos.

Atentamente,
Comité Evaluador — UFCA`}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                Al hacer clic en <strong>"Abrir en Gmail"</strong> se abrirá una nueva pestaña en Gmail con el borrador listo para enviar.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRechazoEmailData(null)}
            >
              Omitir
            </Button>
            {rechazoEmailData && (
              <Button
                className="gap-2 bg-slate-700 hover:bg-slate-800"
                onClick={() => {
                  const { email, nombre, motivo } = rechazoEmailData;
                  const asunto  = encodeURIComponent('UFCA — Resultado de su solicitud de ingreso');
                  const cuerpo  = encodeURIComponent(
                    `Estimado/a ${nombre},\n\n` +
                    `Hemos revisado su solicitud de ingreso a la Cooperativa de Ahorro y Crédito UFCA.\n\n` +
                    `Lamentablemente, su solicitud no fue aprobada por el siguiente motivo:\n\n` +
                    `"${motivo}"\n\n` +
                    `Si desea más información o desea presentar una nueva solicitud en el futuro, no dude en contactarnos.\n\n` +
                    `Atentamente,\nComité Evaluador — UFCA`
                  );
                  // Abrir Gmail Compose directamente (funciona sin cliente de correo instalado)
                  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${asunto}&body=${cuerpo}`;
                  window.open(gmailUrl, '_blank');
                  setRechazoEmailData(null);
                }}
              >
                <Mail className="size-4" /> Abrir en Gmail
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Dialog: Registrar primer pago de activación ───────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={isPagoActivacionOpen}
        onOpenChange={open => {
          if (!open) { setIsPagoActivacionOpen(false); setPagoSolicitud(null); setPagoMonto(''); setPagoFecha(''); setPagoObservacion(''); setPagoComprobante(null); }
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[480px] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col max-h-[90svh]">

          {/* ── Cabecera ─────────────────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-white/20 rounded-xl shrink-0">
                <PiggyBank className="size-5 sm:size-6 text-white" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-white text-base sm:text-lg font-bold leading-tight">
                  Registrar primer aporte
                </DialogTitle>
                <DialogDescription className="text-teal-100 text-xs sm:text-sm mt-0.5 truncate">
                  {pagoSolicitud
                    ? `${pagoSolicitud.nombres} ${pagoSolicitud.apellidos} · C.C. ${pagoSolicitud.cedula}`
                    : ''}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* ── Cuerpo scrollable ─────────────────────────────────────────────── */}
          <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-4 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

            {/* Aviso de activación */}
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl">
              <CheckCircle className="size-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <p className="text-sm text-teal-800 dark:text-teal-300 leading-relaxed">
                Al registrar este pago la cuenta se <strong>activará automáticamente</strong>{' '}
                y el asociado tendrá acceso completo al sistema.
              </p>
            </div>

            {/* Referencia monto propuesto */}
            {pagoSolicitud?.montoAhorroPropuesto && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
                  <Calculator className="size-3.5 shrink-0" /> Propuesto
                </span>
                <span className="font-bold text-sm text-slate-700 dark:text-slate-200 text-right">
                  ${parseFloat(pagoSolicitud.montoAhorroPropuesto).toLocaleString('es-CO')} COP
                </span>
              </div>
            )}

            {/* Monto recibido */}
            <div className="space-y-1.5">
              <Label htmlFor="pago-monto" className="text-sm font-semibold">
                Monto recibido (COP) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-semibold text-sm pointer-events-none select-none">
                  $
                </span>
                <Input
                  id="pago-monto"
                  type="text"
                  inputMode="numeric"
                  placeholder="100.000"
                  value={pagoMonto}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    if (!digits) { setPagoMonto(''); return; }
                    const num = parseInt(digits, 10);
                    if (!isNaN(num)) {
                      setPagoMonto(
                        new Intl.NumberFormat('es-CO', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(num)
                      );
                    }
                  }}
                  className={`h-11 pl-8 text-sm font-semibold tracking-wide ${
                    pagoMonto && parseCurrencyInput(pagoMonto) < 100_000
                      ? 'border-red-400 focus-visible:ring-red-400/20'
                      : 'focus-visible:border-teal-500 focus-visible:ring-teal-500/20'
                  }`}
                  autoFocus
                />
              </div>
              <p className={`text-xs flex items-center gap-1 ${
                pagoMonto && parseCurrencyInput(pagoMonto) < 100_000
                  ? 'text-red-500'
                  : 'text-slate-400 dark:text-slate-500'
              }`}>
                {pagoMonto && parseCurrencyInput(pagoMonto) < 100_000 && (
                  <AlertTriangle className="size-3 shrink-0" />
                )}
                {pagoMonto && parseCurrencyInput(pagoMonto) < 100_000
                  ? 'El valor ingresado es menor al monto estipulado'
                  : ''}
              </p>
            </div>

            {/* Fecha del pago */}
            <div className="space-y-1.5">
              <Label htmlFor="pago-fecha" className="text-sm font-semibold">
                Fecha del pago <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pago-fecha"
                type="date"
                value={pagoFecha}
                min={hoyLocal()}
                max={hoyLocal()}
                onChange={e => setPagoFecha(e.target.value)}
                className="h-11 focus-visible:border-teal-500 focus-visible:ring-teal-500/20"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">Solo se permite la fecha de hoy</p>
            </div>

            {/* Observación */}
            <div className="space-y-1.5">
              <Label htmlFor="pago-obs" className="text-sm font-semibold">
                Observación{' '}
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
              </Label>
              <Input
                id="pago-obs"
                placeholder="Ej: Transferencia Nequi, efectivo, etc."
                value={pagoObservacion}
                onChange={e => setPagoObservacion(e.target.value)}
                className="h-11"
              />
            </div>

            {/* Comprobante */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                Comprobante de pago{' '}
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
              </Label>
              <label
                htmlFor="pago-comprobante"
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-dashed cursor-pointer transition-all select-none ${
                  pagoComprobante
                    ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/40 dark:border-teal-700'
                    : 'border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-950/20'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${
                  pagoComprobante
                    ? 'bg-teal-100 dark:bg-teal-900'
                    : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                  <Paperclip className={`size-4 ${
                    pagoComprobante ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  {pagoComprobante ? (
                    <>
                      <p className="text-sm font-semibold text-teal-700 dark:text-teal-400 truncate">
                        {pagoComprobante.name}
                      </p>
                      <p className="text-xs text-teal-500 dark:text-teal-500 mt-0.5">
                        {(pagoComprobante.size / 1024).toFixed(0)} KB · Listo para subir
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Adjuntar imagen o PDF del comprobante
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        PNG, JPG, PDF — máx. 10 MB
                      </p>
                    </>
                  )}
                </div>
                {pagoComprobante && (
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); setPagoComprobante(null); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                  >
                    <XCircle className="size-4" />
                  </button>
                )}
              </label>
              <input
                id="pago-comprobante"
                type="file"
                accept="image/*,.pdf"
                className="sr-only"
                onChange={e => setPagoComprobante(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {/* ── Footer ───────────────────────────────────────────────────────── */}
          <div className="px-5 py-4 sm:px-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setIsPagoActivacionOpen(false);
                setPagoSolicitud(null);
                setPagoMonto(''); setPagoFecha(''); setPagoObservacion(''); setPagoComprobante(null);
              }}
              disabled={savingPago}
            >
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 gap-2 font-semibold shadow-md shadow-teal-900/20"
              onClick={handleRegistrarPrimerPago}
              disabled={savingPago || !pagoMonto || !pagoFecha}
            >
              <PiggyBank className="size-4" />
              {savingPago ? 'Registrando...' : 'Registrar y activar cuenta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Dialog: Resultado del correo de bienvenida post-aprobación ─────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!aprobacionEmailData} onOpenChange={open => { if (!open) { setAprobacionEmailData(null); setSelectedSolicitud(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {aprobacionEmailData?.inviteLink
                ? <><CheckCircle className="size-5 text-emerald-600" /> ¡Solicitud aprobada!</>
                : aprobacionEmailData?.error === 'RATE_LIMIT'
                  ? <><AlertTriangle className="size-5 text-orange-500" /> Límite de invitaciones alcanzado</>
                  : <><AlertTriangle className="size-5 text-red-500" /> Error al generar el acceso</>
              }
            </DialogTitle>
            <DialogDescription>
              {aprobacionEmailData?.inviteLink
                ? 'La cuenta fue creada. Envía el enlace de acceso al aspirante por Gmail.'
                : 'La aprobación quedó registrada en el sistema.'}
            </DialogDescription>
          </DialogHeader>

          {aprobacionEmailData && (
            <div className="space-y-4">
              {aprobacionEmailData.inviteLink ? (
                /* ── Email enviado exitosamente ── */
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-5 text-emerald-600 shrink-0" />
                    <p className="text-sm font-semibold text-emerald-800">¡Email de bienvenida enviado automáticamente!</p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Aspirante:</span>
                      <span className="font-semibold text-slate-800">{aprobacionEmailData.nombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Correo:</span>
                      <span className="font-semibold text-slate-800 break-all">{aprobacionEmailData.email}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white border border-emerald-200 p-3 text-xs text-emerald-700">
                    <p>📧 El aspirante recibirá un correo con el diseño de UFCA y un botón para crear su contraseña. El enlace expira en <strong>24 horas</strong>.</p>
                  </div>
                </div>
              ) : aprobacionEmailData.error === 'RATE_LIMIT' ? (
                /* ── Rate limit ── */
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-orange-800">Has excedido el límite de correos de Gmail</p>
                      <p className="text-xs text-orange-700 mt-1">
                        La aprobación quedó registrada. El correo de invitación se podrá reenviar cuando se cumpla la hora.
                      </p>
                    </div>
                  </div>
                  {rateLimitCountdown ? (
                    <div className="rounded-lg bg-white border border-orange-200 p-3 flex items-center justify-between">
                      <span className="text-xs text-slate-600">Tiempo restante para reenviar:</span>
                      <span className="text-lg font-bold text-orange-600 tabular-nums">{rateLimitCountdown}</span>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 font-medium">
                      ✅ Ya puedes reenviar el correo desde el detalle de la solicitud.
                    </div>
                  )}
                </div>
              ) : (
                /* ── Otro error ── */
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">No se pudo generar el enlace de acceso</p>
                      {aprobacionEmailData.error && (
                        <p className="text-xs text-red-600 mt-1">{aprobacionEmailData.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white border border-red-200 p-3 text-xs text-slate-700">
                    <p>La aprobación quedó registrada. Para dar acceso al sistema, ve a <strong>Supabase → Authentication → Users → Invite user</strong> e ingresa el correo del aspirante manualmente.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAprobacionEmailData(null); setSelectedSolicitud(null); }}
            >
              Cerrar
            </Button>

            {/* El email ya se envió automáticamente — solo mostrar botón Cerrar */}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
