import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import {
  Users, PiggyBank, Wallet, CreditCard, ShoppingCart, Calendar,
  ArrowRight, UserPlus, CheckCircle, ClipboardList, TrendingUp, Landmark, LogIn, FileText,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ── Supabase ──────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { dashboardApi } from '../lib/api';
import type { UserRole } from '../contexts/AuthContext';

interface DashboardProps {
  userRole?: UserRole | null;
  userData?: any;
  onNavigate?: (view: string, asociadoId?: string) => void;
}

export default function Dashboard({ userRole, userData, onNavigate }: DashboardProps) {
  // ── Stats en vivo ─────────────────────────────────────────────────────────
  const [liveStats, setLiveStats] = useState({
    totalAsociados:        0,
    totalUsuarios:         0,
    totalAhorrosPerm:      0,
    totalAhorrosVol:       0,
    totalAhorros:          0,
    totalCreditos:         0,
    totalCarteraCreditos:  0,
    totalInteresesMes:     0,
    solicitudesPendientes: 0,
    liquidacionesPend:     0,
    proximosEventos:       0,
  });
  const [monthlyData,   setMonthlyData]   = useState<any[]>([]);
  const [allCreditosData, setAllCreditosData] = useState<any[]>([]);
  const [pieData,       setPieData]       = useState<any[]>([]);
  const [loadingStats,  setLoadingStats]  = useState(true);
  const [showAccesoModal, setShowAccesoModal] = useState(false);
  // R-03: ref para debounce — evita disparar N queries por cambios rápidos en Realtime
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recargarDashboard = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      cargarDatosGraficas();
      cargarStatsAdmin();
    }, 600); // agrupa cambios rápidos en una sola recarga
  }, []);

  useEffect(() => {
    if (userRole === 'admin') {
      cargarStatsAdmin();
      cargarDatosGraficas();

      // R-03: suscripción con debounce — antes disparaba ~11 queries por evento
      const canal = supabase
        .channel('dashboard-creditos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'creditos' }, recargarDashboard)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos_credito' }, recargarDashboard)
        .subscribe();

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        supabase.removeChannel(canal);
      };
    } else if (userRole === 'asociado' && userData?.cedula) {
      cargarStatsAsociado(userData.cedula);
    } else {
      setLoadingStats(false);
    }
  }, [userRole, userData]);

  async function cargarStatsAdmin() {
    try {
      const stats = await dashboardApi.getStats();

      setLiveStats({
        totalAsociados:        stats.totalAsociados,
        totalUsuarios:         stats.totalUsuarios,
        totalAhorrosPerm:      stats.totalAhorrosPerm,
        totalAhorrosVol:       stats.totalAhorrosVol,
        totalAhorros:          stats.totalAhorros,
        totalCreditos:         stats.totalCreditos,
        totalCarteraCreditos:  stats.totalCarteraCreditos,
        totalInteresesMes:     stats.totalInteresesMes,
        solicitudesPendientes: stats.solicitudesPendientes,
        liquidacionesPend:     stats.liquidacionesPend,
        proximosEventos:       0, // tabla 'eventos' no implementada aún
      });
    } catch (err) {
      console.error('Error cargando stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }

  async function cargarDatosGraficas() {
    try {
      // Últimos 6 meses
      const desde = new Date();
      desde.setMonth(desde.getMonth() - 5);
      desde.setDate(1);
      const desdeStr = desde.toISOString().split('T')[0];

      const [{ data: pagosPerm }, { data: pagosVol }, { data: credsMes }] = await Promise.all([
        // Pagos ahorro permanente del período
        supabase.from('pagos_ahorro_permanente')
          .select('fecha_pago, monto_total_pagado')
          .gte('fecha_pago', desdeStr),
        // Pagos ahorro voluntario del período
        supabase.from('pagos_ahorro_voluntario')
          .select('fecha_pago, monto')
          .gte('fecha_pago', desdeStr),
        supabase.from('creditos')
          .select('created_at, monto')
          .gte('created_at', desdeStr + 'T00:00:00')
          .neq('anulado', true),
      ]);
      const movsPerm = pagosPerm || [];
      const movsVol  = pagosVol  || [];

      // Construir array de 6 meses
      const meses: { key: string; mes: string; permanente: number; voluntario: number; creditos: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const mes = d.toLocaleDateString('es-CO', { month: 'short' });
        meses.push({ key, mes: mes.charAt(0).toUpperCase() + mes.slice(1, 3), permanente: 0, voluntario: 0, creditos: 0 });
      }

      movsPerm.forEach((m: any) => {
        const entry = meses.find(x => x.key === m.fecha_pago?.substring(0, 7));
        if (entry) entry.permanente += m.monto_total_pagado || 0;
      });
      movsVol.forEach((m: any) => {
        const entry = meses.find(x => x.key === m.fecha_pago?.substring(0, 7));
        if (entry) entry.voluntario += m.monto || 0;
      });
      (credsMes || []).forEach((c: any) => {
        const entry = meses.find(x => x.key === c.created_at?.substring(0, 7));
        if (entry) entry.creditos += c.monto || 0;
      });

      setMonthlyData(meses);

      // Créditos de los últimos 3 meses agrupados por mes
      const desde3m = new Date();
      desde3m.setMonth(desde3m.getMonth() - 2);
      desde3m.setDate(1);
      const desde3mStr = desde3m.toISOString().split('T')[0];

      const { data: todosCreditos } = await supabase
        .from('creditos')
        .select('created_at, monto, estado')
        .neq('anulado', true)
        .gte('created_at', desde3mStr + 'T00:00:00')
        .order('created_at', { ascending: true });

      // Construir los 3 meses fijos para que siempre aparezcan aunque no haya datos
      const meses3: { key: string; mes: string; creditos: number; cantidad: number }[] = [];
      for (let i = 2; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        const mesCorto = d.toLocaleDateString('es-CO', { month: 'short' });
        meses3.push({
          key,
          mes: mesCorto.charAt(0).toUpperCase() + mesCorto.slice(1, 3) + ' ' + d.getFullYear().toString().slice(2),
          creditos: 0,
          cantidad: 0,
        });
      }

      (todosCreditos || []).forEach((c: any) => {
        const key = c.created_at?.substring(0, 7);
        const entry = meses3.find(x => x.key === key);
        if (entry) {
          entry.creditos += c.monto || 0;
          entry.cantidad += 1;
        }
      });
      setAllCreditosData(meses3);

    } catch (err) {
      console.error('Error cargando gráficas:', err);
    }
  }

  async function cargarStatsAsociado(cedula: string) {
    try {
      // B-05: 'ahorros' no existe — las tablas reales son ahorros_permanentes y ahorros_voluntarios
      const { data: asoc } = await supabase
        .from('asociados')
        .select('id, creditos(id, anulado, estado)')
        .eq('cedula', cedula)
        .single();

      if (!asoc) return;

      const [permRes, volRes] = await Promise.all([
        supabase.from('ahorros_permanentes')
          .select('monto_ahorrado')
          .eq('asociado_id', asoc.id)
          .eq('anulado', false)
          .eq('estado', 'activo'),
        supabase.from('ahorros_voluntarios')
          .select('monto_ahorrado')
          .eq('asociado_id', asoc.id)
          .eq('anulado', false)
          .eq('estado', 'activo'),
      ]);

      const ahorroPerm  = (permRes.data || []).reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
      const ahorroVol   = (volRes.data  || []).reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
      const credActivos = (asoc.creditos || []).filter((c: any) => !c.anulado && ['activo','desembolsado','en_mora'].includes(c.estado)).length;

      setLiveStats(prev => ({
        ...prev,
        totalAhorrosPerm: ahorroPerm,
        totalAhorrosVol:  ahorroVol,
        totalAhorros:     ahorroPerm + ahorroVol,
        totalCreditos:    credActivos,
        proximosEventos:  0, // tabla 'eventos' no implementada aún
      }));
    } catch (err) {
      console.error('Error cargando stats asociado:', err);
    } finally {
      setLoadingStats(false);
    }
  }

  const fmtCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
      notation: n >= 1_000_000 ? 'compact' : 'standard',
    }).format(n);

  // ── Tarjetas admin (datos 100% reales) ───────────────────────────────────
  const adminStats = [
    {
      title: 'Cartera de créditos',
      value: fmtCOP(liveStats.totalCarteraCreditos),
      sub:   `${liveStats.totalCreditos} crédito${liveStats.totalCreditos !== 1 ? 's' : ''} activo${liveStats.totalCreditos !== 1 ? 's' : ''}`,
      icon: Landmark, color: 'amber',
      highlight: true,
    },
    {
      title: 'Capital en ahorros',
      value: fmtCOP(liveStats.totalAhorros),
      sub:   `Perm: ${fmtCOP(liveStats.totalAhorrosPerm)} · Vol: ${fmtCOP(liveStats.totalAhorrosVol)}`,
      icon: PiggyBank, color: 'emerald',
      highlight: true,
    },
    {
      title: 'Intereses cobrados',
      value: fmtCOP(liveStats.totalInteresesMes),
      sub:   'Recaudados este mes',
      icon: TrendingUp, color: 'violet',
      highlight: true,
    },
    {
      title: 'Ahorro permanente',
      value: fmtCOP(liveStats.totalAhorrosPerm),
      sub:   'Saldo activo',
      icon: PiggyBank, color: 'blue',
    },
    {
      title: 'Ahorro voluntario',
      value: fmtCOP(liveStats.totalAhorrosVol),
      sub:   'Saldo activo',
      icon: Wallet, color: 'cyan',
    },
    {
      title: 'Asociados activos',
      value: liveStats.totalAsociados.toLocaleString('es-CO'),
      sub:   `${liveStats.solicitudesPendientes} sol. pendiente${liveStats.solicitudesPendientes !== 1 ? 's' : ''}`,
      icon: Users, color: 'pink',
    },
  ];

  // ── Tarjetas asociado ─────────────────────────────────────────────────────
  const asociadoStats = [
    { title: 'Ahorro permanente', value: fmtCOP(liveStats.totalAhorrosPerm), sub: 'Tu saldo actual', icon: PiggyBank,  color: 'emerald' },
    { title: 'Ahorro voluntario', value: fmtCOP(liveStats.totalAhorrosVol),  sub: 'Tu saldo actual', icon: Wallet,     color: 'blue'    },
    { title: 'Créditos activos',  value: String(liveStats.totalCreditos),    sub: 'En curso',        icon: CreditCard, color: 'amber'   },
  ];

  const stats = userRole === 'asociado' ? asociadoStats : adminStats;

  const getColorClasses = (color: string) => ({
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200'    },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-200'  },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200'   },
    pink:    { bg: 'bg-pink-50',    text: 'text-pink-600',    border: 'border-pink-200'    },
    cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-600',    border: 'border-cyan-200'    },
  }[color] ?? { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' });

  // Pie chart — distribución de capital real
  const pieDataCalculado = [
    { name: 'A. Permanente', value: liveStats.totalAhorrosPerm, color: '#10b981' },
    { name: 'A. Voluntario', value: liveStats.totalAhorrosVol,  color: '#3b82f6' },
  ].filter(d => d.value > 0);

  const pieToShow = pieDataCalculado.length > 0 ? pieDataCalculado : [
    { name: 'Sin datos', value: 1, color: '#e2e8f0' },
  ];

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">

      {/* Banner "Hazte Asociado" — solo visitantes */}
      {!userData && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 p-8 shadow-xl">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 size-32 rounded-full bg-white/10" />
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 size-40 rounded-full bg-white/10" />
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex-1 text-white">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="size-8" />
                <h2 className="text-3xl font-bold">¡Únete a UFCA!</h2>
              </div>
              <p className="text-emerald-50 text-lg mb-4">Forma parte de nuestra familia y disfruta de todos los beneficios</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {['Ahorros con intereses competitivos','Créditos con bajas tasas','Beneficios especiales','Solidaridad y cooperación'].map(b => (
                  <div key={b} className="flex items-center gap-2">
                    <CheckCircle className="size-5 text-emerald-200" />
                    <span className="text-emerald-50">{b}</span>
                  </div>
                ))}
              </div>
              <Button size="lg" className="bg-white text-emerald-600 hover:bg-emerald-50 shadow-lg gap-2" onClick={() => setShowAccesoModal(true)}>
                <UserPlus className="size-5" />Hazte Asociado<ArrowRight className="size-4" />
              </Button>
            </div>
            <div className="hidden lg:flex flex-col gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              {[
                { icon: Users,    valor: liveStats.totalAsociados,  label: 'Asociados activos',  fmt: (v: number) => v.toLocaleString('es-CO') },
                { icon: PiggyBank,valor: liveStats.totalAhorros,    label: 'En ahorros totales', fmt: fmtCOP },
              ].map(({ icon: Icon, valor, label, fmt }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-lg"><Icon className="size-6 text-white" /></div>
                  <div className="text-white">
                    <p className="text-2xl font-bold">{loadingStats ? '…' : fmt(valor)}</p>
                    <p className="text-emerald-100 text-sm">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de acceso: "Ya tengo cuenta" vs "Soy nuevo" ─────────────── */}
      <Dialog open={showAccesoModal} onOpenChange={setShowAccesoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">¡Bienvenido a UFCA!</DialogTitle>
            <DialogDescription className="text-slate-500">
              ¿Cómo quieres continuar?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Opción 1 — Ya tengo cuenta */}
            <button
              onClick={() => { setShowAccesoModal(false); onNavigate?.('login'); }}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-center"
            >
              <div className="p-3 bg-slate-100 group-hover:bg-emerald-100 rounded-full transition-colors">
                <LogIn className="size-7 text-slate-600 group-hover:text-emerald-700 transition-colors" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Ya tengo cuenta</p>
                <p className="text-xs text-slate-500 mt-1">Iniciar sesión</p>
              </div>
            </button>

            {/* Opción 2 — Soy nuevo */}
            <button
              onClick={() => { setShowAccesoModal(false); onNavigate?.('solicitud'); }}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-center"
            >
              <div className="p-3 bg-slate-100 group-hover:bg-emerald-100 rounded-full transition-colors">
                <FileText className="size-7 text-slate-600 group-hover:text-emerald-700 transition-colors" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Soy nuevo</p>
                <p className="text-xs text-slate-500 mt-1">Solicitar afiliación</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900">Dashboard</h1>
          {userData ? (
            <p className="text-slate-600 mt-1">
              Bienvenido, <span className="font-semibold">{userData.nombre ?? userData.name ?? 'Usuario'}</span>
              <Badge variant="outline" className="ml-2">
                {userRole === 'admin' ? '👨‍💼 Administrador' : '👤 Asociado'}
              </Badge>
            </p>
          ) : (
            <p className="text-slate-600 mt-1">Vista general del sistema UFCA</p>
          )}
        </div>
        {/* U-01: vista 'reportes' aún no existe — botón deshabilitado hasta implementarla */}
        <Button
          className="gap-2"
          variant="outline"
          disabled
          title="Módulo de reportes — Próximamente"
        >
          <ArrowRight className="size-4" />Ver Reportes
        </Button>
      </div>

      {/* ── Tarjetas de estadísticas ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => {
          const Icon   = stat.icon;
          const colors = getColorClasses(stat.color);
          const isHighlight = (stat as any).highlight;
          return (
            <Card
              key={i}
              className={`border transition-shadow ${
                isHighlight
                  ? `${colors.border} shadow-sm hover:shadow-lg ring-1 ring-inset ${colors.border}`
                  : `${colors.border} hover:shadow-md`
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className={`text-sm font-medium ${isHighlight ? 'text-slate-700' : 'text-slate-600'}`}>
                  {stat.title}
                </CardTitle>
                <div className={`p-2.5 rounded-xl ${colors.bg}`}>
                  <Icon className={`size-5 ${colors.text}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`font-bold text-slate-900 ${isHighlight ? 'text-3xl' : 'text-2xl'}`}>
                  {loadingStats
                    ? <div className={`rounded bg-slate-200 animate-pulse ${isHighlight ? 'h-8 w-32' : 'h-7 w-24'}`} />
                    : stat.value}
                </div>
                {stat.sub && (
                  <p className="text-xs text-slate-500 mt-1">{stat.sub}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Franja financiera rápida (solo admin) ── */}
      {userRole === 'admin' && !loadingStats && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="grid sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {[
              {
                label: 'Cartera total',
                value: fmtCOP(liveStats.totalCarteraCreditos),
                sub: 'Lo que le deben al negocio',
                color: 'text-amber-600',
                dot: 'bg-amber-400',
              },
              {
                label: 'Capital administrado',
                value: fmtCOP(liveStats.totalAhorros),
                sub: 'Total ahorros bajo gestión',
                color: 'text-emerald-600',
                dot: 'bg-emerald-400',
              },
              {
                label: 'Intereses este mes',
                value: fmtCOP(liveStats.totalInteresesMes),
                sub: 'Ganancia por créditos',
                color: 'text-violet-600',
                dot: 'bg-violet-400',
              },
              {
                label: 'Liquidaciones activas',
                value: String(liveStats.liquidacionesPend),
                sub: `${liveStats.totalUsuarios} usuarios con acceso`,
                color: 'text-slate-600',
                dot: 'bg-slate-400',
              },
            ].map(({ label, value, sub, color, dot }) => (
              <div key={label} className="px-6 py-4 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`size-2 rounded-full ${dot}`} />
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                </div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-400">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Gráficas ── */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* Créditos últimos 3 meses — actualización en tiempo real (3/5) */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Créditos por mes</CardTitle>
              <p className="text-sm text-slate-500">Últimos 3 meses · se actualiza en tiempo real</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 whitespace-nowrap">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              En vivo
            </span>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={allCreditosData}
                layout="vertical"
                margin={{ left: 0, right: 24, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K`
                    : String(v)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="mes"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                  width={52}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: 12 }}
                  formatter={(val: number, _name: string, props: any) => [
                    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val),
                    `Monto total (${props.payload?.cantidad ?? 0} crédito${(props.payload?.cantidad ?? 0) !== 1 ? 's' : ''})`,
                  ]}
                />
                <Bar dataKey="creditos" name="Créditos" radius={[0, 6, 6, 0]}>
                  {allCreditosData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.cantidad > 0 ? '#f59e0b' : '#e2e8f0'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Resumen numérico debajo */}
            <div className="flex justify-around mt-3 pt-3 border-t border-slate-100">
              {allCreditosData.map((m) => (
                <div key={m.key} className="text-center">
                  <p className="text-xs text-slate-500">{m.mes}</p>
                  <p className="text-sm font-bold text-amber-600">
                    {m.cantidad > 0
                      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, notation: 'compact' }).format(m.creditos)
                      : '—'}
                  </p>
                  <p className="text-xs text-slate-400">{m.cantidad} crédito{m.cantidad !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Distribución de capital real (2/5) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Distribución de capital</CardTitle>
            <p className="text-sm text-slate-500">Saldo activo por tipo de ahorro</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieToShow}
                  cx="50%" cy="50%"
                  outerRadius={80}
                  innerRadius={44}
                  dataKey="value"
                  label={({ name, percent }) =>
                    pieToShow[0]?.name === 'Sin datos' ? '' : `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={pieToShow[0]?.name !== 'Sin datos'}
                >
                  {pieToShow.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) =>
                    pieToShow[0]?.name === 'Sin datos' ? 'Sin datos' :
                    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val)
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            {!loadingStats && (
              <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Permanente</p>
                  <p className="text-sm font-semibold text-emerald-700">{fmtCOP(liveStats.totalAhorrosPerm)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Voluntario</p>
                  <p className="text-sm font-semibold text-blue-700">{fmtCOP(liveStats.totalAhorrosVol)}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-600">Total</p>
                  <p className="text-sm font-bold text-slate-800">{fmtCOP(liveStats.totalAhorros)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}