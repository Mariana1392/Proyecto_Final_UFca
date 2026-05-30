// ── AhorroVoluntarioAlertDialogs.tsx ─────────────────────────────────────────
// Todos los AlertDialogs y el diálogo de preview PDF del módulo.

import { AlertTriangle, FileText, TrendingUp, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { formatCurrency } from '../../lib/formatters';
import { parseCurrencyInput } from './useAhorroVoluntario';
import { toast } from 'sonner';

interface AhorroVoluntarioAlertDialogsProps {
  // ── Anular ──────────────────────────────────────────────────────────────────
  isDeleteDialogOpen:    boolean;
  setIsDeleteDialogOpen: (v: boolean) => void;
  selectedItem:          any;
  setSelectedItem:       (v: any) => void;
  justificacionAnulacion:    string;
  setJustificacionAnulacion: (v: string) => void;
  handleAnular:          () => void;

  // ── Toggle estado ────────────────────────────────────────────────────────────
  isToggleEstadoDialogOpen:    boolean;
  setIsToggleEstadoDialogOpen: (v: boolean) => void;
  handleToggleEstado:          (id: string) => void;

  // ── Saldo inicial bajo ───────────────────────────────────────────────────────
  isConfirmSaldoBajoVolOpen:    boolean;
  setIsConfirmSaldoBajoVolOpen: (v: boolean) => void;
  formSaldoInicial:             string;
  montoMinimo:                  number;
  handleSaveAhorro:             (forzar?: boolean) => void;

  // ── Movimiento bajo ───────────────────────────────────────────────────────────
  isConfirmMovBajoVolOpen:    boolean;
  setIsConfirmMovBajoVolOpen: (v: boolean) => void;
  formMovMonto:               string;
  ejecutarRegistrarMovimiento: () => void;

  // ── PDF preview ──────────────────────────────────────────────────────────────
  isPdfPreviewOpen:    boolean;
  setIsPdfPreviewOpen: (v: boolean) => void;
  pdfPreviewUrl:       string;
  setPdfPreviewUrl:    (v: string) => void;
  pdfPreviewFilename:  string;
  pdfDownloadFn:       (() => void) | null;
  setPdfDownloadFn:    (v: (() => void) | null) => void;

  // ── Rechazar solicitud vol ────────────────────────────────────────────────────
  isRechazarVolOpen:    boolean;
  setIsRechazarVolOpen: (v: boolean) => void;
  solVolSeleccionada:   any;
  setSolVolSeleccionada:(v: any) => void;
  notaRechazoVol:       string;
  setNotaRechazoVol:    (v: string) => void;
  savingSolVol:         boolean;
  handleRechazarSolicitudVol: () => void;

  // ── Rechazar aporte vol ───────────────────────────────────────────────────────
  isRechazarAporteVolOpen:    boolean;
  setIsRechazarAporteVolOpen: (v: boolean) => void;
  aporteVolSeleccionado:      any;
  setAporteVolSeleccionado:   (v: any) => void;
  notaRechazoAporteVol:       string;
  setNotaRechazoAporteVol:    (v: string) => void;
  savingAporteVol:            boolean;
  handleRechazarAporteVol:    () => void;
}

export default function AhorroVoluntarioAlertDialogs({
  // Anular
  isDeleteDialogOpen, setIsDeleteDialogOpen,
  selectedItem, setSelectedItem,
  justificacionAnulacion, setJustificacionAnulacion,
  handleAnular,
  // Toggle estado
  isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen,
  handleToggleEstado,
  // Saldo bajo
  isConfirmSaldoBajoVolOpen, setIsConfirmSaldoBajoVolOpen,
  formSaldoInicial, montoMinimo, handleSaveAhorro,
  // Movimiento bajo
  isConfirmMovBajoVolOpen, setIsConfirmMovBajoVolOpen,
  formMovMonto, ejecutarRegistrarMovimiento,
  // PDF
  isPdfPreviewOpen, setIsPdfPreviewOpen,
  pdfPreviewUrl, setPdfPreviewUrl,
  pdfPreviewFilename,
  pdfDownloadFn, setPdfDownloadFn,
  // Rechazar sol vol
  isRechazarVolOpen, setIsRechazarVolOpen,
  solVolSeleccionada, setSolVolSeleccionada,
  notaRechazoVol, setNotaRechazoVol,
  savingSolVol, handleRechazarSolicitudVol,
  // Rechazar aporte vol
  isRechazarAporteVolOpen, setIsRechazarAporteVolOpen,
  aporteVolSeleccionado, setAporteVolSeleccionado,
  notaRechazoAporteVol, setNotaRechazoAporteVol,
  savingAporteVol, handleRechazarAporteVol,
}: AhorroVoluntarioAlertDialogsProps) {

  const closePdf = () => {
    setIsPdfPreviewOpen(false);
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl('');
    setPdfDownloadFn(null);
  };

  return (
    <>
      {/* ── Anular con justificación ─────────────────────────────────────────── */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) { setSelectedItem(null); setJustificacionAnulacion(''); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              ¿Confirmar anulación del ahorro voluntario?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Estás a punto de anular el ahorro voluntario de:</p>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Asociado:</span>
                    <span className="font-semibold text-slate-800">{selectedItem?.asociado}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Saldo acumulado:</span>
                    <span className="font-semibold text-red-700">
                      {selectedItem ? formatCurrency(selectedItem.montoAhorrado) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fecha de registro:</span>
                    <span className="text-slate-700">{selectedItem?.fechaInicio}</span>
                  </div>
                </div>
                <p className="text-xs text-red-600 font-medium">⚠ Esta acción no se puede deshacer.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2 space-y-2">
            <Label htmlFor="justificacion" className="text-slate-700 font-medium">
              Motivo de la anulación <span className="text-red-500">*</span>
            </Label>
            <Input
              id="justificacion"
              placeholder="Describe el motivo de la anulación..."
              value={justificacionAnulacion}
              onChange={(e) => setJustificacionAnulacion(e.target.value)}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => { setSelectedItem(null); setJustificacionAnulacion(''); }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAnular}
              className="bg-red-600 hover:bg-red-700"
              disabled={!justificacionAnulacion.trim()}
            >
              Sí, anular ahorro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Cambiar estado ───────────────────────────────────────────────────── */}
      <AlertDialog
        open={isToggleEstadoDialogOpen}
        onOpenChange={(open) => {
          setIsToggleEstadoDialogOpen(open);
          if (!open) { setSelectedItem(null); setJustificacionAnulacion(''); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de estado?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de{' '}
              <strong>{selectedItem?.estado === 'activo' ? 'desactivar' : 'activar'}</strong>{' '}
              el ahorro voluntario de{' '}
              <span className="font-semibold">"{selectedItem?.asociado}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 px-1 pb-2">
            <Label className={`font-medium ${selectedItem?.estado === 'activo' ? 'text-yellow-700' : 'text-emerald-700'}`}>
              Motivo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder={
                selectedItem?.estado === 'activo'
                  ? 'Motivo de la desactivación...'
                  : 'Motivo de la reactivación...'
              }
              value={justificacionAnulacion}
              onChange={(e) => setJustificacionAnulacion(e.target.value)}
              rows={2}
              className={
                selectedItem?.estado === 'activo'
                  ? 'border-yellow-300 focus-visible:ring-yellow-400'
                  : 'border-emerald-300 focus-visible:ring-emerald-400'
              }
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => { setSelectedItem(null); setJustificacionAnulacion(''); }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleToggleEstado(selectedItem?.id)}
              disabled={!justificacionAnulacion.trim()}
              className={
                selectedItem?.estado === 'activo'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }
            >
              {selectedItem?.estado === 'activo' ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Advertencia: saldo inicial menor al mínimo ────────────────────── */}
      <AlertDialog open={isConfirmSaldoBajoVolOpen} onOpenChange={setIsConfirmSaldoBajoVolOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Aporte por debajo del mínimo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  El monto ingresado es{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(parseCurrencyInput(formSaldoInicial))}
                  </span>
                  , que está{' '}
                  <span className="font-semibold">por debajo del mínimo obligatorio</span> de{' '}
                  <span className="font-semibold text-emerald-700">{formatCurrency(montoMinimo)}</span>.
                </p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs font-medium">
                  ⚠️ Registrar un aporte inferior al mínimo puede generar inconsistencias en el historial del asociado y afectar los cálculos del período.
                </div>
                <p>
                  Como administrador, puede continuar si existe una justificación válida (pago parcial acordado, abono, etc.).
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmSaldoBajoVolOpen(false)}>
              Cancelar — corregir monto
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => { setIsConfirmSaldoBajoVolOpen(false); handleSaveAhorro(true); }}
            >
              Sí, registrar de todas formas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Advertencia: depósito menor al mínimo ─────────────────────────── */}
      <AlertDialog open={isConfirmMovBajoVolOpen} onOpenChange={setIsConfirmMovBajoVolOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Aporte por debajo del mínimo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  El monto ingresado es{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(parseCurrencyInput(formMovMonto))}
                  </span>
                  , que está{' '}
                  <span className="font-semibold">por debajo del mínimo obligatorio</span> de{' '}
                  <span className="font-semibold text-emerald-700">{formatCurrency(montoMinimo)}</span>.
                </p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs font-medium">
                  ⚠️ Registrar un aporte inferior al mínimo puede generar inconsistencias en el historial del asociado y afectar los cálculos del período.
                </div>
                <p>
                  Como administrador, puede continuar si existe una justificación válida (pago parcial acordado, abono, etc.).
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmMovBajoVolOpen(false)}>
              Cancelar — corregir monto
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => { setIsConfirmMovBajoVolOpen(false); ejecutarRegistrarMovimiento(); }}
            >
              Sí, registrar de todas formas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Vista previa PDF ─────────────────────────────────────────────────── */}
      <Dialog open={isPdfPreviewOpen} onOpenChange={(open) => { if (!open) closePdf(); }}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="size-5 text-purple-600" />
                  Vista previa — Certificado de Ahorro Voluntario
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-slate-500">
                  {pdfPreviewFilename}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden bg-slate-100">
            {pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0"
                title="Vista previa del certificado PDF"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 shrink-0 flex items-center justify-between bg-slate-50">
            <p className="text-xs text-slate-500">Revisa el documento antes de descargarlo</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={closePdf}>Cerrar</Button>
              <Button
                className="gap-2 bg-purple-600 hover:bg-purple-700"
                onClick={() => {
                  pdfDownloadFn?.();
                  toast.success('Certificado descargado correctamente');
                }}
              >
                <TrendingUp className="size-4" />
                Descargar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rechazar solicitud voluntaria ──────────────────────────────────── */}
      <AlertDialog
        open={isRechazarVolOpen}
        onOpenChange={(o) => {
          setIsRechazarVolOpen(o);
          if (!o) { setSolVolSeleccionada(null); setNotaRechazoVol(''); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-500" />
              Rechazar solicitud de ahorro voluntario
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a rechazar el plan{' '}
              <span className="font-semibold">"{solVolSeleccionada?.nombre_plan ?? '—'}"</span>{' '}
              de{' '}
              <span className="font-semibold">{solVolSeleccionada?.usuarios?.nombre ?? '—'}</span>.
              El asociado recibirá una notificación con el motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label className="font-medium">
              Motivo del rechazo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Explica el motivo..."
              value={notaRechazoVol}
              onChange={(e) => setNotaRechazoVol(e.target.value)}
              className="min-h-[80px]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingSolVol}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRechazarSolicitudVol}
              disabled={!notaRechazoVol.trim() || savingSolVol}
            >
              {savingSolVol ? 'Guardando...' : 'Confirmar rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Rechazar aporte voluntario reportado ───────────────────────────── */}
      <AlertDialog
        open={isRechazarAporteVolOpen}
        onOpenChange={(o) => {
          setIsRechazarAporteVolOpen(o);
          if (!o) { setAporteVolSeleccionado(null); setNotaRechazoAporteVol(''); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-500" />
              Rechazar aporte voluntario reportado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  Vas a rechazar el aporte de{' '}
                  <span className="font-semibold">
                    {aporteVolSeleccionado?.usuarios?.nombre ?? '—'}
                  </span>{' '}
                  por{' '}
                  <span className="font-semibold text-slate-800">
                    {aporteVolSeleccionado ? formatCurrency(aporteVolSeleccionado.monto) : ''}
                  </span>{' '}
                  vía{' '}
                  <span className="font-medium">{aporteVolSeleccionado?.medio_pago}</span>.
                </p>
                <p className="text-xs text-slate-400">
                  El asociado recibirá una notificación con el motivo del rechazo.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label className="font-medium">
              Motivo del rechazo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Explica el motivo del rechazo..."
              value={notaRechazoAporteVol}
              onChange={(e) => setNotaRechazoAporteVol(e.target.value)}
              className="min-h-[80px]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingAporteVol}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRechazarAporteVol}
              disabled={!notaRechazoAporteVol.trim() || savingAporteVol}
            >
              {savingAporteVol ? 'Guardando...' : 'Confirmar rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
