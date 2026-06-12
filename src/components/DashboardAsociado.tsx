import { useState, useEffect } from 'react';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  PiggyBank, Wallet, CreditCard, TrendingUp,
  ArrowRight, User, Bell, Star, Gift, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Coins, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { businessRules } from '../services/businessRules';

interface Props {
  userData?: any;
  onNavigate?: (view: string) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
    notation: n >= 1_000_000 ? 'compact' : 'standard',
  }).format(n);


export default function DashboardAsociado({ userData, onNavigate }: Props) {
  const [data, setData] = useState({
    ahorroPerm:    0,
    ahorroVol:     0,
    creditoSaldo:  0,
    creditoActivo: false,
    referidos:     0,
  });
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [creditos, setCreditos]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [estadoAhorro, setEstadoAhorro] = useState<{estado: string, mensaje: string} | null>(null);

  useEffect(() => {
    if (userData?.id) cargar(userData.id);
    else setLoading(false);
  }, [userData]);
  useRealtimeSubscription(
    'dashboard_asociado_realtime',
    ['cuentas_ahorro', 'creditos', 'transacciones'],
    () => { if (userData?.id) cargar(userData.id); },
  );

  async function cargar(asociadoId: string) {
    try {
      const [ahorroPermRes, ahorroVolRes, creditoRes, pagosPermRes, pagosVolRes, refRes] = await Promise.all([
        // Ahorro permanente
        supabase.from('cuentas_ahorro')
          .select('id, monto_ahorrado, estado, anulado')
          .eq('tipo', 'permanente')
          .eq('asociado_id', asociadoId)
          .eq('anulado', false),

        // Ahorros voluntarios
        supabase.from('cuentas_ahorro')
          .select('id, monto_ahorrado, estado, anulado')
          .eq('tipo', 'voluntario')
          .eq('asociado_id', asociadoId)
          .eq('anulado', false),

        // Créditos activos
        supabase.from('creditos')
          .select('id, monto, saldo, estado, anulado, fecha_desembolso, plazo_meses, cuota_mensual')
          .eq('asociado_id', asociadoId)
          .eq('anulado', false)
          .in('estado', ['activo', 'desembolsado', 'en_mora']),

        // Últimos aportes ahorro permanente
        supabase.from('transacciones')
          .select('id, fecha_pago, monto, created_at')
          .eq('tipo', 'aporte_permanente')
          .eq('asociado_id', asociadoId)
          .order('created_at', { ascending: false })
          .limit(4),

        // Últimos aportes ahorro voluntario
        supabase.from('transacciones')
          .select('id, fecha_pago, monto, created_at')
          .eq('tipo', 'aporte_voluntario')
          .eq('asociado_id', asociadoId)
          .order('created_at', { ascending: false })
          .limit(3),

        // Referidos
        supabase.from('usuarios')
          .select('id', { count: 'exact', head: true })
          .eq('referido_por_id', asociadoId),
      ]);

      const ap = (ahorroPermRes.data || []).reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
      const av = (ahorroVolRes.data || []).reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
      const totalActual = ap + av;

      const creditosActivos = creditoRes.data || [];
      const saldoTotal = creditosActivos.reduce((s: number, c: any) => s + (c.saldo || 0), 0);

      setData({
        ahorroPerm:    ap,
        ahorroVol:     av,
        creditoSaldo:  saldoTotal,
        creditoActivo: creditosActivos.length > 0,
        referidos:     refRes.count ?? 0,
      });
      setCreditos(creditosActivos);

      // Calcular estado de ahorro permanente
      const pagosPerm = pagosPermRes.data || [];
      const ultimoPagoPerm = pagosPerm.length > 0 ? pagosPerm[0].fecha_pago : null;
      setEstadoAhorro(businessRules.calcularEstadoAhorroPermanente(ultimoPagoPerm));

      // Últimos pagos de ahorro — combinar permanente y voluntario
      const movsProcesados = [
        ...(pagosPermRes.data || []).map((m: any) => ({
          id:             m.id,
          tipo_movimiento: 'Aporte',
          fuente:         'Ahorro Permanente',
          monto:          m.monto,
          created_at:     m.created_at,
          fecha_pago:     m.fecha_pago,
        })),
        ...(pagosVolRes.data || []).map((m: any) => ({
          id:             m.id,
          tipo_movimiento: 'Depósito',
          fuente:         'Ahorro Voluntario',
          monto:          m.monto,
          created_at:     m.created_at,
          fecha_pago:     m.fecha_pago,
        })),
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      setMovimientos(movsProcesados);


    } catch (e) {
      console.error('Error cargando dashboard asociado:', e);
    } finally {
      setLoading(false);
    }
  }

  const totalAhorros = data.ahorroPerm + data.ahorroVol;


  const nombre = userData?.name || userData?.nombre || 'Asociado';
  const hora   = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

  const relTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `Hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Hace ${h}h`;
    return `Hace ${Math.floor(h / 24)}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="size-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm">Cargando tu portal...</p>
        </div>
      </div>
    );
  }

  // U-03: sin id → la solicitud aún no ha sido aprobada
  if (!userData?.id) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-amber-100 rounded-full">
              <Clock className="size-10 text-amber-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-800">Solicitud en revisión</h2>
          <p className="text-slate-500 text-sm">
            Tu solicitud de asociación está siendo evaluada por el equipo UFCA.
            Una vez aprobada podrás ver tu portal completo aquí.
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            ¿Tienes dudas? Contacta a tu cooperativa para conocer el estado de tu solicitud.
          </div>
        </div>
      </div>
    );
  }

  // Cuenta suspendida: solicitud aprobada pero aún no pagó la primera cuota
  if (userData?.cuentaActivada === false) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 flex gap-4 items-start shadow-md">
          <div className="p-3 bg-amber-100 rounded-xl flex-shrink-0">
            <PiggyBank className="size-7 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h2 className="font-bold text-amber-900 text-lg">
              ¡Bienvenido/a a UFCA, {userData?.nombre?.split(' ')[0]}!
            </h2>
            <p className="text-sm text-amber-800 leading-relaxed">
              Tu cuenta está <strong>casi lista</strong>. Para activar el acceso completo al sistema,
              realiza tu <strong>primera cuota de ahorro permanente</strong> y comunícate con el
              administrador para que la registre. Una vez registrado el pago, todos los módulos se
              activarán automáticamente.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-amber-700">
              <span className="flex items-center gap-1">📞 +57 314 758 7250</span>
              <span className="flex items-center gap-1">✉️ marboledalondono@gmail.com</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // U-04: asociado_id existe pero pendiente de pago de activación
  if (userData?.pendienteActivacion) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 flex gap-4 items-start shadow-sm">
          <div className="p-2 bg-amber-100 rounded-xl flex-shrink-0">
            <AlertCircle className="size-6 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-amber-900 text-base">Tu cuenta está pendiente de activación</h2>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">
              Tu solicitud fue aprobada. Para activar tu cuenta completa, realiza el pago del aporte inicial
              y envía el comprobante al administrador. Una vez confirmado el pago, tendrás acceso a todos los módulos.
            </p>
          </div>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <PiggyBank className="size-5 text-emerald-600" /> Tu ahorro permanente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Saldo acumulado</p>
                <p className="text-3xl font-bold text-emerald-700">{fmtCompact(data.ahorroPerm)}</p>
              </div>
              <div className="size-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <PiggyBank className="size-7 text-emerald-600" />
              </div>
            </div>
            <Button
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onNavigate?.('ahorro-permanente')}
            >
              Ver detalle de mi ahorro <ArrowRight className="size-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Módulos disponibles tras activación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Ahorro voluntario', icon: Wallet     },
              { label: 'Créditos',          icon: CreditCard },
              { label: 'Liquidación',       icon: Coins      },
              { label: 'Referidos',         icon: Gift       },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 p-2.5 rounded-xl opacity-40 cursor-not-allowed">
                <div className="size-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <Icon className="size-4 text-slate-400" />
                </div>
                <span className="text-sm font-medium text-slate-500">{label}</span>
                <span className="ml-auto text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Bloqueado</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Bienvenida ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 shadow-xl">
        <div className="absolute -top-8 -right-8 size-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-10 size-48 rounded-full bg-white/10" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
              <User className="size-8 text-white" />
            </div>
            <div>
              <p className="text-emerald-100 text-sm font-medium">{saludo},</p>
              <h1 className="text-2xl font-bold text-white">{nombre}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-white/20 text-white border-0 text-xs">
                  <Star className="size-3 mr-1" /> Asociado UFCA
                </Badge>
                <Badge className="bg-emerald-400/30 text-white border-0 text-xs">
                  <CheckCircle2 className="size-3 mr-1" /> Activo
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1"
              onClick={() => onNavigate?.('ahorro-permanente')}>
              <PiggyBank className="size-4" /> Mis ahorros
            </Button>
            <Button size="sm" className="bg-white text-emerald-700 hover:bg-emerald-50 gap-1"
              onClick={() => onNavigate?.('creditos')}>
              <CreditCard className="size-4" /> Mis créditos
            </Button>
          </div>
        </div>
      </div>

      {/* ── Alertas de Mora / Vencimiento ── */}
      {estadoAhorro && estadoAhorro.estado === 'en_mora' && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 flex gap-3 items-center shadow-md animate-pulse">
          <div className="p-2 bg-amber-100 rounded-full">
            <AlertCircle className="size-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-amber-900 font-bold">Aviso de Mora en Ahorro Permanente</h3>
            <p className="text-sm text-amber-800">{estadoAhorro.mensaje}</p>
          </div>
        </div>
      )}
      {estadoAhorro && estadoAhorro.estado === 'plazo_vencido' && (
        <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-4 flex gap-3 items-center shadow-md">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="size-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-red-900 font-bold">Plazo Máximo Excedido</h3>
            <p className="text-sm text-red-800">{estadoAhorro.mensaje}</p>
          </div>
        </div>
      )}

      {/* ── Tarjetas de resumen ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => onNavigate?.('ahorro-permanente')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <PiggyBank className="size-5 text-emerald-600" />
              </div>
              <ChevronRight className="size-4 text-slate-300 group-hover:text-emerald-500 transition-colors mt-1" />
            </div>
            <p className="text-xs text-slate-500 font-medium mb-1">Ahorro permanente</p>
            <p className="text-2xl font-bold text-slate-900">{fmtCompact(data.ahorroPerm)}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="size-3 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">Creciendo</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => onNavigate?.('ahorro-voluntario')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div className="size-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Wallet className="size-5 text-blue-600" />
              </div>
              <ChevronRight className="size-4 text-slate-300 group-hover:text-blue-500 transition-colors mt-1" />
            </div>
            <p className="text-xs text-slate-500 font-medium mb-1">Ahorro voluntario</p>
            <p className="text-2xl font-bold text-slate-900">{fmtCompact(data.ahorroVol)}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="size-3 text-blue-500" />
              <span className="text-xs text-blue-600 font-medium">Disponible</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => onNavigate?.('creditos')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`size-10 rounded-xl flex items-center justify-center ${data.creditoActivo ? 'bg-amber-100' : 'bg-slate-100'}`}>
                <CreditCard className={`size-5 ${data.creditoActivo ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <ChevronRight className="size-4 text-slate-300 group-hover:text-amber-500 transition-colors mt-1" />
            </div>
            <p className="text-xs text-slate-500 font-medium mb-1">Saldo en créditos</p>
            <p className="text-2xl font-bold text-slate-900">
              {data.creditoActivo ? fmtCompact(data.creditoSaldo) : '—'}
            </p>
            <div className="flex items-center gap-1 mt-2">
              {data.creditoActivo
                ? <><AlertCircle className="size-3 text-amber-500" /><span className="text-xs text-amber-600 font-medium">{creditos.length} crédito(s) activo(s)</span></>
                : <><CheckCircle2 className="size-3 text-slate-400" /><span className="text-xs text-slate-400">Sin créditos activos</span></>
              }
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Coins className="size-5 text-white" />
              </div>
              <Badge className="bg-white/20 text-white border-0 text-xs">Total</Badge>
            </div>
            <p className="text-xs text-emerald-100 font-medium mb-1">Patrimonio total</p>
            <p className="text-2xl font-bold">{fmtCompact(totalAhorros)}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="size-3 text-emerald-200" />
              <span className="text-xs text-emerald-100 font-medium">Perm. + Voluntario</span>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* ── Fila inferior ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Últimos movimientos */}
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">Últimos movimientos</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-emerald-600 gap-1 h-7"
                onClick={() => onNavigate?.('ahorro-permanente')}>
                Ver todos <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {movimientos.length > 0 ? (
              <div className="space-y-2">
                {movimientos.map(m => {
                  const esPositivo = ['abono', 'deposito', 'apertura', 'inicial', 'credito', 'ingreso']
                    .includes((m.tipo_movimiento || '').toLowerCase());
                  return (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`size-8 rounded-lg flex items-center justify-center ${esPositivo ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          <TrendingUp className={`size-4 ${esPositivo ? 'text-emerald-600' : 'text-red-500 rotate-180'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{m.descripcion || m.fuente}</p>
                          <p className="text-xs text-slate-400">{m.fuente} · {relTime(m.created_at)}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${esPositivo ? 'text-emerald-600' : 'text-red-500'}`}>
                        {esPositivo ? '+' : '-'}{fmt(m.monto || 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <Clock className="size-8 opacity-30" />
                <p className="text-sm">No hay movimientos recientes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accesos rápidos */}
        <Card className="border-0 shadow-md h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Bell className="size-4 text-purple-500" /> Accesos rápidos
            </CardTitle>
          </CardHeader>
          {/* R-06: mapa estático — Tailwind no detecta clases con interpolación dinámica `bg-${color}-100` */}
          {(() => {
            const CLS: Record<string, { hover: string; bg: string; text: string }> = {
              emerald: { hover: 'hover:bg-emerald-50', bg: 'bg-emerald-100', text: 'text-emerald-600' },
              amber:   { hover: 'hover:bg-amber-50',   bg: 'bg-amber-100',   text: 'text-amber-600'   },
              blue:    { hover: 'hover:bg-blue-50',     bg: 'bg-blue-100',    text: 'text-blue-600'    },
              purple:  { hover: 'hover:bg-purple-50',   bg: 'bg-purple-100',  text: 'text-purple-600'  },
            };
            return (
          <CardContent className="space-y-2">
            {[
              { label: 'Mis ahorros',  icon: PiggyBank,  view: 'ahorro-permanente', color: 'emerald' },
              { label: 'Mis créditos', icon: CreditCard, view: 'creditos',           color: 'amber'   },
              { label: 'Liquidación',  icon: Coins,      view: 'liquidacion',        color: 'blue'    },
              { label: 'Referidos',    icon: Gift,       view: 'referidos',          color: 'purple'  },
            ].map(({ label, icon: Icon, view, color }) => {
              const cls = CLS[color] ?? CLS.emerald;
              return (
              <button key={view}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl ${cls.hover} transition-colors group text-left`}
                onClick={() => onNavigate?.(view)}
              >
                <div className={`size-8 rounded-lg ${cls.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`size-4 ${cls.text}`} />
                </div>
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{label}</span>
                <ChevronRight className="size-4 text-slate-300 group-hover:text-slate-500 ml-auto" />
              </button>
            );})}
          </CardContent>
            );
          })()}
        </Card>
      </div>

      {/* ── Créditos activos (si tiene) ── */}
      {creditos.length > 0 && (
        <Card className="border-0 shadow-md border-l-4 border-l-amber-400">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <CreditCard className="size-4 text-amber-500" /> Mis créditos activos
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-amber-600 gap-1 h-7"
                onClick={() => onNavigate?.('creditos')}>
                Ver detalle <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {creditos.map(c => (
                <div key={c.id} className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="flex items-center justify-between mb-2">
                    {/* U-04: título refleja el estado real del crédito */}
                  <span className="text-xs font-medium text-amber-700">
                    {c.estado === 'en_mora' ? 'Crédito en mora' : 'Crédito activo'}
                  </span>
                    <Badge className={`text-xs border-0 ${c.estado === 'en_mora' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.estado}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{fmt(c.saldo || 0)}</p>
                  <p className="text-xs text-slate-500">Saldo pendiente</p>
                  <div className="mt-2 pt-2 border-t border-amber-100 flex justify-between text-xs text-slate-500">
                    <span>Cuota: {fmt(c.cuota_mensual || 0)}</span>
                    <span>{c.plazo_meses}m plazo</span>
                  </div>
                  <div className="mt-2">
                    <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, 100 - ((c.saldo / c.monto) * 100)))}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {Math.round(100 - ((c.saldo / c.monto) * 100))}% pagado
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
