import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Users, PiggyBank, Wallet, CreditCard, ShoppingCart, Calendar,
  ArrowRight, UserPlus, CheckCircle, ClipboardList, FileText,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ── Supabase ──────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { dashboardApi } from '../lib/api';

interface DashboardProps {
  userRole?: 'admin' | 'asociado' | null;
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
    pedidosPendientes:     0,
    solicitudesPendientes: 0,
    liquidacionesPend:     0,
    proximosEventos:       0,
  });
  const [monthlyData,   setMonthlyData]   = useState<any[]>([]);
  const [allCreditosData, setAllCreditosData] = useState<any[]>([]);
  const [pieData,       setPieData]       = useState<any[]>([]);
  const [recentActivity,setRecentActivity]= useState<any[]>([]);
  const [loadingStats,  setLoadingStats]  = useState(true);

  useEffect(() => {
    if (userRole === 'admin') {
      cargarStatsAdmin();
      cargarActividadReciente();
      cargarDatosGraficas();

      // Suscripción en tiempo real: actualiza la gráfica de créditos cuando hay cambios
      const canal = supabase
        .channel('dashboard-creditos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'creditos' }, () => {
          cargarDatosGraficas();
          cargarStatsAdmin();
        })
        .subscribe();

      return () => { supabase.removeChannel(canal); };
    } else if (userRole === 'asociado' && userData?.cedula) {
      cargarStatsAsociado(userData.cedula);
    } else {
      setLoadingStats(false);
    }
  }, [userRole, userData]);

  async function cargarStatsAdmin() {
    try {
      const [stats, { count: eventos }] = await Promise.all([
        dashboardApi.getStats(),
        supabase
          .from('eventos')
          .select('*', { count: 'exact', head: true })
          .in('estado', ['programado', 'en_curso'])
          .gte('fecha', new Date().toISOString().split('T')[0]),
      ]);

      setLiveStats({
        totalAsociados:        stats.totalAsociados,
        totalUsuarios:         stats.totalUsuarios,
        totalAhorrosPerm:      stats.totalAhorrosPerm,
        totalAhorrosVol:       stats.totalAhorrosVol,
        totalAhorros:          stats.totalAhorros,
        totalCreditos:         stats.totalCreditos,
        pedidosPendientes:     stats.pedidosPendientes,
        solicitudesPendientes: stats.solicitudesPendientes,
        liquidacionesPend:     stats.liquidacionesPend,
        proximosEventos:       eventos ?? 0,
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

      const [{ data: movsPerm }, { data: movsVol }, { data: credsMes }] = await Promise.all([
        supabase.from('movimientos_ahorro_permanente')
          .select('fecha_movimiento, monto')
          .gte('fecha_movimiento', desdeStr)
          .eq('tipo_movimiento', 'Aporte'),
        supabase.from('movimientos_ahorro_voluntario')
          .select('fecha_movimiento, monto')
          .gte('fecha_movimiento', desdeStr)
          .in('tipo_movimiento', ['Depósito', 'Aporte']),
        supabase.from('creditos')
          .select('created_at, monto')
          .gte('created_at', desdeStr + 'T00:00:00')
          .neq('anulado', true),
      ]);

      // Construir array de 6 meses
      const meses: { key: string; mes: string; permanente: number; voluntario: number; creditos: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const mes = d.toLocaleDateString('es-CO', { month: 'short' });
        meses.push({ key, mes: mes.charAt(0).toUpperCase() + mes.slice(1, 3), permanente: 0, voluntario: 0, creditos: 0 });
      }

      (movsPerm || []).forEach((m: any) => {
        const entry = meses.find(x => x.key === m.fecha_movimiento?.substring(0, 7));
        if (entry) entry.permanente += m.monto || 0;
      });
      (movsVol || []).forEach((m: any) => {
        const entry = meses.find(x => x.key === m.fecha_movimiento?.substring(0, 7));
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
      const { data: asociado } = await supabase
        .from('asociados')
        .select('ahorro_permanente(monto_ahorrado), ahorro_voluntario(monto_ahorrado), creditos(id, anulado, estado)')
        .eq('cedula', cedula)
        .single();

      const ahorroPerm  = (asociado?.ahorro_permanente || []).reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
      const ahorroVol   = (asociado?.ahorro_voluntario  || []).reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
      const credActivos = (asociado?.creditos || []).filter((c: any) => !c.anulado && ['activo','desembolsado','en_mora'].includes(c.estado)).length;

      const { count: eventos } = await supabase
        .from('eventos')
        .select('*', { count: 'exact', head: true })
        .in('estado', ['programado', 'en_curso'])
        .gte('fecha', new Date().toISOString().split('T')[0]);

      setLiveStats(prev => ({
        ...prev,
        totalAhorrosPerm: ahorroPerm,
        totalAhorrosVol:  ahorroVol,
        totalAhorros:     ahorroPerm + ahorroVol,
        totalCreditos:    credActivos,
        proximosEventos:  eventos ?? 0,
      }));
    } catch (err) {
      console.error('Error cargando stats asociado:', err);
    } finally {
      setLoadingStats(false);
    }
  }

  async function cargarActividadReciente() {
    try {
      const { data } = await supabase
        .from('auditoria')
        .select('accion, detalle, created_at, tabla')
        .order('created_at', { ascending: false })
        .limit(6);

      setRecentActivity((data || []).map((a: any) => {
        let det: any = {};
        try { det = typeof a.detalle === 'string' ? JSON.parse(a.detalle) : (a.detalle ?? {}); } catch { det = {}; }
        const descripcion = det.asociado ?? det.nombre ?? det.numLiquidacion ?? a.tabla ?? '';
        return {
          action: a.accion,
          name:   descripcion.toString().substring(0, 45),
          time:   formatRelativeTime(a.created_at),
          type:   a.accion?.includes('CREACIÓN') || a.accion?.includes('CONFIRMADO') ? 'success'
                : a.accion?.includes('RECHAZO')  || a.accion?.includes('ANULACIÓN')  ? 'danger'
                : 'info',
        };
      }));
    } catch (err) {
      console.error('Error cargando actividad:', err);
    }
  }

  function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'Ahora mismo';
    if (mins < 60)  return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `Hace ${hrs} h`;
    const days = Math.floor(hrs / 24);
    return `Hace ${days} día${days > 1 ? 's' : ''}`;
  }

  const fmtCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
      notation: n >= 1_000_000 ? 'compact' : 'standard',
    }).format(n);

  // ── Tarjetas admin (datos 100% reales) ───────────────────────────────────
  const adminStats = [
    {
      title: 'Asociados activos',
      value: liveStats.totalAsociados.toLocaleString('es-CO'),
      sub:   `${liveStats.totalUsuarios} usuarios con cuenta`,
      icon: Users, color: 'emerald',
    },
    {
      title: 'Solicitudes pendientes',
      value: String(liveStats.solicitudesPendientes),
      sub:   'Por revisar en comité',
      icon: ClipboardList, color: 'violet',
    },
    {
      title: 'Ahorro permanente',
      value: fmtCOP(liveStats.totalAhorrosPerm),
      sub:   `Voluntario: ${fmtCOP(liveStats.totalAhorrosVol)}`,
      icon: PiggyBank, color: 'blue',
    },
    {
      title: 'Créditos activos',
      value: String(liveStats.totalCreditos),
      sub:   'Desembolsados / En mora',
      icon: CreditCard, color: 'amber',
    },
    {
      title: 'Pedidos pendientes',
      value: String(liveStats.pedidosPendientes),
      sub:   'Tienda — sin despachar',
      icon: ShoppingCart, color: 'pink',
    },
    {
      title: 'Próximos eventos',
      value: String(liveStats.proximosEventos),
      sub:   'Este mes',
      icon: Calendar, color: 'cyan',
    },
  ];

  // ── Tarjetas asociado ─────────────────────────────────────────────────────
  const asociadoStats = [
    { title: 'Ahorro permanente', value: fmtCOP(liveStats.totalAhorrosPerm), sub: 'Tu saldo actual', icon: PiggyBank, color: 'emerald' },
    { title: 'Ahorro voluntario', value: fmtCOP(liveStats.totalAhorrosVol),  sub: 'Tu saldo actual', icon: Wallet,    color: 'blue' },
    { title: 'Créditos activos',  value: String(liveStats.totalCreditos),    sub: 'En curso',         icon: CreditCard,color: 'amber' },
    { title: 'Próximos eventos',  value: String(liveStats.proximosEventos),  sub: 'Este mes',         icon: Calendar,  color: 'cyan' },
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

  // Actividad reciente — solo real, sin mocks
  const actividadAMostrar = recentActivity.length > 0 ? recentActivity : [];

  const dotColor = (type: string) =>
    type === 'success' ? 'bg-emerald-500' : type === 'danger' ? 'bg-red-400' : 'bg-blue-400';

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen">

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
                {['Ahorros con intereses competitivos','Créditos con bajas tasas','Eventos exclusivos','Beneficios especiales'].map(b => (
                  <div key={b} className="flex items-center gap-2">
                    <CheckCircle className="size-5 text-emerald-200" />
                    <span className="text-emerald-50">{b}</span>
                  </div>
                ))}
              </div>
              <Button size="lg" className="bg-white text-emerald-600 hover:bg-emerald-50 shadow-lg gap-2" onClick={() => onNavigate?.('login')}>
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
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => onNavigate?.('reportes')}>
          <ArrowRight className="size-4" />Ver Reportes
        </Button>
      </div>

      {/* ── Tarjetas de estadísticas ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => {
          const Icon   = stat.icon;
          const colors = getColorClasses(stat.color);
          return (
            <Card key={i} className={`border ${colors.border} hover:shadow-md transition-shadow`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">{stat.title}</CardTitle>
                <div className={`p-2.5 rounded-xl ${colors.bg}`}>
                  <Icon className={`size-5 ${colors.text}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {loadingStats
                    ? <div className="h-7 w-24 rounded bg-slate-200 animate-pulse" />
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

      {/* ── Resumen total de capital (solo admin) ── */}
      {userRole === 'admin' && !loadingStats && (
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: 'Capital total en ahorros', value: fmtCOP(liveStats.totalAhorros),     color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Usuarios con acceso',       value: liveStats.totalUsuarios.toLocaleString('es-CO'), color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
            { label: 'Liquidaciones en proceso',  value: String(liveStats.liquidacionesPend), color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-xl border px-5 py-4 flex items-center justify-between ${bg}`}>
              <p className="text-sm text-slate-600">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Gráficas ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Créditos últimos 3 meses — actualización en tiempo real */}
        <Card>
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
            <ResponsiveContainer width="100%" height={180}>
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

        {/* Distribución de capital real */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de capital en ahorros</CardTitle>
            <p className="text-sm text-slate-500">Saldo total activo por tipo de ahorro</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieToShow}
                  cx="50%" cy="50%"
                  outerRadius={95}
                  innerRadius={50}
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
              <div className="flex justify-around mt-2 pt-3 border-t border-slate-100">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Permanente</p>
                  <p className="text-sm font-semibold text-emerald-700">{fmtCOP(liveStats.totalAhorrosPerm)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Voluntario</p>
                  <p className="text-sm font-semibold text-blue-700">{fmtCOP(liveStats.totalAhorrosVol)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-sm font-semibold text-slate-700">{fmtCOP(liveStats.totalAhorros)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Actividad reciente ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-slate-500" />
            Actividad reciente
          </CardTitle>
          <p className="text-sm text-slate-500">Últimas acciones registradas en el sistema</p>
        </CardHeader>
        <CardContent>
          {actividadAMostrar.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2 text-slate-400">
              <FileText className="size-8 text-slate-300" />
              <p className="text-sm">No hay actividad registrada aún</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {actividadAMostrar.map((activity, index) => (
                <div key={index} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className={`size-2.5 rounded-full shrink-0 ${dotColor(activity.type)}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{activity.action}</p>
                      {activity.name && <p className="text-xs text-slate-500">{activity.name}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap ml-4">{activity.time}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}