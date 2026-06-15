import React, { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { pagosCreditoApi } from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';
import { tasaEAaMensual } from './creditoHelpers';

export interface UseCreditosPagosParams {
  selectedItem: any;
  setSelectedItem: (v: any) => void;
  setCreditos: React.Dispatch<React.SetStateAction<any[]>>;
  cargarDatos: () => Promise<void>;
  userData?: any;
  user: any;
}

export function useCreditosPagos({
  selectedItem,
  setSelectedItem,
  setCreditos,
  cargarDatos,
  userData,
  user,
}: UseCreditosPagosParams) {
  const [isPagoDialogOpen, setIsPagoDialogOpen]   = useState(false);
  const [pagoMonto, setPagoMonto]                 = useState('');
  const [pagoMetodo, setPagoMetodo]               = useState('efectivo');
  const [pagoObservacion, setPagoObservacion]     = useState('');
  const [pagoFecha, setPagoFecha]                 = useState('');
  const [pagoComprobante, setPagoComprobante]     = useState<File | null>(null);
  const [pagando, setPagando]                     = useState(false);
  const [historialPagos, setHistorialPagos]       = useState<any[]>([]);
  const [loadingPagos, setLoadingPagos]           = useState(false);
  const [historialDetalle, setHistorialDetalle]   = useState<any[]>([]);
  const [loadingHistorialDetalle, setLoadingHistorialDetalle] = useState(false);

  const handleOpenPago = async (credito: any) => {
    setSelectedItem(credito);
    setPagoMonto(credito.cuotaMensual?.toString() ?? '');
    setPagoMetodo('efectivo');
    setPagoObservacion('');
    setPagoFecha(new Date().toISOString().split('T')[0]);
    setIsPagoDialogOpen(true);
    setLoadingPagos(true);
    try {
      const pagos = await pagosCreditoApi.getByCredito(credito.id);
      setHistorialPagos(pagos);
    } catch { setHistorialPagos([]); }
    finally { setLoadingPagos(false); }
  };

  const handleRegistrarPago = async () => {
    if (!selectedItem) return;
    const monto = parseFloat(pagoMonto.replace(/[^\d.]/g, '')) || 0;
    const cuotaAcordada = selectedItem.cuotaMensual ?? 0;
    if (monto <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (cuotaAcordada > 0 && monto < cuotaAcordada) {
      toast.error('Monto insuficiente', {
        description: `El pago mínimo es ${formatCurrency(cuotaAcordada)}. Puedes pagar más — el excedente se abona directamente al capital.`,
        duration: 6000,
      });
      return;
    }
    if (monto > selectedItem.saldo) { toast.error('El monto no puede superar el saldo pendiente'); return; }
    if (!pagoFecha)            { toast.error('Selecciona la fecha del pago'); return; }
    if (pagoMetodo === 'transferencia' && !pagoComprobante) {
      toast.error('Adjunta el comprobante de transferencia para continuar');
      return;
    }

    // Tasa mensual efectiva desde EA (fórmula correcta)
    const tasaMensual   = tasaEAaMensual(selectedItem.tasaInteres ?? 0);
    const tipoInteres   = selectedItem.tipoInteres ?? 'compuesto';
    // Para interés simple: siempre sobre el capital original (monto)
    // Para interés compuesto: sobre el saldo pendiente
    const baseInteres   = tipoInteres === 'simple' ? (selectedItem.monto ?? selectedItem.saldo) : selectedItem.saldo;
    const interesCuota  = Math.round(baseInteres * tasaMensual);
    const capitalCuota  = Math.round(monto - interesCuota);
    const saldoDespues  = Math.max(0, selectedItem.saldo - capitalCuota);

    const numCuota = historialPagos.length + 1;

    const nombrePagador = userData?.nombre ?? userData?.email ?? 'Asociado';
    void nombrePagador;

    setPagando(true);
    try {
      let urlComprobante: string | undefined;
      if (pagoComprobante) {
        const ext      = pagoComprobante.name.split('.').pop() ?? 'bin';
        const filePath = `comprobantes/${selectedItem.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('creditos-documentos')
          .upload(filePath, pagoComprobante, { upsert: true });
        if (uploadErr) throw new Error('Error al subir el comprobante: ' + uploadErr.message);
        const { data: urlData } = supabase.storage
          .from('creditos-documentos')
          .getPublicUrl(filePath);
        urlComprobante = urlData.publicUrl;
      }

      const nuevoPago = await pagosCreditoApi.registrar({
        credito_id:      selectedItem.id,
        monto_pagado:    monto,
        capital:         Math.max(0, capitalCuota),
        interes:         interesCuota,
        saldo_antes:     selectedItem.saldo,
        saldo_despues:   saldoDespues,
        num_cuota:       numCuota,
        fecha_pago:      pagoFecha,
        metodo_pago:     pagoMetodo,
        observacion:     pagoObservacion.trim() || undefined,
        registrado_por:  user?.id ?? null,
        url_comprobante: urlComprobante,
      });

      const ahora = new Date().toISOString();
      setCreditos(prev => prev.map(c =>
        c.id === selectedItem.id
          ? {
              ...c,
              saldo: saldoDespues,
              estadoAprobacion:   saldoDespues <= 0 ? 'pagado' : c.estadoAprobacion,
              fechaEstadoCambio:  saldoDespues <= 0 ? ahora    : c.fechaEstadoCambio,
              motivoEstadoCambio: saldoDespues <= 0 ? 'Crédito pagado en su totalidad' : c.motivoEstadoCambio,
            }
          : c
      ));
      setSelectedItem((prev: any) => prev ? { ...prev, saldo: saldoDespues } : prev);

      setHistorialPagos(prev => [nuevoPago, ...prev]);

      toast.success('✅ Pago registrado correctamente', {
        description: `Cuota ${numCuota} · ${formatCurrency(monto)} · Saldo restante: ${formatCurrency(saldoDespues)}`,
      });

      setPagoMonto('');
      setPagoObservacion('');
      setPagoComprobante(null);

      await cargarDatos();

      if (saldoDespues <= 0) {
        toast.success('🎉 ¡Crédito completamente pagado!');
        setIsPagoDialogOpen(false);
      }
    } catch (err: any) {
      toast.error('Error al registrar el pago: ' + err.message);
    } finally {
      setPagando(false);
    }
  };

  return {
    isPagoDialogOpen, setIsPagoDialogOpen,
    pagoMonto, setPagoMonto,
    pagoMetodo, setPagoMetodo,
    pagoObservacion, setPagoObservacion,
    pagoFecha, setPagoFecha,
    pagoComprobante, setPagoComprobante,
    pagando,
    historialPagos, setHistorialPagos,
    loadingPagos,
    historialDetalle, setHistorialDetalle,
    loadingHistorialDetalle, setLoadingHistorialDetalle,
    handleOpenPago,
    handleRegistrarPago,
  };
}
