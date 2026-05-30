import { Landmark, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import { toast } from 'sonner';
import { formatCurrency } from '../../lib/formatters';
import type { CreditosHook } from './useCreditos';

interface CreditoDialogDesembolsoProps {
  hook: CreditosHook;
}

export default function CreditoDialogDesembolso({ hook }: CreditoDialogDesembolsoProps) {
  const {
    isDesembolsoOpen, setIsDesembolsoOpen,
    selectedItem,
    desembolsoFecha, setDesembolsoFecha,
    desembolsoReferencia, setDesembolsoReferencia,
    desembolsoArchivo, setDesembolsoArchivo,
    handleRegistrarDesembolso,
    guardandoDesembolso,
  } = hook;

  return (
    <Dialog open={isDesembolsoOpen} onOpenChange={(open) => {
      setIsDesembolsoOpen(open);
      if (!open) { setDesembolsoFecha(''); setDesembolsoReferencia(''); setDesembolsoArchivo(null); }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="size-5 text-indigo-600" /> Registrar desembolso
          </DialogTitle>
          <DialogDescription>
            {selectedItem && `${selectedItem.asociado} · ${formatCurrency(selectedItem.monto)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Fecha de desembolso */}
          <div className="space-y-1.5">
            <Label htmlFor="desembolso-fecha">
              Fecha de desembolso <span className="text-red-500">*</span>
            </Label>
            <Input
              id="desembolso-fecha"
              type="date"
              value={desembolsoFecha}
              onChange={(e) => setDesembolsoFecha(e.target.value)}
            />
          </div>

          {/* Referencia */}
          <div className="space-y-1.5">
            <Label htmlFor="desembolso-ref">
              Referencia de transferencia <span className="text-xs text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Input
              id="desembolso-ref"
              placeholder="Ej. REF123456789"
              value={desembolsoReferencia}
              onChange={(e) => setDesembolsoReferencia(e.target.value)}
            />
          </div>

          {/* Comprobante */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Upload className="size-3.5 text-slate-400" />
              Comprobante de transferencia <span className="text-xs text-slate-400 font-normal">(opcional)</span>
            </Label>
            <div
              className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-colors ${
                desembolsoArchivo
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100'
              }`}
              onClick={() => document.getElementById('desembolso-file-input')?.click()}
            >
              <input
                id="desembolso-file-input"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 5 * 1024 * 1024) {
                    toast.error('El archivo supera los 5 MB permitidos');
                    return;
                  }
                  setDesembolsoArchivo(f);
                }}
              />
              {desembolsoArchivo ? (
                <>
                  <CheckCircle2 className="size-6 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-700 text-center break-all">{desembolsoArchivo.name}</p>
                  <p className="text-xs text-slate-500">{(desembolsoArchivo.size / 1024).toFixed(0)} KB · haz clic para cambiar</p>
                </>
              ) : (
                <>
                  <Upload className="size-6 text-indigo-400" />
                  <p className="text-sm font-medium text-indigo-700">Haz clic para adjuntar el comprobante</p>
                  <p className="text-xs text-slate-500">PDF, JPG o PNG · máx. 5 MB</p>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <AlertTriangle className="size-3 text-slate-300" />
              El comprobante se guardará de forma segura. Solo visible para el asociado y el admin.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDesembolsoOpen(false)}>Cancelar</Button>
          <Button
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            disabled={guardandoDesembolso || !desembolsoFecha}
            onClick={handleRegistrarDesembolso}
          >
            {guardandoDesembolso
              ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> Guardando...</>
              : <><Landmark className="size-4" /> Registrar desembolso</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
