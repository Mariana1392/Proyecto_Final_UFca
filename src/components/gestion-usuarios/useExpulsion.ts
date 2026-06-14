import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

export interface DatosExpulsion {
  loading: boolean;
  totalAhorroPermanente: number;
  totalAhorroVoluntario: number;
  saldoCreditoPendiente: number;
  moraCreditoAcumulada: number;
  moraAhorroAcumulada: number;
  netoADevolver: number;
  esPerdidaFondo: boolean;
  montoPerdida: number;
}

export function useExpulsion() {
  const [isExpulsionOpen, setIsExpulsionOpen] = useState(false);
  const [expulsionAsociado, setExpulsionAsociado] = useState<any>(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [datosExpulsion, setDatosExpulsion] = useState<DatosExpulsion | null>(null);

  async function cargarDatosExpulsion(asociadoId: string) {
    setDatosExpulsion({
      loading: true,
      totalAhorroPermanente: 0,
      totalAhorroVoluntario: 0,
      saldoCreditoPendiente: 0,
      moraCreditoAcumulada: 0,
      moraAhorroAcumulada: 0,
      netoADevolver: 0,
      esPerdidaFondo: false,
      montoPerdida: 0
    });
    try {
      // 1. Get savings (permanente + voluntario)
      const [permRes, volRes, credRes, configRes] = await Promise.all([
        supabase.from('cuentas_ahorro')
          .select('id, monto_ahorrado, multa_mora_vigente')
          .eq('asociado_id', asociadoId)
          .eq('tipo', 'permanente')
          .eq('estado', 'activo')
          .eq('anulado', false),
        supabase.from('cuentas_ahorro')
          .select('id, monto_ahorrado')
          .eq('asociado_id', asociadoId)
          .eq('tipo', 'voluntario')
          .eq('estado', 'activo')
          .eq('anulado', false),
        supabase.from('creditos')
          .select('id, saldo, tasa_mora, fecha_desembolso, plazo_meses, cuota_mensual, monto, tasa_interes')
          .eq('asociado_id', asociadoId)
          .eq('anulado', false)
          .in('estado', ['activo', 'desembolsado', 'en_mora']),
        supabase.from('configuracion')
          .select('valor')
          .eq('clave', 'multa_mora_ahorro_diaria')
          .maybeSingle(),
      ]);

      const totalPerm = (permRes.data || []).reduce((s, a) => s + (Number(a.monto_ahorrado) || 0), 0);
      const totalVol = (volRes.data || []).reduce((s, a) => s + (Number(a.monto_ahorrado) || 0), 0);
      const saldoCredito = (credRes.data || []).reduce((s, c) => s + (Number(c.saldo) || 0), 0);

      // Calculate credit mora
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      let moraCredito = 0;
      (credRes.data || []).forEach((cr: any) => {
        const crMonto = Number(cr.monto) || 0;
        const crSaldo = Number(cr.saldo) || crMonto;
        const crCuota = Number(cr.cuota_mensual) || 0;
        const crPlazo = Number(cr.plazo_meses) || 0;
        const crTasaAnual = Number(cr.tasa_interes) || 0;
        const crCuotasPagadas = crCuota > 0 ? Math.max(0, Math.round((crMonto - crSaldo) / crCuota)) : 0;
        const crFechaBase = cr.fecha_desembolso ? new Date(cr.fecha_desembolso + 'T00:00:00') : null;
        const crFechaVenc = crFechaBase && crCuotasPagadas < crPlazo
          ? new Date(crFechaBase.getFullYear(), crFechaBase.getMonth() + crCuotasPagadas + 1, crFechaBase.getDate())
          : null;
        const crDiasMora = (crFechaVenc && crFechaVenc <= hoy)
          ? Math.floor((hoy.getTime() - crFechaVenc.getTime()) / 86400000) + 1 : 0;
        if (crDiasMora > 0) {
          const crTasaMensual = crTasaAnual > 0 ? Math.pow(1 + crTasaAnual / 100, 1 / 12) - 1 : 0;
          const crTasaDiariaCorr = crTasaMensual / 30;
          const crTasaDiariaMora = crTasaDiariaCorr * 1.5;
          moraCredito += Math.round(crSaldo * crTasaDiariaMora * crDiasMora);
        }
      });

      // Calculate savings mora (days after 16th * daily penalty)
      const diaHoy = hoy.getDate();
      const diasMora = diaHoy >= 17 ? diaHoy - 16 : 0;
      const multaDiaria = Number(configRes.data?.valor) || 2000;

      let moraAhorro = 0;
      (permRes.data || []).forEach((c: any) => {
        const tarifa = Number(c.multa_mora_vigente) || multaDiaria;
        moraAhorro += diasMora * tarifa;
      });

      const totalAhorros = totalPerm + totalVol;
      const totalDeudas = saldoCredito + moraCredito + moraAhorro;
      const neto = totalAhorros - totalDeudas;

      setDatosExpulsion({
        loading: false,
        totalAhorroPermanente: totalPerm,
        totalAhorroVoluntario: totalVol,
        saldoCreditoPendiente: saldoCredito,
        moraCreditoAcumulada: moraCredito,
        moraAhorroAcumulada: moraAhorro,
        netoADevolver: Math.max(0, neto),
        esPerdidaFondo: neto < 0,
        montoPerdida: neto < 0 ? Math.abs(neto) : 0,
      });
    } catch (err: any) {
      setDatosExpulsion(null);
      toast.error('No se pudo cargar los datos: ' + err.message);
    }
  }

  async function ejecutarExpulsion(asociadoId: string, motivo: string, adminNombre: string) {
    if (!motivo.trim()) {
      toast.error('Debes proporcionar un motivo de expulsión');
      return false;
    }
    setEjecutando(true);
    try {
      const fechaHoy = new Date().toISOString().split('T')[0];

      // 1. Close all active credits
      await supabase.from('creditos')
        .update({
          saldo: 0,
          estado: 'cancelado',
          fecha_estado_cambio: new Date().toISOString(),
          motivo_estado_cambio: `Expulsión: ${motivo}`
        })
        .eq('asociado_id', asociadoId)
        .eq('anulado', false)
        .in('estado', ['activo', 'desembolsado', 'en_mora', 'pendiente', 'aprobado']);

      // 2. Close all savings accounts
      await supabase.from('cuentas_ahorro')
        .update({ estado: 'cerrado', monto_ahorrado: 0 })
        .eq('asociado_id', asociadoId)
        .eq('anulado', false);

      // 3. Mark user as suspended
      await supabase.from('usuarios').update({
        estado_cuenta: 'suspendido',
        activo: false,
        fecha_suspension: fechaHoy,
        motivo_suspension: motivo,
      }).eq('id', asociadoId);

      // 4. Register audit trail
      await supabase.from('auditoria').insert({
        asociado_id: asociadoId,
        tipo: 'EXPULSIÓN',
        descripcion: `Asociado expulsado por ${adminNombre}. Motivo: ${motivo}. Fecha: ${fechaHoy}`,
        usuario_nombre: adminNombre,
      });

      toast.success('Asociado expulsado exitosamente', {
        description: `Cuenta suspendida y liquidación registrada el ${fechaHoy}`
      });
      setIsExpulsionOpen(false);
      setExpulsionAsociado(null);
      setDatosExpulsion(null);
      return true;
    } catch (err: any) {
      toast.error('Error al ejecutar la expulsión: ' + err.message);
      return false;
    } finally {
      setEjecutando(false);
    }
  }

  function abrirExpulsion(asociado: any) {
    setExpulsionAsociado(asociado);
    setIsExpulsionOpen(true);
    cargarDatosExpulsion(asociado.id);
  }

  return {
    isExpulsionOpen,
    setIsExpulsionOpen,
    expulsionAsociado,
    ejecutando,
    datosExpulsion,
    abrirExpulsion,
    ejecutarExpulsion,
    cargarDatosExpulsion,
  };
}
