import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../components/ui/dialog';
import { PiggyBank, Wallet, History, ArrowUpCircle, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/formatters';

// ── Vista asociado (porta MisAhorros) ─────────────────────────────────────────

function AhorrosAsociado({ userData }: { userData: any }) {
  const [loading, setLoading]             = useState(true);
  const [ahorroPermanente, setAhorroPerm] = useState<any>(null);
  const [ahorrosVol, setAhorrosVol]       = useState<any[]>([]);
  const [movsPerm, setMovsPerm]           = useState<any[]>([]);
  const [movsVol, setMovsVol]             = useState<any[]>([]);
  const [volSeleccionado, setVolSel]      = useState<any>(null);

  useEffect(() => { cargar(); }, [userData?.id]);

  async function cargar() {
    setLoading(true);
    try {
      const asocId = userData?.id;
      if (!asocId) return;

      const [permRes, volRes] = await Promise.all([
        supabase.from('cuentas_ahorro').select('*').eq('tipo','permanente').eq('asociado_id', asocId).eq('anulado',false).order('created_at',{ascending:false}),
        supabase.from('cuentas_ahorro').select('*').eq('tipo','voluntario').eq('asociado_id', asocId).eq('anulado',false).order('created_at',{ascending:false}),
      ]);

      if (permRes.error) throw permRes.error;
      if (volRes.error) throw volRes.error;

      const listaPerm  = permRes.data ?? [];
      const activos    = listaPerm.filter((a: any) => a.estado === 'activo');
      const mejorPerm  = activos.length > 0
        ? activos.reduce((best: any, curr: any) => curr.monto_ahorrado > best.monto_ahorrado ? curr : best, activos[0])
        : listaPerm[0] ?? null;
      setAhorroPerm(mejorPerm);
      setAhorrosVol(volRes.data ?? []);

      if (mejorPerm?.id) {
        const { data: movs, error: movsErr } = await supabase.from('transacciones').select('*')
          .eq('tipo','aporte_permanente').eq('ahorro_id', mejorPerm.id)
          .order('fecha_pago',{ascending:false}).limit(5);
        if (movsErr) throw movsErr;
        setMovsPerm(movs ?? []);
      }
    } catch (err: any) {
      toast.error('Error al cargar ahorros: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function cargarMovsVol(ahorro: any) {
    setVolSel(ahorro);
    const { data, error } = await supabase.from('transacciones').select('*')
      .eq('tipo','aporte_voluntario').eq('ahorro_id', ahorro.id)
      .order('fecha_pago',{ascending:false}).limit(5);
    if (error) toast.error('Error al cargar movimientos: ' + error.message);
    setMovsVol(data ?? []);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Mis Ahorros</h2>
        <p className="text-xs text-muted-foreground">Consulta tus planes de ahorro</p>
      </div>

      {/* AHORRO PERMANENTE */}
      <Card className={ahorroPermanente ? 'border-emerald-200' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${ahorroPermanente ? 'bg-emerald-100' : 'bg-muted'}`}>
              <PiggyBank className={`size-5 ${ahorroPermanente ? 'text-emerald-600' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-sm">Ahorro Permanente</CardTitle>
              <p className="text-xs text-muted-foreground">Aporte mensual obligatorio</p>
            </div>
            {ahorroPermanente && (
              <Badge className={ahorroPermanente.estado === 'activo' ? 'bg-emerald-600 text-white' : 'bg-yellow-100 text-yellow-700'}>
                {ahorroPermanente.estado === 'activo' ? 'Activo' : ahorroPermanente.estado}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!ahorroPermanente ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <PiggyBank className="size-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Sin ahorro permanente</p>
              <p className="text-xs mt-1">Se activa automáticamente al ser aprobado como asociado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                <p className="text-xs text-emerald-600 font-medium mb-1">Saldo acumulado</p>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(ahorroPermanente.monto_ahorrado)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Cuota mensual</p>
                  <p className="font-semibold">{formatCurrency(ahorroPermanente.cuota_mensual)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Fecha inicio</p>
                  <p className="font-semibold text-xs">{ahorroPermanente.created_at?.split('T')[0] ?? '—'}</p>
                </div>
              </div>
              {movsPerm.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <History className="size-3" /> Últimos pagos
                  </p>
                  <div className="space-y-1.5">
                    {movsPerm.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-background rounded-lg border text-xs">
                        <div className="flex items-center gap-2">
                          <ArrowUpCircle className="size-3.5 text-emerald-400 shrink-0" />
                          <span className="text-muted-foreground">Pago · {m.fecha_pago}</span>
                        </div>
                        <span className="font-semibold text-emerald-600">+{formatCurrency(m.monto ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AHORRO VOLUNTARIO */}
      <Card className={ahorrosVol.length > 0 ? 'border-blue-200' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${ahorrosVol.length > 0 ? 'bg-blue-100' : 'bg-muted'}`}>
              <Wallet className={`size-5 ${ahorrosVol.length > 0 ? 'text-blue-600' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-sm">Ahorro Voluntario</CardTitle>
              <p className="text-xs text-muted-foreground">Plan flexible gestionado por el administrador</p>
            </div>
            {ahorrosVol.length > 0 && (
              <Badge className="bg-blue-600 text-white">{ahorrosVol.length} {ahorrosVol.length === 1 ? 'plan' : 'planes'}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {ahorrosVol.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Wallet className="size-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Sin ahorro voluntario</p>
              <p className="text-xs mt-1">Contacta al administrador para crear un plan.</p>
            </div>
          ) : ahorrosVol.length === 1 ? (
            <PlanVoluntarioCard
              plan={ahorrosVol[0]}
              movs={volSeleccionado?.id === ahorrosVol[0].id ? movsVol : []}
              onSelect={cargarMovsVol}
            />
          ) : (
            <Tabs defaultValue={ahorrosVol[0]?.id}>
              <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${Math.min(ahorrosVol.length, 3)}, 1fr)` }}>
                {ahorrosVol.map((p: any, i: number) => (
                  <TabsTrigger key={p.id} value={p.id} className="text-xs" onClick={() => cargarMovsVol(p)}>
                    Plan {i + 1}
                  </TabsTrigger>
                ))}
              </TabsList>
              {ahorrosVol.map((p: any) => (
                <TabsContent key={p.id} value={p.id}>
                  <PlanVoluntarioCard
                    plan={p}
                    movs={volSeleccionado?.id === p.id ? movsVol : []}
                    onSelect={cargarMovsVol}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlanVoluntarioCard({ plan, movs, onSelect }: { plan: any; movs: any[]; onSelect: (p: any) => void }) {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Desde: {plan.created_at?.split('T')[0] ?? '—'}</span>
        <Badge className={plan.estado === 'activo' ? 'bg-blue-600 text-white' : plan.estado === 'retirado' ? 'bg-muted text-muted-foreground' : 'bg-yellow-100 text-yellow-700'}>
          {plan.estado}
        </Badge>
      </div>
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-center">
        <p className="text-xs text-blue-600 font-medium mb-1">Saldo acumulado</p>
        <p className="text-2xl font-bold text-blue-700">{formatCurrency(plan.monto_ahorrado)}</p>
        {plan.monto_al_cierre != null && (
          <p className="text-xs text-muted-foreground mt-1">Al cierre: {formatCurrency(plan.monto_al_cierre)}</p>
        )}
      </div>
      <div>
        <button onClick={() => onSelect(plan)} className="text-xs text-blue-600 font-medium flex items-center gap-1 mb-2">
          <History className="size-3" /> Ver últimos pagos
        </button>
        {movs.length > 0 && (
          <div className="space-y-1.5">
            {movs.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-background rounded-lg border text-xs">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="size-3.5 text-blue-400 shrink-0" />
                  <span className="text-muted-foreground">Depósito · {m.fecha_pago}</span>
                </div>
                <span className="font-semibold text-blue-600">+{formatCurrency(m.monto ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
        {movs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-1">Sin pagos registrados aún</p>
        )}
      </div>
    </div>
  );
}

// ── Diálogo Registro de Aporte Móvil ───────────────────────────────────────────

function AhorroDialogAporteMobile({ open, onClose, cuentas, onCreated }: { open: boolean, onClose: () => void, cuentas: any[], onCreated: () => void }) {
  const [formCuenta, setFormCuenta] = useState('');
  const [formMonto, setFormMonto]   = useState('');
  const [saving, setSaving]         = useState(false);

  async function handleSave() {
    if (!formCuenta) return toast.error('Selecciona una cuenta');
    const monto = parseFloat(formMonto.replace(/\./g, '').replace(/[^\d]/g, '')) || 0;
    if (monto <= 0) return toast.error('Monto inválido');
    
    setSaving(true);
    try {
      const cuenta = cuentas.find(c => c.id === formCuenta);
      const tipoAporte = cuenta?.tipo === 'permanente' ? 'aporte_permanente' : 'aporte_voluntario';
      
      const payload = {
        ahorro_id: formCuenta,
        tipo: tipoAporte,
        monto,
        fecha_pago: new Date().toISOString().split('T')[0],
        metodo_pago: 'efectivo',
        registrado_por: (await supabase.auth.getUser()).data.user?.id,
      };

      const { error } = await supabase.from('transacciones').insert(payload);
      if (error) throw error;
      
      toast.success('Aporte registrado correctamente');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error('Error al registrar aporte: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Aporte</DialogTitle>
          <DialogDescription>Añade fondos a una cuenta de ahorros activa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cuenta de Ahorro</Label>
            <select
              value={formCuenta}
              onChange={e => setFormCuenta(e.target.value)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccione cuenta...</option>
              {cuentas.filter(c => c.estado === 'activo').map(c => (
                <option key={c.id} value={c.id}>
                  {c.usuarios?.nombre} ({c.tipo}) - Saldo: {formatCurrency(c.monto_ahorrado)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Monto a depositar</Label>
            <input
              type="text"
              placeholder="Ej: 50.000"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formMonto}
              onChange={e => {
                const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                setFormMonto(raw ? parseInt(raw, 10).toLocaleString('es-CO') : '');
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Vista admin (resumen de todos los ahorros) ────────────────────────────────

function AhorrosAdmin() {
  const [loading, setLoading]   = useState(true);
  const [cuentas, setCuentas]   = useState<any[]>([]);
  const [search, setSearch]     = useState('');
  const [filtroTipo, setFiltro] = useState<'todos' | 'permanente' | 'voluntario'>('todos');
  const [crearOpen, setCrearOpen] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try {
      const [cRes, uRes] = await Promise.all([
        supabase
          .from('cuentas_ahorro')
          .select('id,tipo,monto_ahorrado,cuota_mensual,estado,anulado,created_at,asociado_id')
          .eq('anulado', false)
          .order('monto_ahorrado', { ascending: false }),
        supabase.from('usuarios').select('id,nombre,cedula')
      ]);

      if (cRes.error) throw cRes.error;

      const asocMap = Object.fromEntries((uRes.data ?? []).map(u => [u.id, u]));

      const mapped = (cRes.data ?? []).map(c => ({
        ...c,
        usuarios: asocMap[c.asociado_id] || { nombre: '—', cedula: '' }
      }));

      setCuentas(mapped);
    } catch (err: any) {
      toast.error('Error al cargar ahorros: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalPerm = cuentas.filter(c => c.tipo === 'permanente' && c.estado === 'activo').reduce((s, c) => s + (c.monto_ahorrado || 0), 0);
  const totalVol  = cuentas.filter(c => c.tipo === 'voluntario'  && c.estado === 'activo').reduce((s, c) => s + (c.monto_ahorrado || 0), 0);

  const filtradas = cuentas.filter(c => {
    if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (c.usuarios?.nombre ?? '').toLowerCase().includes(q) || (c.usuarios?.cedula ?? '').includes(search);
    }
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Gestión de Ahorros</h2>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 gap-1" onClick={() => setCrearOpen(true)}>
            <ArrowUpCircle className="size-3.5" /> Aporte
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Todos los ahorros registrados</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Ahorro permanente', value: formatCurrency(totalPerm), icon: PiggyBank, bg: 'bg-emerald-100', text: 'text-emerald-600' },
          { label: 'Ahorro voluntario',  value: formatCurrency(totalVol),  icon: Wallet,    bg: 'bg-blue-100',    text: 'text-blue-600'    },
          { label: 'Total ahorros',       value: formatCurrency(totalPerm + totalVol), icon: TrendingUp, bg: 'bg-indigo-100', text: 'text-indigo-600' },
          { label: 'Cuentas activas',     value: String(cuentas.filter(c => c.estado === 'activo').length), icon: Users, bg: 'bg-slate-100', text: 'text-slate-600' },
        ].map(({ label, value, icon: Icon, bg, text }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-1.5`}>
                <Icon className={`size-4 ${text}`} />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className={`text-sm font-bold ${text}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar por nombre o cédula..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 h-9 px-3 text-sm rounded-md border border-input bg-background"
        />
        <select
          value={filtroTipo}
          onChange={e => setFiltro(e.target.value as any)}
          className="h-9 px-2 text-xs rounded-md border border-input bg-background"
        >
          <option value="todos">Todos</option>
          <option value="permanente">Permanente</option>
          <option value="voluntario">Voluntario</option>
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtradas.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Sin resultados</p>
        ) : filtradas.map(c => (
          <Card key={c.id} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg shrink-0 ${c.tipo === 'permanente' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                    {c.tipo === 'permanente'
                      ? <PiggyBank className="size-4 text-emerald-600" />
                      : <Wallet className="size-4 text-blue-600" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.usuarios?.nombre ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{c.usuarios?.cedula ?? ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${c.tipo === 'permanente' ? 'text-emerald-700' : 'text-blue-700'}`}>
                    {formatCurrency(c.monto_ahorrado)}
                  </p>
                  <Badge variant="outline" className="text-[10px] mt-0.5">
                    {c.tipo === 'permanente' ? 'Permanente' : 'Voluntario'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                <span>Estado: <span className={`font-medium ${c.estado === 'activo' ? 'text-emerald-600' : 'text-slate-500'}`}>{c.estado}</span></span>
                {c.cuota_mensual > 0 && <span>Cuota: {formatCurrency(c.cuota_mensual)}</span>}
                <span>Desde: {c.created_at?.split('T')[0]}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <AhorroDialogAporteMobile open={crearOpen} onClose={() => setCrearOpen(false)} cuentas={cuentas} onCreated={cargar} />
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function AhorrosScreen() {
  const { userRole, userData } = useAuth();
  if (userRole === 'admin') return <AhorrosAdmin />;
  return <AhorrosAsociado userData={userData} />;
}
