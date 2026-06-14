import React, { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { creditosApi } from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';
import {
  calcularCuota,
  calcularCuotaSimple,
  generarTablaAmortizacion,
  generarTablaAmortizacionSimple,
  FilaAmortizacion,
} from './creditoHelpers';

export interface UseCreditosSimulacionParams {
  formAsociadoId: string;
  formMonto: string;
  formTasa: string;
  formPlazo: string;
  formFecha: string;
  formTipo: string;
  formTipoInteres: 'simple' | 'compuesto';
  formDescSoporte: string;
  asociadosDisponibles: any[];
  setIsCreateDialogOpen: (v: boolean) => void;
  setSelectedItem: (v: any) => void;
  setFormArchivoFile: (v: File | null) => void;
  cargarDatos: () => Promise<void>;
  parseMonto: (v: string) => number;
  /** Lifted from orchestrator so cargarDatos can update the same state */
  setCreditosSimulacion: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useCreditosSimulacion({
  formAsociadoId,
  formMonto,
  formTasa,
  formPlazo,
  formFecha,
  formTipo,
  formTipoInteres,
  formDescSoporte,
  asociadosDisponibles,
  setIsCreateDialogOpen,
  setSelectedItem,
  setFormArchivoFile,
  cargarDatos,
  parseMonto,
  setCreditosSimulacion,
}: UseCreditosSimulacionParams) {
  const [isSimulacionOpen, setIsSimulacionOpen]           = useState(false);
  const [tablaSimulacion, setTablaSimulacion]             = useState<FilaAmortizacion[]>([]);
  const [enviandoSimulacion, setEnviandoSimulacion]       = useState(false);
  const [confirmandoSim, setConfirmandoSim]               = useState(false);
  const [rechazandoSim, setRechazandoSim]                 = useState(false);
  const [simSeleccionada, setSimSeleccionada]             = useState<any>(null);
  const [isConfirmSimOpen, setIsConfirmSimOpen]           = useState(false);
  const [isRechazarSimOpen, setIsRechazarSimOpen]         = useState(false);
  const [isSimDetalleOpen, setIsSimDetalleOpen]           = useState(false);
  const [simDetalleData, setSimDetalleData]               = useState<{ sim: any; tabla: FilaAmortizacion[] } | null>(null);

  const handleAbrirSimulacion = () => {
    const monto = parseMonto(formMonto);
    const tasa  = parseFloat(formTasa) || 0;
    const plazo = parseInt(formPlazo)  || 0;
    if (!formAsociadoId) { toast.error('Selecciona un asociado'); return; }
    if (!monto || monto <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (plazo <= 0)  { toast.error('El plazo debe ser mayor a 0'); return; }
    if (plazo > 12)  { toast.error('El plazo máximo permitido es de 12 meses'); return; }
    const tabla = formTipoInteres === 'simple'
      ? generarTablaAmortizacionSimple(monto, tasa, plazo, formFecha || new Date().toISOString().split('T')[0])
      : generarTablaAmortizacion(monto, tasa, plazo, formFecha || new Date().toISOString().split('T')[0]);
    setTablaSimulacion(tabla);
    setIsSimulacionOpen(true);
  };

  const handleEnviarSimulacion = async () => {
    if (!formAsociadoId) return;
    const monto = parseMonto(formMonto);
    const tasa  = parseFloat(formTasa) || 0;
    const plazo = parseInt(formPlazo)  || 0;
    const cuota = formTipoInteres === 'simple'
      ? calcularCuotaSimple(monto, tasa, plazo)
      : calcularCuota(monto, tasa, plazo);
    const asociado = asociadosDisponibles.find(a => a.id === formAsociadoId);
    setEnviandoSimulacion(true);
    try {
      const nuevo = await creditosApi.create({
        asociado_id:      formAsociadoId,
        tipo:             formTipo,
        tipo_interes:     formTipoInteres,
        monto,
        tasa_interes:     tasa,
        plazo_meses:      plazo,
        cuota_mensual:    cuota,
        fecha_desembolso: formFecha || new Date().toISOString().split('T')[0],
        estado:           'simulacion',
        observaciones:    formDescSoporte.trim() || null,
        saldo:            monto,
        anulado:          false,
      });

      const { data: usuarioAsoc } = await supabase
        .from('usuarios')
        .select('id, email')
        .eq('asociado_id', formAsociadoId)
        .maybeSingle();

      await supabase.from('notificaciones').insert({
        usuario_id:  usuarioAsoc?.id ?? null,
        asociado_id: formAsociadoId,
        tipo:        'simulacion_credito',
        titulo:      '📊 Simulación de crédito pendiente de confirmación',
        mensaje:     `Se ha generado una simulación de crédito por ${formatCurrency(monto)} a ${plazo} meses con cuota mensual de ${formatCurrency(cuota)}. Revisa el plan de pagos y confirma o rechaza el crédito.`,
        leida:       false,
        para_admin:  false,
        credito_id:  nuevo.id,
      }).then(() => {}, () => {});

      void Promise.resolve(supabase.functions.invoke('enviar-simulacion-credito', {
        body: {
          destinatario:   usuarioAsoc?.email ?? asociado?.email ?? null,
          nombreAsociado: asociado?.nombre ?? 'Asociado',
          monto, tasa, plazo,
        },
      })).catch(() => {});

      const ahora = new Date().toISOString();
      const simEntry = {
        id: nuevo.id,
        asociado:         asociado?.nombre ?? '',
        cedula:           asociado?.cedula ?? '',
        asociado_id:      formAsociadoId,
        tipo:             formTipo,
        tipoInteres:      formTipoInteres,
        monto,  tasaInteres: tasa, plazo, cuotaMensual: cuota,
        saldo:            monto,
        fechaDesembolso:  formFecha || ahora.split('T')[0],
        estadoAprobacion: 'simulacion',
        descripcionSoporte: formDescSoporte,
        urlDocumento:     '',
        estado:           'simulacion',
        anulado:          false,
        motivoAnulacion:  '',
        editadoPor: '', editadoEn: '',
        fechaEstadoCambio: '', motivoEstadoCambio: '',
        createdAt: ahora,
      };
      setCreditosSimulacion(prev => [simEntry, ...prev]);

      toast.success('✅ Simulación enviada al asociado', {
        description: `${asociado?.nombre} recibirá el plan de pagos para confirmar o rechazar.`,
      });
      setIsSimulacionOpen(false);
      setIsCreateDialogOpen(false);
      setSelectedItem(null);
      setFormArchivoFile(null);
    } catch (err: any) {
      toast.error('Error al enviar simulación: ' + err.message);
    } finally {
      setEnviandoSimulacion(false);
    }
  };

  const handleConfirmarSimulacion = async () => {
    if (!simSeleccionada) return;
    setConfirmandoSim(true);
    try {
      const { error: rpcError } = await supabase.rpc('confirmar_simulacion_credito', {
        p_credito_id: simSeleccionada.id,
      });

      if (rpcError) {
        const { error: updateError } = await supabase.from('creditos').update({
          estado:               'aprobado',
          saldo:                simSeleccionada.monto,
          fecha_estado_cambio:  new Date().toISOString(),
          motivo_estado_cambio: 'Crédito confirmado por el asociado — pendiente de desembolso',
          anulado:              false,
        }).eq('id', simSeleccionada.id);

        if (updateError) throw updateError;
      }

      supabase.from('notificaciones').insert({
        titulo:     '✅ Crédito aprobado — confirmado por asociado',
        mensaje:    `${simSeleccionada.asociado} confirmó el crédito por ${formatCurrency(simSeleccionada.monto)} a ${simSeleccionada.plazo} meses. Estado: APROBADO, pendiente de desembolso.`,
        tipo:       'credito_activo',
        leida:      false,
        para_admin: true,
      }).then(() => {}, () => {});

      const asocId = simSeleccionada.asociadoId ?? simSeleccionada.asociado_id;
      if (asocId) {
        supabase.from('notificaciones').insert({
          titulo:      '🎉 Tu crédito ha sido aprobado',
          mensaje:     `Tu crédito por ${formatCurrency(simSeleccionada.monto)} a ${simSeleccionada.plazo} meses ha sido aprobado y está pendiente de desembolso.`,
          tipo:        'credito_activo',
          leida:       false,
          para_admin:  false,
          asociado_id: asocId,
        }).then(() => {}, () => {});
      }

      toast.success('🎉 ¡Crédito aprobado! Ya aparece en Gestión de Créditos pendiente de desembolso.');
      setIsConfirmSimOpen(false);
      setSimSeleccionada(null);
      await cargarDatos();
    } catch (err: any) {
      toast.error('Error al aprobar el crédito: ' + err.message);
    } finally {
      setConfirmandoSim(false);
    }
  };

  const handleRechazarSimulacion = async () => {
    if (!simSeleccionada) return;
    setRechazandoSim(true);
    try {
      const { error: rpcError } = await supabase.rpc('rechazar_simulacion_credito', {
        p_credito_id: simSeleccionada.id,
      });

      if (rpcError) {
        const { error: deleteError } = await supabase
          .from('creditos')
          .delete()
          .eq('id', simSeleccionada.id);

        if (deleteError) throw deleteError;
      }

      supabase.from('notificaciones').insert({
        titulo:     '❌ Simulación de crédito rechazada',
        mensaje:    `${simSeleccionada.asociado} rechazó la simulación por ${formatCurrency(simSeleccionada.monto)}.`,
        tipo:       'credito_rechazado',
        leida:      false,
        para_admin: true,
      }).then(() => {}, () => {});

      toast.success('Simulación rechazada y eliminada correctamente.');
      setIsRechazarSimOpen(false);
      setSimSeleccionada(null);
      await cargarDatos();
    } catch (err: any) {
      toast.error('Error al rechazar: ' + err.message);
    } finally {
      setRechazandoSim(false);
    }
  };

  return {
    isSimulacionOpen, setIsSimulacionOpen,
    tablaSimulacion, setTablaSimulacion,
    enviandoSimulacion,
    confirmandoSim,
    rechazandoSim,
    simSeleccionada, setSimSeleccionada,
    isConfirmSimOpen, setIsConfirmSimOpen,
    isRechazarSimOpen, setIsRechazarSimOpen,
    isSimDetalleOpen, setIsSimDetalleOpen,
    simDetalleData, setSimDetalleData,
    handleAbrirSimulacion,
    handleEnviarSimulacion,
    handleConfirmarSimulacion,
    handleRechazarSimulacion,
  };
}
