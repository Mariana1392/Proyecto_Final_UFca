// ── useAhorroPermanenteCRUD.ts ────────────────────────────────────────────────
// Gestiona el formulario de crear/editar, los diálogos de CRUD y la
// configuración del monto obligatorio.

import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction, ChangeEvent } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { ahorroPermanenteApi } from '../../lib/api';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../../lib/formatters';
import { resolverPeriodoId, notificarAsociado } from './ahorroPermanenteUtils';

interface CRUDParams {
  setAhorros:          Dispatch<SetStateAction<any[]>>;
  asociadosDisponibles: any[];
  selectedItem:        any;
  setSelectedItem:     Dispatch<SetStateAction<any>>;
  montoObligatorio:    number;
  setMontoObligatorio: Dispatch<SetStateAction<number>>;
  invalidarAuditoria:  (id: string) => void;
}

export function useAhorroPermanenteCRUD({
  setAhorros,
  asociadosDisponibles,
  selectedItem, setSelectedItem,
  montoObligatorio, setMontoObligatorio,
  invalidarAuditoria,
}: CRUDParams) {

  // ── Diálogos ───────────────────────────────────────────────────────────────
  const [isCreateDialogOpen,      setIsCreateDialogOpen]      = useState(false);
  const [isDeleteDialogOpen,      setIsDeleteDialogOpen]      = useState(false);
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [isConfirmEditDialogOpen, setIsConfirmEditDialogOpen] = useState(false);
  const [isConfirmSaldoBajoOpen,  setIsConfirmSaldoBajoOpen]  = useState(false);

  // ── Formulario crear / editar ──────────────────────────────────────────────
  const [formAsociadoId,     setFormAsociadoId]     = useState('');
  const [formCuotaMensual,   setFormCuotaMensual]   = useState('');
  const [formSaldoInicial,   setFormSaldoInicial]   = useState('0,0');
  const [formFechaInicio,    setFormFechaInicio]    = useState('');
  const [formObservaciones,  setFormObservaciones]  = useState('');
  const [saldoInicialError,  setSaldoInicialError]  = useState('');
  const [editHasMovimientos, setEditHasMovimientos] = useState(false);
  const [loadingEditMovs,    setLoadingEditMovs]    = useState(false);

  // ── Estado cambio de estado ────────────────────────────────────────────────
  const [justificacionAnulacion,  setJustificacionAnulacion]  = useState('');
  const [nuevoEstadoSeleccionado, setNuevoEstadoSeleccionado] = useState<
    'activo' | 'inactivo' | 'anulado'
  >('inactivo');

  // ── Configuración monto obligatorio ───────────────────────────────────────
  const [isEditingMonto,       setIsEditingMonto]       = useState(false);
  const [tempMontoObligatorio, setTempMontoObligatorio] = useState(montoObligatorio.toString());

  // Sincronizar tempMontoObligatorio cuando se carga el valor real desde la BD
  useEffect(() => {
    setTempMontoObligatorio(montoObligatorio.toString());
  }, [montoObligatorio]);

  // ── Helpers de formulario ──────────────────────────────────────────────────
  const handleCuotaMensualChange = (e: ChangeEvent<HTMLInputElement>) =>
    setFormCuotaMensual(e.target.value.replace(/[^\d.,]/g, ''));

  const handleCuotaMensualBlur = () =>
    formCuotaMensual &&
    setFormCuotaMensual(formatCurrencyInput(parseCurrencyInput(formCuotaMensual).toString()));

  const handleSaldoInicialChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.,]/g, '');
    setFormSaldoInicial(raw);
    const num = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
    if (num > 0 && num < montoObligatorio) {
      setSaldoInicialError('El monto ingresado es menor al estipulado');
    } else {
      setSaldoInicialError('');
    }
  };

  const handleSaldoInicialBlur = () => {
    if (formSaldoInicial)
      setFormSaldoInicial(formatCurrencyInput(parseCurrencyInput(formSaldoInicial).toString()));
  };

  // ── Abrir diálogo crear / editar ──────────────────────────────────────────
  const handleOpenCreateDialog = async (item?: any) => {
    if (item) {
      setSelectedItem(item);
      setFormAsociadoId(item.asociado_id);
      setFormCuotaMensual(formatCurrencyInput(item.cuotaMensual.toString()));
      setFormSaldoInicial(item.montoAhorrado.toString().replace(/\./g, ','));
      setFormFechaInicio(item.fechaInicio);
      setFormObservaciones(item.observaciones || '');
      setLoadingEditMovs(true);
      setIsCreateDialogOpen(true);
      try {
        const { count } = await supabase
          .from('transacciones')
          .select('id', { count: 'exact', head: true })
          .eq('ahorro_id', item.id)
          .eq('tipo', 'aporte_permanente');
        setEditHasMovimientos((count ?? 0) > 0);
      } catch {
        setEditHasMovimientos(true);
      } finally {
        setLoadingEditMovs(false);
      }
    } else {
      setSelectedItem(null);
      setFormAsociadoId('');
      setFormCuotaMensual(formatCurrencyInput(montoObligatorio.toString()));
      setFormSaldoInicial('0,0');
      setFormFechaInicio('');
      setFormObservaciones('');
      setEditHasMovimientos(false);
      setIsCreateDialogOpen(true);
    }
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setSelectedItem(null);
    setFormObservaciones('');
    setEditHasMovimientos(false);
    setLoadingEditMovs(false);
  };

  const openAnularDialog = (ahorro: any) => {
    setSelectedItem(ahorro);
    setJustificacionAnulacion('');
    setIsDeleteDialogOpen(true);
  };

  const openToggleEstadoDialog = (ahorro: any) => {
    setSelectedItem(ahorro);
    setNuevoEstadoSeleccionado(ahorro.estado ? 'inactivo' : 'activo');
    setJustificacionAnulacion('');
    setIsToggleEstadoDialogOpen(true);
  };

  // ── Handler: cambiar estado (activo / inactivo / anulado) ─────────────────
  const handleToggleEstado = async () => {
    if (!selectedItem) return;
    const justificacion = justificacionAnulacion.trim();
    if (!justificacion) { toast.error('La justificación es obligatoria'); return; }
    try {
      const { id, asociado_id, asociado } = selectedItem;
      if (nuevoEstadoSeleccionado === 'anulado') {
        await ahorroPermanenteApi.anular(id, justificacion);
        setAhorros(prev => prev.map(a =>
          a.id === id ? { ...a, anulado: true, estado: false, motivoAnulacion: justificacion } : a
        ));
        await notificarAsociado(asociado_id, '❌ Ahorro permanente anulado',
          `Tu ahorro permanente ha sido anulado. Motivo: ${justificacion}`, 'general');
        toast.success(`Ahorro de "${asociado}" anulado`);
      } else {
        const esActivo = nuevoEstadoSeleccionado === 'activo';
        // Al reactivar, limpiar también el flag anulado por si venía de una anulación previa
        await ahorroPermanenteApi.update(id, {
          estado: esActivo ? 'activo' : 'inactivo',
          ...(esActivo && { anulado: false, motivo_anulacion: null }),
        });
        setAhorros(prev => prev.map(a => a.id === id ? { ...a, estado: esActivo, ...(esActivo && { anulado: false }) } : a));
        await notificarAsociado(
          asociado_id,
          esActivo ? '✅ Ahorro permanente activado' : '⚠️ Ahorro permanente desactivado',
          esActivo
            ? `Tu ahorro permanente ha sido reactivado. Motivo: ${justificacion}`
            : `Tu ahorro permanente ha sido desactivado. Motivo: ${justificacion}`,
          'general'
        );
        toast.success(`Ahorro de "${asociado}" ${esActivo ? 'activado' : 'desactivado'}`);
      }
      invalidarAuditoria(selectedItem.id);
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
    setIsToggleEstadoDialogOpen(false);
    setSelectedItem(null);
    setJustificacionAnulacion('');
  };

  // ── Handler: anular ahorro ────────────────────────────────────────────────
  const handleAnular = async () => {
    if (!selectedItem || !justificacionAnulacion.trim()) {
      toast.error('La justificación es obligatoria para anular un ahorro');
      return;
    }
    const justificacion = justificacionAnulacion.trim();
    try {
      const { id, asociado_id, asociado } = selectedItem;
      await ahorroPermanenteApi.anular(id, justificacion);
      setAhorros(prev => prev.map(a =>
        a.id === id ? { ...a, anulado: true, estado: false, motivoAnulacion: justificacion } : a
      ));
      await notificarAsociado(asociado_id, '❌ Ahorro permanente anulado',
        `Tu ahorro permanente ha sido anulado. Motivo: ${justificacion}`, 'general');
      invalidarAuditoria(id);
      toast.success(`Ahorro de "${asociado}" anulado exitosamente`);
    } catch (err: any) {
      toast.error('Error al anular ahorro: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedItem(null);
    setJustificacionAnulacion('');
  };

  // ── Handler: guardar monto obligatorio ────────────────────────────────────
  const handleSaveMontoObligatorio = async () => {
    const monto = parseFloat(tempMontoObligatorio);
    if (isNaN(monto) || monto <= 0) {
      toast.error('❌ Monto inválido', { description: 'El monto obligatorio debe ser mayor a cero.' });
      return;
    }
    try {
      const { error } = await supabase
        .from('configuracion')
        .upsert({
          clave:       'cuota_ahorro_permanente',
          valor:       monto.toString(),
          descripcion: 'Monto obligatorio mensual para el plan de ahorro permanente',
          updated_at:  new Date().toISOString(),
        }, { onConflict: 'clave' });
      if (error) throw error;
      setMontoObligatorio(monto);
      setIsEditingMonto(false);
      toast.success('✅ Configuración actualizada', {
        description: `Monto obligatorio: ${formatCurrency(monto)}`,
      });
    } catch (err: any) {
      toast.error('Error al guardar configuración: ' + err.message);
    }
  };

  const handleCancelEditMonto = () => {
    setTempMontoObligatorio(montoObligatorio.toString());
    setIsEditingMonto(false);
  };

  // ── Handler: guardar ahorro (crear o editar) ──────────────────────────────
  const handleSaveAhorro = async (skipSaldoCheck = false) => {
    if (!formAsociadoId) {
      toast.error('❌ Error de validación', { description: 'Selecciona un asociado' });
      return;
    }
    const cuota = parseCurrencyInput(formCuotaMensual);
    if (!cuota || cuota <= 0) {
      toast.error('❌ Error de validación', { description: 'La cuota debe ser mayor a cero' });
      return;
    }
    if (cuota < montoObligatorio) {
      toast.error('❌ Cuota insuficiente', {
        description: `La cuota mínima obligatoria es ${montoObligatorio.toLocaleString('es-CO', {
          style: 'currency', currency: 'COP', minimumFractionDigits: 0,
        })}. No se puede crear un ahorro permanente con un monto menor.`,
      });
      return;
    }
    const saldo = parseCurrencyInput(formSaldoInicial);
    if (saldo < 0) {
      toast.error('❌ Error de validación', { description: 'El saldo inicial debe ser ≥ 0' });
      return;
    }
    if (!skipSaldoCheck && saldo > 0 && saldo < montoObligatorio) {
      setIsConfirmSaldoBajoOpen(true);
      return;
    }
    if (!formFechaInicio) {
      toast.error('❌ Error de validación', { description: 'Selecciona una fecha de inicio' });
      return;
    }
    if (selectedItem && !selectedItem.estado) {
      toast.error('Solo se pueden editar ahorros en estado Activo');
      return;
    }

    if (!selectedItem) {
      // Traer historial de ahorros permanentes del asociado
      const currentYear = new Date().getFullYear();
      const firstDayOfYear = new Date(currentYear, 0, 1).toISOString();
      
      const { data: historial } = await supabase
        .from('cuentas_ahorro')
        .select('*')
        .eq('tipo', 'permanente')
        .eq('asociado_id', formAsociadoId);

      const historialAhorros = historial || [];

      // Regla 1: Solo 1 ahorro activo a la vez
      const activo = historialAhorros.find((h: any) => h.estado === 'activo' || (!h.anulado && h.estado !== 'cerrado'));
      if (activo) {
        toast.error('El asociado ya tiene un ahorro permanente activo', {
          description: 'No se puede crear otro hasta que el actual sea anulado o liquidado.',
        });
        return;
      }

      // Regla 2: Máximo 3 por año
      const historialYear = historialAhorros.filter((h: any) => h.created_at >= firstDayOfYear);
      if (historialYear.length >= 3) {
        toast.error('Límite anual alcanzado', {
          description: 'El asociado ya ha alcanzado el límite de 3 ahorros permanentes este año.',
        });
        return;
      }

      // Regla 3: Mínimo 2 días (48 horas) de espera desde la última anulación
      const anulados = historialAhorros.filter((h: any) => h.anulado === true);
      if (anulados.length > 0) {
        // Ordenar del más reciente al más antiguo
        anulados.sort((a: any, b: any) => {
          const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
          const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
          return dateB - dateA;
        });

        const ultimoAnulado = anulados[0];
        const fechaAnulacion = new Date(ultimoAnulado.updated_at || ultimoAnulado.created_at);
        const hoy = new Date();
        const diffHours = (hoy.getTime() - fechaAnulacion.getTime()) / (1000 * 60 * 60);

        if (diffHours < 48) {
          toast.error('Tiempo de espera no cumplido', {
            description: `Deben pasar al menos 48 horas desde la última anulación para crear uno nuevo (han pasado ${Math.floor(diffHours)} horas).`,
          });
          return;
        }
      }
    }

    const asociado = asociadosDisponibles.find((a: any) => a.id === formAsociadoId);

    try {
      if (selectedItem) {
        const updatePayload: Record<string, any> = {
          cuota_mensual: cuota,
          observaciones: formObservaciones.trim() || null,
        };
        await ahorroPermanenteApi.update(selectedItem.id, updatePayload);

        const localUpdate: Record<string, any> = {
          cuotaMensual:  cuota,
          observaciones: formObservaciones.trim(),
        };
        setAhorros(prev => prev.map(a =>
          a.id === selectedItem.id ? { ...a, ...localUpdate } : a
        ));

        const cambios: string[] = [];
        if (cuota !== selectedItem.cuotaMensual) cambios.push(`cuota: ${formatCurrency(cuota)}`);
        if (formObservaciones.trim() !== selectedItem.observaciones) cambios.push('observaciones actualizadas');
        toast.success('✅ Ahorro actualizado', {
          description: cambios.length > 0
            ? cambios.join(' · ')
            : `Sin cambios en "${selectedItem.asociado}"`,
        });
      } else {
        const periodoIdCreacion = await resolverPeriodoId();
        if (!periodoIdCreacion) {
          toast.error('No hay un período contable activo. Activa un período antes de crear el ahorro.');
          return;
        }
        const nuevo = await ahorroPermanenteApi.create({
          asociado_id:    formAsociadoId,
          cuota_mensual:  cuota,
          monto_ahorrado: saldo,
          estado:         'activo',
          anulado:        false,
          periodo_id:     periodoIdCreacion,
        });

        if (saldo > 0) {
          // Reutiliza periodoIdCreacion — ya resuelto arriba, no hace falta una segunda query
          const fechaApertura = formFechaInicio || new Date().toISOString().split('T')[0];
          const { error: movErr } = await supabase
            .from('transacciones')
            .insert({
              tipo:                 'aporte_permanente',
              ahorro_id:            nuevo.id,
              asociado_id:          formAsociadoId,
              periodo_id:           periodoIdCreacion,
              mes_correspondiente:  fechaApertura,
              fecha_pago:           fechaApertura,
              monto:                saldo,
              saldo_antes:          0,
              saldo_despues:        saldo,
              anulado:              false,
              observacion:          'Saldo inicial cargado al crear el plan',
            });
          if (movErr) toast.error('Ahorro creado, pero error al registrar saldo inicial: ' + movErr.message);
        }

        const nowIso = new Date().toISOString();
        setAhorros(prev => [{
          id:              nuevo.id,
          asociado:        asociado?.nombre ?? '',
          cedula:          asociado?.cedula ?? '',
          asociado_id:     formAsociadoId,
          montoAhorrado:   saldo,
          cuotaMensual:    cuota,
          fechaInicio:     nowIso.split('T')[0],
          estado:          true,
          anulado:         false,
          motivoAnulacion: '',
          createdAt:       nowIso,
        }, ...prev]);
        toast.success('✅ Ahorro registrado exitosamente', {
          description: saldo > 0
            ? `Saldo inicial: ${formatCurrency(saldo)} | Cuota mensual: ${formatCurrency(cuota)}`
            : `Cuota mensual: ${formatCurrency(cuota)}`,
        });
      }
    } catch (err: any) {
      const msg: string = err.message ?? '';
      if (msg.includes('uq_cuentas_ahorro_asociado_permanente') || msg.includes('duplicate key') || msg.includes('unique constraint')) {
        toast.error('Este asociado ya tiene una cuenta de ahorro permanente', {
          description: 'Solo se permite una cuenta de ahorro permanente por asociado.',
        });
      } else {
        toast.error('Error al guardar ahorro: ' + msg);
      }
    }

    setIsCreateDialogOpen(false);
    setSelectedItem(null);
    setFormAsociadoId('');
    setFormCuotaMensual('');
    setFormSaldoInicial('0,0');
    setFormFechaInicio('');
    setFormObservaciones('');
    setEditHasMovimientos(false);
    setLoadingEditMovs(false);
  };

  return {
    // Diálogos
    isCreateDialogOpen,      setIsCreateDialogOpen,
    isDeleteDialogOpen,      setIsDeleteDialogOpen,
    isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen,
    isConfirmEditDialogOpen, setIsConfirmEditDialogOpen,
    isConfirmSaldoBajoOpen,  setIsConfirmSaldoBajoOpen,
    // Formulario crear / editar
    formAsociadoId,    setFormAsociadoId,
    formCuotaMensual,  setFormCuotaMensual,
    formSaldoInicial,
    formFechaInicio,   setFormFechaInicio,
    formObservaciones, setFormObservaciones,
    saldoInicialError,
    editHasMovimientos,
    loadingEditMovs,
    // Estado cambio
    justificacionAnulacion,  setJustificacionAnulacion,
    nuevoEstadoSeleccionado, setNuevoEstadoSeleccionado,
    // Monto obligatorio
    isEditingMonto,       setIsEditingMonto,
    tempMontoObligatorio, setTempMontoObligatorio,
    // Handlers
    handleCuotaMensualChange,
    handleCuotaMensualBlur,
    handleSaldoInicialChange,
    handleSaldoInicialBlur,
    handleOpenCreateDialog,
    closeCreateDialog,
    openAnularDialog,
    openToggleEstadoDialog,
    handleToggleEstado,
    handleAnular,
    handleSaveMontoObligatorio,
    handleCancelEditMonto,
    handleSaveAhorro,
  };
}
