// ── useAhorroPermanentePDF.ts ─────────────────────────────────────────────────
// Gestiona la generación de extractos PDF de ahorro permanente.

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { buildAhorroPermanentePDF } from '../utils/pdfGenerator';

interface PDFParams {
  movimientosDetalle:    any[];
  setMovimientosDetalle: Dispatch<SetStateAction<any[]>>;
}

export function useAhorroPermanentePDF({
  movimientosDetalle,
  setMovimientosDetalle,
}: PDFParams) {

  // ── Estado ─────────────────────────────────────────────────────────────────
  const [isPdfRangeDialogOpen, setIsPdfRangeDialogOpen] = useState(false);
  const [pdfRangeInicio,       setPdfRangeInicio]       = useState('');
  const [pdfRangeFin,          setPdfRangeFin]          = useState('');
  const [ahorroPdfSelected,    setAhorroPdfSelected]    = useState<any>(null);

  // ── Estado de vista previa ─────────────────────────────────────────────────
  const [isPdfPreviewOpen,    setIsPdfPreviewOpen]    = useState(false);
  const [pdfPreviewUrl,       setPdfPreviewUrl]       = useState('');
  const [pdfPreviewFilename,  setPdfPreviewFilename]  = useState('');
  const [pdfDownloadFn,       setPdfDownloadFn]       = useState<(() => void) | null>(null);

  // ── Handler: abrir diálogo de rango PDF ──────────────────────────────────
  const handleOpenPdfDialog = async (ahorro: any) => {
    setAhorroPdfSelected(ahorro);
    const hoy = new Date().toISOString().split('T')[0];
    setPdfRangeFin(hoy);
    setPdfRangeInicio(ahorro.fechaInicio || hoy);
    setIsPdfRangeDialogOpen(true);
    try {
      const { data, error } = await supabase
        .from('transacciones')
        .select('*')
        .eq('ahorro_id', ahorro.id)
        .in('tipo', ['aporte_permanente', 'mora_permanente'])
        .order('fecha_pago', { ascending: true });
      if (!error) setMovimientosDetalle(data || []);
    } catch { /* ignorar */ }
  };

  // ── Handler: cerrar vista previa y liberar blob URL ───────────────────────
  const handleClosePdfPreview = () => {
    setIsPdfPreviewOpen(false);
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl('');
    setPdfDownloadFn(null);
  };

  // ── Handler: generar PDF y abrir vista previa ────────────────────────────
  const handleGenerarPDF = () => {
    if (!ahorroPdfSelected) return;
    if (!pdfRangeInicio || !pdfRangeFin) {
      toast.error('Selecciona el rango de fechas para el extracto');
      return;
    }
    if (new Date(pdfRangeInicio) > new Date(pdfRangeFin)) {
      toast.error('La fecha de inicio no puede ser mayor a la fecha de fin');
      return;
    }
    const movsFiltrados = movimientosDetalle.filter(m => {
      const fm = m.fecha_pago ?? m.fecha_movimiento;
      return fm >= pdfRangeInicio && fm <= pdfRangeFin;
    });
    const pdfData = {
      asociado:          ahorroPdfSelected.asociado,
      cedula:            ahorroPdfSelected.cedula,
      fechaAfiliacion:   ahorroPdfSelected.fechaInicio,
      aporteActual:      ahorroPdfSelected.cuotaMensual,
      fechaUltimoAporte: (movsFiltrados[0]?.fecha_pago ?? movsFiltrados[0]?.fecha_movimiento) ?? ahorroPdfSelected.fechaInicio,
      totalAportes:      movsFiltrados.length,
      saldoAcumulado:    ahorroPdfSelected.montoAhorrado,
      estado:            ahorroPdfSelected.estado,
      rangoInicio:       pdfRangeInicio,
      rangoFin:          pdfRangeFin,
      movimientos:       movsFiltrados,
    };
    const result = buildAhorroPermanentePDF(pdfData);
    if (result) {
      setPdfPreviewUrl(result.url);
      setPdfPreviewFilename(result.filename);
      setPdfDownloadFn(() => result.download);
      setIsPdfRangeDialogOpen(false);
      setIsPdfPreviewOpen(true);
    } else {
      toast.error('Error al generar el PDF. Intenta nuevamente.');
    }
  };

  return {
    // Diálogo de selección de rango
    isPdfRangeDialogOpen, setIsPdfRangeDialogOpen,
    pdfRangeInicio,       setPdfRangeInicio,
    pdfRangeFin,          setPdfRangeFin,
    ahorroPdfSelected,    setAhorroPdfSelected,
    handleOpenPdfDialog,
    handleGenerarPDF,
    // Vista previa PDF
    isPdfPreviewOpen,     setIsPdfPreviewOpen,
    pdfPreviewUrl,        setPdfPreviewUrl,
    pdfPreviewFilename,
    pdfDownloadFn,        setPdfDownloadFn,
    handleClosePdfPreview,
  };
}
