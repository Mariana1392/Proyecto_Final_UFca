import { useState } from 'react';
import { AlertTriangle, Ban, DollarSign, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import type { DatosExpulsion } from './useExpulsion';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asociado: any;
  datos: DatosExpulsion | null;
  ejecutando: boolean;
  onConfirm: (asociadoId: string, motivo: string, adminNombre: string) => Promise<boolean>;
  adminNombre: string;
  onSuccess?: () => void;
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

export function ExpulsionDialog({
  open,
  onOpenChange,
  asociado,
  datos,
  ejecutando,
  onConfirm,
  adminNombre,
  onSuccess
}: Props) {
  const [motivo, setMotivo] = useState('');

  const handleConfirm = async () => {
    if (!motivo.trim() || !asociado) return;
    const ok = await onConfirm(asociado.id, motivo.trim(), adminNombre);
    if (ok) {
      setMotivo('');
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <Ban className="size-5" /> Suspender / Expulsar asociado
          </DialogTitle>
          <DialogDescription>
            {asociado?.nombre} — Revisa el desglose financiero antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {datos?.loading ? (
          <div className="flex items-center justify-center py-10 gap-3 text-slate-500">
            <Loader2 className="size-5 animate-spin" />
            Calculando desglose financiero…
          </div>
        ) : datos ? (
          <div className="space-y-4 py-1">
            {/* Financial breakdown */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Ahorro permanente</span>
                <span className="font-semibold text-emerald-700">+{formatCOP(datos.totalAhorroPermanente)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Ahorro voluntario</span>
                <span className="font-semibold text-emerald-700">+{formatCOP(datos.totalAhorroVoluntario)}</span>
              </div>
              <hr className="border-slate-200" />
              {datos.saldoCreditoPendiente > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Saldo crédito pendiente</span>
                  <span className="font-semibold text-red-600">−{formatCOP(datos.saldoCreditoPendiente)}</span>
                </div>
              )}
              {datos.moraCreditoAcumulada > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Mora crédito acumulada</span>
                  <span className="font-semibold text-red-600">−{formatCOP(datos.moraCreditoAcumulada)}</span>
                </div>
              )}
              {datos.moraAhorroAcumulada > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Mora ahorro acumulada</span>
                  <span className="font-semibold text-red-600">−{formatCOP(datos.moraAhorroAcumulada)}</span>
                </div>
              )}
              <hr className="border-slate-300" />
              <div className="flex justify-between text-base font-bold">
                <span>Neto a devolver</span>
                <span className={datos.esPerdidaFondo ? 'text-red-700' : 'text-emerald-700'}>
                  {datos.esPerdidaFondo ? `−${formatCOP(datos.montoPerdida)}` : formatCOP(datos.netoADevolver)}
                </span>
              </div>
            </div>

            {/* Loss warning */}
            {datos.esPerdidaFondo && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">⚠️ Pérdida para el fondo</p>
                  <p className="text-xs text-red-700 mt-1">
                    El ahorro del asociado no alcanza a cubrir sus deudas. El fondo asumirá una pérdida de <strong>{formatCOP(datos.montoPerdida)}</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Motivo */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-red-700">Motivo de la expulsión <span className="text-red-500">*</span></Label>
              <textarea
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 min-h-[80px] resize-none"
                placeholder="Describe el motivo de la expulsión…"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
              />
            </div>

            {/* Info box */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <DollarSign className="size-4 shrink-0 mt-0.5" />
              <span>
                Al confirmar: se creará una liquidación tipo "Expulsión", se cerrarán todos los créditos y cuentas de ahorro, y el asociado quedará suspendido. Solo podrá reingresar a partir de enero del año siguiente.
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-4 text-center">No se pudo cargar los datos. Cierra e intenta de nuevo.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ejecutando}>Cancelar</Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            disabled={ejecutando || !motivo.trim() || datos?.loading}
            onClick={handleConfirm}
          >
            {ejecutando
              ? <><Loader2 className="size-4 animate-spin" /> Procesando…</>
              : <><Ban className="size-4" /> Confirmar expulsión</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
