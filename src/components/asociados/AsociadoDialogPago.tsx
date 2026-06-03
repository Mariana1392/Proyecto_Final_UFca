import { CheckCircle2, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: any;
  comprobante: File | null;
  setComprobante: (f: File | null) => void;
  saving: boolean;
  onConfirm: () => void;
}

export function AsociadoDialogPago({ open, onOpenChange, solicitud, comprobante, setComprobante, saving, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" /> Confirmar pago de activación
          </DialogTitle>
          <DialogDescription>
            Al confirmar, la cuenta quedará completamente activa y el asociado tendrá acceso a todos los módulos.
          </DialogDescription>
        </DialogHeader>
        {solicitud && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
              <p className="font-semibold text-slate-800">{solicitud.nombres} {solicitud.apellidos}</p>
              <p className="text-slate-500 text-xs">CC {solicitud.cedula}</p>
              {solicitud.monto_ahorro_propuesto && (
                <p className="text-emerald-700 text-xs mt-1 font-medium">
                  Aporte propuesto:{' '}
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(solicitud.monto_ahorro_propuesto))}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Comprobante de pago <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
                <Upload className="size-5 text-slate-400" />
                <span className="text-sm text-slate-500">
                  {comprobante ? comprobante.name : 'Subir comprobante (PDF, imagen)'}
                </span>
                <input
                  type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                  onChange={e => setComprobante(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => { onOpenChange(false); setComprobante(null); }}>Cancelar</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" disabled={saving} onClick={onConfirm}>
            {saving
              ? <><div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Procesando...</>
              : <><CheckCircle2 className="size-4" /> Confirmar pago</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
