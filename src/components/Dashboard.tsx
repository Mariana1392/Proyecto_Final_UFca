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
  AreaChart, Area,
  BarChart, Bar, LabelList, PieChart, Pie, Cell,
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transacciones' }, recargarDashboard)
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
        supabase.from('transacciones')
          .select('fecha_pago, monto')
          .eq('tipo', 'aporte_permanente')
          .gte('fecha_pago', desdeStr),
        // Pagos ahorro voluntario del período
        supabase.from('transacciones')
          .select('fecha_pago, monto')
          .eq('tipo', 'aporte_voluntario')
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
        if (entry) entry.permanente += m.monto || 0;
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
    void cedula; // cedula no se usa directamente; usamos userData.id
    try {
      const asociadoId = userData?.id;
      if (!asociadoId) return;

      const [{ data: cuentas }, { data: credData }] = await Promise.all([
        supabase
          .from('cuentas_ahorro')
          .select('tipo, monto_ahorrado')
          .eq('asociado_id', asociadoId)
          .eq('anulado', false)
          .eq('estado', 'activo'),
        supabase
          .from('creditos')
          .select('id, anulado, estado')
          .eq('asociado_id', asociadoId),
      ]);

      const permRes = { data: (cuentas || []).filter((c: any) => c.tipo === 'permanente') };
      const volRes  = { data: (cuentas || []).filter((c: any) => c.tipo === 'voluntario') };

      const ahorroPerm  = (permRes.data || []).reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
      const ahorroVol   = (volRes.data  || []).reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
      const credActivos = (credData || []).filter((c: any) => !c.anulado && ['activo','desembolsado','en_mora'].includes(c.estado)).length;

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
    }).format(n);

  // ── Tarjetas admin (datos 100% reales) ───────────────────────────────────
  const adminStats = [
    {
      title: 'Cartera de créditos',
      value: fmtCOP(liveStats.totalCarteraCreditos),
      sub:   `${liveStats.totalCreditos} crédito${liveStats.totalCreditos !== 1 ? 's' : ''} activo${liveStats.totalCreditos !== 1 ? 's' : ''}`,
      icon: Landmark, color: 'amber',
      highlight: true, splitSub: false,
      gradient: 'from-amber-500 to-orange-400',
    },
    {
      title: 'Capital en ahorros',
      value: fmtCOP(liveStats.totalAhorros),
      sub:   '',
      icon: PiggyBank, color: 'emerald',
      highlight: true, splitSub: true,
      gradient: 'from-emerald-500 to-teal-400',
    },
    {
      title: 'Intereses cobrados',
      value: fmtCOP(liveStats.totalInteresesMes),
      sub:   'Recaudados este mes',
      icon: TrendingUp, color: 'violet',
      highlight: true, splitSub: false,
      gradient: 'from-violet-500 to-purple-400',
    },
    {
      title: 'Ahorro permanente',
      value: fmtCOP(liveStats.totalAhorrosPerm),
      sub:   'Saldo activo',
      icon: PiggyBank, color: 'emerald', highlight: false, splitSub: false, gradient: '',
    },
    {
      title: 'Ahorro voluntario',
      value: fmtCOP(liveStats.totalAhorrosVol),
      sub:   'Saldo activo',
      icon: Wallet, color: 'blue', highlight: false, splitSub: false, gradient: '',
    },
    {
      title: 'Asociados activos',
      value: liveStats.totalAsociados.toLocaleString('es-CO'),
      sub:   `${liveStats.solicitudesPendientes} sol. pendiente${liveStats.solicitudesPendientes !== 1 ? 's' : ''}`,
      icon: Users, color: 'pink', highlight: false, splitSub: false, gradient: '',
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
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-300', leftBorder: 'border-l-emerald-400', badge: 'bg-emerald-100 text-emerald-700' },
    blue:    { bg: 'bg-blue-100',    text: 'text-blue-600',    border: 'border-blue-300',    leftBorder: 'border-l-blue-400',    badge: 'bg-blue-100 text-blue-700'    },
    violet:  { bg: 'bg-violet-100',  text: 'text-violet-600',  border: 'border-violet-300',  leftBorder: 'border-l-violet-400',  badge: 'bg-violet-100 text-violet-700'  },
    amber:   { bg: 'bg-amber-100',   text: 'text-amber-600',   border: 'border-amber-300',   leftBorder: 'border-l-amber-400',   badge: 'bg-amber-100 text-amber-700'   },
    pink:    { bg: 'bg-pink-100',    text: 'text-pink-600',    border: 'border-pink-300',    leftBorder: 'border-l-pink-400',    badge: 'bg-pink-100 text-pink-700'    },
    cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-600',    border: 'border-cyan-300',    leftBorder: 'border-l-cyan-400',    badge: 'bg-cyan-100 text-cyan-700'    },
  }[color] ?? { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', leftBorder: 'border-l-slate-400', badge: 'bg-slate-100 text-slate-700' });

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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-[#f4f6fb] dark:bg-slate-900 min-h-screen">

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
                { icon: Users,    valor: liveStats.totalAsociados, label: 'Asociados activos',  fmt: (v: number) => v.toLocaleString('es-CO') },
                { icon: PiggyBank,valor: liveStats.totalAhorros,   label: 'En ahorros totales', fmt: fmtCOP },
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

      {/* ── Modal acceso ── */}
      <Dialog open={showAccesoModal} onOpenChange={setShowAccesoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">¡Bienvenido a UFCA!</DialogTitle>
            <DialogDescription className="text-slate-500">¿Cómo quieres continuar?</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <button onClick={() => { setShowAccesoModal(false); onNavigate?.('login'); }}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-center">
              <div className="p-3 bg-slate-100 group-hover:bg-emerald-100 rounded-full transition-colors">
                <LogIn className="size-7 text-slate-600 group-hover:text-emerald-700 transition-colors" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Ya tengo cuenta</p>
                <p className="text-xs text-slate-500 mt-1">Iniciar sesión</p>
              </div>
            </button>
            <button onClick={() => { setShowAccesoModal(false); onNavigate?.('solicitud'); }}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-center">
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

      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
            {userData && (
              <Badge className={`text-xs font-semibold px-3 py-1 rounded-full border-0 ${
                userRole === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {userRole === 'admin' ? '👨‍💼 Administrador' : '👤 Asociado'}
              </Badge>
            )}
          </div>
          {userData
            ? <p className="text-slate-400 mt-0.5 text-sm">Bienvenido de nuevo, <span className="font-semibold text-slate-600">{userData.nombre ?? userData.name ?? 'Usuario'}</span></p>
            : <p className="text-slate-400 mt-0.5 text-sm">Vista general del sistema UFCA</p>
          }
        </div>
        <Button className="gap-2 rounded-xl" variant="outline" disabled title="Módulo de reportes — Próximamente">
          <ArrowRight className="size-4" />Ver Reportes
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════════
          VISTA ADMIN
      ══════════════════════════════════════════════════════════ */}
      {userRole === 'admin' && (
        <>
          {/* ── FILA 1: Hero chart + Donut ── */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* Hero: Capital + área 6 meses */}
            <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 shadow-xl p-6">
              {/* Decoración de fondo */}
              <div className="absolute -top-10 -right-10 size-48 rounded-full bg-emerald-500/10" />
              <div className="absolute -bottom-16 -left-10 size-56 rounded-full bg-teal-500/10" />
              <div className="relative z-10">
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-1">Capital Administrado · UFCA</p>
                <div className="flex items-end gap-4 mb-4">
                  <p className="text-4xl font-black text-white tracking-tight">
                    {loadingStats ? <span className="bg-white/10 animate-pulse rounded-lg h-10 w-44 inline-block" /> : fmtCOP(liveStats.totalAhorros)}
                  </p>
                  <div className="flex items-center gap-1 text-emerald-400 text-sm font-medium mb-1">
                    <TrendingUp className="size-4" /><span>Total en ahorros</span>
                  </div>
                </div>
                {/* Leyenda de series */}
                <div className="flex gap-4 mb-3">
                  {[
                    { label: 'A. Permanente', color: 'bg-emerald-400' },
                    { label: 'A. Voluntario',  color: 'bg-blue-400'   },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${color} inline-block`} />
                      <span className="text-xs text-white/60">{label}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gperm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gvol" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" stroke="transparent" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', fontSize: 12, color: 'white' }}
                      formatter={(val: number, name: string) => [
                        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, notation: 'compact' }).format(val),
                        name,
                      ]}
                    />
                    <Area type="monotone" dataKey="permanente" name="A. Permanente" stroke="#10b981" strokeWidth={2.5} fill="url(#gperm)" dot={false} />
                    <Area type="monotone" dataKey="voluntario"  name="A. Voluntario"  stroke="#60a5fa" strokeWidth={2.5} fill="url(#gvol)"  dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut distribución */}
            <div className="rounded-2xl bg-white shadow-md p-5 flex flex-col">
              <p className="text-sm font-bold text-slate-700 mb-0.5">Distribución de capital</p>
              <p className="text-xs text-slate-400 mb-2">Saldo activo por tipo</p>
              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieToShow} cx="50%" cy="50%" outerRadius={75} innerRadius={48}
                      dataKey="value" strokeWidth={3} stroke="white">
                      {pieToShow.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) =>
                      pieToShow[0]?.name === 'Sin datos' ? 'Sin datos'
                      : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val)
                    } />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Leyenda */}
              <div className="flex flex-col gap-3 mt-2 border-t border-slate-100 pt-3">
                {[
                  { label: 'A. Permanente', value: liveStats.totalAhorrosPerm, color: 'bg-emerald-500', text: 'text-emerald-600' },
                  { label: 'A. Voluntario',  value: liveStats.totalAhorrosVol,  color: 'bg-blue-500',   text: 'text-blue-600'   },
                ].map(({ label, value, color, text }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${color} inline-block`} />
                      <span className="text-xs text-slate-500 font-medium">{label}</span>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${text}`}>{loadingStats ? '…' : fmtCOP(value)}</p>
                      <p className="text-xs text-slate-400">
                        {liveStats.totalAhorros > 0 ? ((value / liveStats.totalAhorros) * 100).toFixed(0) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">Total</span>
                  <span className="text-sm font-bold text-slate-800">{loadingStats ? '…' : fmtCOP(liveStats.totalAhorros)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── FILA 2: 4 mini-stat chips ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Landmark,  label: 'Cartera créditos',  value: fmtCOP(liveStats.totalCarteraCreditos),          bg: 'bg-amber-100',   text: 'text-amber-600',   iconBg: 'bg-amber-500'   },
              { icon: PiggyBank, label: 'Ahorro permanente',  value: fmtCOP(liveStats.totalAhorrosPerm),              bg: 'bg-emerald-100', text: 'text-emerald-600', iconBg: 'bg-emerald-500' },
              { icon: Wallet,    label: 'Ahorro voluntario',  value: fmtCOP(liveStats.totalAhorrosVol),               bg: 'bg-blue-100',    text: 'text-blue-600',    iconBg: 'bg-blue-500'    },
              { icon: Users,     label: 'Asociados activos',  value: liveStats.totalAsociados.toLocaleString('es-CO'), bg: 'bg-violet-100',  text: 'text-violet-600',  iconBg: 'bg-violet-500'  },
            ].map(({ icon: Icon, label, value, bg, text, iconBg }) => (
              <div key={label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`p-3 rounded-2xl ${bg} flex-shrink-0`}>
                  <Icon className={`size-5 ${text}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium truncate">{label}</p>
                  <p className={`text-base font-bold ${text} truncate`}>
                    {loadingStats ? <span className={`${iconBg} opacity-20 animate-pulse rounded h-5 w-16 inline-block`} /> : value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── FILA 3: 4 tarjetas gradiente con sparkline ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Intereses cobrados',  value: fmtCOP(liveStats.totalInteresesMes),          sub: 'Recaudados este mes',   from: 'from-pink-500',   to: 'to-rose-500',    dataKey: 'permanente' },
              { label: 'Capital en ahorros',  value: fmtCOP(liveStats.totalAhorros),               sub: 'Total administrado',    from: 'from-violet-500', to: 'to-indigo-600',  dataKey: 'voluntario'  },
              { label: 'Cartera créditos',    value: fmtCOP(liveStats.totalCarteraCreditos),        sub: `${liveStats.totalCreditos} crédito${liveStats.totalCreditos !== 1 ? 's' : ''} activo${liveStats.totalCreditos !== 1 ? 's' : ''}`, from: 'from-teal-400', to: 'to-emerald-600', dataKey: 'creditos'   },
              { label: 'Asociados activos',   value: liveStats.totalAsociados.toLocaleString('es-CO'), sub: `${liveStats.solicitudesPendientes} pendiente${liveStats.solicitudesPendientes !== 1 ? 's' : ''}`, from: 'from-amber-400', to: 'to-orange-500', dataKey: 'permanente' },
            ].map(({ label, value, sub, from, to, dataKey }) => (
              <div key={label} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${from} ${to} p-5 shadow-lg text-white`}>
                <div className="absolute -top-5 -right-5 size-24 rounded-full bg-white/10" />
                <div className="absolute -bottom-8 -left-6 size-28 rounded-full bg-white/10" />
                <div className="relative z-10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70 mb-2">{label}</p>
                  <p className="text-2xl font-black tracking-tight leading-none">
                    {loadingStats ? <span className="bg-white/20 animate-pulse rounded h-7 w-20 inline-block" /> : value}
                  </p>
                  <p className="text-xs text-white/60 mt-1.5">{sub}</p>
                </div>
                <div className="relative z-10 mt-3 -mx-2">
                  <ResponsiveContainer width="100%" height={48}>
                    <AreaChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="white" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="white" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey={dataKey} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} fill={`url(#sg-${label})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          {/* ── FILA 4: Créditos bar chart + Resumen panel ── */}
          <div className="grid lg:grid-cols-5 gap-6">

            {/* Bar chart créditos */}
            <div className="lg:col-span-3 bg-white rounded-2xl shadow-md p-5">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <p className="text-sm font-bold text-slate-700">Créditos por mes</p>
                  <p className="text-xs text-slate-400">Últimos 3 meses · actualización en tiempo real</p>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 whitespace-nowrap">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />En vivo
                </span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={allCreditosData}
                  margin={{ left: 16, right: 16, top: 28, bottom: 4 }}
                  barCategoryGap="35%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    stroke="#94a3b8"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      new Intl.NumberFormat('es-CO', {
                        style: 'currency', currency: 'COP', minimumFractionDigits: 0,
                      }).format(v)
                    }
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc', radius: 8 }}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 12 }}
                    formatter={(val: number, _n: string, props: any) => [
                      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val),
                      `${props.payload?.cantidad ?? 0} crédito${(props.payload?.cantidad ?? 0) !== 1 ? 's' : ''}`,
                    ]}
                    labelStyle={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}
                  />
                  <Bar dataKey="creditos" name="Créditos" radius={[8, 8, 0, 0]} maxBarSize={80}>
                    {allCreditosData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cantidad > 0 ? '#f59e0b' : '#e2e8f0'} />
                    ))}
                    <LabelList
                      dataKey="creditos"
                      position="top"
                      style={{ fontSize: 11, fontWeight: 700, fill: '#b45309' }}
                      formatter={(v: number) =>
                        v > 0
                          ? new Intl.NumberFormat('es-CO', {
                              style: 'currency', currency: 'COP', minimumFractionDigits: 0,
                            }).format(v)
                          : ''
                      }
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Resumen por mes */}
              <div className="flex justify-around mt-2 pt-3 border-t border-slate-100">
                {allCreditosData.map((m) => (
                  <div key={m.key} className="text-center">
                    <p className="text-xs text-slate-400 font-medium">{m.mes}</p>
                    <p className={`text-sm font-bold mt-0.5 ${m.cantidad > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                      {m.cantidad > 0
                        ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(m.creditos)
                        : '$ 0'}
                    </p>
                    <p className="text-xs text-slate-400">{m.cantidad} crédito{m.cantidad !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel resumen financiero */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-md p-5">
              <p className="text-sm font-bold text-slate-700 mb-0.5">Resumen financiero</p>
              <p className="text-xs text-slate-400 mb-4">Estado actual del fondo</p>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Cartera total',       value: fmtCOP(liveStats.totalCarteraCreditos),  sub: 'Créditos activos',    bar: 'bg-amber-500',   text: 'text-amber-600'   },
                  { label: 'Capital administrado', value: fmtCOP(liveStats.totalAhorros),          sub: 'Total ahorros',       bar: 'bg-emerald-500', text: 'text-emerald-600' },
                  { label: 'Intereses este mes',   value: fmtCOP(liveStats.totalInteresesMes),     sub: 'Ganancia créditos',   bar: 'bg-violet-500',  text: 'text-violet-600'  },
                  { label: 'Liquidaciones',        value: String(liveStats.liquidacionesPend),     sub: `${liveStats.totalUsuarios} usuarios`, bar: 'bg-slate-400', text: 'text-slate-600' },
                ].map(({ label, value, sub, bar, text }) => (
                  <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className={`w-1 h-10 rounded-full ${bar} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-600 truncate">{label}</p>
                      <p className="text-xs text-slate-400">{sub}</p>
                    </div>
                    <p className={`text-sm font-bold ${text} whitespace-nowrap`}>
                      {loadingStats ? <span className="bg-slate-200 animate-pulse rounded h-5 w-12 inline-block" /> : value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          VISTA ASOCIADO
      ══════════════════════════════════════════════════════════ */}
      {userRole === 'asociado' && (
        <div className="grid sm:grid-cols-3 gap-5">
          {asociadoStats.map((stat, i) => {
            const Icon   = stat.icon;
            const colors = getColorClasses(stat.color);
            return (
              <Card key={i} className="border-0 shadow-md bg-white hover:shadow-xl transition-all duration-200 overflow-hidden">
                <div className={`h-1 bg-gradient-to-r ${
                  stat.color === 'emerald' ? 'from-emerald-500 to-teal-400'
                  : stat.color === 'blue'  ? 'from-blue-500 to-cyan-400'
                  : 'from-amber-500 to-orange-400'
                }`} />
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                  <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{stat.title}</CardTitle>
                  <div className={`p-3 rounded-2xl ${colors.bg}`}>
                    <Icon className={`size-5 ${colors.text}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {loadingStats ? <div className="rounded-lg bg-slate-200 animate-pulse h-9 w-32" /> : stat.value}
                  </div>
                  {stat.sub && <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}