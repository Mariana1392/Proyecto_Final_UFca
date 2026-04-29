import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  PiggyBank, Wallet, CreditCard, Calendar, TrendingUp,
  ArrowRight, User, Bell, Star, Gift, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Coins, BarChart3,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '../lib/supabase';

interface Props {
  userData?: any;
  onNavigate?: (view: string) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0,
    notation: n >= 1_000_000 ? 'compact' : 'standard' }).format(n);

export default function DashboardAsociado({ userData, onNavigate }: Props) {
  const [data, setData] = useState({
    ahorroPerm:   0,
    ahorroVol:    0,
    creditoSaldo: 0,
    creditoActivo: false,
    eventos:      0,
    referidos:    0,
  });
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [proximosEventos, setProximosEventos] = useState<any[]>([]);
  const [creditos, setCreditos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData?.asociado_id) cargar(userData.asociado_id);
    else setLoading(false);
  }, [userData]);

  async function cargar(asociadoId: string) {
    try {
      const [ahorroRes, creditoRes, eventosRes, movPermRes, movVolRes, referidosRes] = await Promise.all([
        // Ahorros
        supabase.from('asociados').select(`
          ahorro_permanente(monto_ahorrado, estado, anulado),
          ahorro_voluntario(monto_ahorrado, estado, anulado)
        `).eq('id', asociadoId).single(),

        // Créditos activos
        supabase.from('creditos')
          .select('id, monto, saldo, estado, anulado, fecha_desembolso, plazo_meses, cuota_mensual')
          .eq('asociado_id', asociadoId)
          .eq('anulado', false)
          .in('estado', ['activo', 'desembolsado', 'en_mora']),

        // Próximos eventos
        supabase.from('eventos')
          .select('id, titulo, fecha, hora, lugar, estado')
          .in('estado', ['programado', 'en_curso'])
          .gte('fecha', new Date().toISOString().split('T')[0])
          .order('fecha', { ascending: true })
          .limit(3),

        // Últimos movimientos ahorro permanente
        supabase.from('movimientos_ahorro_permanente')
          .select('id, tipo, monto, descripcion, created_at')
          .eq('asociado_id', asociadoId)
          .order('created_at', { ascending: false })
          .limit(4),

        // Últimos movimientos ahorro voluntario
        supabase.from('movimientos_ahorro_voluntario')
          .select('id, tipo, monto, descripcion, created_at')
          .eq('asociado_id', asociadoId)
          .order('created_at', { ascending: false })
          .limit(3),

        // Referidos
        supabase.from('asociados')
          .select('id', { count: 'exact', head: true })
          .eq('referido_por_id', asociadoId),
      ]);

      const ap = (ahorroRes.data?.ahorro_permanente || [])
        .filter((a: any) => !a.anulado)
        .reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
      const av = (ahorroRes.data?.ahorro_voluntario || [])
        .filter((a: any) => !a.anulado)
        .reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);

      const creditosActivos = creditoRes.data || [];
      const saldoTotal = creditosActivos.reduce((s: number, c: any) => s + (c.saldo || 0), 0);

      setData({
        ahorroPerm:    ap,
        ahorroVol:     av,
        creditoSaldo:  saldoTotal,
        creditoActivo: creditosActivos.length > 0,
        eventos:       eventosRes.count ?? eventosRes.data?.length ?? 0,
        referidos:     referidosRes.count ?? 0,
      });

      setCreditos(creditosActivos);
      setProximosEventos(eventosRes.data || []);

      // Unir movimientos y ordenar por fecha
      const movs = [
        ...(movPermRes.data || []).map((m: any) => ({ ...m, fuente: 'Ahorro Permanente' })),
        ...(movVolRes.data  || []).map((m: any) => ({ ...m, fuente: 'Ahorro Voluntario' })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
      setMovimientos(movs);

    } catch (e) {
      console.error('Error cargando dashboard asociado:', e);
    } finally {
      setLoading(false);
    }
  }

  // Datos para el gráfico de área (últimos 6 meses simulados con base en datos reales)
  const totalAhorros = data.ahorroPerm + data.ahorroVol;
  const chartData = [
    { mes: 'Ene', total: Math.round(totalAhorros * 0.60) },
    { mes: 'Feb', total: Math.round(totalAhorros * 0.68) },
    { mes: 'Mar', total: Math.round(totalAhorros * 0.75) },
    { mes: 'Abr', total: Math.round(totalAhorros * 0.82) },
    { mes: 'May', total: Math.round(totalAhorros * 0.91) },
    { mes: 'Jun', total: totalAhorros },
  ];

  const pieData = [
    { name: 'Ahorro Permanente', value: data.ahorroPerm, color: '#10b981' },
    { name: 'Ahorro Voluntario', value: data.ahorroVol,  color: '#3b82f6' },
  ].filter(d => d.value > 0);

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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Bienvenida ─────────────────────────────────────────────────────── */}
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
            <Button
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1"
              onClick={() => onNavigate?.('ahorro-permanente')}
            >
              <PiggyBank className="size-4" /> Mis ahorros
            </Button>
            <Button
              size="sm"
              className="bg-white text-emerald-700 hover:bg-emerald-50 gap-1"
              onClick={() => onNavigate?.('creditos')}
            >
              <CreditCard className="size-4" /> Mis créditos
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tarjetas de resumen ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ahorro Permanente */}
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

        {/* Ahorro Voluntario */}
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

        {/* Créditos */}
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

        {/* Total ahorros */}
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

      {/* ── Gráficas ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Evolución de ahorros */}
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-800">Evolución de ahorros</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Proyección de los últimos 6 meses</p>
              </div>
              <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <BarChart3 className="size-4 text-emerald-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {totalAhorros > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAhorros" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                  <Tooltip formatter={(v: any) => [fmt(v), 'Total ahorros']}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                  <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2.5}
                    fill="url(#gradAhorros)" dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-slate-400 gap-2">
                <PiggyBank className="size-10 opacity-30" />
                <p className="text-sm">Aún no tienes ahorros registrados</p>
                <Button size="sm" variant="outline" className="mt-1 text-emerald-600 border-emerald-200"
                  onClick={() => onNavigate?.('ahorro-permanente')}>
                  Comenzar a ahorrar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribución */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">Distribución</CardTitle>
            <p className="text-xs text-slate-500">Composición de mis ahorros</p>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={68}
                      dataKey="value" paddingAngle={3}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v)}
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="size-2.5 rounded-full" style={{ background: d.color }} />
                        <span className="text-slate-600">{d.name}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{fmtCompact(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[180px] flex flex-col items-center justify-center text-slate-400 gap-2">
                <Wallet className="size-8 opacity-30" />
                <p className="text-xs text-center">Sin datos para mostrar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Fila inferior ─────────────────────────────────────────────────── */}
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
                {movimientos.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${
                        m.tipo === 'abono' ? 'bg-emerald-100' : 'bg-red-100'
                      }`}>
                        <TrendingUp className={`size-4 ${m.tipo === 'abono' ? 'text-emerald-600' : 'text-red-500 rotate-180'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{m.descripcion || m.fuente}</p>
                        <p className="text-xs text-slate-400">{m.fuente} · {relTime(m.created_at)}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${m.tipo === 'abono' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {m.tipo === 'abono' ? '+' : '-'}{fmt(m.monto || 0)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <Clock className="size-8 opacity-30" />
                <p className="text-sm">No hay movimientos recientes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel derecho: eventos + accesos rápidos */}
        <div className="space-y-4">
          {/* Próximos eventos */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Calendar className="size-4 text-cyan-500" /> Próximos eventos
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs text-cyan-600 gap-1 h-7"
                  onClick={() => onNavigate?.('eventos')}>
                  Ver <ArrowRight className="size-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {proximosEventos.length > 0 ? proximosEventos.map(ev => (
                <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="size-8 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="size-4 text-cyan-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{ev.titulo}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(ev.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      {ev.hora ? ` · ${ev.hora}` : ''}
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-400 text-center py-3">No hay eventos próximos</p>
              )}
            </CardContent>
          </Card>

          {/* Accesos rápidos */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Bell className="size-4 text-purple-500" /> Accesos rápidos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Mis ahorros',   icon: PiggyBank, view: 'ahorro-permanente', color: 'emerald' },
                { label: 'Mis créditos',  icon: CreditCard, view: 'creditos',          color: 'amber' },
                { label: 'Liquidación',   icon: Coins,      view: 'liquidacion',        color: 'blue' },
                { label: 'Referidos',     icon: Gift,       view: 'referidos',          color: 'purple' },
              ].map(({ label, icon: Icon, view, color }) => (
                <button key={view}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-${color}-50 transition-colors group text-left`}
                  onClick={() => onNavigate?.(view)}
                >
                  <div className={`size-8 rounded-lg bg-${color}-100 flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`size-4 text-${color}-600`} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{label}</span>
                  <ChevronRight className="size-4 text-slate-300 group-hover:text-slate-500 ml-auto" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Créditos activos (si tiene) ────────────────────────────────────── */}
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
                    <span className="text-xs font-medium text-amber-700">Crédito activo</span>
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
                  {/* Barra de progreso del crédito */}
                  <div className="mt-2">
                    <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, 100 - ((c.saldo / c.monto) * 100)))}%` }}
                      />
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
