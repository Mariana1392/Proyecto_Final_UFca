import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/formatters';
import {
  PiggyBank, Wallet, CreditCard, Landmark, Users, TrendingUp, AlertTriangle, Activity,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import ReportesScreen from './Reportes';

interface Stats {
  totalAsociados: number;
  totalCreditos: number;
  totalAhorrosPerm: number;
  totalAhorrosVol: number;
  totalAhorros: number;
  totalCarteraCreditos: number;
  totalInteresesMes: number;
  solicitudesPendientes: number;
  liquidacionesPend: number;
}

const EMPTY: Stats = {
  totalAsociados: 0, totalCreditos: 0,
  totalAhorrosPerm: 0, totalAhorrosVol: 0, totalAhorros: 0,
  totalCarteraCreditos: 0, totalInteresesMes: 0,
  solicitudesPendientes: 0, liquidacionesPend: 0,
};

export default function DashboardScreen() {
  const { userData, userRole } = useAuth();
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargarAdmin = useCallback(async () => {
    try {
      const { data: rpc } = await supabase.rpc('get_dashboard_stats');
      if (rpc) {
        setStats({
          totalAsociados:       rpc.totalAsociados        ?? 0,
          totalCreditos:        rpc.totalCreditos         ?? 0,
          totalAhorrosPerm:     rpc.totalAhorrosPerm      ?? 0,
          totalAhorrosVol:      rpc.totalAhorrosVol       ?? 0,
          totalAhorros:         rpc.totalAhorros          ?? 0,
          totalCarteraCreditos: rpc.totalCarteraCreditos  ?? 0,
          totalInteresesMes:    rpc.totalInteresesMes     ?? 0,
          solicitudesPendientes:rpc.solicitudesPendientes ?? 0,
          liquidacionesPend:    rpc.liquidacionesPend     ?? 0,
        });
        return;
      }
    } catch {}

    // Fallback individual queries
    const hoy = new Date();
    const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    const [
      { count: asocs }, { count: creds },
      { data: perm }, { data: vol },
      { data: cartera }, { data: intereses },
      { count: solPend }, { count: liqPend },
    ] = await Promise.all([
      supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('estado_cuenta', 'activo'),
      supabase.from('creditos').select('*', { count: 'exact', head: true }).eq('anulado', false).in('estado', ['activo','aprobado','desembolsado','en_mora']),
      supabase.from('cuentas_ahorro').select('monto_ahorrado').eq('tipo','permanente').eq('estado','activo').eq('anulado',false),
      supabase.from('cuentas_ahorro').select('monto_ahorrado').eq('tipo','voluntario').eq('estado','activo').eq('anulado',false),
      supabase.from('creditos').select('saldo').eq('anulado',false).in('estado',['activo','aprobado','desembolsado','en_mora']),
      supabase.from('transacciones').select('interes').in('tipo',['pago_credito','abono_capital']).gte('fecha_pago', inicioMes),
      supabase.from('solicitudes_asociados').select('*', { count: 'exact', head: true }).eq('estado','pendiente'),
      supabase.from('liquidaciones').select('*', { count: 'exact', head: true }).not('estado','in','("Pagada","Rechazada","Borrador")'),
    ]);
    const totalAhorrosPerm     = (perm  ?? []).reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
    const totalAhorrosVol      = (vol   ?? []).reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
    const totalCarteraCreditos = (cartera ?? []).reduce((s: number, c: any) => s + (c.saldo || 0), 0);
    const totalInteresesMes    = (intereses ?? []).reduce((s: number, p: any) => s + (p.interes || 0), 0);
    setStats({
      totalAsociados: asocs ?? 0,
      totalCreditos: creds ?? 0,
      totalAhorrosPerm, totalAhorrosVol,
      totalAhorros: totalAhorrosPerm + totalAhorrosVol,
      totalCarteraCreditos, totalInteresesMes,
      solicitudesPendientes: solPend ?? 0,
      liquidacionesPend: liqPend ?? 0,
    });
  }, []);

  const cargarAsociado = useCallback(async () => {
    const id = userData?.id;
    if (!id) return;
    const [{ data: cuentas }, { data: creds }] = await Promise.all([
      supabase.from('cuentas_ahorro').select('tipo,monto_ahorrado').eq('asociado_id', id).eq('anulado', false).eq('estado','activo'),
      supabase.from('creditos').select('id,anulado,estado').eq('asociado_id', id),
    ]);
    const perm  = (cuentas ?? []).filter((c: any) => c.tipo === 'permanente').reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
    const vol   = (cuentas ?? []).filter((c: any) => c.tipo === 'voluntario').reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
    const activos = (creds ?? []).filter((c: any) => !c.anulado && ['activo','desembolsado','en_mora'].includes(c.estado)).length;
    setStats(prev => ({ ...prev, totalAhorrosPerm: perm, totalAhorrosVol: vol, totalAhorros: perm + vol, totalCreditos: activos }));
  }, [userData?.id]);

  const reload = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (userRole === 'admin') cargarAdmin();
    }, 500);
  }, [userRole, cargarAdmin]);

  useEffect(() => {
    setLoading(true);
    const fn = userRole === 'admin' ? cargarAdmin : cargarAsociado;
    fn().finally(() => setLoading(false));

    if (userRole === 'admin') {
      const ch = supabase.channel('dash-mobile')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'creditos' }, reload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transacciones' }, reload)
        .subscribe();
      return () => { if (debounce.current) clearTimeout(debounce.current); supabase.removeChannel(ch); };
    }
  }, [userRole]);

  const Shimmer = () => <span className="inline-block h-5 w-20 bg-slate-200 animate-pulse rounded" />;

  // ── ADMIN ──────────────────────────────────────────────────────────────────
  if (userRole === 'admin') {
    const adminCards = [
      { label: 'Cartera de créditos', value: formatCurrency(stats.totalCarteraCreditos), sub: `${stats.totalCreditos} activos`, icon: Landmark, bg: 'bg-amber-100', text: 'text-amber-600' },
      { label: 'Capital en ahorros',  value: formatCurrency(stats.totalAhorros),          sub: 'Total administrado',            icon: PiggyBank,  bg: 'bg-emerald-100', text: 'text-emerald-600' },
      { label: 'Intereses este mes',  value: formatCurrency(stats.totalInteresesMes),      sub: 'Recaudados en el mes',          icon: TrendingUp, bg: 'bg-violet-100',  text: 'text-violet-600' },
      { label: 'Asociados activos',   value: String(stats.totalAsociados),                 sub: `${stats.solicitudesPendientes} sol. pendientes`, icon: Users, bg: 'bg-pink-100', text: 'text-pink-600' },
      { label: 'Ahorro permanente',   value: formatCurrency(stats.totalAhorrosPerm),       sub: 'Saldo activo',                  icon: PiggyBank,  bg: 'bg-emerald-100', text: 'text-emerald-600' },
      { label: 'Ahorro voluntario',   value: formatCurrency(stats.totalAhorrosVol),        sub: 'Saldo activo',                  icon: Wallet,     bg: 'bg-blue-100',    text: 'text-blue-600' },
    ];

    const alertas = [
      stats.solicitudesPendientes > 0 && { label: `${stats.solicitudesPendientes} solicitud${stats.solicitudesPendientes > 1 ? 'es' : ''} de asociación pendiente${stats.solicitudesPendientes > 1 ? 's' : ''}`, color: 'bg-amber-50 border-amber-200 text-amber-800' },
      stats.liquidacionesPend    > 0 && { label: `${stats.liquidacionesPend} liquidación${stats.liquidacionesPend > 1 ? 'es' : ''} en proceso`, color: 'bg-blue-50 border-blue-200 text-blue-800' },
    ].filter(Boolean) as { label: string; color: string }[];

    return (
      <div className="space-y-4 animate-fade-in pb-4">
        {/* Cabecera */}
        <div>
          <h2 className="text-lg font-bold text-foreground">Dashboard</h2>
          <p className="text-xs text-muted-foreground">Panel de administración · UFCA</p>
        </div>

        <Tabs defaultValue="resumen" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="reportes">Reportes</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-4">
            {/* Alertas */}
        {alertas.map((a, i) => (
          <div key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${a.color}`}>
            <AlertTriangle className="size-4 shrink-0" />
            {a.label}
          </div>
        ))}

        {/* Grid de tarjetas */}
        <div className="grid grid-cols-2 gap-3">
          {adminCards.map(({ label, value, sub, icon: Icon, bg, text }) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-2`}>
                  <Icon className={`size-5 ${text}`} />
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium truncate">{label}</p>
                <p className={`text-base font-bold mt-0.5 ${text} leading-tight`}>
                  {loading ? <Shimmer /> : value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Resumen financiero */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-bold text-foreground">Resumen financiero</p>
            {[
              { label: 'Cartera total',       value: formatCurrency(stats.totalCarteraCreditos), bar: 'bg-amber-500',   text: 'text-amber-600' },
              { label: 'Capital administrado', value: formatCurrency(stats.totalAhorros),          bar: 'bg-emerald-500', text: 'text-emerald-600' },
              { label: 'Intereses este mes',   value: formatCurrency(stats.totalInteresesMes),     bar: 'bg-violet-500',  text: 'text-violet-600' },
              { label: 'Liquidaciones activas', value: String(stats.liquidacionesPend),             bar: 'bg-blue-400',    text: 'text-blue-600' },
            ].map(({ label, value, bar, text }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-1 h-10 rounded-full ${bar} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{label}</p>
                </div>
                <p className={`text-sm font-bold ${text} whitespace-nowrap`}>
                  {loading ? <Shimmer /> : value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="reportes" className="space-y-4">
          <ReportesScreen />
        </TabsContent>
      </Tabs>
      </div>
    );
  }

  // ── ASOCIADO ───────────────────────────────────────────────────────────────
  const asociadoCards = [
    { label: 'Ahorro permanente', value: formatCurrency(stats.totalAhorrosPerm), sub: 'Saldo acumulado', icon: PiggyBank,  bg: 'bg-emerald-100', text: 'text-emerald-600', grad: 'from-emerald-500 to-teal-400' },
    { label: 'Ahorro voluntario',  value: formatCurrency(stats.totalAhorrosVol),  sub: 'Saldo acumulado', icon: Wallet,     bg: 'bg-blue-100',    text: 'text-blue-600',    grad: 'from-blue-500 to-cyan-400'    },
    { label: 'Créditos activos',   value: String(stats.totalCreditos),            sub: 'En curso',        icon: CreditCard, bg: 'bg-amber-100',   text: 'text-amber-600',   grad: 'from-amber-500 to-orange-400' },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Saludo */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <CardContent className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-foreground">Hola, {userData?.nombre || 'Asociado'}</p>
            <p className="text-xs text-muted-foreground">Bienvenido a tu portal UFCA</p>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
            Asociado
          </Badge>
        </CardContent>
      </Card>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          {/* Tarjetas de stats */}
      <div className="grid grid-cols-1 gap-3">
        {asociadoCards.map(({ label, value, sub, icon: Icon, bg, text, grad }) => (
          <Card key={label} className="border-0 shadow-sm overflow-hidden">
            <div className={`h-1 bg-gradient-to-r ${grad}`} />
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className={`text-2xl font-extrabold mt-1 ${text}`}>
                  {loading ? <Shimmer /> : value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </div>
              <div className={`p-3 rounded-2xl ${bg}`}>
                <Icon className={`size-6 ${text}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resumen total ahorros */}
      {!loading && (stats.totalAhorrosPerm + stats.totalAhorrosVol) > 0 && (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-800 to-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="size-4 text-emerald-400" />
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Total ahorros</p>
            </div>
            <p className="text-3xl font-black text-white">
              {formatCurrency(stats.totalAhorrosPerm + stats.totalAhorrosVol)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Suma de todos tus planes activos</p>
          </CardContent>
        </Card>
      )}
      </TabsContent>

      <TabsContent value="reportes" className="space-y-4">
        <ReportesScreen />
      </TabsContent>
      </Tabs>
    </div>
  );
}
