// ── AhorroDialogAporte.tsx ────────────────────────────────────────────────────
// Diálogo para que el administrador registre un aporte al ahorro permanente.

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import { AlertTriangle, Paperclip, XCircle, Clock } from 'lucide-react';
import { formatCurrency, parseCurrencyInput } from '../../lib/formatters';

const fmtMonto = (v: string) => {
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return isNaN(num)
    ? ''
    : new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface AhorroDialogAporteProps {
  open:                boolean;
  onOpenChange:        (open: boolean) => void;
  selectedItem:        any;
  movimientosDetalle:  any[];
  formAporteMonto:     string;
  setFormAporteMonto:  (v: string) => void;
  formAporteFecha:     string;
  setFormAporteFecha:  (v: string) => void;
  formAporteDesc:      string;
  setFormAporteDesc:   (v: string) => void;
  formAportePeriodoId: string;
  setFormAportePeriodoId: (v: string) => void;
  formComprobante:     File | null;
  setFormComprobante:  (f: File | null) => void;
  periodos:            any[];
  handleRegistrarAporte: () => void;
  savingAporte:        boolean;
}

export default function AhorroDialogAporte({
  open, onOpenChange, selectedItem, movimientosDetalle,
  formAporteMonto, setFormAporteMonto,
  formAporteFecha, setFormAporteFecha,
  formAporteDesc, setFormAporteDesc,
  formAportePeriodoId, setFormAportePeriodoId,
  formComprobante, setFormComprobante,
  periodos, handleRegistrarAporte, savingAporte,
}: AhorroDialogAporteProps) {

  const saldoActual = Number(
    [...movimientosDetalle]
      .filter(m => !m.anulado)
      .sort((a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime())[0]
      ?.saldo_despues ?? selectedItem?.montoAhorrado
  ) || 0;

  const montoNum   = parseCurrencyInput(formAporteMonto);
  const montoError = !!formAporteMonto && montoNum < 100_000;
  const hoy        = hoyLocal();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Aporte</DialogTitle>
          <DialogDescription>
            {selectedItem && `Asociado: ${selectedItem.asociado} — Saldo actual: ${formatCurrency(saldoActual)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">

          {/* Advertencia: ya pagó este mes */}
          {selectedItem?.pagadoEsteMes && !selectedItem?.enMora && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700">Ya se registró el aporte de este mes</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Puedes continuar si lo consideras necesario. Quedará registrado como aporte adicional.
                </p>
              </div>
            </div>
          )}

          {/* Alerta de mora */}
          {selectedItem?.enMora && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-red-600 shrink-0" />
                <p className="text-sm font-semibold text-red-700">Este asociado tiene mora pendiente</p>
              </div>
              <p className="text-xs text-red-600">
                {selectedItem.diasMora} día{selectedItem.diasMora !== 1 ? 's' : ''} desde el día 16 ·{' '}
                <span className="font-bold">{formatCurrency(selectedItem.montoMora)}</span> de mora
                ($2.000 COP/día)
              </p>
            </div>
          )}

          {/* Monto */}
          <div className="space-y-1.5">
            <Label htmlFor="aporte-monto">Monto del aporte *</Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm pointer-events-none select-none">
                $
              </span>
              <Input
                id="aporte-monto"
                type="text"
                inputMode="numeric"
                placeholder="100.000"
                value={formAporteMonto}
                onChange={e => setFormAporteMonto(fmtMonto(e.target.value))}
                className={`pl-8 ${montoError ? 'border-red-400 focus-visible:ring-red-400/20' : ''}`}
              />
            </div>
            {montoError && (
              <p className="text-xs flex items-center gap-1 text-amber-600">
                <AlertTriangle className="size-3 shrink-0" />
                El valor ingresado es menor al monto estipulado.
              </p>
            )}
          </div>

          {/* Fecha — solo hoy */}
          <div className="space-y-1.5">
            <Label htmlFor="aporte-fecha">Fecha del aporte *</Label>
            <Input
              id="aporte-fecha"
              type="date"
              value={formAporteFecha}
              min={hoy}
              max={hoy}
              onChange={e => setFormAporteFecha(e.target.value)}
            />
            <p className="text-xs text-slate-400">Solo se permite la fecha de hoy</p>
          </div>

          {/* Período */}
          <div className="space-y-2">
            <Label htmlFor="aporte-periodo">Período contable *</Label>
            <Select value={formAportePeriodoId} onValueChange={setFormAportePeriodoId}>
              <SelectTrigger id="aporte-periodo">
                <SelectValue placeholder="Selecciona un período..." />
              </SelectTrigger>
              <SelectContent>
                {periodos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.nombre}
                      {p.estado === 'activo' && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                          Activo
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="aporte-desc">Descripción <span className="text-slate-400 font-normal text-xs">(opcional)</span></Label>
            <Input
              id="aporte-desc"
              type="text"
              placeholder="Ej: Aporte mensual abril 2026"
              value={formAporteDesc}
              onChange={e => setFormAporteDesc(e.target.value)}
            />
          </div>

          {/* Comprobante */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Comprobante de pago <span className="text-xs font-normal text-slate-400">(opcional)</span>
            </Label>
            <label
              htmlFor="aporte-comprobante"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all select-none ${
                formComprobante
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40'
              }`}
            >
              <div className={`p-1.5 rounded-lg shrink-0 ${formComprobante ? 'bg-emerald-100' : 'bg-slate-100 dark:bg-slate-700'}`}>
                <Paperclip className={`size-4 ${formComprobante ? 'text-emerald-600' : 'text-slate-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                {formComprobante ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 truncate">{formComprobante.name}</p>
                    <p className="text-xs text-emerald-500 mt-0.5">{(formComprobante.size / 1024).toFixed(0)} KB · Listo para subir</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Adjuntar imagen o PDF</p>
                    <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, PDF — máx. 10 MB</p>
                  </>
                )}
              </div>
              {formComprobante && (
                <button
                  type="button"
                  onClick={e => { e.preventDefault(); setFormComprobante(null); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                >
                  <XCircle className="size-4" />
                </button>
              )}
            </label>
            <input
              id="aporte-comprobante"
              type="file"
              accept="image/*,.pdf"
              className="sr-only"
              onChange={e => setFormComprobante(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={savingAporte}
          >
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleRegistrarAporte}
            disabled={savingAporte || montoError || !formAporteMonto || !formAporteFecha}
          >
            {savingAporte ? 'Guardando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
