import React, { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/formatters';
import { TIPOS_CREDITO } from '../../lib/constants';
import { calcularCuota, FilaAmortizacion } from './creditoHelpers';

export interface UseCreditosSolicitudesParams {
  setCreditos: React.Dispatch<React.SetStateAction<any[]>>;
  userData?: any;
  /** Lifted from orchestrator so cargarDatos can update the same state */
  setSolicitudesCredito: React.Dispatch<React.SetStateAction<any[]>>;
  /** Lifted from orchestrator so cargarDatos can update the same state */
  setMisSolicitudes: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useCreditosSolicitudes({
  setCreditos,
  userData,
  setSolicitudesCredito,
  setMisSolicitudes,
}: UseCreditosSolicitudesParams) {
  const [isSolicitudDialogOpen, setIsSolicitudDialogOpen] = useState(false);
  const [solMonto, setSolMonto]             = useState('');
  const [solTipo, setSolTipo]               = useState('libre_inversion');
  const [solPlazo, setSolPlazo]             = useState('');
  const [solTasa, setSolTasa]               = useState('');
  const [solDestino, setSolDestino]         = useState('');
  const [solObs, setSolObs]                 = useState('');
  const [savingSolicitud, setSavingSolicitud] = useState(false);
  const [isSolSimOpen, setIsSolSimOpen]       = useState(false);
  const [tablaSolSim, setTablaSolSim]         = useState<FilaAmortizacion[]>([]);
  const [isRechazarSolOpen, setIsRechazarSolOpen]             = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada]     = useState<any>(null);
  const [notaRechazoSol, setNotaRechazoSol]                   = useState('');
  const [savingRechazarSol, setSavingRechazarSol]             = useState(false);
  const [solBanco, setSolBanco]               = useState('');
  const [solTipoCuenta, setSolTipoCuenta]     = useState('ahorros');
  const [solNumeroCuenta, setSolNumeroCuenta] = useState('');

  const parseMonto = (v: string) => parseFloat(v.replace(/[^\d.]/g, '')) || 0;

  const handleSolicitarCredito = async () => {
    const monto = parseMonto(solMonto);
    if (!monto || monto <= 0)      { toast.error('Ingresa un monto válido'); return; }
    const plazo = parseInt(solPlazo) || 0;
    if (plazo <= 0)                { toast.error('El plazo debe ser mayor a 0 meses'); return; }
    if (!solDestino.trim())        { toast.error('Describe el destino del crédito'); return; }

    setSavingSolicitud(true);
    try {
      const { data: periodoData } = await supabase
        .from('periodos')
        .select('id')
        .eq('estado', 'activo')
        .maybeSingle();
      const periodoId = periodoData?.id ?? null;

      const tasa  = parseFloat(solTasa) || 0;
      const cuota = calcularCuota(monto, tasa, plazo);

      const { data, error } = await supabase
        .from('creditos')
        .insert({
          asociado_id:    userData?.id,
          tipo:           solTipo,
          monto,
          plazo_meses:    plazo,
          tasa_interes:   tasa,
          cuota_mensual:  cuota,
          saldo:          monto,
          estado:         'pendiente',
          observaciones:  (solDestino.trim() + (solObs.trim() ? '\n' + solObs.trim() : '')) || null,
          anulado:        false,
          periodo_id:     periodoId,
          // Datos bancarios para el desembolso
          banco:          solBanco.trim()        || null,
          tipo_cuenta:    solTipoCuenta          || null,
          numero_cuenta:  solNumeroCuenta.trim() || null,
        })
        .select('*')
        .single();

      if (error) throw error;

      const nuevaCred = {
        id:                 data.id,
        asociado:           userData?.nombre ?? '',
        cedula:             userData?.cedula ?? '',
        asociado_id:        data.asociado_id,
        tipo:               data.tipo,
        monto:              data.monto,
        tasaInteres:        data.tasa_interes ?? 0,
        plazo:              data.plazo_meses,
        cuotaMensual:       data.cuota_mensual,
        saldo:              data.saldo,
        fechaDesembolso:    null,
        estadoAprobacion:   'pendiente',
        descripcionSoporte: data.observaciones ?? '',
        urlDocumento:       '',
        estado:             'pendiente',
        anulado:            false,
        motivoAnulacion:    '',
        fechaEstadoCambio:  '',
        motivoEstadoCambio: '',
        createdAt:          data.created_at,
      };
      setCreditos(prev => [nuevaCred, ...prev]);

      supabase.from('notificaciones').insert({
        titulo:      '📋 Nueva solicitud de crédito',
        mensaje:     `${userData?.nombre ?? 'Un asociado'} solicitó un crédito por ${formatCurrency(monto)} a ${plazo} meses (${TIPOS_CREDITO.find(t => t.value === solTipo)?.label ?? solTipo}). Destino: ${solDestino.trim()}.`,
        tipo:        'credito_pendiente',
        leida:       false,
        para_admin:  true,
        asociado_id: userData?.id,
      }).then(() => {}, () => {});

      toast.success('✅ Solicitud enviada al administrador', {
        description: 'Recibirás una notificación cuando sea revisada.',
      });
      setIsSolicitudDialogOpen(false);
      setSolMonto(''); setSolTipo('libre_inversion'); setSolPlazo('');
      setSolTasa(''); setSolDestino(''); setSolObs('');
    } catch (err: any) {
      toast.error('Error al enviar la solicitud: ' + err.message);
    } finally {
      setSavingSolicitud(false);
    }
  };

  const handlePonerEnRevision = async (sol: any) => {
    try {
      const ahora = new Date().toISOString();
      await supabase
        .from('creditos')
        .update({
          estado:               'en_revision',
          fecha_estado_cambio:  ahora,
          motivo_estado_cambio: 'Solicitud puesta en revisión por el administrador',
        })
        .eq('id', sol.id);

      await supabase.from('notificaciones').insert({
        asociado_id: sol.asociadoId,
        tipo:        'credito_pendiente',
        titulo:      '🔍 Tu solicitud está en revisión',
        mensaje:     `Tu solicitud de crédito por ${formatCurrency(sol.monto)} está siendo revisada por el administrador.`,
        leida:       false,
      });

      setSolicitudesCredito(prev => prev.map(s =>
        s.id === sol.id
          ? { ...s, estadoAprobacion: 'en_revision', estado: 'en_revision' }
          : s
      ));
      setCreditos(prev => prev.map(c =>
        c.id === sol.id
          ? { ...c, estadoAprobacion: 'en_revision', estado: 'en_revision' }
          : c
      ));

      toast.success(`🔍 Solicitud de ${sol.asociado} puesta en revisión`);
    } catch (err: any) {
      toast.error('Error al actualizar la solicitud: ' + err.message);
    }
  };

  const handleAprobarSolicitudCredito = async (sol: any) => {
    try {
      const ahora   = new Date().toISOString();
      const tasa    = sol.tasaInteres || 0;
      const cuota   = calcularCuota(sol.monto, tasa, sol.plazoMeses);
      void cuota;

      const { data: creditoData, error: creditoErr } = await supabase
        .from('creditos')
        .update({
          estado:              'aprobado',
          fecha_estado_cambio: ahora,
          motivo_estado_cambio: 'Aprobado por administrador',
        })
        .eq('id', sol.id)
        .select()
        .single();

      if (creditoErr) throw creditoErr;

      await supabase.from('notificaciones').insert({
        asociado_id: sol.asociadoId,
        tipo:        'credito_pendiente',
        titulo:      '✅ Solicitud de crédito aprobada',
        mensaje:     `Tu solicitud de crédito por ${formatCurrency(sol.monto)} fue aprobada.`,
        leida:       false,
        credito_id:  creditoData.id,
      });

      setSolicitudesCredito(prev => prev.filter(s => s.id !== sol.id));
      setCreditos(prev => prev.map(c =>
        c.id === sol.id
          ? { ...c, estado: 'aprobado', estadoAprobacion: 'aprobado', fechaEstadoCambio: ahora, motivoEstadoCambio: 'Aprobado por administrador' }
          : c
      ));

      toast.success(`✅ Solicitud de ${sol.asociado} aprobada`, {
        description: `Crédito de ${formatCurrency(sol.monto)} creado y listo para desembolso.`,
      });
    } catch (err: any) {
      toast.error('Error al aprobar la solicitud: ' + err.message);
    }
  };

  const handleRechazarSolicitudCredito = async () => {
    if (!solicitudSeleccionada) return;
    if (!notaRechazoSol.trim())  { toast.error('Escribe el motivo del rechazo'); return; }
    setSavingRechazarSol(true);
    try {
      const ahora = new Date().toISOString();
      await supabase
        .from('creditos')
        .update({
          estado:               'rechazado',
          fecha_estado_cambio:  ahora,
          motivo_estado_cambio: notaRechazoSol.trim(),
        })
        .eq('id', solicitudSeleccionada.id);

      await supabase.from('notificaciones').insert({
        asociado_id: solicitudSeleccionada.asociadoId,
        tipo:        'credito_pendiente',
        titulo:      '❌ Solicitud de crédito rechazada',
        mensaje:     `Tu solicitud de crédito por ${formatCurrency(solicitudSeleccionada.monto)} fue rechazada. Motivo: ${notaRechazoSol.trim()}`,
        leida:       false,
      });

      setSolicitudesCredito(prev => prev.filter(s => s.id !== solicitudSeleccionada.id));
      toast.success('Solicitud rechazada y asociado notificado.');
      setIsRechazarSolOpen(false);
      setSolicitudSeleccionada(null);
      setNotaRechazoSol('');
    } catch (err: any) {
      toast.error('Error al rechazar la solicitud: ' + err.message);
    } finally {
      setSavingRechazarSol(false);
    }
  };

  return {
    isSolicitudDialogOpen, setIsSolicitudDialogOpen,
    solMonto, setSolMonto,
    solTipo, setSolTipo,
    solPlazo, setSolPlazo,
    solTasa, setSolTasa,
    solDestino, setSolDestino,
    solObs, setSolObs,
    savingSolicitud,
    isSolSimOpen, setIsSolSimOpen,
    tablaSolSim, setTablaSolSim,
    isRechazarSolOpen, setIsRechazarSolOpen,
    solicitudSeleccionada, setSolicitudSeleccionada,
    notaRechazoSol, setNotaRechazoSol,
    savingRechazarSol,
    solBanco, setSolBanco,
    solTipoCuenta, setSolTipoCuenta,
    solNumeroCuenta, setSolNumeroCuenta,
    handleSolicitarCredito,
    handlePonerEnRevision,
    handleAprobarSolicitudCredito,
    handleRechazarSolicitudCredito,
  };
}
