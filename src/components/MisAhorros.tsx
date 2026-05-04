import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  PiggyBank, Wallet, Clock, CheckCircle2, XCircle, Send,
  TrendingUp, DollarSign, Calendar, History, FileText, Target,
  Plus, ArrowUpCircle, ArrowDownCircle, Banknote,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { generateAhorroPermanentePDF } from './utils/pdfGenerator';

const FRECUENCIAS   = ['Diaria', 'Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'];
const MEDIOS_PAGO   = ['Transferencia bancaria', 'Efectivo', 'PSE', 'Nequi', 'Daviplata', 'Otro'];

interface MisAhorrosProps {
  userData?: any;
}

export default function MisAhorros({ userData }: MisAhorrosProps) {
  // ── Datos ─────────────────────────────────────────────────────────────────
  const [loading, setLoading]                     = useState(true);
  const [miAsociadoId, setMiAsociadoId]           = useState<string | null>(null);
  const [ahorroPermanente, setAhorroPermanente]   = useState<any>(null);
  const [ahorrosVoluntarios, setAhorrosVoluntarios] = useState<any[]>([]);
  const [solicitudPerm, setSolicitudPerm]         = useState<any>(null);
  const [solicitudVol, setSolicitudVol]           = useState<any>(null);
  const [montoObligatorio, setMontoObligatorio]   = useState(50000);
  const [movsPerm, setMovsPerm]                   = useState<any[]>([]);
  const [movsVol, setMovsVol]                     = useState<any[]>([]);

  // ── Diálogos ──────────────────────────────────────────────────────────────
  const [isSolPermDialogOpen, setIsSolPermDialogOpen] = useState(false);
  const [isSolVolDialogOpen, setIsSolVolDialogOpen]   = useState(false);
  const [saving, setSaving]                           = useState(false);

  // ── Formulario solicitud voluntario ───────────────────────────────────────
  const [volNombrePlan, setVolNombrePlan]         = useState('');
  const [volFrecuencia, setVolFrecuencia]         = useState('Mensual');
  const [volMontoInicial, setVolMontoInicial]     = useState('');
  const [volMontoObjetivo, setVolMontoObjetivo]   = useState('');
  const [volNota, setVolNota]                     = useState('');
  const [permNota, setPermNota]                   = useState('');

  // ── Detalle voluntario seleccionado ───────────────────────────────────────
  const [volSeleccionado, setVolSeleccionado]     = useState<any>(null);

  // ── Reportar aporte ───────────────────────────────────────────────────────
  const [solicitudesAporte, setSolicitudesAporte] = useState<any[]>([]);
  const [isAporteDialogOpen, setIsAporteDialogOpen] = useState(false);
  const [aporteAhorroId, setAporteAhorroId]       = useState<string>('');
  const [aporteTipo, setAporteTipo]               = useState<'permanente'|'voluntario'>('permanente');
  const [aporteMonto, setAporteMonto]             = useState('');
  const [aporteFecha, setAporteFecha]             = useState('');
  const [aporteMedio, setAporteMedio]             = useState('Transferencia bancaria');
  const [aporteNota, setAporteNota]               = useState('');
  const [savingAporte, setSavingAporte]           = useState(false);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

  // ── Mes fiscal: día 1 al 30 de cada mes ──────────────────────────────────
  const getMesFiscal = () => {
    const hoy  = new Date();
    const año  = hoy.getFullYear();
    const mes  = hoy.getMonth(); // 0-based
    const primerDia = new Date(año, mes, 1);
    // El mes fiscal termina el día 30 (o el último día del mes si es menor a 30)
    const ultimoDelMes  = new Date(año, mes + 1, 0).getDate(); // último día real
    const diaFin        = Math.min(30, ultimoDelMes);
    const ultimoDia     = new Date(año, mes, diaFin);
    const fmt           = (d: Date) => d.toISOString().split('T')[0];
    const nombreMes     = hoy.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    return {
      primerDia:  fmt(primerDia),
      ultimoDia:  fmt(ultimoDia),
      hoy:        fmt(hoy),
      diaFin,
      nombreMes:  nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
    };
  };

  const MONTO_MINIMO_VOLUNTARIO = 50_000;

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setLoading(true);
    try {
      // 1. Resolver asociado_id
      let asocId: string | null = userData?.asociado_id ?? null;
      if (!asocId && userData?.cedula) {
        const { data: asoc } = await supabase
          .from('asociados')
          .select('id')
          .eq('cedula', userData.cedula)
          .maybeSingle();
        asocId = asoc?.id ?? null;
      }
      setMiAsociadoId(asocId);
      if (!asocId) return;

      // 2. Cargar todo en paralelo
      const [permRes, volRes, solRes, configRes] = await Promise.all([
        supabase
          .from('ahorro_permanente')
          .select('*')
          .eq('asociado_id', asocId)
          .eq('anulado', false)
          .maybeSingle(),
        supabase
          .from('ahorro_voluntario')
          .select('*')
          .eq('asociado_id', asocId)
          .eq('anulado', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('solicitudes')
          .select('*')
          .eq('asociado_id', asocId)
          .in('tipo', ['ahorro_permanente', 'ahorro_voluntario'])
          .order('created_at', { ascending: false }),
        supabase
          .from('configuracion')
          .select('valor')
          .eq('id', 'monto_obligatorio_ahorro_permanente')
          .single(),
      ]);

      setAhorroPermanente(permRes.data ?? null);
      setAhorrosVoluntarios(volRes.data ?? []);

      // Solicitudes: aplanar datos jsonb y priorizar pendiente/rechazada sobre aprobada
      const flattenSol = (s: any) => ({
        ...s,
        nota_asociado:  s.datos?.nota_asociado,
        nombre_plan:    s.datos?.nombre_plan,
        frecuencia:     s.datos?.frecuencia,
        monto_inicial:  s.datos?.monto_inicial,
        monto_objetivo: s.datos?.monto_objetivo,
      });
      const sols: any[] = (solRes.data ?? []).map(flattenSol);
      const solsPerm = sols.filter(s => s.tipo === 'ahorro_permanente');
      const solsVol  = sols.filter(s => s.tipo === 'ahorro_voluntario');

      // Si no hay ahorro activo, priorizar la solicitud pendiente o rechazada más reciente
      // Si hay ahorro activo, la solicitud aprobada es la relevante
      const encontrarSolicitud = (lista: any[], hayAhorro: boolean) => {
        if (hayAhorro) return lista[0] ?? null; // la más reciente (aprobada)
        return (
          lista.find(s => s.estado === 'pendiente') ??
          lista.find(s => s.estado === 'rechazada') ??
          lista[0] ?? null
        );
      };

      setSolicitudPerm(encontrarSolicitud(solsPerm, !!permRes.data));
      setSolicitudVol(encontrarSolicitud(solsVol,  (volRes.data ?? []).length > 0));

      if (!configRes.error && configRes.data) {
        const m = parseFloat(configRes.data.valor);
        if (!isNaN(m) && m > 0) setMontoObligatorio(m);
      }

      // 3. Solicitudes de aporte del asociado
      const { data: aportes } = await supabase
        .from('solicitudes')
        .select('*')
        .eq('asociado_id', asocId)
        .in('tipo', ['aporte_permanente', 'aporte_voluntario'])
        .order('created_at', { ascending: false });
      const aportesMapped = (aportes ?? []).map((ap: any) => ({
        ...ap,
        tipo_ahorro: ap.tipo === 'aporte_permanente' ? 'permanente' : 'voluntario',
        fecha_pago:  ap.datos?.fecha_pago,
        medio_pago:  ap.datos?.medio_pago,
        nota:        ap.datos?.nota,
      }));
      setSolicitudesAporte(aportesMapped);

      // 4. Movimientos del ahorro permanente (últimos 5)
      if (permRes.data?.id) {
        const { data: movs } = await supabase
          .from('movimientos_ahorro_permanente')
          .select('*')
          .eq('ahorro_id', permRes.data.id)
          .order('fecha_movimiento', { ascending: false })
          .limit(5);
        setMovsPerm(movs ?? []);
      }
    } catch (err: any) {
      toast.error('Error al cargar tus ahorros: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Movimientos del ahorro voluntario seleccionado
  async function cargarMovsVol(ahorro: any) {
    setVolSeleccionado(ahorro);
    const { data } = await supabase
      .from('movimientos_ahorro_voluntario')
      .select('*')
      .eq('ahorro_id', ahorro.id)
      .order('fecha_movimiento', { ascending: false })
      .limit(5);
    setMovsVol(data ?? []);
  }

  // ── Enviar solicitud ahorro permanente ────────────────────────────────────
  const handleSolicitarPermanente = async () => {
    if (!miAsociadoId) return;
    if (solicitudPerm?.estado === 'pendiente') {
      toast.error('Ya tienes una solicitud pendiente'); return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('solicitudes')
        .insert({
          tipo:        'ahorro_permanente',
          asociado_id: miAsociadoId,
          estado:      'pendiente',
          datos:       { nota_asociado: permNota.trim() || null },
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('notificaciones').insert({
        titulo:     'Nueva solicitud de ahorro permanente',
        mensaje:    `El asociado ${userData?.name ?? ''} ha solicitado un plan de ahorro permanente.`,
        tipo:       'solicitud_ahorro',
        leida:      false,
        para_admin: true,
      });

      setSolicitudPerm({ ...data, nota_asociado: data.datos?.nota_asociado });
      setIsSolPermDialogOpen(false);
      setPermNota('');
      toast.success('✅ Solicitud enviada', {
        description: 'El administrador revisará tu solicitud pronto.',
      });
    } catch (err: any) {
      toast.error('Error al enviar la solicitud: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Enviar solicitud ahorro voluntario ────────────────────────────────────
  const handleSolicitarVoluntario = async () => {
    if (!miAsociadoId) return;
    if (!volNombrePlan.trim()) { toast.error('El nombre del plan es obligatorio'); return; }
    if (!volFrecuencia)        { toast.error('Selecciona la frecuencia de ahorro'); return; }
    if (solicitudVol?.estado === 'pendiente') {
      toast.error('Ya tienes una solicitud pendiente'); return;
    }
    setSaving(true);
    try {
      const montoIni = parseFloat(volMontoInicial.replace(/[^\d.]/g, '')) || 0;
      const montoObj = parseFloat(volMontoObjetivo.replace(/[^\d.]/g, '')) || 0;

      const { data, error } = await supabase
        .from('solicitudes')
        .insert({
          tipo:        'ahorro_voluntario',
          asociado_id: miAsociadoId,
          estado:      'pendiente',
          datos: {
            nombre_plan:    volNombrePlan.trim(),
            frecuencia:     volFrecuencia,
            monto_inicial:  montoIni || null,
            monto_objetivo: montoObj || null,
            nota_asociado:  volNota.trim() || null,
          },
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('notificaciones').insert({
        titulo:     'Nueva solicitud de ahorro voluntario',
        mensaje:    `El asociado ${userData?.name ?? ''} ha solicitado el plan "${volNombrePlan.trim()}".`,
        tipo:       'solicitud_ahorro',
        leida:      false,
        para_admin: true,
      });

      setSolicitudVol({
        ...data,
        nombre_plan:    data.datos?.nombre_plan,
        frecuencia:     data.datos?.frecuencia,
        monto_inicial:  data.datos?.monto_inicial,
        monto_objetivo: data.datos?.monto_objetivo,
        nota_asociado:  data.datos?.nota_asociado,
      });
      setIsSolVolDialogOpen(false);
      setVolNombrePlan(''); setVolFrecuencia('Mensual');
      setVolMontoInicial(''); setVolMontoObjetivo(''); setVolNota('');
      toast.success('✅ Solicitud enviada', {
        description: 'El administrador revisará tu plan pronto.',
      });
    } catch (err: any) {
      toast.error('Error al enviar la solicitud: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── PDF extracto permanente ───────────────────────────────────────────────
  const handleDescargarPDF = async () => {
    if (!ahorroPermanente) return;
    const { data: movs } = await supabase
      .from('movimientos_ahorro_permanente')
      .select('*')
      .eq('ahorro_id', ahorroPermanente.id)
      .order('fecha_movimiento', { ascending: true });

    const hoy = new Date().toISOString().split('T')[0];
    generateAhorroPermanentePDF({
      asociado:          userData?.name ?? '',
      cedula:            userData?.cedula ?? '',
      fechaAfiliacion:   ahorroPermanente.fecha_inicio,
      aporteActual:      ahorroPermanente.cuota_mensual,
      fechaUltimoAporte: (movs ?? [])[0]?.fecha_movimiento ?? ahorroPermanente.fecha_inicio,
      totalAportes:      (movs ?? []).length,
      saldoAcumulado:    ahorroPermanente.monto_ahorrado,
      estado:            ahorroPermanente.estado,
      rangoInicio:       ahorroPermanente.fecha_inicio,
      rangoFin:          hoy,
      movimientos:       movs ?? [],
    });
    toast.success('Extracto PDF descargado');
  };

  // ── Reportar aporte ───────────────────────────────────────────────────────
  const abrirDialogoAporte = (ahorroId: string, tipo: 'permanente' | 'voluntario') => {
    setAporteAhorroId(ahorroId);
    setAporteTipo(tipo);
    setAporteMonto('');
    // Para voluntario: la fecha por defecto es hoy, pero limitada al rango del mes fiscal (1-30)
    const { hoy, ultimoDia } = getMesFiscal();
    setAporteFecha(hoy <= ultimoDia ? hoy : ultimoDia);
    setAporteMedio('Transferencia bancaria');
    setAporteNota('');
    setIsAporteDialogOpen(true);
  };

  const handleReportarAporte = async () => {
    if (!miAsociadoId || !aporteAhorroId) return;
    const monto = parseFloat(aporteMonto.replace(/\./g, '').replace(',', '.'));
    if (!monto || monto <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (!aporteFecha)         { toast.error('Selecciona la fecha del pago'); return; }

    // ── Reglas del ahorro voluntario ─────────────────────────────────────────
    if (aporteTipo === 'voluntario') {
      // 1. Monto mínimo $50.000
      if (monto < MONTO_MINIMO_VOLUNTARIO) {
        toast.error('Monto mínimo no alcanzado', {
          description: `El ahorro voluntario mínimo es ${formatCurrency(MONTO_MINIMO_VOLUNTARIO)} por depósito.`,
          duration: 6000,
        });
        return;
      }
      // 2. La fecha debe estar dentro del mes fiscal actual (día 1 al 30)
      const { primerDia, ultimoDia, nombreMes } = getMesFiscal();
      if (aporteFecha < primerDia || aporteFecha > ultimoDia) {
        toast.error('Fecha fuera del mes fiscal', {
          description: `El depósito debe aplicar al mes fiscal actual: ${nombreMes} (del día 1 al ${ultimoDia.split('-')[2]}).`,
          duration: 6000,
        });
        return;
      }
    }

    setSavingAporte(true);
    try {
      const { data, error } = await supabase
        .from('solicitudes')
        .insert({
          tipo:        aporteTipo === 'permanente' ? 'aporte_permanente' : 'aporte_voluntario',
          ahorro_id:   aporteAhorroId,
          asociado_id: miAsociadoId,
          monto,
          estado:      'pendiente',
          datos: {
            fecha_pago: aporteFecha,
            medio_pago: aporteMedio,
            nota:       aporteNota.trim() || null,
          },
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('notificaciones').insert({
        titulo:     'Nuevo reporte de aporte',
        mensaje:    `${userData?.name ?? 'Un asociado'} reportó un aporte de ${formatCurrency(monto)} en ahorro ${aporteTipo}.`,
        tipo:       'aporte_reportado',
        leida:      false,
        para_admin: true,
      });

      const aporteAplanado = {
        ...data,
        tipo_ahorro: aporteTipo,
        fecha_pago:  data.datos?.fecha_pago,
        medio_pago:  data.datos?.medio_pago,
        nota:        data.datos?.nota,
      };
      setSolicitudesAporte(prev => [aporteAplanado, ...prev]);
      setIsAporteDialogOpen(false);
      toast.success('✅ Pago reportado', {
        description: 'El administrador verificará y acreditará tu aporte pronto.',
      });
    } catch (err: any) {
      toast.error('Error al reportar el pago: ' + err.message);
    } finally {
      setSavingAporte(false);
    }
  };

  // ── Helpers UI ────────────────────────────────────────────────────────────
  const SolicitudStatusCard = ({
    tipo, solicitud, ahorro, onSolicitar, onReenviar,
  }: {
    tipo: 'permanente' | 'voluntario';
    solicitud: any;
    ahorro: any;
    onSolicitar: () => void;
    onReenviar: () => void;
  }) => {
    if (ahorro) return null; // Tiene ahorro activo → lo muestra la sección de abajo

    if (!solicitud) return (
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <div className={`p-4 rounded-full ${tipo === 'permanente' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
          {tipo === 'permanente'
            ? <PiggyBank className="size-8 text-emerald-600" />
            : <Wallet className="size-8 text-blue-600" />}
        </div>
        <div>
          <p className="font-semibold text-slate-700">
            {tipo === 'permanente' ? 'Sin ahorro permanente' : 'Sin ahorro voluntario'}
          </p>
          <p className="text-sm text-slate-500 mt-0.5">
            {tipo === 'permanente'
              ? `Cuota mensual obligatoria: ${formatCurrency(montoObligatorio)}`
              : 'Define tu propio plan, frecuencia y meta'}
          </p>
        </div>
        <Button
          size="sm"
          className={`gap-2 ${tipo === 'permanente' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          onClick={onSolicitar}
        >
          <Send className="size-4" /> Solicitar
        </Button>
      </div>
    );

    if (solicitud.estado === 'pendiente') return (
      <div className="flex flex-col items-center text-center gap-2 py-6">
        <div className="p-3 bg-amber-100 rounded-full">
          <Clock className="size-7 text-amber-600" />
        </div>
        <p className="font-semibold text-amber-800">Solicitud en revisión</p>
        <p className="text-xs text-amber-600">
          Enviada el {new Date(solicitud.created_at).toLocaleDateString('es-CO')}
        </p>
        {solicitud.nota_asociado && (
          <p className="text-xs text-slate-500 italic">"{solicitud.nota_asociado}"</p>
        )}
      </div>
    );

    if (solicitud.estado === 'rechazada') return (
      <div className="flex flex-col items-center text-center gap-2 py-6">
        <div className="p-3 bg-red-100 rounded-full">
          <XCircle className="size-7 text-red-500" />
        </div>
        <p className="font-semibold text-red-800">Solicitud rechazada</p>
        {solicitud.nota_admin && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 max-w-xs">
            <span className="font-medium">Motivo:</span> {solicitud.nota_admin}
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-2 border-red-300 text-red-700 hover:bg-red-50 mt-1"
          onClick={onReenviar}
        >
          <Send className="size-4" /> Volver a solicitar
        </Button>
      </div>
    );

    // Para cualquier otro estado (aprobada, anulada, etc.) sin ahorro activo
    // → mostrar el estado "sin ahorro" con botón de solicitar nuevamente
    return (
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <div className={`p-4 rounded-full ${tipo === 'permanente' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
          {tipo === 'permanente'
            ? <PiggyBank className="size-8 text-emerald-600" />
            : <Wallet className="size-8 text-blue-600" />}
        </div>
        <div>
          <p className="font-semibold text-slate-700">
            {tipo === 'permanente' ? 'Sin ahorro permanente activo' : 'Sin ahorro voluntario activo'}
          </p>
          <p className="text-sm text-slate-500 mt-0.5">
            {tipo === 'permanente'
              ? `Tu plan anterior fue anulado. Puedes solicitar uno nuevo.`
              : 'Tu plan anterior fue anulado. Puedes solicitar uno nuevo.'}
          </p>
        </div>
        <Button
          size="sm"
          className={`gap-2 ${tipo === 'permanente' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          onClick={onSolicitar}
        >
          <Send className="size-4" /> Solicitar nuevo plan
        </Button>
      </div>
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Cargando tus ahorros...</p>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Encabezado */}
        <div>
          <h1 className="text-slate-900 mb-1">Mis Ahorros</h1>
          <p className="text-slate-600">Consulta y gestiona tus planes de ahorro</p>
        </div>

        {/* ── Dos columnas: Permanente | Voluntario ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── AHORRO PERMANENTE ─────────────────────────────── */}
          <Card className={`${ahorroPermanente ? 'border-emerald-200' : solicitudPerm?.estado === 'pendiente' ? 'border-amber-200' : solicitudPerm?.estado === 'rechazada' ? 'border-red-200' : 'border-slate-200'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${ahorroPermanente ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  <PiggyBank className={`size-5 ${ahorroPermanente ? 'text-emerald-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  <CardTitle className="text-base">Ahorro Permanente</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">Aporte mensual obligatorio fijo</p>
                </div>
                {ahorroPermanente && (
                  <Badge className={`ml-auto ${ahorroPermanente.estado ? 'bg-emerald-600' : 'bg-yellow-100 text-yellow-700'}`}>
                    {ahorroPermanente.estado ? 'Activo' : 'Inactivo'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Estado de solicitud (cuando no hay ahorro) */}
              <SolicitudStatusCard
                tipo="permanente"
                solicitud={solicitudPerm}
                ahorro={ahorroPermanente}
                onSolicitar={() => setIsSolPermDialogOpen(true)}
                onReenviar={() => { setPermNota(''); setIsSolPermDialogOpen(true); }}
              />

              {/* Detalle cuando tiene ahorro aprobado */}
              {ahorroPermanente && (
                <div className="space-y-4">
                  {/* Saldo destacado */}
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                    <p className="text-xs text-emerald-600 font-medium mb-1">Saldo acumulado</p>
                    <p className="text-3xl font-bold text-emerald-700">
                      {formatCurrency(ahorroPermanente.monto_ahorrado)}
                    </p>
                  </div>

                  {/* Info del plan */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-400 mb-0.5">Cuota mensual</p>
                      <p className="font-semibold text-slate-700">{formatCurrency(ahorroPermanente.cuota_mensual)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-400 mb-0.5">Fecha inicio</p>
                      <p className="font-semibold text-slate-700">{ahorroPermanente.fecha_inicio}</p>
                    </div>
                  </div>

                  {/* Últimos movimientos */}
                  {movsPerm.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                        <History className="size-3" /> Últimos movimientos
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {movsPerm.map(m => (
                          <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-white rounded-lg border border-slate-100 text-xs">
                            <div className="flex items-center gap-2">
                              {m.tipo_movimiento === 'Retiro'
                                ? <ArrowDownCircle className="size-3.5 text-red-400 shrink-0" />
                                : <ArrowUpCircle className="size-3.5 text-emerald-400 shrink-0" />}
                              <span className="text-slate-600">{m.tipo_movimiento} · {m.fecha_movimiento}</span>
                            </div>
                            <span className={`font-semibold ${m.tipo_movimiento === 'Retiro' ? 'text-red-600' : 'text-emerald-600'}`}>
                              {m.tipo_movimiento === 'Retiro' ? '-' : '+'}{formatCurrency(m.monto)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Aporte pendiente */}
                  {solicitudesAporte.some(a => a.ahorro_id === ahorroPermanente.id && a.estado === 'pendiente') && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      <Clock className="size-3.5 shrink-0" />
                      Tienes un aporte pendiente de confirmación por el administrador
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                      onClick={handleDescargarPDF}
                    >
                      <FileText className="size-4" /> Extracto PDF
                    </Button>
                    <Button
                      size="sm"
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => abrirDialogoAporte(ahorroPermanente.id, 'permanente')}
                      disabled={solicitudesAporte.some(a => a.ahorro_id === ahorroPermanente.id && a.estado === 'pendiente')}
                    >
                      <Banknote className="size-4" /> Reportar pago
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── AHORRO VOLUNTARIO ────────────────────────────────────────── */}
          <Card className={`${ahorrosVoluntarios.length > 0 ? 'border-blue-200' : solicitudVol?.estado === 'pendiente' ? 'border-amber-200' : solicitudVol?.estado === 'rechazada' ? 'border-red-200' : 'border-slate-200'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${ahorrosVoluntarios.length > 0 ? 'bg-blue-100' : 'bg-slate-100'}`}>
                  <Wallet className={`size-5 ${ahorrosVoluntarios.length > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  <CardTitle className="text-base">Ahorro Voluntario</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">Plan flexible con tu frecuencia y meta</p>
                </div>
                {ahorrosVoluntarios.length > 0 && (
                  <Badge className="ml-auto bg-blue-600">
                    {ahorrosVoluntarios.length} {ahorrosVoluntarios.length === 1 ? 'plan' : 'planes'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Estado solicitud (cuando no hay planes) */}
              {ahorrosVoluntarios.length === 0 && (
                <SolicitudStatusCard
                  tipo="voluntario"
                  solicitud={solicitudVol}
                  ahorro={null}
                  onSolicitar={() => setIsSolVolDialogOpen(true)}
                  onReenviar={() => {
                    setVolNombrePlan(''); setVolFrecuencia('Mensual');
                    setVolMontoInicial(''); setVolMontoObjetivo(''); setVolNota('');
                    setIsSolVolDialogOpen(true);
                  }}
                />
              )}

              {/* Lista de planes voluntarios */}
              {ahorrosVoluntarios.length > 0 && (
                <div className="space-y-3">
                  {/* Botón nuevo plan */}
                  {!(solicitudVol?.estado === 'pendiente') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => setIsSolVolDialogOpen(true)}
                    >
                      <Plus className="size-4" /> Solicitar otro plan
                    </Button>
                  )}
                  {solicitudVol?.estado === 'pendiente' && (
                    <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      <Clock className="size-4 shrink-0" />
                      Tienes una solicitud de nuevo plan en revisión
                    </div>
                  )}

                  {/* Tabs por plan */}
                  {ahorrosVoluntarios.length === 1 ? (
                    <PlanVoluntarioCard
                      plan={ahorrosVoluntarios[0]}
                      movsVol={volSeleccionado?.id === ahorrosVoluntarios[0].id ? movsVol : []}
                      onSelect={cargarMovsVol}
                      formatCurrency={formatCurrency}
                      onReportarAporte={() => abrirDialogoAporte(ahorrosVoluntarios[0].id, 'voluntario')}
                      aportePendiente={solicitudesAporte.some(a => a.ahorro_id === ahorrosVoluntarios[0].id && a.estado === 'pendiente')}
                    />
                  ) : (
                    <Tabs defaultValue={ahorrosVoluntarios[0]?.id}>
                      <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${Math.min(ahorrosVoluntarios.length, 3)}, 1fr)` }}>
                        {ahorrosVoluntarios.map((p, i) => (
                          <TabsTrigger key={p.id} value={p.id} className="text-xs truncate" onClick={() => cargarMovsVol(p)}>
                            {p.frecuencia_ahorro ?? `Plan ${i + 1}`}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {ahorrosVoluntarios.map(p => (
                        <TabsContent key={p.id} value={p.id}>
                          <PlanVoluntarioCard
                            plan={p}
                            movsVol={volSeleccionado?.id === p.id ? movsVol : []}
                            onSelect={cargarMovsVol}
                            formatCurrency={formatCurrency}
                            onReportarAporte={() => abrirDialogoAporte(p.id, 'voluntario')}
                            aportePendiente={solicitudesAporte.some(a => a.ahorro_id === p.id && a.estado === 'pendiente')}
                          />
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Dialog: Solicitar ahorro permanente ─────────────────────────────── */}
      <Dialog open={isSolPermDialogOpen} onOpenChange={(o) => { setIsSolPermDialogOpen(o); if (!o) setPermNota(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="size-5 text-emerald-600" />
              Solicitar Ahorro Permanente
            </DialogTitle>
            <DialogDescription>
              Tu cuota mensual obligatoria será de{' '}
              <span className="font-bold text-emerald-700">{formatCurrency(montoObligatorio)}</span>.
              El administrador activará tu plan una vez apruebe la solicitud.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 space-y-1">
              <p className="font-medium">¿Qué incluye el ahorro permanente?</p>
              <ul className="text-xs text-emerald-700 space-y-0.5 list-disc list-inside">
                <li>Aporte mensual fijo de {formatCurrency(montoObligatorio)}</li>
                <li>Historial de movimientos y extracto PDF</li>
                <li>Acumulación de capital como asociado</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <Label>Nota adicional (opcional)</Label>
              <Textarea
                placeholder="¿Hay algo que quieras comunicarle al administrador?"
                value={permNota}
                onChange={e => setPermNota(e.target.value)}
                className="min-h-[70px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSolPermDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSolicitarPermanente}
              disabled={saving}
            >
              <Send className="size-4" />
              {saving ? 'Enviando...' : 'Enviar solicitud'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Solicitar ahorro voluntario ─────────────────────────────── */}
      <Dialog open={isSolVolDialogOpen} onOpenChange={(o) => {
        setIsSolVolDialogOpen(o);
        if (!o) {
          setVolNombrePlan(''); setVolFrecuencia('Mensual');
          setVolMontoInicial(''); setVolMontoObjetivo(''); setVolNota('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="size-5 text-blue-600" />
              Solicitar Ahorro Voluntario
            </DialogTitle>
            <DialogDescription>
              Define tu plan de ahorro personalizado. El administrador lo activará una vez aprobado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre del plan <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Ej: Fondo vacaciones, Ahorro vivienda..."
                value={volNombrePlan}
                onChange={e => setVolNombrePlan(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frecuencia de ahorro <span className="text-red-500">*</span></Label>
              <Select value={volFrecuencia} onValueChange={setVolFrecuencia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FRECUENCIAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto inicial (opcional)</Label>
                <Input
                  placeholder="$ 0"
                  value={volMontoInicial}
                  onChange={e => setVolMontoInicial(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Meta de ahorro (opcional)</Label>
                <Input
                  placeholder="$ 0"
                  value={volMontoObjetivo}
                  onChange={e => setVolMontoObjetivo(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nota adicional (opcional)</Label>
              <Textarea
                placeholder="Cuéntale al administrador el propósito de este plan..."
                value={volNota}
                onChange={e => setVolNota(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSolVolDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="gap-2 bg-blue-600 hover:bg-blue-700"
              onClick={handleSolicitarVoluntario}
              disabled={saving}
            >
              <Send className="size-4" />
              {saving ? 'Enviando...' : 'Enviar solicitud'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Reportar pago de aporte ─────────────────────────────────── */}
      <Dialog open={isAporteDialogOpen} onOpenChange={(o) => {
        setIsAporteDialogOpen(o);
        if (!o) { setAporteMonto(''); setAporteNota(''); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className={`size-5 ${aporteTipo === 'voluntario' ? 'text-blue-600' : 'text-emerald-600'}`} />
              Reportar pago de aporte
            </DialogTitle>
            <DialogDescription>
              Indica los detalles del pago que realizaste. El administrador lo verificará
              y acreditará en tu saldo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">

            {/* ── Banner mes fiscal (solo voluntario) ── */}
            {aporteTipo === 'voluntario' && (() => {
              const { nombreMes, primerDia, ultimoDia } = getMesFiscal();
              const diaInicio = primerDia.split('-')[2];
              const diaFin    = ultimoDia.split('-')[2];
              return (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
                  <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    Mes fiscal actual: <span className="capitalize">{nombreMes}</span>
                  </p>
                  <p className="text-xs text-blue-700">
                    Tu depósito se aplicará al periodo del <strong>día {diaInicio} al {diaFin}</strong> de este mes.
                  </p>
                  <p className="text-xs text-blue-700">
                    Monto mínimo por depósito: <strong>{formatCurrency(MONTO_MINIMO_VOLUNTARIO)}</strong>
                  </p>
                </div>
              );
            })()}

            <div className="space-y-1.5">
              <Label>
                Monto pagado <span className="text-red-500">*</span>
                {aporteTipo === 'voluntario' && (
                  <span className="ml-1 text-xs text-blue-600 font-normal">
                    (mín. {formatCurrency(MONTO_MINIMO_VOLUNTARIO)})
                  </span>
                )}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <Input
                  className="pl-7"
                  placeholder={aporteTipo === 'voluntario' ? '50.000' : '0'}
                  value={aporteMonto}
                  onChange={e => setAporteMonto(e.target.value.replace(/[^\d.,]/g, ''))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha del pago <span className="text-red-500">*</span></Label>
              {aporteTipo === 'voluntario' ? (() => {
                const { primerDia, ultimoDia } = getMesFiscal();
                return (
                  <Input
                    type="date"
                    value={aporteFecha}
                    onChange={e => setAporteFecha(e.target.value)}
                    min={primerDia}
                    max={ultimoDia}
                  />
                );
              })() : (
                <Input
                  type="date"
                  value={aporteFecha}
                  onChange={e => setAporteFecha(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              )}
              {aporteTipo === 'voluntario' && (
                <p className="text-xs text-slate-500">
                  Solo puedes reportar aportes del mes fiscal actual.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Medio de pago <span className="text-red-500">*</span></Label>
              <Select value={aporteMedio} onValueChange={setAporteMedio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEDIOS_PAGO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Referencia / nota (opcional)</Label>
              <Textarea
                placeholder="Ej: Transferencia ref. 123456, comprobante adjunto..."
                value={aporteNota}
                onChange={e => setAporteNota(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-2">
              <Clock className="size-3.5 mt-0.5 shrink-0" />
              Tu aporte quedará pendiente hasta que el administrador confirme la recepción del pago.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAporteDialogOpen(false)} disabled={savingAporte}>
              Cancelar
            </Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleReportarAporte}
              disabled={savingAporte}
            >
              <Send className="size-4" />
              {savingAporte ? 'Enviando...' : 'Reportar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Subcomponente: tarjeta de un plan voluntario ───────────────────────────
function PlanVoluntarioCard({
  plan, movsVol, onSelect, formatCurrency, onReportarAporte, aportePendiente,
}: {
  plan: any;
  movsVol: any[];
  onSelect: (p: any) => void;
  formatCurrency: (v: number) => string;
  onReportarAporte: () => void;
  aportePendiente: boolean;
}) {
  const progreso = plan.monto_objetivo > 0
    ? Math.min(100, Math.round((plan.monto_ahorrado / plan.monto_objetivo) * 100))
    : null;

  return (
    <div className="space-y-3 pt-2">
      {/* Saldo */}
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-center">
        <p className="text-xs text-blue-600 font-medium mb-1">Saldo acumulado</p>
        <p className="text-3xl font-bold text-blue-700">{formatCurrency(plan.monto_ahorrado)}</p>
        {progreso !== null && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-blue-500 mb-1">
              <span>Progreso</span>
              <span>{progreso}% de {formatCurrency(plan.monto_objetivo)}</span>
            </div>
            <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 bg-slate-50 rounded-lg">
          <p className="text-slate-400 mb-0.5">Frecuencia</p>
          <p className="font-semibold text-slate-700">{plan.frecuencia_ahorro ?? '—'}</p>
        </div>
        <div className="p-2.5 bg-slate-50 rounded-lg">
          <p className="text-slate-400 mb-0.5">Desde</p>
          <p className="font-semibold text-slate-700">{plan.fecha_inicio ?? '—'}</p>
        </div>
      </div>

      {/* Últimos movimientos */}
      <div>
        <button
          onClick={() => onSelect(plan)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mb-2"
        >
          <History className="size-3" /> Ver últimos movimientos
        </button>
        {movsVol.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {movsVol.map(m => (
              <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-white rounded-lg border border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  {m.tipo_movimiento === 'Retiro'
                    ? <ArrowDownCircle className="size-3.5 text-red-400 shrink-0" />
                    : <ArrowUpCircle className="size-3.5 text-blue-400 shrink-0" />}
                  <span className="text-slate-600">{m.tipo_movimiento} · {m.fecha_movimiento}</span>
                </div>
                <span className={`font-semibold ${m.tipo_movimiento === 'Retiro' ? 'text-red-600' : 'text-blue-600'}`}>
                  {m.tipo_movimiento === 'Retiro' ? '-' : '+'}{formatCurrency(m.monto)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aporte pendiente */}
      {aportePendiente && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <Clock className="size-3.5 shrink-0" />
          Tienes un aporte pendiente de confirmación por el administrador
        </div>
      )}

      {/* Botón reportar pago */}
      <Button
        size="sm"
        className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
        onClick={onReportarAporte}
        disabled={aportePendiente}
      >
        <Banknote className="size-4" /> Reportar pago
      </Button>
    </div>
  );
}
