import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export function useLiquidacionAnular(
  userData: any, 
  setLiquidaciones: any, 
  registrarAuditLiq: (liqId: string, asocId: string, accion: string, detalle: any) => Promise<void>
) {
  const [isAnularOpen, setIsAnularOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [justificacionAnulacion, setJustificacionAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);

  const handleAnular = async () => {
    if (!justificacionAnulacion.trim()) {
      toast.error('Debes proporcionar un motivo de anulación');
      return;
    }
    if (!selectedItem) return;

    setAnulando(true);
    try {
      const { error } = await supabase.rpc('actualizar_liquidacion', {
        p_id: selectedItem.id,
        p_anulado: true,
        p_justificacion_anulacion: justificacionAnulacion.trim(),
        p_anulado_por: userData?.name ?? userData?.nombre ?? 'Administrador',
        p_anulado_en: new Date().toISOString(),
      });

      if (error) throw error;

      await registrarAuditLiq(
        selectedItem.id,
        selectedItem.asociado_id,
        'ANULACION',
        { motivo: justificacionAnulacion.trim() }
      );

      setLiquidaciones((prev: any[]) => prev.map(l => l.id === selectedItem.id ? { 
        ...l, 
        anulado: true, 
        justificacionAnulacion: justificacionAnulacion.trim(),
        anuladoPor: userData?.name ?? userData?.nombre ?? 'Administrador',
        anuladoEn: new Date().toISOString(),
      } : l));

      toast.success('Liquidación anulada con éxito');
      setIsAnularOpen(false);
      setJustificacionAnulacion('');
    } catch (err: any) {
      toast.error('Error al anular: ' + err.message);
    } finally {
      setAnulando(false);
    }
  };

  return {
    isAnularOpen, setIsAnularOpen,
    selectedItem, setSelectedItem,
    justificacionAnulacion, setJustificacionAnulacion,
    anulando,
    handleAnular
  };
}
