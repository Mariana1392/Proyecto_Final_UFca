import { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../components/ui/dialog';
import {
  ReceiptText, CheckCircle2, Clock, DollarSign, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/formatters';
import { TIPOS_LIQUIDACION } from '../lib/constants';

interface Liq {
  id: string;
  asociado: string;
  cedula: string;
  asociado_id: string;
  tipo: string;
  estado: string;
  motivo: string;
  montoFinal: number;
  anulado: boolean;
  createdAt: string;
  fechaCorte: string;
  conceptos: any[];
  observaciones: string;
}

function estadoBadge(estado: string) {
  if (estado === 'Pagada') return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
  if (estado === 'Anulada') return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700';
  return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
}

function parseLiq(row: any): Liq {
  const det = row.detalle || {};
  const conceptos = (() => {
    if (Array.isArray(det.conceptos)) return det.conceptos;
    if (Array.isArray(row.conceptos)) return row.conceptos;
    try { return JSON.parse(det.conceptos || row.conceptos || '[]'); } catch { return []; }
  })();
  return {
    id:          row.id,
    asociado:    row.usuarios?.nombre ?? row.asociado_nombre ?? '—',
    cedula:      row.usuarios?.cedula ?? row.cedula ?? '',
    asociado_id: row.asociado_id,
    tipo:        row.tipo ?? '',
    estado:      row.estado ?? det.estado ?? 'En proceso',
    motivo:      row.motivo ?? det.motivo ?? '',
    montoFinal:  row.monto_total ?? det.montoFinal ?? 0,
    anulado:     !!(row.anulado ?? det.anulado),
    createdAt:   row.created_at ?? row.fecha ?? '',
    fechaCorte:  row.fecha_corte ?? det.fechaCorte ?? '',
    conceptos,
    observaciones: row.observaciones ?? det.observaciones ?? '',
  };
}

function LiqCard({ liq, isAdmin, onCambiarEstado }: { liq: Liq; isAdmin: boolean; onCambiarEstado?: (id: string, nuevo: string) => void }) {
  const [open, setOpen] = useState(false);
  const tipoLabel = TIPOS_LIQUIDACION.find(t => t.value === liq.tipo)?.label ?? liq.tipo;

  return (
    <>
      <Card className={`border-0 shadow-sm ${liq.anulado ? 'opacity-60' : ''}`} onClick={() => setOpen(true)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              {isAdmin && <p className="text-sm font-semibold text-foreground">{liq.asociado}</p>}
              {isAdmin && <p className="text-xs text-muted-foreground">{liq.cedula}</p>}
              <p className="text-xs font-medium text-foreground mt-0.5">{tipoLabel}</p>
            </div>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${estadoBadge(liq.anulado ? 'Anulada' : liq.estado)}`}>
              {liq.anulado ? 'Anulada' : liq.estado}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><DollarSign className="size-3" /> {formatCurrency(liq.montoFinal)}</span>
            <span>{liq.createdAt?.split('T')[0]}</span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="size-5 text-blue-600" /> Detalle de liquidación
            </DialogTitle>
            <DialogDescription>{isAdmin ? liq.asociado : tipoLabel}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'Tipo',        v: tipoLabel },
                { l: 'Estado',      v: liq.anulado ? 'Anulada' : liq.estado },
                { l: 'Monto final', v: formatCurrency(liq.montoFinal) },
                { l: 'Fecha corte', v: liq.fechaCorte || '—' },
                { l: 'Registrada',  v: liq.createdAt?.split('T')[0] },
                { l: 'Motivo',      v: liq.motivo || '—' },
              ].map(({ l, v }) => (
                <div key={l} className="p-2.5 bg-muted/50 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{l}</p>
                  <p className="text-xs font-semibold mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            {liq.conceptos.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2">Conceptos</p>
                <div className="space-y-1.5">
                  {liq.conceptos.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs px-3 py-2 bg-muted/30 rounded-lg">
                      <span>{c.nombre}</span>
                      <span className={`font-semibold ${c.tipo === 'credito' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {c.tipo === 'credito' ? '+' : '-'}{formatCurrency(parseFloat(c.monto) || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {liq.observaciones && (
              <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Observaciones: </span>{liq.observaciones}
              </div>
            )}
          </div>
          <DialogFooter className="flex items-center justify-between w-full">
            {isAdmin && !liq.anulado && onCambiarEstado && (
              <select
                value={liq.estado}
                onChange={e => onCambiarEstado(liq.id, e.target.value)}
                className="h-9 px-2 text-xs rounded-md border border-input bg-background"
              >
                <option value="En proceso">En proceso</option>
                <option value="Pagada">Pagada</option>
              </select>
            )}
            <Button variant="outline" className={!(isAdmin && !liq.anulado) ? 'ml-auto' : ''} onClick={() => setOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Diálogo Crear Liquidación Móvil ───────────────────────────────────────────

function LiquidacionDialogCrearMobile({ open, onClose, usuarios, onCreated }: { open: boolean, onClose: () => void, usuarios: any[], onCreated: () => void }) {
  const [formAsoc, setFormAsoc] = useState('');
  const [formTipo, setFormTipo] = useState('Renuncia');
  const [formMonto, setFormMonto] = useState('');
  const [formObservaciones, setFormObservaciones] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!formAsoc) return toast.error('Selecciona un asociado');
    const monto = parseFloat(formMonto.replace(/\./g, '').replace(/[^\d]/g, '')) || 0;
    
    setSaving(true);
    try {
      const payload = {
        asociado_id: formAsoc,
        tipo: formTipo,
        monto_total: monto,
        fecha: new Date().toISOString().split('T')[0],
        estado: 'En proceso',
        anulado: false,
        observaciones: formObservaciones,
        detalle: { montoFinal: monto, estado: 'En proceso' }
      };

      const { error } = await supabase.from('liquidaciones').insert(payload);
      if (error) throw error;
      
      toast.success('Liquidación registrada correctamente');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error('Error al crear liquidación: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Liquidación</DialogTitle>
          <DialogDescription>Registra la liquidación de un asociado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Asociado</Label>
            <select
              value={formAsoc}
              onChange={e => setFormAsoc(e.target.value)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccione asociado...</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.cedula})</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo de Retiro</Label>
            <select
              value={formTipo}
              onChange={e => setFormTipo(e.target.value)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TIPOS_LIQUIDACION.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Monto a Liquidar</Label>
            <Input type="text" placeholder="Ej: 1.500.000" value={formMonto} onChange={e => {
              const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
              setFormMonto(raw ? parseInt(raw, 10).toLocaleString('es-CO') : '');
            }} />
          </div>
          <div className="space-y-1.5">
            <Label>Observaciones (opcional)</Label>
            <Textarea 
              rows={2} 
              value={formObservaciones} 
              onChange={e => setFormObservaciones(e.target.value)} 
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

export default function LiquidacionesScreen() {
  const { userData, userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const [loading, setLoading]     = useState(true);
  const [liquidaciones, setLiqs]  = useState<Liq[]>([]);
  const [usuarios, setUsuarios]   = useState<any[]>([]);
  const [search, setSearch]       = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [crearOpen, setCrearOpen] = useState(false);

  useEffect(() => { cargar(); }, [userData?.id]);

  async function cargar() {
    setLoading(true);
    try {
      const [liqsRes, usrRes] = await Promise.all([
        (async () => {
          let q = supabase.from('liquidaciones')
            .select('id,tipo,estado,monto_total,anulado,created_at,fecha_corte,detalle,observaciones,asociado_id')
            .order('created_at', { ascending: false });
          if (!isAdmin && userData?.id) q = (q as any).eq('asociado_id', userData.id);
          return q;
        })(),
        isAdmin ? supabase.from('usuarios').select('id,nombre,cedula').order('nombre') : Promise.resolve({ data: [] })
      ]);
      
      if (liqsRes.error) throw liqsRes.error;
      const usuariosLoad = usrRes.data ?? [];
      setUsuarios(usuariosLoad);

      const asocMap = Object.fromEntries(usuariosLoad.map(u => [u.id, u]));
      if (!isAdmin && userData?.id) {
        asocMap[userData.id] = { nombre: userData.name || userData.nombre, cedula: userData.cedula };
      }

      setLiqs((liqsRes.data ?? []).map(l => parseLiq({ ...l, usuarios: asocMap[l.asociado_id] })));

    } catch (err: any) {
      toast.error('Error al cargar liquidaciones: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleCambiarEstado = async (id: string, nuevoEstado: string) => {
    try {
      const { error } = await supabase.rpc('actualizar_liquidacion', {
        p_id: id,
        p_estado: nuevoEstado,
      });
      if (error) throw error;
      setLiqs(prev => prev.map(l => l.id === id ? { ...l, estado: nuevoEstado } : l));
      toast.success('Estado de liquidación actualizado');
    } catch (err: any) {
      toast.error('Error al actualizar: ' + err.message);
    }
  };

  const visibles = liquidaciones.filter(l => {
    if (filtroEstado && !l.anulado && l.estado !== filtroEstado) return false;
    if (filtroEstado === 'Anulada' && !l.anulado) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return l.asociado.toLowerCase().includes(q) || l.cedula.includes(search);
    }
    return true;
  });

  const activas   = visibles.filter(l => !l.anulado);
  const anuladas  = visibles.filter(l => l.anulado);
  const total     = liquidaciones.filter(l => !l.anulado).reduce((s, l) => s + (l.montoFinal || 0), 0);
  const pagadas   = liquidaciones.filter(l => !l.anulado && l.estado === 'Pagada').length;
  const enProceso = liquidaciones.filter(l => !l.anulado && l.estado !== 'Pagada').length;

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {isAdmin ? 'Gestión de Liquidaciones' : 'Mis Liquidaciones'}
          </h2>
          {isAdmin && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 gap-1" onClick={() => setCrearOpen(true)}>
              <Plus className="size-3.5" /> Nueva
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {isAdmin ? 'Administra las liquidaciones del fondo' : 'Estado de tus liquidaciones'}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: 'Total', v: formatCurrency(total), icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { l: 'Pagadas', v: String(pagadas), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { l: 'En proceso', v: String(enProceso), icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(({ l, v, icon: Icon, color, bg }) => (
          <Card key={l} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mx-auto mb-1`}>
                <Icon className={`size-4 ${color}`} />
              </div>
              <p className="text-[10px] text-muted-foreground">{l}</p>
              <p className={`text-sm font-bold ${color}`}>{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      {isAdmin && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar por nombre o cédula..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 h-9 px-3 text-sm rounded-md border border-input bg-background"
          />
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="h-9 px-2 text-xs rounded-md border border-input bg-background"
          >
            <option value="">Todos</option>
            <option value="En proceso">En proceso</option>
            <option value="Pagada">Pagada</option>
            <option value="Anulada">Anulada</option>
          </select>
        </div>
      )}

      {/* Lista activas */}
      {activas.length === 0 && anuladas.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <ReceiptText className="size-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium text-muted-foreground">Sin liquidaciones</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isAdmin ? 'No hay liquidaciones registradas.' : 'No tienes liquidaciones registradas.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activas ({activas.length})</p>
              {activas.map(l => <LiqCard key={l.id} liq={l} isAdmin={isAdmin} onCambiarEstado={isAdmin ? handleCambiarEstado : undefined} />)}
            </div>
          )}
          {anuladas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anuladas ({anuladas.length})</p>
              {anuladas.map(l => <LiqCard key={l.id} liq={l} isAdmin={isAdmin} />)}
            </div>
          )}
        </>
      )}

      {isAdmin && (
        <LiquidacionDialogCrearMobile open={crearOpen} onClose={() => setCrearOpen(false)} usuarios={usuarios} onCreated={cargar} />
      )}
    </div>
  );
}
