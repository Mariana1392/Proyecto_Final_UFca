import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { FileText, ShieldAlert, Upload, Download } from 'lucide-react';
import { numLiq } from './liquidacionUtils';

interface LiquidacionDialogsProps {
  isPdfPreviewOpen: boolean;
  setIsPdfPreviewOpen: (b: boolean) => void;
  pdfPreviewUrl: string | null;
  selectedItem: any;
  
  isAnularOpen: boolean;
  setIsAnularOpen: (b: boolean) => void;
  justificacionAnulacion: string;
  setJustificacionAnulacion: (s: string) => void;
  anulando: boolean;
  handleAnular: () => void;

  isUploadDocOpen: boolean;
  setIsUploadDocOpen: (b: boolean) => void;
  uploadDocFile: File | null;
  uploadDocNombre: string;
  setUploadDocNombre: (s: string) => void;
  uploadingDoc: boolean;
  handleUploadDoc: () => void;
  handleFileSelect: (f: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function LiquidacionDialogs({
  isPdfPreviewOpen, setIsPdfPreviewOpen, pdfPreviewUrl, selectedItem,
  isAnularOpen, setIsAnularOpen, justificacionAnulacion, setJustificacionAnulacion, anulando, handleAnular,
  isUploadDocOpen, setIsUploadDocOpen, uploadDocFile, uploadDocNombre, setUploadDocNombre, uploadingDoc, handleUploadDoc, handleFileSelect, fileInputRef
}: LiquidacionDialogsProps) {
  return (
    <>
      {/* ── Previsualización PDF ── */}
      <Dialog open={isPdfPreviewOpen} onOpenChange={setIsPdfPreviewOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Documento de Liquidación
              </DialogTitle>
              <DialogDescription>
                {selectedItem ? `${numLiq(selectedItem.id)} - ${selectedItem.asociado}` : ''}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              if (pdfPreviewUrl) {
                const a = document.createElement('a');
                a.href = pdfPreviewUrl;
                a.download = `Liquidacion_${numLiq(selectedItem?.id)}_${(selectedItem?.asociado ?? 'asociado').replace(/\s+/g, '_')}.pdf`;
                a.click();
              }
            }}>
              <Download className="w-4 h-4 mr-2" /> Descargar PDF
            </Button>
          </DialogHeader>
          <div className="flex-1 bg-slate-100/50">
            {pdfPreviewUrl ? (
              <iframe src={pdfPreviewUrl} className="w-full h-full border-0" title="Vista previa PDF" />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                Cargando vista previa...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Anular ── */}
      <AlertDialog open={isAnularOpen} onOpenChange={setIsAnularOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="w-5 h-5" />
              ¿Marcar Liquidación como Inválida?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Estás a punto de anular la liquidación <strong className="text-slate-900">{numLiq(selectedItem?.id || '')}</strong> de <strong>{selectedItem?.asociado}</strong>.
              <br /><br />
              Esta acción no elimina el registro de la base de datos por razones de auditoría, pero lo marcará como anulado y no se sumará a los reportes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-red-700 font-semibold">Motivo de la anulación <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Explica brevemente por qué se anula esta liquidación..."
                value={justificacionAnulacion}
                onChange={e => setJustificacionAnulacion(e.target.value)}
                className="border-red-200 focus-visible:ring-red-500"
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anulando}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={handleAnular} disabled={anulando || !justificacionAnulacion.trim()} className="bg-red-600 hover:bg-red-700 text-white">
              {anulando ? 'Anulando...' : 'Sí, anular liquidación'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Subir Documento ── */}
      <Dialog open={isUploadDocOpen} onOpenChange={(open) => {
        setIsUploadDocOpen(open);
        if (!open) {
          if (fileInputRef.current) fileInputRef.current.value = '';
          setUploadDocNombre('');
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" /> Subir Comprobante
            </DialogTitle>
            <DialogDescription>
              Adjunta un comprobante (transferencia, consignación, etc.) para la liquidación <strong>{numLiq(selectedItem?.id || '')}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del documento</Label>
              <Input placeholder="Ej. Comprobante de transferencia" value={uploadDocNombre} onChange={(e) => setUploadDocNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Archivo (PDF, Imagen, Word)</Label>
              <Input type="file" ref={fileInputRef} accept=".pdf,image/*,.doc,.docx" onChange={(e) => {
                if (e.target.files && e.target.files[0]) handleFileSelect(e.target.files[0]);
              }} />
              <p className="text-[10px] text-slate-500">Máximo 10 MB.</p>
            </div>
            {selectedItem?.estado === 'En proceso' && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2 mt-2">
                <ShieldAlert className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800">
                  Al subir este comprobante, el estado de la liquidación cambiará automáticamente a <strong>Pagada</strong>.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDocOpen(false)} disabled={uploadingDoc}>Cancelar</Button>
            <Button onClick={handleUploadDoc} disabled={uploadingDoc || !uploadDocFile || !uploadDocNombre.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {uploadingDoc ? 'Subiendo...' : 'Subir y guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
