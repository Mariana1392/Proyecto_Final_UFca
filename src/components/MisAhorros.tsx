import { useState, useEffect } from 'react';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  PiggyBank, Wallet, Clock,
  TrendingUp, DollarSign, Calendar, History, FileText,
  ArrowUpCircle, ArrowDownCircle, AlertTriangle, Printer, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { buildAhorroPermanentePDF, buildAhorroVoluntarioPDF } from './utils/pdfGenerator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

interface MisAhorrosProps {
  userData?: any;
}

export default function MisAhorros({ userData }: MisAhorrosProps) {
  // ── Datos ─────────────────────────────────────────────────────────────────
  const [loading, setLoading]                       = useState(true);
  const [miAsociadoId, setMiAsociadoId]             = useState<string | null>(null);
  const [ahorroPermanente, setAhorroPermanente]     = useState<any>(null);
  const [ahorrosVoluntarios, setAhorrosVoluntarios] = useState<any[]>([]);
  const [montoObligatorio, setMontoObligatorio]     = useState(50000);
  const [movsPerm, setMovsPerm]                     = useState<any[]>([]);
  const [movsVol, setMovsVol]                       = useState<any[]>([]);

  // ── Detalle voluntario seleccionado ───────────────────────────────────────
  const [volSeleccionado, setVolSeleccionado]       = useState<any>(null);

  // ── Filtro y Ordenación ───────────────────────────────────────────────────
  const [filterVolEstado, setFilterVolEstado] = useState<string>('todos');
  const [sortPermKey, setSortPermKey] = useState<'fecha' | 'monto'>('fecha');
  const [sortPermOrder, setSortPermOrder] = useState<'asc' | 'desc'>('desc');
  const [sortVolKey, setSortVolKey] = useState<'fecha' | 'monto'>('fecha');
  const [sortVolOrder, setSortVolOrder] = useState<'asc' | 'desc'>('desc');

  // ── PDF Preview ───────────────────────────────────────────────────────────
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfFilename, setPdfFilename] = useState('');
  const [downloadPdfFn, setDownloadPdfFn] = useState<(() => void) | null>(null);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => { cargarDatos(); }, []);
  useRealtimeSubscription('mis_ahorros_realtime', ['cuentas_ahorro', 'transacciones'], cargarDatos);

  async function cargarDatos() {
    setLoading(true);
    try {
      // 1. Resolver asociado_id (ahora es userData.id directamente)
      let asocId: string | null = userData?.id ?? null;
      setMiAsociadoId(asocId);
      if (!asocId) return;

      // 2. Cargar todo en paralelo
      const [permRes, volRes, configRes] = await Promise.all([
        supabase
          .from('cuentas_ahorro')
          .select('*')
          .eq('tipo', 'permanente')
          .eq('asociado_id', asocId)
          .eq('anulado', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('cuentas_ahorro')
          .select('*')
          .eq('tipo', 'voluntario')
          .eq('asociado_id', asocId)
          .eq('anulado', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', 'cuota_ahorro_permanente')
          .single(),
      ]);

      // Entre varios registros, priorizar activos y, dentro de ellos, el de mayor saldo
      const listaPerm = permRes.data ?? [];
      const activosPerm = listaPerm.filter((a: any) => a.estado === 'activo');
      const mejorPerm =
        activosPerm.length > 0
          ? activosPerm.reduce((best: any, curr: any) =>
              curr.monto_ahorrado > best.monto_ahorrado ? curr : best, activosPerm[0])
          : listaPerm[0] ?? null;
      setAhorroPermanente(mejorPerm);
      setAhorrosVoluntarios(volRes.data ?? []);

      if (!configRes.error && configRes.data) {
        const m = parseFloat(configRes.data.valor);
        if (!isNaN(m) && m > 0) setMontoObligatorio(m);
      }

      // 3. Movimientos del ahorro permanente (últimos 50)
      if (mejorPerm?.id) {
        const { data: movs } = await supabase
          .from('transacciones')
          .select('*')
          .eq('tipo', 'aporte_permanente')
          .eq('ahorro_id', mejorPerm.id)
          .order('fecha_pago', { ascending: false })
          .limit(50);
        setMovsPerm(movs ?? []);
      }

      // 4. Movimientos de los ahorros voluntarios — pre-carga el plan activo
      const volData = volRes.data ?? [];
      if (volData.length > 0) {
        const volIds = volData.map((v: any) => v.id);
        const { data: movsVolData } = await supabase
          .from('transacciones')
          .select('*')
          .eq('tipo', 'aporte_voluntario')
          .in('ahorro_id', volIds)
          .order('fecha_pago', { ascending: false })
          .limit(50);

        // Pre-seleccionar el primer plan activo (o el primero de la lista)
        const primerActivo =
          volData.find((v: any) => v.estado === 'activo') ?? volData[0];
        if (primerActivo) {
          setVolSeleccionado(primerActivo);
          setMovsVol(
            (movsVolData ?? []).filter((m: any) => m.ahorro_id === primerActivo.id)
          );
        }
      }
    } catch (err: any) {
      toast.error('Error al cargar tus ahorros: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Movimientos del ahorro voluntario seleccionado (últimos 50)
  async function cargarMovsVol(ahorro: any) {
    setVolSeleccionado(ahorro);
    const { data } = await supabase
      .from('transacciones')
      .select('*')
      .eq('tipo', 'aporte_voluntario')
      .eq('ahorro_id', ahorro.id)
      .order('fecha_pago', { ascending: false })
      .limit(50);
    setMovsVol(data ?? []);
  }

  // ── Filtrado y ordenación en memoria ─────────────────────────────────────
  const filteredVoluntarios = (ahorrosVoluntarios ?? []).filter((p: any) => {
    if (filterVolEstado === 'todos') return true;
    return p.estado === filterVolEstado;
  });

  useEffect(() => {
    if (filteredVoluntarios.length > 0) {
      const exists = filteredVoluntarios.some((p: any) => p.id === volSeleccionado?.id);
      if (!exists) {
        cargarMovsVol(filteredVoluntarios[0]);
      }
    } else {
      if (volSeleccionado !== null) {
        setVolSeleccionado(null);
        setMovsVol([]);
      }
    }
  }, [filterVolEstado, ahorrosVoluntarios, volSeleccionado]);

  const getSortedMovsPerm = () => {
    return [...movsPerm].sort((a, b) => {
      let comparison = 0;
      if (sortPermKey === 'fecha') {
        comparison = new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime();
      } else {
        comparison = (a.monto || 0) - (b.monto || 0);
      }
      return sortPermOrder === 'asc' ? comparison : -comparison;
    });
  };

  const getSortedMovsVol = () => {
    return [...movsVol].sort((a, b) => {
      let comparison = 0;
      if (sortVolKey === 'fecha') {
        comparison = new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime();
      } else {
        comparison = (a.monto || 0) - (b.monto || 0);
      }
      return sortVolOrder === 'asc' ? comparison : -comparison;
    });
  };

  // ── PDF extracto permanente ───────────────────────────────────────────────
  const handleDescargarPDF = async () => {
    if (!ahorroPermanente) return;
    const { data: movs } = await supabase
      .from('transacciones')
      .select('*')
      .eq('tipo', 'aporte_permanente')
      .eq('ahorro_id', ahorroPermanente.id)
      .order('fecha_pago', { ascending: true });

    const hoy = new Date().toISOString().split('T')[0];
    const fechaInicio = ahorroPermanente.created_at?.split('T')[0] ?? hoy;
    
    const pdfObj = buildAhorroPermanentePDF({
      asociado:          userData?.name || userData?.nombre || '',
      cedula:            userData?.cedula ?? '',
      fechaAfiliacion:   fechaInicio,
      aporteActual:      ahorroPermanente.cuota_mensual,
      fechaUltimoAporte: (movs ?? [])[movs?.length - 1]?.fecha_pago ?? fechaInicio,
      totalAportes:      (movs ?? []).length,
      saldoAcumulado:    ahorroPermanente.monto_ahorrado,
      estado:            ahorroPermanente.estado,
      rangoInicio:       fechaInicio,
      rangoFin:          hoy,
      movimientos:       movs ?? [],
    });
    
    if (pdfObj) {
      setPdfPreviewUrl(pdfObj.url);
      setPdfFilename(pdfObj.filename);
      setDownloadPdfFn(() => pdfObj.download);
      setIsPdfPreviewOpen(true);
    } else {
      toast.error('Error al generar la vista previa del PDF');
    }
  };

  // ── PDF extracto voluntario ────────────────────────────────────────────────
  const handleDescargarVoluntarioPDF = async (plan: any) => {
    if (!plan) return;
    const { data: movs } = await supabase
      .from('transacciones')
      .select('*')
      .eq('tipo', 'aporte_voluntario')
      .eq('ahorro_id', plan.id)
      .order('fecha_pago', { ascending: true });

    const ultimoMov = movs && movs.length > 0 ? movs[movs.length - 1] : null;

    const pdfObj = buildAhorroVoluntarioPDF({
      asociado:          userData?.name || userData?.nombre || '',
      cedula:            userData?.cedula ?? '',
      estado:            plan.estado === 'activo',
      totalAportes:      (movs ?? []).length,
      ultimoAporte:      ultimoMov?.monto ?? 0,
      fechaUltimoAporte: ultimoMov?.fecha_pago ?? '—',
      montoTotal:        plan.monto_ahorrado,
    });

    if (pdfObj) {
      setPdfPreviewUrl(pdfObj.url);
      setPdfFilename(pdfObj.filename);
      setDownloadPdfFn(() => pdfObj.download);
      setIsPdfPreviewOpen(true);
    } else {
      toast.error('Error al generar la vista previa del PDF');
    }
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
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Encabezado */}
        <div>
          <h1 className="text-slate-900 mb-1">Mis Ahorros</h1>
          <p className="text-slate-600">Consulta tus planes de ahorro</p>
        </div>

        {/* ── Dos columnas: Permanente | Voluntario ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── AHORRO PERMANENTE ─────────────────────────────── */}
          <Card className={`${ahorroPermanente ? 'border-emerald-200' : 'border-slate-200'}`}>
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
                  <Badge className={`ml-auto ${ahorroPermanente.estado === 'activo' ? 'bg-emerald-600' : 'bg-yellow-100 text-yellow-700'}`}>
                    {ahorroPermanente.estado === 'activo' ? 'Activo' : ahorroPermanente.estado}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Sin ahorro permanente */}
              {!ahorroPermanente && (
                <div className="flex flex-col items-center text-center gap-3 py-6">
                  <div className="p-4 rounded-full bg-emerald-100">
                    <PiggyBank className="size-8 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">Sin ahorro permanente</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Tu ahorro permanente se activa automáticamente al ser aprobado como asociado.
                      Contacta al administrador si tienes dudas.
                    </p>
                  </div>
                </div>
              )}

              {/* Detalle cuando tiene ahorro aprobado */}
              {ahorroPermanente && (
                <div className="space-y-4">
                  {/* Banner de cuenta inactiva / suspendida */}
                  {ahorroPermanente.estado !== 'activo' && (
                    <div className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${
                      ahorroPermanente.estado === 'suspendido'
                        ? 'bg-orange-50 border-orange-200 text-orange-800'
                        : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    }`}>
                      <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">
                          Cuenta {ahorroPermanente.estado === 'suspendido' ? 'suspendida' : 'inactiva'}
                        </p>
                        <p className="text-xs mt-0.5 opacity-80">
                          {ahorroPermanente.estado === 'suspendido'
                            ? 'Tu cuenta está suspendida. Contacta al administrador para más información.'
                            : 'No puedes realizar nuevos aportes hasta que el administrador reactive tu cuenta.'}
                        </p>
                      </div>
                    </div>
                  )}

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
                      <p className="font-semibold text-slate-700">
                        {ahorroPermanente.created_at?.split('T')[0] ?? '—'}
                      </p>
                    </div>
                  </div>

                  {/* Últimos pagos */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <History className="size-3" /> Últimos pagos
                      </p>
                      {movsPerm.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              if (sortPermKey === 'fecha') {
                                setSortPermOrder(o => o === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortPermKey('fecha');
                                setSortPermOrder('desc');
                              }
                            }}
                            className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                              sortPermKey === 'fecha'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            Fecha {sortPermKey === 'fecha' && (sortPermOrder === 'asc' ? '↑' : '↓')}
                          </button>
                          <button
                            onClick={() => {
                              if (sortPermKey === 'monto') {
                                setSortPermOrder(o => o === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortPermKey('monto');
                                setSortPermOrder('desc');
                              }
                            }}
                            className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                              sortPermKey === 'monto'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            Monto {sortPermKey === 'monto' && (sortPermOrder === 'asc' ? '↑' : '↓')}
                          </button>
                        </div>
                      )}
                    </div>
                    {movsPerm.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {getSortedMovsPerm().map(m => (
                          <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                            <div className="flex items-center gap-2">
                              <ArrowUpCircle className="size-3.5 text-emerald-400 shrink-0" />
                              <span className="text-slate-600 dark:text-slate-400">
                                Pago · {m.fecha_pago}
                                {m.monto_mora > 0 ? <span className="ml-1 text-amber-600">(+mora)</span> : null}
                              </span>
                            </div>
                            <span className="font-semibold text-emerald-600">
                              +{formatCurrency(m.monto ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-2">Sin pagos registrados aún</p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                      onClick={handleDescargarPDF}
                    >
                      <FileText className="size-4" /> Extracto PDF
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── AHORRO VOLUNTARIO ────────────────────────────────────────── */}
          <Card className={`${ahorrosVoluntarios.length > 0 ? 'border-blue-200' : 'border-slate-200'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${ahorrosVoluntarios.length > 0 ? 'bg-blue-100' : 'bg-slate-100'}`}>
                  <Wallet className={`size-5 ${ahorrosVoluntarios.length > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  <CardTitle className="text-base">Ahorro Voluntario</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">Plan flexible gestionado por el administrador</p>
                </div>
                {ahorrosVoluntarios.length > 0 && (
                  <Badge className="ml-auto bg-blue-600">
                    {filteredVoluntarios.length} {filteredVoluntarios.length === 1 ? 'plan' : 'planes'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Sin planes voluntarios */}
              {ahorrosVoluntarios.length === 0 && (
                <div className="flex flex-col items-center text-center gap-3 py-6">
                  <div className="p-4 rounded-full bg-blue-100">
                    <Wallet className="size-8 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">Sin ahorro voluntario</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      No tienes planes de ahorro voluntario activos. Contacta al administrador para crear uno.
                    </p>
                  </div>
                </div>
              )}

              {/* Lista de planes voluntarios */}
              {ahorrosVoluntarios.length > 0 && (
                <div className="space-y-3">
                  {/* Selector de Estado (Filtro) */}
                  <div className="flex items-center gap-1.5 mb-4 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-lg w-fit">
                    {(['todos', 'activo', 'retirado'] as const).map((estado) => (
                      <button
                        key={estado}
                        onClick={() => setFilterVolEstado(estado)}
                        className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                          filterVolEstado === estado
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        {estado}
                      </button>
                    ))}
                  </div>

                  {filteredVoluntarios.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">No hay planes con el estado seleccionado.</p>
                  ) : filteredVoluntarios.length === 1 ? (
                    <PlanVoluntarioCard
                      plan={filteredVoluntarios[0]}
                      movsVol={volSeleccionado?.id === filteredVoluntarios[0].id ? getSortedMovsVol() : []}
                      onSelect={cargarMovsVol}
                      formatCurrency={formatCurrency}
                      sortVolKey={sortVolKey}
                      sortVolOrder={sortVolOrder}
                      setSortVolKey={setSortVolKey}
                      setSortVolOrder={setSortVolOrder}
                      onDescargarPDF={handleDescargarVoluntarioPDF}
                    />
                  ) : (
                    <Tabs defaultValue={filteredVoluntarios[0]?.id} value={volSeleccionado?.id}>
                      <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${Math.min(filteredVoluntarios.length, 3)}, 1fr)` }}>
                        {filteredVoluntarios.map((p, i) => (
                          <TabsTrigger key={p.id} value={p.id} className="text-xs truncate" onClick={() => cargarMovsVol(p)}>
                            {`Plan ${i + 1}`}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {filteredVoluntarios.map(p => (
                        <TabsContent key={p.id} value={p.id}>
                          <PlanVoluntarioCard
                            plan={p}
                            movsVol={volSeleccionado?.id === p.id ? getSortedMovsVol() : []}
                            onSelect={cargarMovsVol}
                            formatCurrency={formatCurrency}
                            sortVolKey={sortVolKey}
                            sortVolOrder={sortVolOrder}
                            setSortVolKey={setSortVolKey}
                            setSortVolOrder={setSortVolOrder}
                            onDescargarPDF={handleDescargarVoluntarioPDF}
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

      {/* Modal Vista Previa PDF */}
      <Dialog open={isPdfPreviewOpen} onOpenChange={(open) => { if (!open) { setIsPdfPreviewOpen(false); setPdfPreviewUrl(''); }}}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="size-5 text-emerald-600" />
                  Vista previa de Extracto
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-slate-500">
                  Revisa el documento antes de descargarlo o imprimirlo.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950 relative">
            {pdfPreviewUrl ? (
              <iframe
                id="pdf-iframe-preview-ahorros"
                src={pdfPreviewUrl}
                className="w-full h-full border-0 absolute inset-0"
                title="Vista previa del PDF de Ahorros"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Documento generado interactivo</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsPdfPreviewOpen(false)}>Cerrar</Button>
              <Button
                variant="outline"
                className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-850"
                onClick={() => {
                  if (!pdfPreviewUrl) return;
                  const iframe = document.getElementById('pdf-iframe-preview-ahorros') as HTMLIFrameElement;
                  if (iframe && iframe.contentWindow) {
                    try {
                      iframe.contentWindow.focus();
                      iframe.contentWindow.print();
                      toast.success('Abriendo diálogo de impresión...');
                    } catch (err) {
                      console.error('Error al imprimir desde iframe:', err);
                      window.open(pdfPreviewUrl, '_blank');
                    }
                  } else {
                    window.open(pdfPreviewUrl, '_blank');
                  }
                }}
              >
                <Printer className="size-4" />
                Imprimir
              </Button>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  if (downloadPdfFn) {
                    downloadPdfFn();
                    toast.success('Documento descargado');
                  }
                }}
              >
                <Download className="size-4" />
                Descargar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Subcomponente: tarjeta de un plan voluntario ───────────────────────────
function PlanVoluntarioCard({
  plan, movsVol, onSelect, formatCurrency, sortVolKey, sortVolOrder, setSortVolKey, setSortVolOrder, onDescargarPDF
}: {
  plan: any;
  movsVol: any[];
  onSelect: (p: any) => void;
  formatCurrency: (v: number) => string;
  sortVolKey: 'fecha' | 'monto';
  sortVolOrder: 'asc' | 'desc';
  setSortVolKey: (k: 'fecha' | 'monto') => void;
  setSortVolOrder: (o: 'asc' | 'desc' | ((prev: 'asc' | 'desc') => 'asc' | 'desc')) => void;
  onDescargarPDF: (plan: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2">
      {/* Badge estado */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Desde: {plan.created_at?.split('T')[0] ?? '—'}
        </span>
        <Badge
          className={
            plan.estado === 'activo'
              ? 'bg-blue-600'
              : plan.estado === 'retirado'
              ? 'bg-slate-400'
              : 'bg-yellow-100 text-yellow-700'
          }
        >
          {plan.estado}
        </Badge>
      </div>

      {/* Banner de plan inactivo / cerrado */}
      {plan.estado !== 'activo' && plan.estado !== 'retirado' && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg border bg-yellow-50 border-yellow-200 text-yellow-800 text-sm">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Plan {plan.estado}</p>
            <p className="text-xs mt-0.5 opacity-80">
              Este plan no admite nuevos aportes. Contacta al administrador para reactivarlo.
            </p>
          </div>
        </div>
      )}

      {/* Saldo */}
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-center">
        <p className="text-xs text-blue-600 font-medium mb-1">Saldo acumulado</p>
        <p className="text-3xl font-bold text-blue-700">{formatCurrency(plan.monto_ahorrado)}</p>
        {plan.monto_al_cierre != null && (
          <p className="text-xs text-slate-500 mt-1">
            Monto al cierre: {formatCurrency(plan.monto_al_cierre)}
          </p>
        )}
      </div>

      {/* Últimos pagos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => onSelect(plan)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <History className="size-3" /> Ver últimos pagos
          </button>
          {movsVol.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (sortVolKey === 'fecha') {
                    setSortVolOrder(o => o === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortVolKey('fecha');
                    setSortVolOrder('desc');
                  }
                }}
                className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  sortVolKey === 'fecha'
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                }`}
              >
                Fecha {sortVolKey === 'fecha' && (sortVolOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => {
                  if (sortVolKey === 'monto') {
                    setSortVolOrder(o => o === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortVolKey('monto');
                    setSortVolOrder('desc');
                  }
                }}
                className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  sortVolKey === 'monto'
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                }`}
              >
                Monto {sortVolKey === 'monto' && (sortVolOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          )}
        </div>
        {movsVol.length > 0 ? (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {movsVol.map(m => {
              const esRetiro = (m.saldo_despues ?? 0) < (m.saldo_antes ?? 0);
              return (
                <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    {esRetiro ? (
                      <ArrowDownCircle className="size-3.5 text-red-500 shrink-0" />
                    ) : (
                      <ArrowUpCircle className="size-3.5 text-blue-400 shrink-0" />
                    )}
                    <span className="text-slate-600 dark:text-slate-400">
                      {esRetiro ? 'Retiro' : 'Depósito'} · {m.fecha_pago}
                    </span>
                  </div>
                  <span className={`font-semibold ${esRetiro ? 'text-red-600' : 'text-blue-600'}`}>
                    {esRetiro ? '-' : '+'}{formatCurrency(m.monto ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-1">Sin pagos registrados aún</p>
        )}
      </div>

      {/* Acciones */}
      <div className="pt-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
          onClick={() => onDescargarPDF(plan)}
        >
          <FileText className="size-4" /> Extracto PDF
        </Button>
      </div>
    </div>
  );
}
