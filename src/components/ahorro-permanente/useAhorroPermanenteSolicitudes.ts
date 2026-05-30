// ── useAhorroPermanenteSolicitudes.ts ────────────────────────────────────────
// Gestiona las solicitudes de apertura de ahorro permanente (aprobación /
// rechazo por el administrador).

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { ahorroPermanenteApi } from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';

interface SolicitudesParams {
  setAhorros:       Dispatch<SetStateAction<any[]>>;
  montoObligatorio: number;
}

export function useAhorroPermanenteSolicitudes({
  setAhorros,
  montoObligatorio,
}: SolicitudesParams) {

  // ── Estado ─────────────────────────────────────────────────────────────────
  const [solicitudes,           setSolicitudes]           = useState<any[]>([]);
  const [isRechazarDialogOpen,  setIsRechazarDialogOpen]  = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<any>(null);
  const [notaRechazo,           setNotaRechazo]           = useState('');
  const [savingSolicitud,       setSavingSolicitud]       = useState(false);

  // ── Handler: aprobar solicitud ────────────────────────────────────────────
  const handleAprobarSolicitud = async (sol: any) => {
    try {
      const nuevo = await ahorroPermanenteApi.create({
        asociado_id:    sol.asociado_id,
        cuota_mensual:  montoObligatorio,
        monto_ahorrado: 0,
        estado:         'activo',
        anulado:        false,
      });

      await supabase.from('notificaciones').insert({
        titulo:      '✅ Solicitud de ahorro aprobada',
        mensaje:     `Tu solicitud de ahorro permanente fue aprobada. Tu cuota mensual es ${formatCurrency(montoObligatorio)}.`,
        tipo:        'pago_registrado',
        leida:       false,
        asociado_id: sol.asociado_id,
      });

      setSolicitudes(prev =>
        prev.map(s => s.id === sol.id ? { ...s, estado: 'aprobada' } : s)
      );
      const aprobadoIso = new Date().toISOString();
      setAhorros(prev => [{
        id:              nuevo.id,
        asociado:        sol.usuarios?.nombre ?? '',
        cedula:          sol.usuarios?.cedula ?? '',
        asociado_id:     sol.asociado_id,
        montoAhorrado:   0,
        cuotaMensual:    montoObligatorio,
        fechaInicio:     aprobadoIso.split('T')[0],
        estado:          true,
        anulado:         false,
        motivoAnulacion: '',
        createdAt:       aprobadoIso,
      }, ...prev]);

      toast.success('✅ Solicitud aprobada', {
        description: `Ahorro permanente creado para ${sol.usuarios?.nombre ?? 'el asociado'}.`,
      });
    } catch (err: any) {
      toast.error('Error al aprobar la solicitud: ' + err.message);
    }
  };

  // ── Handler: rechazar solicitud ───────────────────────────────────────────
  const handleRechazarSolicitud = async () => {
    if (!solicitudSeleccionada) return;
    if (!notaRechazo.trim()) { toast.error('Escribe el motivo del rechazo'); return; }
    setSavingSolicitud(true);
    try {
      await supabase.from('notificaciones').insert({
        titulo:      '❌ Solicitud de ahorro rechazada',
        mensaje:     `Tu solicitud de ahorro permanente fue rechazada. Motivo: ${notaRechazo.trim()}`,
        tipo:        'ahorro_rechazado',
        leida:       false,
        asociado_id: solicitudSeleccionada.asociado_id,
      });

      setSolicitudes(prev =>
        prev.map(s =>
          s.id === solicitudSeleccionada.id
            ? { ...s, estado: 'rechazada', nota_admin: notaRechazo.trim() }
            : s
        )
      );

      toast.success('Solicitud rechazada', {
        description: `Se notificó a ${solicitudSeleccionada.usuarios?.nombre ?? 'el asociado'}.`,
      });
      setIsRechazarDialogOpen(false);
      setSolicitudSeleccionada(null);
      setNotaRechazo('');
    } catch (err: any) {
      toast.error('Error al rechazar la solicitud: ' + err.message);
    } finally {
      setSavingSolicitud(false);
    }
  };

  return {
    solicitudes,
    isRechazarDialogOpen,  setIsRechazarDialogOpen,
    solicitudSeleccionada, setSolicitudSeleccionada,
    notaRechazo,           setNotaRechazo,
    savingSolicitud,
    handleAprobarSolicitud,
    handleRechazarSolicitud,
  };
}
