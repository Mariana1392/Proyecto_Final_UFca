import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

export interface RetiroStatus {
  loading: boolean;
  creditosPendientes: number;
  ahorrosConSaldo: number;
  tieneAlgunaLiq: boolean;
  liquidacionPagada: boolean;
  usuarioActivo: boolean;
  usuarioId: string | null;
}

export function useRetiro(
  setAsociados: React.Dispatch<React.SetStateAction<any[]>>,
) {
  const [isRetiroOpen, setIsRetiroOpen]     = useState(false);
  const [retiroAsociado, setRetiroAsociado] = useState<any>(null);
  const [retirando, setRetirando]           = useState(false);
  const [retiroStatus, setRetiroStatus]     = useState<RetiroStatus | null>(null);

  async function cargarEstadoRetiro(asociadoId: string) {
    setRetiroStatus({ loading: true, creditosPendientes: 0, ahorrosConSaldo: 0, tieneAlgunaLiq: false, liquidacionPagada: false, usuarioActivo: false, usuarioId: null });
    try {
      const [creditosRes, ahorrosRes, liqRes, liqPagadaRes, usuarioRes] = await Promise.all([
        supabase.from('creditos').select('id')
          .eq('asociado_id', asociadoId).eq('anulado', false)
          .in('estado', ['pendiente', 'aprobado', 'desembolsado', 'en_mora', 'activo'])
          .gt('saldo', 0),
        supabase.from('cuentas_ahorro').select('id')
          .eq('tipo', 'permanente').eq('asociado_id', asociadoId)
          .eq('estado', 'activo').eq('anulado', false).gt('monto_ahorrado', 0),
        supabase.from('liquidaciones').select('id')
          .eq('asociado_id', asociadoId).eq('anulado', false).limit(1),
        supabase.from('liquidaciones').select('id')
          .eq('asociado_id', asociadoId).eq('anulado', false).eq('estado', 'Pagada').limit(1),
        supabase.from('usuarios').select('id, activo')
          .eq('id', asociadoId).maybeSingle(),
      ]);
      setRetiroStatus({
        loading:            false,
        creditosPendientes: creditosRes.data?.length  ?? 0,
        ahorrosConSaldo:    ahorrosRes.data?.length   ?? 0,
        tieneAlgunaLiq:     (liqRes.data?.length      ?? 0) > 0,
        liquidacionPagada:  (liqPagadaRes.data?.length ?? 0) > 0,
        usuarioActivo:      usuarioRes.data?.activo   ?? false,
        usuarioId:          usuarioRes.data?.id        ?? null,
      });
    } catch {
      setRetiroStatus(null);
      toast.error('No se pudo cargar el estado del retiro');
    }
  }

  async function handleDesactivarCuenta() {
    if (!retiroAsociado || !retiroStatus) return;
    setRetirando(true);
    try {
      const { error: err1 } = await supabase
        .from('usuarios')
        .update({ activo: false, estado_cuenta: 'inactivo' })
        .eq('id', retiroAsociado.id);
      if (err1) throw err1;

      if (retiroStatus.usuarioId && retiroStatus.usuarioId !== retiroAsociado.id) {
        const { error: err2 } = await supabase
          .from('usuarios')
          .update({ activo: false })
          .eq('id', retiroStatus.usuarioId);
        if (err2) throw err2;
      }

      setAsociados(prev => prev.map(a =>
        a.id === retiroAsociado.id ? { ...a, estado: false } : a
      ));
      toast.success(`Retiro completado — cuenta de "${retiroAsociado.nombre}" desactivada.`);
      setIsRetiroOpen(false);
      setRetiroAsociado(null);
      setRetiroStatus(null);
    } catch (err: any) {
      toast.error('Error al desactivar: ' + err.message);
    } finally {
      setRetirando(false);
    }
  }

  function abrirRetiro(asociado: any) {
    setRetiroAsociado(asociado);
    setIsRetiroOpen(true);
    cargarEstadoRetiro(asociado.id);
  }

  return {
    isRetiroOpen,
    setIsRetiroOpen,
    retiroAsociado,
    retirando,
    retiroStatus,
    abrirRetiro,
    handleDesactivarCuenta,
  };
}
