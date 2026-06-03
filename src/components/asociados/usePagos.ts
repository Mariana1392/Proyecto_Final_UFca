import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

export function usePagos() {
  const [pendientesPago, setPendientesPago]                   = useState<any[]>([]);
  const [isPagoConfirmDialogOpen, setIsPagoConfirmDialogOpen] = useState(false);
  const [solicitudPagoSeleccionada, setSolicitudPagoSeleccionada] = useState<any>(null);
  const [comprobante, setComprobante]                         = useState<File | null>(null);
  const [savingConfirmPago, setSavingConfirmPago]             = useState(false);

  async function cargarPendientesPago() {
    const { data, error } = await supabase
      .from('solicitudes_asociados')
      .select('id, usuario_id, nombres, apellidos, cedula, telefono, email, fecha_solicitud, monto_ahorro_propuesto, observaciones')
      .eq('estado', 'pendiente_activacion')
      .order('fecha_solicitud', { ascending: true });
    if (!error) setPendientesPago(data || []);
  }

  async function handleConfirmarPago() {
    if (!solicitudPagoSeleccionada) return;
    setSavingConfirmPago(true);
    try {
      let comprobanteUrl: string | null = null;

      if (comprobante) {
        const ext  = comprobante.name.split('.').pop();
        const path = `comprobantes/${solicitudPagoSeleccionada.id}_${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('documentos')
          .upload(path, comprobante, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(uploadData.path);
        comprobanteUrl = urlData.publicUrl;
      }

      const observacionFinal = comprobanteUrl
        ? `Pago confirmado. Comprobante: ${comprobanteUrl}`
        : 'Pago confirmado por el administrador.';

      const { error } = await supabase
        .from('solicitudes_asociados')
        .update({ estado: 'aprobada', observaciones: observacionFinal })
        .eq('id', solicitudPagoSeleccionada.id);
      if (error) throw error;

      setPendientesPago(prev => prev.filter(s => s.id !== solicitudPagoSeleccionada.id));
      toast.success(`Pago de ${solicitudPagoSeleccionada.nombres} ${solicitudPagoSeleccionada.apellidos} confirmado. Cuenta activada.`);
      setIsPagoConfirmDialogOpen(false);
      setSolicitudPagoSeleccionada(null);
      setComprobante(null);
    } catch (err: any) {
      toast.error('Error al confirmar pago: ' + err.message);
    } finally {
      setSavingConfirmPago(false);
    }
  }

  return {
    pendientesPago,
    isPagoConfirmDialogOpen,
    setIsPagoConfirmDialogOpen,
    solicitudPagoSeleccionada,
    setSolicitudPagoSeleccionada,
    comprobante,
    setComprobante,
    savingConfirmPago,
    cargarPendientesPago,
    handleConfirmarPago,
  };
}
