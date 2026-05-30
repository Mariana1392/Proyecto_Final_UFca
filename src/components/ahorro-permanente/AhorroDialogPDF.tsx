// ── AhorroDialogPDF.tsx ───────────────────────────────────────────────────────
// Diálogo para seleccionar el rango de fechas y generar el extracto PDF.
// Incluye vista previa del PDF antes de descargar (CA_52_03).

import { Calendar, FileText, TrendingUp, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import { formatCurrency } from '../../lib/formatters';
import { toast } from 'sonner';

interface AhorroDialogPDFProps {
  // Diálogo de rango
  open:               boolean;
  onClose:            () => void;
  ahorroPdfSelected:  any;
  pdfRangeInicio:     string;
  setPdfRangeInicio:  (v: string) => void;
  pdfRangeFin:        string;
  setPdfRangeFin:     (v: string) => void;
  handleGenerarPDF:   () => void;

  // Vista previa PDF
  isPdfPreviewOpen:    boolean;
  pdfPreviewUrl:       string;
  pdfPreviewFilename:  string;
  pdfDownloadFn:       (() => void) | null;
  handleClosePdfPreview: () => void;
}

export default function AhorroDialogPDF({
  open, onClose, ahorroPdfSelected,
  pdfRangeInicio, setPdfRangeInicio,
  pdfRangeFin, setPdfRangeFin,
  handleGenerarPDF,
  isPdfPreviewOpen, pdfPreviewUrl, pdfPreviewFilename,
  pdfDownloadFn, handleClosePdfPreview,
}: AhorroDialogPDFProps) {
  return (
    <>
    {/* ── Vista previa PDF ───────────────────────────────────────────────── */}
    <Dialog open={isPdfPreviewOpen} onOpenChange={(open) => { if (!open) handleClosePdfPreview(); }}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="size-5 text-emerald-600" />
                Vista previa — Extracto de Ahorro Permanente
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
              title="Vista previa del extracto PDF"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 shrink-0 flex items-center justify-between bg-slate-50">
          <p className="text-xs text-slate-500">Revisa el documento antes de descargarlo</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClosePdfPreview}>Cerrar</Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                pdfDownloadFn?.();
                toast.success('Extracto descargado correctamente');
              }}
            >
              <Download className="size-4" />
              Descargar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Selector de rango de fechas ────────────────────────────────────── */}
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-emerald-600" />
            Extracto de ahorro permanente
          </DialogTitle>
          <DialogDescription>
            Selecciona el rango de fechas para generar el extracto de{' '}
            <span className="font-semibold">{ahorroPdfSelected?.asociado}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Resumen del ahorro */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Saldo actual:</span>
                <p className="font-bold text-emerald-700">
                  {ahorroPdfSelected ? formatCurrency(ahorroPdfSelected.montoAhorrado) : ''}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Estado:</span>
                <p className="font-medium">
                  {ahorroPdfSelected?.estado ? 'Activo' : 'Inactivo'}
                </p>
              </div>
            </div>
          </div>

          {/* Rango de fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rangeInicio" className="flex items-center gap-2">
                <Calendar className="size-4 text-slate-400" /> Fecha inicio
              </Label>
              <Input
                id="rangeInicio"
                type="date"
                value={pdfRangeInicio}
                onChange={(e) => setPdfRangeInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rangeFin" className="flex items-center gap-2">
                <Calendar className="size-4 text-slate-400" /> Fecha fin
              </Label>
              <Input
                id="rangeFin"
                type="date"
                value={pdfRangeFin}
                onChange={(e) => setPdfRangeFin(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleGenerarPDF}>
            <TrendingUp className="size-4" />
            Vista previa / Generar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
