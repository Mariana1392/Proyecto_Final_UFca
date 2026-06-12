// ── useAhorroPermanenteAportes.ts ─────────────────────────────────────────────
// Gestiona el formulario de registro de aportes y los aportes pendientes
// reportados por asociados (confirmación / rechazo admin).

import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../../lib/formatters';
import { resolverPeriodoId } from './ahorroPermanenteUtils';

// Cliente con fallback: usa service role si está disponible, sino cliente normal
const db = supabaseAdmin ?? supabase;

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

interface AportesParams {
  setAhorros:            Dispatch<SetStateAction<any[]>>;
  selectedItem:          any;
  setSelectedItem:       Dispatch<SetStateAction<any>>;
  periodos:              any[];
  montoObligatorio:      number;
  setMovimientosDetalle: Dispatch<SetStateAction<any[]>>;
}

export function useAhorroPermanenteAportes({
  setAhorros,
  selectedItem, setSelectedItem,
  periodos,
  montoObligatorio,
  setMovimientosDetalle,
}: AportesParams) {

  // ── Diálogos ───────────────────────────────────────────────────────────────
  const [isAporteDialogOpen,      setIsAporteDialogOpen]      = useState(false);
  const [isConfirmAporteBajoOpen, setIsConfirmAporteBajoOpen] = useState(false);

  // ── Formulario registrar aporte ───────────────────────────────────────────
  const [formAporteMonto,     setFormAporteMonto]     = useState('');
  const [formAporteFecha,     setFormAporteFecha]     = useState('');
  const [formAporteDesc,      setFormAporteDesc]      = useState('');
  const [formAportePeriodoId, setFormAportePeriodoId] = useState('');
  const [formComprobante,     setFormComprobante]     = useState<File | null>(null);
  const [formPagaMora,        setFormPagaMora]        = useState(false);
  const [formMoraMonto,       setFormMoraMonto]       = useState('');

  // ── Aportes pendientes reportados por asociados ───────────────────────────
  const [savingAporte,        setSavingAporte]        = useState(false);
  const [aportesPendientes,   setAportesPendientes]   = useState<any[]>([]);
  const [isRechazarAporteOpen, setIsRechazarAporteOpen] = useState(false);
  const [aporteSeleccionado,  setAporteSeleccionado]  = useState<any>(null);
  const [notaRechazoAporte,   setNotaRechazoAporte]   = useState('');

  // Sincronizar período activo cuando cargan los períodos
  useEffect(() => {
    const activo = periodos.find((p: any) => p.estado === 'activo');
    if (activo) setFormAportePeriodoId(activo.id);
  }, [periodos]);

  // ── Abrir diálogo de aporte ───────────────────────────────────────────────
  const openAporteDialog = (ahorro: any) => {
    setSelectedItem(ahorro);
    setMovimientosDetalle([]);
    setFormAporteMonto('');
    setFormAporteFecha(hoyLocal());
    setFormAporteDesc('');
    setFormComprobante(null);
    setFormPagaMora(false);
    setFormMoraMonto('');
    setIsAporteDialogOpen(true);
  };

  // ── Handler: validar y registrar aporte ──────────────────────────────────
  const handleRegistrarAporte = () => {
    if (!selectedItem) return;
    if (!formAporteFecha) { toast.error('Selecciona la fecha'); return; }

    const monto        = parseCurrencyInput(formAporteMonto);
    const montoMoraNum = parseCurrencyInput(formMoraMonto);
    const tieneAporte  = monto > 0;
    const tieneMora    = formPagaMora && montoMoraNum > 0;

    if (!tieneAporte && !tieneMora) {
      toast.error('Ingresa un monto de aporte o de mora'); return;
    }
    if (formPagaMora && montoMoraNum <= 0) {
      toast.error('Ingresa el monto de la mora'); return;
    }
    // Si hay aporte y es menor al obligatorio, pedir confirmación
    if (tieneAporte && monto < montoObligatorio) {
      setIsConfirmAporteBajoOpen(true); return;
    }
    ejecutarRegistrarAporte();
  };

  // ── Leer saldo actual desde DB de forma confiable ─────────────────────────
  const leerSaldoActual = async (cuentaId: string, fallback: number): Promise<number> => {
    try {
      const { data } = await db.from('cuentas_ahorro')
        .select('monto_ahorrado').eq('id', cuentaId).single();
      return Number(data?.monto_ahorrado) || fallback;
    } catch {
      return fallback;
    }
  };

  // ── Actualizar saldo en DB de forma confiable ─────────────────────────────
  const actualizarSaldo = async (cuentaId: string, nuevoSaldo: number): Promise<void> => {
    const { error } = await db.from('cuentas_ahorro')
      .update({ monto_ahorrado: nuevoSaldo })
      .eq('id', cuentaId);
    if (error) throw new Error('No se pudo actualizar el saldo: ' + error.message);
  };

  // ── Handler: lógica real de guardado ─────────────────────────────────────
  const ejecutarRegistrarAporte = async () => {
    const monto        = parseCurrencyInput(formAporteMonto);
    const montoMoraNum = parseCurrencyInput(formMoraMonto);
    const tieneAporte  = monto > 0;
    const tieneMora    = formPagaMora && montoMoraNum > 0;

    setSavingAporte(true);
    try {
      // Leer saldo base
      const saldoAnterior = await leerSaldoActual(selectedItem.id, selectedItem.montoAhorrado ?? 0);
      let   saldoNuevo    = saldoAnterior;

      // ── Bloque aporte (solo si hay monto de aporte) ───────────────────────
      if (tieneAporte) {
        // 1. Subir comprobante (no bloquea si falla)
        let urlComprobante: string | null = null;
        if (formComprobante && selectedItem?.asociado_id) {
          try {
            const ext  = formComprobante.name.split('.').pop() ?? 'jpg';
            const path = `comprobantes-aportes/${selectedItem.asociado_id}/${Date.now()}.${ext}`;
            const { error: upErr } = await db.storage
              .from('solicitudes-documentos')
              .upload(path, formComprobante, { upsert: true });
            if (!upErr) {
              const { data: { publicUrl } } = db.storage
                .from('solicitudes-documentos').getPublicUrl(path);
              urlComprobante = publicUrl;
            }
          } catch { /* no bloquea */ }
        }

        saldoNuevo = saldoAnterior + monto;

        // 2. Insertar transacción aporte
        const { error: movErr } = await supabase
          .from('transacciones')
          .insert({
            tipo:                'aporte_permanente',
            ahorro_id:           selectedItem.id,
            asociado_id:         selectedItem.asociado_id,
            periodo_id:          formAportePeriodoId || null,
            mes_correspondiente: formAporteFecha,
            fecha_pago:          formAporteFecha,
            monto,
            saldo_antes:         saldoAnterior,
            saldo_despues:       saldoNuevo,
            anulado:             false,
            url_comprobante:     urlComprobante,
            observacion:         formAporteDesc.trim() || null,
          });
        if (movErr) throw new Error('Error al insertar transacción: ' + movErr.message);

        // 3. Actualizar saldo en cuentas_ahorro
        await actualizarSaldo(selectedItem.id, saldoNuevo);

        // 4. Actualizar UI local — quitar mora porque ya pagó el aporte
        setSelectedItem((prev: any) => ({
          ...prev,
          montoAhorrado: saldoNuevo,
          pagadoEsteMes: true,
          enMora:        false,
          diasMora:      0,
          montoMora:     0,
        }));
        setAhorros(prev => prev.map(a =>
          a.id === selectedItem.id
            ? { ...a, montoAhorrado: saldoNuevo, pagadoEsteMes: true, enMora: false, diasMora: 0, montoMora: 0 }
            : a
        ));
      }

      // ── Bloque mora (independiente del aporte) ────────────────────────────
      if (tieneMora) {
        const { error: moraErr } = await supabase
          .from('transacciones')
          .insert({
            tipo:          'mora_permanente',
            ahorro_id:     selectedItem.id,
            asociado_id:   selectedItem.asociado_id,
            periodo_id:    formAportePeriodoId || null,
            fecha_pago:    formAporteFecha,
            monto:         montoMoraNum,
            saldo_antes:   saldoNuevo,
            saldo_despues: saldoNuevo,
            anulado:       false,
            observacion:   'Pago de mora',
          });
        if (moraErr) throw new Error('Error al insertar mora: ' + moraErr.message);
      }

      // ── Recargar historial ────────────────────────────────────────────────
      const { data: movs } = await db
        .from('transacciones')
        .select('*, periodos(nombre)')
        .eq('ahorro_id', selectedItem.id)
        .in('tipo', ['aporte_permanente', 'mora_permanente'])
        .order('fecha_pago', { ascending: false });
      setMovimientosDetalle(movs || []);

      // ── Toast según lo que se registró ───────────────────────────────────
      if (tieneAporte && tieneMora) {
        toast.success('Aporte y mora registrados', {
          description: `Aporte ${formatCurrency(monto)} + mora ${formatCurrency(montoMoraNum)} — Nuevo saldo: ${formatCurrency(saldoNuevo)}`,
        });
      } else if (tieneAporte) {
        toast.success('Aporte registrado exitosamente', {
          description: `${formatCurrency(monto)} — Nuevo saldo: ${formatCurrency(saldoNuevo)}`,
        });
      } else {
        toast.success('Mora registrada', {
          description: `${formatCurrency(montoMoraNum)} registrados como pago de mora`,
        });
      }

      setIsAporteDialogOpen(false);
      setFormAporteMonto('');
      setFormAporteFecha('');
      setFormAporteDesc('');
      setFormComprobante(null);
      setFormPagaMora(false);
      setFormMoraMonto('');
      const activo = periodos.find((p: any) => p.estado === 'activo');
      if (activo) setFormAportePeriodoId(activo.id);
    } catch (err: any) {
      toast.error('Error al registrar: ' + err.message);
    } finally {
      setSavingAporte(false);
    }
  };

  // ── Handler: confirmar aporte reportado por asociado ─────────────────────
  const handleConfirmarAporte = async (ap: any) => {
    try {
      // Leer saldo real con fallback
      const saldoAnterior = await leerSaldoActual(ap.ahorro_id, 0);
      const saldoNuevo    = saldoAnterior + ap.monto;

      const periodoId = await resolverPeriodoId();
      const { error: movErr } = await supabase
        .from('transacciones')
        .insert({
          tipo:                'aporte_permanente',
          ahorro_id:           ap.ahorro_id,
          asociado_id:         ap.asociado_id,
          periodo_id:          periodoId,
          mes_correspondiente: ap.fecha_pago,
          fecha_pago:          ap.fecha_pago,
          monto:               ap.monto,
          saldo_antes:         saldoAnterior,
          saldo_despues:       saldoNuevo,
          anulado:             false,
          observacion:         `${ap.medio_pago ?? ''}${ap.nota ? ' — ' + ap.nota : ''}`,
        });
      if (movErr) throw new Error('Error al insertar transacción: ' + movErr.message);

      // Actualizar saldo con supabaseAdmin
      await actualizarSaldo(ap.ahorro_id, saldoNuevo);

      // Notificar al asociado (usa tipo válido del schema)
      await supabase.from('notificaciones').insert({
        titulo:      '✅ Aporte confirmado',
        mensaje:     `Tu aporte de ${formatCurrency(ap.monto)} (${ap.medio_pago ?? ''}) fue confirmado. Nuevo saldo: ${formatCurrency(saldoNuevo)}.`,
        tipo:        'pago_registrado',
        leida:       false,
        usuario_id: ap.asociado_id,
      });

      setAportesPendientes(prev =>
        prev.map(a => a.id === ap.id ? { ...a, estado: 'aprobada' } : a)
      );
      setAhorros(prev =>
        prev.map(a => a.id === ap.ahorro_id ? { ...a, montoAhorrado: saldoNuevo } : a)
      );

      toast.success(`✅ Aporte de ${formatCurrency(ap.monto)} confirmado`, {
        description: `Nuevo saldo de ${ap.usuarios?.nombre ?? 'el asociado'}: ${formatCurrency(saldoNuevo)}`,
      });
    } catch (err: any) {
      toast.error('Error al confirmar el aporte: ' + err.message);
    }
  };

  // ── Handler: rechazar aporte reportado ────────────────────────────────────
  const handleRechazarAporte = async () => {
    if (!aporteSeleccionado) return;
    if (!notaRechazoAporte.trim()) { toast.error('Escribe el motivo del rechazo'); return; }
    setSavingAporte(true);
    try {
      await supabase.from('notificaciones').insert({
        titulo:      '❌ Aporte no confirmado',
        mensaje:     `Tu reporte de aporte de ${formatCurrency(aporteSeleccionado.monto)} no fue confirmado. Motivo: ${notaRechazoAporte.trim()}`,
        tipo:        'general',
        leida:       false,
        usuario_id: aporteSeleccionado.asociado_id,
      });

      setAportesPendientes(prev =>
        prev.map(a =>
          a.id === aporteSeleccionado.id
            ? { ...a, estado: 'rechazada', nota_admin: notaRechazoAporte.trim() }
            : a
        )
      );
      toast.success('Aporte rechazado y asociado notificado');
      setIsRechazarAporteOpen(false);
      setAporteSeleccionado(null);
      setNotaRechazoAporte('');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSavingAporte(false);
    }
  };

  const handleFormAporteMontoChange = (raw: string) => {
    setFormAporteMonto(formatCurrencyInput(raw));
  };

  const handleFormMoraMontoChange = (raw: string) => {
    setFormMoraMonto(formatCurrencyInput(raw));
  };

  return {
    isAporteDialogOpen,      setIsAporteDialogOpen,
    isConfirmAporteBajoOpen, setIsConfirmAporteBajoOpen,
    formAporteMonto,     setFormAporteMonto,
    formAporteFecha,     setFormAporteFecha,
    formAporteDesc,      setFormAporteDesc,
    formAportePeriodoId, setFormAportePeriodoId,
    formComprobante,     setFormComprobante,
    formPagaMora,        setFormPagaMora,
    formMoraMonto,       setFormMoraMonto,
    savingAporte,
    aportesPendientes,
    isRechazarAporteOpen,  setIsRechazarAporteOpen,
    aporteSeleccionado,    setAporteSeleccionado,
    notaRechazoAporte,     setNotaRechazoAporte,
    openAporteDialog,
    handleRegistrarAporte,
    ejecutarRegistrarAporte,
    handleConfirmarAporte,
    handleRechazarAporte,
    handleFormAporteMontoChange,
    handleFormMoraMontoChange,
  };
}
