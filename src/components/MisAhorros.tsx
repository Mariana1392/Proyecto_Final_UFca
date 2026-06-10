import { useState, useEffect } from 'react';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  PiggyBank, Wallet, Clock,
  TrendingUp, DollarSign, Calendar, History, FileText,
  ArrowUpCircle, ArrowDownCircle, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { generateAhorroPermanentePDF } from './utils/pdfGenerator';

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

      // 3. Movimientos del ahorro permanente (últimos 5)
      if (mejorPerm?.id) {
        const { data: movs } = await supabase
          .from('transacciones')
          .select('*')
          .eq('tipo', 'aporte_permanente')
          .eq('ahorro_id', mejorPerm.id)
          .order('fecha_pago', { ascending: false })
          .limit(5);
        setMovsPerm(movs ?? []);
      }

      // 4. Movimientos de los ahorros voluntarios — pre-carga el plan activo
      //    (antes nunca se consultaba esta tabla para voluntarios en cargarDatos)
      const volData = volRes.data ?? [];
      if (volData.length > 0) {
        const volIds = volData.map((v: any) => v.id);
        const { data: movsVolData } = await supabase
          .from('transacciones')
          .select('*')
          .eq('tipo', 'aporte_voluntario')
          .in('ahorro_id', volIds)
          .order('fecha_pago', { ascending: false })
          .limit(25);

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

  // Movimientos del ahorro voluntario seleccionado
  async function cargarMovsVol(ahorro: any) {
    setVolSeleccionado(ahorro);
    const { data } = await supabase
      .from('transacciones')
      .select('*')
      .eq('tipo', 'aporte_voluntario')
      .eq('ahorro_id', ahorro.id)
      .order('fecha_pago', { ascending: false })
      .limit(5);
    setMovsVol(data ?? []);
  }

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
    generateAhorroPermanentePDF({
      asociado:          userData?.name ?? '',
      cedula:            userData?.cedula ?? '',
      fechaAfiliacion:   fechaInicio,
      aporteActual:      ahorroPermanente.cuota_mensual,
      fechaUltimoAporte: (movs ?? [])[0]?.fecha_pago ?? fechaInicio,
      totalAportes:      (movs ?? []).length,
      saldoAcumulado:    ahorroPermanente.monto_ahorrado,
      estado:            ahorroPermanente.estado,
      rangoInicio:       fechaInicio,
      rangoFin:          hoy,
      movimientos:       movs ?? [],
    });
    toast.success('Extracto PDF descargado');
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
                  {movsPerm.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                        <History className="size-3" /> Últimos pagos
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {movsPerm.map(m => (
                          <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-white rounded-lg border border-slate-100 text-xs">
                            <div className="flex items-center gap-2">
                              <ArrowUpCircle className="size-3.5 text-emerald-400 shrink-0" />
                              <span className="text-slate-600">
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
                    </div>
                  )}

                  {movsPerm.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">Sin pagos registrados aún</p>
                  )}

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
                    {ahorrosVoluntarios.length} {ahorrosVoluntarios.length === 1 ? 'plan' : 'planes'}
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
                  {ahorrosVoluntarios.length === 1 ? (
                    <PlanVoluntarioCard
                      plan={ahorrosVoluntarios[0]}
                      movsVol={volSeleccionado?.id === ahorrosVoluntarios[0].id ? movsVol : []}
                      onSelect={cargarMovsVol}
                      formatCurrency={formatCurrency}
                    />
                  ) : (
                    <Tabs defaultValue={ahorrosVoluntarios[0]?.id}>
                      <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${Math.min(ahorrosVoluntarios.length, 3)}, 1fr)` }}>
                        {ahorrosVoluntarios.map((p, i) => (
                          <TabsTrigger key={p.id} value={p.id} className="text-xs truncate" onClick={() => cargarMovsVol(p)}>
                            {`Plan ${i + 1}`}
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
    </div>
  );
}

// ── Subcomponente: tarjeta de un plan voluntario ───────────────────────────
function PlanVoluntarioCard({
  plan, movsVol, onSelect, formatCurrency,
}: {
  plan: any;
  movsVol: any[];
  onSelect: (p: any) => void;
  formatCurrency: (v: number) => string;
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
        <button
          onClick={() => onSelect(plan)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mb-2"
        >
          <History className="size-3" /> Ver últimos pagos
        </button>
        {movsVol.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {movsVol.map(m => (
              <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-white rounded-lg border border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="size-3.5 text-blue-400 shrink-0" />
                  <span className="text-slate-600">Depósito · {m.fecha_pago}</span>
                </div>
                <span className="font-semibold text-blue-600">
                  +{formatCurrency(m.monto ?? 0)}
                </span>
              </div>
            ))}
          </div>
        )}
        {movsVol.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-1">Sin pagos registrados aún</p>
        )}
      </div>
    </div>
  );
}
