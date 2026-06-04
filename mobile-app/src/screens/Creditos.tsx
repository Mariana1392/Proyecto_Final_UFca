import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import {
  CreditCard, Plus, Banknote, Clock, CheckCircle2, AlertTriangle,
  Calendar, Percent, X, Check, Search, Users, Table2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/formatters';
import { TIPOS_CREDITO } from '../lib/constants';

function tasaEAaMensual(ea: number) { return ea > 0 ? Math.pow(1 + ea / 100, 1 / 12) - 1 : 0; }
function calcularCuota(monto: number, tasa: number, plazo: number): number {
  if (!monto || !plazo) return 0;
  if (!tasa) return Math.round(monto / plazo);
  const i = tasaEAaMensual(tasa);
  return Math.round(monto * (i * Math.pow(1 + i, plazo)) / (Math.pow(1 + i, plazo) - 1));
}

function CreditoDialogCrearMobile({ open, onClose, usuarios, onCreated }: { open: boolean, onClose: () => void, usuarios: any[], onCreated: () => void }) {
  const [formAsoc, setFormAsoc] = useState('');
  const [formMonto, setFormMonto] = useState('');
  const [formPlazo, setFormPlazo] = useState('');
  const [formTasa, setFormTasa] = useState('');
  const [formTipo, setFormTipo] = useState('libre_inversion');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!formAsoc) return toast.error('Selecciona un asociado');
    const monto = parseFloat(formMonto.replace(/\./g, '').replace(/[^\d]/g, '')) || 0;
    if (monto <= 0) return toast.error('Monto inválido');
    const plazo = parseInt(formPlazo) || 0;
    if (plazo <= 0) return toast.error('Plazo inválido');
    const tasa = parseFloat(formTasa) || 0;
    
    setSaving(true);
    try {
      const cuota = calcularCuota(monto, tasa, plazo);
      const { error } = await supabase.from('creditos').insert({
        asociado_id: formAsoc,
        tipo: formTipo,
        monto,
        tasa_interes: tasa,
        plazo_meses: plazo,
        cuota_mensual: cuota,
        tipo_interes: 'compuesto',
        saldo: monto,
        estado: 'activo',
        fecha_desembolso: new Date().toISOString().split('T')[0],
      });
      if (error) throw error;
      toast.success('Crédito registrado con éxito');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error('Error al registrar crédito: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Crédito</DialogTitle>
          <DialogDescription>Registra un nuevo crédito para un asociado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Asociado</Label>
            <Select value={formAsoc} onValueChange={setFormAsoc}>
              <SelectTrigger><SelectValue placeholder="Seleccione asociado" /></SelectTrigger>
              <SelectContent>
                {usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nombre} ({u.cedula})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de crédito</Label>
            <Select value={formTipo} onValueChange={setFormTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_CREDITO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto</Label>
              <Input type="text" placeholder="Ej: 5.000.000" value={formMonto} onChange={e => {
                const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                setFormMonto(raw ? parseInt(raw, 10).toLocaleString('es-CO') : '');
              }} />
            </div>
            <div className="space-y-1.5">
              <Label>Tasa EA (%)</Label>
              <Input type="number" step="0.1" value={formTasa} onChange={e => setFormTasa(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Plazo (meses)</Label>
            <Input type="number" value={formPlazo} onChange={e => setFormPlazo(e.target.value)} />
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTADOS_APROBACION = [
  { value: 'simulacion',   label: 'Simulación',   color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' },
  { value: 'pendiente',    label: 'Pendiente',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800' },
  { value: 'en_revision',  label: 'En revisión',  color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  { value: 'aprobado',     label: 'Aprobado',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'activo',       label: 'Activo',       color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
  { value: 'desembolsado', label: 'Desembolsado', color: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' },
  { value: 'en_mora',      label: 'En mora',      color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
  { value: 'pagado',       label: 'Pagado',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'rechazado',    label: 'Rechazado',    color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700' },
];

function estadoBadge(estado: string) {
  const e = ESTADOS_APROBACION.find(x => x.value === estado);
  return e?.color ?? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700';
}

// ── Dialog: detalle + historial ───────────────────────────────────────────────

function DetalleDialog({ credito, onClose, isAdmin }: { credito: any; onClose: () => void; isAdmin: boolean }) {
  const [historial, setHistorial] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pagando, setPagando]     = useState(false);
  const [pagoOpen, setPagoOpen]   = useState(false);
  const [montoPago, setMontoPago] = useState('');
  const { userData } = useAuth();

  useEffect(() => {
    supabase.from('transacciones').select('*')
      .eq('credito_id', credito.id)
      .in('tipo', ['pago_credito','abono_capital','cancelacion_total'])
      .order('fecha_pago', { ascending: false })
      .then(({ data }) => { setHistorial(data ?? []); setLoading(false); });
  }, [credito.id]);

  const progreso    = credito.monto > 0 ? Math.max(0, Math.min(100, ((credito.monto - credito.saldo) / credito.monto) * 100)) : 0;
  const cuotasPag   = credito.cuotaMensual > 0 ? Math.round((credito.monto - credito.saldo) / credito.cuotaMensual) : 0;
  const estadoConf  = ESTADOS_APROBACION.find(e => e.value === credito.estadoAprobacion);

  async function pagarCuota() {
    const monto = parseFloat(montoPago.replace(/\./g, '').replace(/[^\d]/g, '')) || 0;
    if (!monto || monto <= 0) { toast.error('Ingresa un monto válido'); return; }
    setPagando(true);
    try {
      const i        = tasaEAaMensual(credito.tasaInteres || 0);
      const interes  = Math.round((credito.saldo || credito.monto) * i);
      const capital  = Math.max(0, monto - interes);
      const saldoNew = Math.max(0, (credito.saldo || 0) - capital);
      const hoy      = new Date().toISOString().split('T')[0];

      const { error } = await supabase.rpc('registrar_pago_credito', {
        p_credito_id:      credito.id,
        p_monto_pagado:    monto,
        p_capital:         capital,
        p_interes:         interes,
        p_saldo_antes:     credito.saldo || credito.monto,
        p_saldo_despues:   saldoNew,
        p_num_cuota:       cuotasPag + 1,
        p_fecha_pago:      hoy,
        p_metodo_pago:     'efectivo',
        p_registrado_por:  userData?.id ?? null,
        p_observacion:     null,
        p_url_comprobante: null,
      });
      if (error) throw error;
      toast.success('Pago registrado correctamente');
      setPagoOpen(false);
      setMontoPago('');
      onClose();
    } catch (err: any) {
      toast.error('Error al registrar pago: ' + err.message);
    } finally {
      setPagando(false);
    }
  }

  const puedesPagar = !credito.anulado && credito.saldo > 0 && ['activo','desembolsado','en_mora'].includes(credito.estadoAprobacion);

  return (
    <>
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-blue-600" />
            {credito.anulado
              ? 'Crédito Anulado'
              : TIPOS_CREDITO.find(t => t.value === credito.tipo)?.label ?? credito.tipo}
          </DialogTitle>
          <DialogDescription>
            CRE-{credito.id.substring(0, 8).toUpperCase()}
            {isAdmin && credito.asociado ? ` · ${credito.asociado}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Estado */}
          <div className="flex items-center gap-2 flex-wrap">
            {credito.anulado
              ? <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200">Anulado</Badge>
              : <Badge variant="outline" className={estadoBadge(credito.estadoAprobacion)}>{estadoConf?.label ?? credito.estadoAprobacion}</Badge>
            }
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { l: 'Monto original',  v: formatCurrency(credito.monto),        color: 'text-indigo-700' },
              { l: 'Saldo pendiente', v: credito.saldo <= 0 ? 'Pagado ✓' : formatCurrency(credito.saldo), color: credito.saldo <= 0 ? 'text-emerald-600' : 'text-orange-600' },
              { l: 'Cuota mensual',   v: formatCurrency(credito.cuotaMensual),  color: 'text-slate-700' },
              { l: 'Plazo',           v: `${credito.plazo} meses`,              color: 'text-slate-700' },
              { l: 'Tasa EA',         v: credito.tasaInteres > 0 ? `${credito.tasaInteres}%` : 'Sin tasa', color: 'text-orange-600' },
              { l: 'Cuotas pagadas',  v: `${Math.max(0, cuotasPag)} / ${credito.plazo}`, color: 'text-blue-700' },
            ].map(({ l, v, color }) => (
              <div key={l} className="p-2.5 bg-muted/40 rounded-lg">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{l}</p>
                <p className={`text-sm font-semibold mt-0.5 ${color}`}>{v}</p>
              </div>
            ))}
          </div>

          {credito.plazo > 0 && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progreso de pago</span>
                <span className="font-medium">{progreso.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${credito.estadoAprobacion === 'en_mora' ? 'bg-red-400' : credito.estadoAprobacion === 'pagado' ? 'bg-emerald-500' : 'bg-blue-400'}`}
                  style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}

          {credito.fechaDesembolso && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3" /> Desembolso: {credito.fechaDesembolso}
            </div>
          )}

          {/* Historial pagos */}
          <div>
            <p className="text-xs font-semibold mb-2 flex items-center gap-1">Historial de pagos</p>
            {loading ? (
              <div className="h-8 bg-muted animate-pulse rounded" />
            ) : historial.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Sin pagos registrados</p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {historial.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs px-3 py-2 bg-background rounded-lg border">
                    <div>
                      <p className="font-medium">{p.fecha_pago}</p>
                      <p className="text-muted-foreground">Capital: {formatCurrency(p.capital ?? 0)} · Int: {formatCurrency(p.interes ?? 0)}</p>
                    </div>
                    <span className="font-semibold text-emerald-600">+{formatCurrency(p.monto_pagado ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {credito.observaciones && (
            <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Observaciones: </span>{credito.observaciones}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2">
          {puedesPagar && (
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={() => setPagoOpen(true)}>
              <Banknote className="size-4" /> Registrar pago
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Dialog pago */}
    <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Banknote className="size-5 text-emerald-600" /> Registrar pago</DialogTitle>
          <DialogDescription>Saldo actual: {formatCurrency(credito.saldo)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
            <p className="text-xs text-emerald-600 font-medium">Cuota sugerida</p>
            <p className="text-xl font-bold text-emerald-700">{formatCurrency(credito.cuotaMensual)}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Monto a pagar</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                className="pl-7"
                placeholder="0"
                value={montoPago}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                  setMontoPago(raw ? parseInt(raw, 10).toLocaleString('es-CO') : '');
                }}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2">
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={pagando} onClick={pagarCuota}>
            {pagando ? 'Registrando...' : 'Confirmar pago'}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setPagoOpen(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ── Card de un crédito ────────────────────────────────────────────────────────

function CreditoCard({ c, isAdmin, onReload }: { c: any; isAdmin: boolean; onReload: () => void }) {
  const [detalleOpen, setDetalleOpen] = useState(false);
  const progreso  = c.monto > 0 ? Math.max(0, Math.min(100, ((c.monto - c.saldo) / c.monto) * 100)) : 0;
  const estadoConf = ESTADOS_APROBACION.find(e => e.value === c.estadoAprobacion);

  return (
    <>
      <Card
        className={`border-0 shadow-sm cursor-pointer ${
          c.anulado ? 'opacity-60 bg-muted/50' :
          c.estadoAprobacion === 'en_mora' ? 'border border-red-200 bg-red-50/30' :
          c.estadoAprobacion === 'pagado'  ? 'border border-emerald-200 bg-emerald-50/20' : ''
        }`}
        onClick={() => setDetalleOpen(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${c.anulado ? 'bg-muted' : c.estadoAprobacion === 'en_mora' ? 'bg-red-100' : c.estadoAprobacion === 'pagado' ? 'bg-emerald-100' : 'bg-blue-50'}`}>
                <CreditCard className={`size-4 ${c.anulado ? 'text-muted-foreground' : c.estadoAprobacion === 'en_mora' ? 'text-red-500' : c.estadoAprobacion === 'pagado' ? 'text-emerald-600' : 'text-blue-600'}`} />
              </div>
              <div>
                {isAdmin && <p className="text-sm font-semibold text-foreground">{c.asociado}</p>}
                <p className="text-xs text-muted-foreground">{TIPOS_CREDITO.find(t => t.value === c.tipo)?.label ?? c.tipo}</p>
                <p className="text-[10px] font-mono text-muted-foreground">CRE-{c.id.substring(0, 8).toUpperCase()}</p>
              </div>
            </div>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${estadoBadge(c.anulado ? 'rechazado' : c.estadoAprobacion)}`}>
              {c.anulado ? 'Anulado' : estadoConf?.label ?? c.estadoAprobacion}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs mb-2">
            <div>
              <p className="text-muted-foreground text-[10px]">Monto</p>
              <p className="font-semibold text-indigo-700">{formatCurrency(c.monto)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">Saldo</p>
              <p className={`font-semibold ${c.saldo <= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                {c.saldo <= 0 ? 'Pagado' : formatCurrency(c.saldo)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">Cuota</p>
              <p className="font-semibold">{formatCurrency(c.cuotaMensual)}</p>
            </div>
          </div>

          {c.plazo > 0 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${c.estadoAprobacion === 'en_mora' ? 'bg-red-400' : c.estadoAprobacion === 'pagado' ? 'bg-emerald-500' : 'bg-blue-400'}`}
                style={{ width: `${progreso}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {detalleOpen && (
        <DetalleDialog
          credito={c}
          isAdmin={isAdmin}
          onClose={() => { setDetalleOpen(false); onReload(); }}
        />
      )}
    </>
  );
}

// ── Solicitar crédito (asociado) ─────────────────────────────────────────────

function SolicitarDialog({ onClose, userData }: { onClose: () => void; userData: any }) {
  const [tipo,        setTipo]        = useState('libre_inversion');
  const [monto,       setMonto]       = useState('');
  const [plazo,       setPlazo]       = useState('');
  const [destino,     setDestino]     = useState('');
  const [obs,         setObs]         = useState('');
  const [banco,       setBanco]       = useState('');
  const [tipoCuenta,  setTipoCuenta]  = useState('ahorros');
  const [numCuenta,   setNumCuenta]   = useState('');
  const [tasa,        setTasa]        = useState('');
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    supabase.from('configuracion').select('clave,valor')
      .in('clave', ['tasa_libre_inversion','tasa_educacion','tasa_vivienda','tasa_calamidad'])
      .then(({ data }) => {
        const TIPO_TASA: Record<string, string> = { libre_inversion: 'tasa_libre_inversion', educacion: 'tasa_educacion', vivienda: 'tasa_vivienda', calamidad: 'tasa_calamidad' };
        const map: Record<string, string> = {};
        (data ?? []).forEach((r: any) => { map[r.clave] = r.valor; });
        setTasa(map[TIPO_TASA[tipo]] ?? '');
      });
  }, [tipo]);

  const montoNum  = parseInt(monto.replace(/\./g, '').replace(/[^\d]/g, ''), 10) || 0;
  const plazoNum  = parseInt(plazo) || 0;
  const tasaNum   = parseFloat(tasa) || 0;
  const cuota     = calcularCuota(montoNum, tasaNum, plazoNum);
  const total     = cuota * plazoNum;
  const intereses = total - montoNum;

  async function enviar() {
    if (!montoNum || montoNum <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (!plazoNum || plazoNum <= 0) { toast.error('Ingresa un plazo válido'); return; }
    if (!banco.trim()) { toast.error('Ingresa el banco'); return; }
    if (!numCuenta.trim()) { toast.error('Ingresa el número de cuenta'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('creditos').insert({
        asociado_id:               userData.id,
        tipo,
        monto:                     montoNum,
        plazo_meses:               plazoNum,
        tasa_interes:              tasaNum,
        cuota_mensual:             cuota,
        saldo:                     montoNum,
        estado:                    'pendiente',
        estado_aprobacion:         'pendiente',
        descripcion_soporte:       destino,
        observaciones:             obs,
        datos_bancarios:           JSON.stringify({ banco, tipo_cuenta: tipoCuenta, numero_cuenta: numCuenta }),
        anulado:                   false,
      });
      if (error) throw error;
      toast.success('Solicitud enviada — el administrador la revisará');
      onClose();
    } catch (err: any) {
      toast.error('Error al enviar solicitud: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CreditCard className="size-5 text-blue-600" /> Solicitar crédito</DialogTitle>
          <DialogDescription>Completa el formulario y el administrador revisará tu solicitud.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de crédito <span className="text-red-500">*</span></Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_CREDITO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {tasa && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                <Percent className="size-3.5 text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700">Tasa para este tipo: <strong>{tasa}% EA</strong></p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto solicitado <span className="text-red-500">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  className="pl-7"
                  placeholder="0"
                  value={monto}
                  onChange={e => {
                    const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                    setMonto(raw ? parseInt(raw, 10).toLocaleString('es-CO') : '');
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Plazo (meses) <span className="text-red-500">*</span></Label>
              <Input type="number" min={1} placeholder="12" value={plazo} onChange={e => setPlazo(e.target.value)} />
            </div>
          </div>

          {/* Preview simulación */}
          {montoNum > 0 && plazoNum > 0 && (
            <div className="rounded-xl border border-purple-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 flex items-center gap-2">
                <Table2 className="size-4 text-white" />
                <span className="text-white text-sm font-bold">Simulación del crédito</span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-purple-100 bg-card">
                {[
                  { l: 'Cuota mensual', v: formatCurrency(cuota),    c: 'text-purple-700' },
                  { l: 'Total intereses', v: formatCurrency(intereses), c: 'text-amber-600' },
                  { l: 'Total a pagar',   v: formatCurrency(total),    c: 'text-emerald-600' },
                ].map(({ l, v, c }) => (
                  <div key={l} className="px-3 py-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{l}</p>
                    <p className={`text-sm font-black mt-0.5 ${c}`}>{v}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-center py-1.5 bg-muted/20">
                Cálculo orientativo — condiciones finales las define el administrador
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Destino del crédito <span className="text-xs text-muted-foreground">(opcional)</span></Label>
            <Input placeholder="Ej. Pago de matrícula universitaria" value={destino} onChange={e => setDestino(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Observaciones adicionales</Label>
            <Textarea placeholder="Información para el administrador..." value={obs} onChange={e => setObs(e.target.value)} rows={3} />
          </div>

          <div className="space-y-3 pt-1 border-t border-border">
            <p className="text-sm font-semibold flex items-center gap-2"><Users className="size-4 text-indigo-500" /> Datos bancarios</p>
            <Input placeholder="Banco (Bancolombia, Nequi...)" value={banco} onChange={e => setBanco(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={tipoCuenta} onValueChange={setTipoCuenta}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ahorros">Ahorros</SelectItem>
                  <SelectItem value="corriente">Corriente</SelectItem>
                  <SelectItem value="digital">Digital / Billetera</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Número de cuenta"
                value={numCuenta}
                onChange={e => setNumCuenta(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2">
          <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={saving} onClick={enviar}>
            {saving ? 'Enviando...' : 'Enviar solicitud'}
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Vista asociado ────────────────────────────────────────────────────────────

function CreditosAsociado({ userData }: { userData: any }) {
  const [loading,    setLoading]    = useState(true);
  const [creditos,   setCreditos]   = useState<any[]>([]);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [simulaciones, setSims]     = useState<any[]>([]);
  const [search,     setSearch]     = useState('');
  const [solOpen,    setSolOpen]    = useState(false);
  const [confirmSim, setConfirmSim] = useState<any>(null);
  const [rechazarSim, setRechazarSim] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);
  const [rechazando, setRechazando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const id = userData?.id;
      if (!id) return;
      const { data, error } = await supabase
        .from('creditos')
        .select('id,tipo,monto,saldo,cuota_mensual,plazo_meses,tasa_interes,estado,anulado,fecha_desembolso,tipo_interes,observaciones,descripcion_soporte,motivo_estado_cambio,created_at')
        .eq('asociado_id', id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;

      const rows = (data ?? []).map((c: any) => ({
        id: c.id, tipo: c.tipo, monto: c.monto, saldo: c.saldo,
        cuotaMensual: c.cuota_mensual, plazo: c.plazo_meses,
        tasaInteres: c.tasa_interes, estadoAprobacion: c.estado,
        estado: c.estado, anulado: !!c.anulado,
        fechaDesembolso: c.fecha_desembolso, tipoInteres: c.tipo_interes,
        observaciones: c.observaciones, descripcionSoporte: c.descripcion_soporte,
        motivoEstadoCambio: c.motivo_estado_cambio,
      }));

      setSims(rows.filter(r => r.estadoAprobacion === 'simulacion'));
      const pend = rows.filter(r => ['pendiente','en_revision','rechazado'].includes(r.estadoAprobacion) && !r.anulado);
      setSolicitudes(pend);
      setCreditos(rows.filter(r => !['simulacion','pendiente','en_revision'].includes(r.estadoAprobacion)));
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [userData?.id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function confirmarSim() {
    if (!confirmSim) return;
    setConfirming(true);
    try {
      const { error } = await supabase.from('creditos').update({
        estado_aprobacion: 'activo',
        estado: 'activo',
      }).eq('id', confirmSim.id);
      if (error) throw error;
      toast.success('¡Crédito activado correctamente!');
      setConfirmSim(null);
      cargar();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setConfirming(false);
    }
  }

  async function rechazarSimFn() {
    if (!rechazarSim) return;
    setRechazando(true);
    try {
      const { error } = await supabase.from('creditos').delete().eq('id', rechazarSim.id);
      if (error) throw error;
      toast.success('Simulación rechazada');
      setRechazarSim(null);
      cargar();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setRechazando(false);
    }
  }

  const misActivos   = creditos.filter(c => !c.anulado && ['activo','desembolsado','en_mora'].includes(c.estadoAprobacion));
  const miSaldo      = misActivos.reduce((s, c) => s + (c.saldo || 0), 0);
  const miCuota      = misActivos.reduce((s, c) => s + (c.cuotaMensual || 0), 0);
  const misEnMora    = misActivos.filter(c => c.estadoAprobacion === 'en_mora').length;

  const filtrados = creditos.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return TIPOS_CREDITO.find(t => t.value === c.tipo)?.label.toLowerCase().includes(q) ||
      (c.estadoAprobacion ?? '').toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q);
  });

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Mis Créditos</h2>
          <p className="text-xs text-muted-foreground">Bienvenido, {userData?.nombre}</p>
        </div>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1.5" onClick={() => setSolOpen(true)}>
          <Plus className="size-4" /> Solicitar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { l: 'Total créditos', v: String(misActivos.length), color: 'text-slate-900' },
          { l: 'Saldo total',    v: formatCurrency(miSaldo),   color: 'text-indigo-700' },
          { l: 'Cuota mensual',  v: miCuota > 0 ? formatCurrency(miCuota) : '—', color: 'text-emerald-700' },
          { l: 'En mora', v: misEnMora > 0 ? String(misEnMora) : '✓ Al día', color: misEnMora > 0 ? 'text-red-600' : 'text-emerald-600' },
        ].map(({ l, v, color }) => (
          <Card key={l} className={`border-0 shadow-sm ${misEnMora > 0 && l === 'En mora' ? 'bg-red-50/50' : ''}`}>
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{l}</p>
              <p className={`text-xl font-bold mt-1 ${color}`}>{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Simulaciones pendientes */}
      {simulaciones.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple-600 text-white">
            <div className="p-2 bg-white/20 rounded-xl shrink-0">
              <Table2 className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">Tienes simulaciones pendientes</p>
              <p className="text-purple-200 text-xs">Revisa y decide si aceptas o rechazas</p>
            </div>
            <Badge className="bg-white text-purple-700 font-black shrink-0">{simulaciones.length}</Badge>
          </div>
          {simulaciones.map(sim => (
            <Card key={sim.id} className="border-2 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-sm">{TIPOS_CREDITO.find(t => t.value === sim.tipo)?.label}</p>
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Simulación</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  {[
                    { l: 'Monto',        v: formatCurrency(sim.monto),        c: 'text-indigo-700' },
                    { l: 'Cuota mensual', v: formatCurrency(sim.cuotaMensual),  c: 'text-purple-700' },
                    { l: 'Plazo',         v: `${sim.plazo} meses`,              c: 'text-slate-700' },
                    { l: 'Tasa EA',       v: sim.tasaInteres > 0 ? `${sim.tasaInteres}%` : '—', c: 'text-orange-600' },
                  ].map(({ l, v, c }) => (
                    <div key={l} className="p-2 bg-muted/40 rounded-lg">
                      <p className="text-[10px] text-muted-foreground uppercase">{l}</p>
                      <p className={`font-bold ${c}`}>{v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={() => setConfirmSim(sim)}>
                    <Check className="size-3.5" /> Aceptar
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-1.5" onClick={() => setRechazarSim(sim)}>
                    <X className="size-3.5" /> Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Solicitudes en proceso */}
      {solicitudes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <Clock className="size-3" /> Mis solicitudes
          </p>
          <div className="space-y-2">
            {solicitudes.map(s => {
              const estadoConfig = ESTADOS_APROBACION.find(e => e.value === s.estadoAprobacion);
              return (
                <Card key={s.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{TIPOS_CREDITO.find(t => t.value === s.tipo)?.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(s.monto)} · {s.plazo} meses
                        </p>
                        {s.motivoEstadoCambio && (
                          <p className="text-xs text-red-600 mt-1">Nota: {s.motivoEstadoCambio}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${estadoBadge(s.estadoAprobacion)}`}>
                        {estadoConfig?.label ?? s.estadoAprobacion}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista de créditos */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar créditos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 text-sm rounded-md border border-input bg-background"
        />
      </div>

      {filtrados.length === 0 && solicitudes.length === 0 && simulaciones.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <CreditCard className="size-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium text-muted-foreground">Sin créditos registrados</p>
            <p className="text-xs text-muted-foreground mt-1">Solicita un crédito con el botón de arriba</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtrados.map(c => (
            <CreditoCard key={c.id} c={c} isAdmin={false} onReload={cargar} />
          ))}
        </div>
      )}

      {solOpen && <SolicitarDialog onClose={() => { setSolOpen(false); cargar(); }} userData={userData} />}

      <AlertDialog open={!!confirmSim} onOpenChange={() => setConfirmSim(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar y activar este crédito?</AlertDialogTitle>
            <AlertDialogDescription>
              El crédito por <strong>{confirmSim ? formatCurrency(confirmSim.monto) : ''}</strong> a{' '}
              <strong>{confirmSim?.plazo} meses</strong> quedará registrado como Activo de inmediato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700" onClick={confirmarSim} disabled={confirming}>
              {confirming ? 'Activando...' : '🎉 Sí, activar crédito'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rechazarSim} onOpenChange={() => setRechazarSim(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar esta simulación?</AlertDialogTitle>
            <AlertDialogDescription>
              La simulación por <strong>{rechazarSim ? formatCurrency(rechazarSim.monto) : ''}</strong> se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={rechazarSimFn} disabled={rechazando}>
              {rechazando ? 'Rechazando...' : '❌ Sí, rechazar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Vista admin ───────────────────────────────────────────────────────────────

function CreditosAdmin() {
  const [loading,    setLoading]   = useState(true);
  const [creditos,   setCreditos]  = useState<any[]>([]);
  const [usuarios,   setUsuarios]  = useState<any[]>([]);
  const [search,     setSearch]    = useState('');
  const [filtroEst,  setFiltroEst] = useState('');
  const [crearOpen,  setCrearOpen] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, uRes] = await Promise.all([
        supabase.from('creditos').select('id,tipo,monto,saldo,cuota_mensual,plazo_meses,tasa_interes,estado,anulado,fecha_desembolso,tipo_interes,observaciones,descripcion_soporte,motivo_estado_cambio,created_at,nota_rechazo,asociado_id').order('created_at', { ascending: false }),
        supabase.from('usuarios').select('id,nombre,cedula')
      ]);

      if (cRes.error) throw cRes.error;
      
      const asocMap = Object.fromEntries((uRes.data ?? []).map(u => [u.id, u]));

      setCreditos((cRes.data ?? []).map((c: any) => ({
        id: c.id, tipo: c.tipo, monto: c.monto, saldo: c.saldo,
        cuotaMensual: c.cuota_mensual, plazo: c.plazo_meses,
        tasaInteres: c.tasa_interes, estadoAprobacion: c.estado,
        estado: c.estado, anulado: !!c.anulado,
        fechaDesembolso: c.fecha_desembolso, tipoInteres: c.tipo_interes,
        observaciones: c.observaciones, descripcionSoporte: c.descripcion_soporte,
        motivoEstadoCambio: c.motivo_estado_cambio, notaRechazo: c.nota_rechazo,
        asociado_id: c.asociado_id,
        asociado: asocMap[c.asociado_id]?.nombre ?? '—',
        cedula: asocMap[c.asociado_id]?.cedula ?? '',
      })));
      setUsuarios(uRes.data ?? []);
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const activos      = creditos.filter(c => !c.anulado && !['simulacion','pendiente','en_revision','rechazado'].includes(c.estadoAprobacion));
  const rechazados   = creditos.filter(c => !c.anulado && c.estadoAprobacion === 'rechazado');
  const solicitudes  = creditos.filter(c => !c.anulado && ['pendiente','en_revision'].includes(c.estadoAprobacion));
  const simulaciones = creditos.filter(c => !c.anulado && c.estadoAprobacion === 'simulacion');

  const totalCartera  = activos.reduce((s, c) => s + (c.saldo || 0), 0);
  const totalCuota    = activos.reduce((s, c) => s + (c.cuotaMensual || 0), 0);
  const enMora        = activos.filter(c => c.estadoAprobacion === 'en_mora').length;

  function filtrar(list: any[]) {
    return list.filter(c => {
      if (filtroEst && c.estadoAprobacion !== filtroEst) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return c.asociado.toLowerCase().includes(q) || c.cedula.includes(search);
      }
      return true;
    });
  }

  async function aprobar(sol: any) {
    const { error } = await supabase.from('creditos').update({ estado_aprobacion: 'aprobado', estado: 'aprobado' }).eq('id', sol.id);
    if (error) { toast.error('Error al aprobar'); return; }
    toast.success('Solicitud aprobada');
    cargar();
  }

  async function rechazar(sol: any, nota: string) {
    const { error } = await supabase.from('creditos').update({ estado_aprobacion: 'rechazado', nota_rechazo: nota }).eq('id', sol.id);
    if (error) { toast.error('Error al rechazar'); return; }
    toast.success('Solicitud rechazada');
    cargar();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Gestión de Créditos</h2>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 gap-1" onClick={() => setCrearOpen(true)}>
            <Plus className="size-3.5" /> Nuevo
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Administra los créditos del fondo</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { l: 'Créditos activos', v: String(activos.length),          color: 'text-slate-900',    bg: 'bg-blue-50',    icon: CreditCard },
          { l: 'Saldo total',       v: formatCurrency(totalCartera),    color: 'text-indigo-700',   bg: 'bg-indigo-50',  icon: Banknote },
          { l: 'Recaudo mensual',   v: formatCurrency(totalCuota),      color: 'text-emerald-700',  bg: 'bg-emerald-50', icon: CheckCircle2 },
          { l: 'En mora',           v: String(enMora), color: enMora > 0 ? 'text-red-600' : 'text-emerald-600', bg: enMora > 0 ? 'bg-red-50' : 'bg-slate-50', icon: AlertTriangle },
        ].map(({ l, v, color, bg, icon: Icon }) => (
          <Card key={l} className={`border-0 shadow-sm ${bg}`}>
            <CardContent className="p-4">
              <Icon className={`size-5 ${color} mb-1`} />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{l}</p>
              <p className={`text-xl font-bold ${color}`}>{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar asociado o cédula..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm rounded-md border border-input bg-background"
          />
        </div>
        <select
          value={filtroEst}
          onChange={e => setFiltroEst(e.target.value)}
          className="h-9 px-2 text-xs rounded-md border border-input bg-background"
        >
          <option value="">Todos</option>
          {ESTADOS_APROBACION.filter(e => !['simulacion'].includes(e.value)).map(e => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="activos">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="activos" className="text-xs relative">
            Activos
            {activos.length > 0 && <span className="ml-1 text-[10px]">({activos.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="solicitudes" className="text-xs relative">
            Solicit.
            {solicitudes.length > 0 && (
              <span className="absolute -top-1 -right-1 size-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {solicitudes.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="simulaciones" className="text-xs relative">
            Sims.
            {simulaciones.length > 0 && (
              <span className="absolute -top-1 -right-1 size-4 rounded-full bg-purple-500 text-white text-[9px] font-bold flex items-center justify-center">
                {simulaciones.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rechazados" className="text-xs">
            Rechaz.
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="space-y-2 mt-3">
          {filtrar(activos).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sin créditos activos</p>
          ) : filtrar(activos).map(c => (
            <CreditoCard key={c.id} c={c} isAdmin onReload={cargar} />
          ))}
        </TabsContent>

        <TabsContent value="solicitudes" className="space-y-3 mt-3">
          {solicitudes.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="size-12 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No hay solicitudes pendientes</p>
            </div>
          ) : solicitudes.map(sol => (
            <SolicitudAdminCard key={sol.id} sol={sol} onAprobar={aprobar} onRechazar={rechazar} />
          ))}
        </TabsContent>

        <TabsContent value="simulaciones" className="space-y-2 mt-3">
          {simulaciones.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sin simulaciones pendientes</p>
          ) : simulaciones.map(c => (
            <Card key={c.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{c.asociado}</p>
                    <p className="text-xs text-muted-foreground">{TIPOS_CREDITO.find(t => t.value === c.tipo)?.label}</p>
                    <p className="text-xs text-purple-600 font-medium">{formatCurrency(c.monto)} · {c.plazo} meses</p>
                  </div>
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">Simulación</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="rechazados" className="space-y-2 mt-3">
          {filtrar(rechazados).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sin créditos rechazados</p>
          ) : filtrar(rechazados).map(c => (
            <CreditoCard key={c.id} c={c} isAdmin onReload={cargar} />
          ))}
        </TabsContent>
      </Tabs>

      <CreditoDialogCrearMobile open={crearOpen} onClose={() => setCrearOpen(false)} usuarios={usuarios} onCreated={cargar} />
    </div>
  );
}

function SolicitudAdminCard({
  sol, onAprobar, onRechazar,
}: {
  sol: any;
  onAprobar: (s: any) => void;
  onRechazar: (s: any, nota: string) => void;
}) {
  const [rechazarOpen, setRechazarOpen] = useState(false);
  const [nota, setNota]                 = useState('');

  return (
    <>
      <Card className={`border ${sol.estadoAprobacion === 'en_revision' ? 'border-blue-200 bg-blue-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-sm">{sol.asociado}</p>
              <p className="text-xs text-muted-foreground">{sol.cedula}</p>
              <Badge variant="outline" className={`text-[10px] mt-0.5 ${estadoBadge(sol.estadoAprobacion)}`}>
                {ESTADOS_APROBACION.find(e => e.value === sol.estadoAprobacion)?.label ?? sol.estadoAprobacion}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-indigo-700">{formatCurrency(sol.monto)}</p>
              <p className="text-xs text-muted-foreground">{sol.plazo} meses</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 bg-white/80 rounded-lg text-center">
              <p className="text-muted-foreground text-[10px]">Tipo</p>
              <p className="font-semibold text-[11px]">{TIPOS_CREDITO.find(t => t.value === sol.tipo)?.label ?? sol.tipo}</p>
            </div>
            <div className="p-2 bg-white/80 rounded-lg text-center">
              <p className="text-muted-foreground text-[10px]">Cuota est.</p>
              <p className="font-semibold text-emerald-700">{formatCurrency(sol.cuotaMensual || calcularCuota(sol.monto, sol.tasaInteres, sol.plazo))}</p>
            </div>
            <div className="p-2 bg-white/80 rounded-lg text-center">
              <p className="text-muted-foreground text-[10px]">Tasa EA</p>
              <p className="font-semibold text-orange-600">{sol.tasaInteres > 0 ? `${sol.tasaInteres}%` : '—'}</p>
            </div>
          </div>

          {sol.descripcionSoporte && (
            <p className="text-xs text-muted-foreground bg-white/60 rounded-lg px-3 py-2">
              <span className="font-semibold text-foreground">Destino: </span>{sol.descripcionSoporte}
            </p>
          )}

          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={() => onAprobar(sol)}>
              <Check className="size-3.5" /> Aprobar
            </Button>
            <Button size="sm" variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-1.5" onClick={() => setRechazarOpen(true)}>
              <X className="size-3.5" /> Rechazar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={rechazarOpen} onOpenChange={setRechazarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><X className="size-5 text-red-600" /> Rechazar solicitud</DialogTitle>
            <DialogDescription>Solicitud de {sol.asociado} por {formatCurrency(sol.monto)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo de rechazo (opcional)</Label>
            <Textarea placeholder="Explica el motivo del rechazo..." value={nota} onChange={e => setNota(e.target.value)} rows={3} />
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => { onRechazar(sol, nota); setRechazarOpen(false); }}>
              Confirmar rechazo
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setRechazarOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function CreditosScreen() {
  const { userRole, userData } = useAuth();
  if (userRole === 'admin') return <CreditosAdmin />;
  return <CreditosAsociado userData={userData} />;
}
