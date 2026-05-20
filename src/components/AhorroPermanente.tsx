import { useState, useEffect, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Search, Plus, Eye, ChevronLeft, ChevronRight, Edit, Trash2, Ban,
  PiggyBank, Check, X, FileText, Calendar, TrendingUp, History,
  AlertTriangle, DollarSign, ClipboardList, Clock, CheckCircle2,
  XCircle, Send, Loader2, ChevronDown,
} from 'lucide-react';
import { Textarea } from './ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { generateAhorroPermanentePDF } from './utils/pdfGenerator';

import { supabase } from '../lib/supabase';
import { ahorroPermanenteApi, asociadosApi } from '../lib/api';

interface AhorroPermanenteProps {
  userRole?: 'admin' | 'asociado' | null;
  userData?: any;
}

export default function AhorroPermanente({ userRole, userData }: AhorroPermanenteProps) {
  const [searchTerm, setSearchTerm]               = useState('');
  const [currentPage, setCurrentPage]             = useState(1);
  const [currentPageAnulados, setCurrentPageAnulados] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen]   = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen]   = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]   = useState(false);
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [isPdfRangeDialogOpen, setIsPdfRangeDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem]           = useState<any>(null);
  const [montoObligatorio, setMontoObligatorio]   = useState<number>(50000);
  const [isEditingMonto, setIsEditingMonto]       = useState(false);
  const [tempMontoObligatorio, setTempMontoObligatorio] = useState<string>('50000');
  const [formAsociadoId, setFormAsociadoId]       = useState<string>('');
  const [formCuotaMensual, setFormCuotaMensual]   = useState<string>('');
  const [formSaldoInicial, setFormSaldoInicial]   = useState<string>('0,0');
  const [formFechaInicio, setFormFechaInicio]     = useState<string>('');
  const [sortBy, setSortBy] = useState<'default'|'saldo-desc'|'saldo-asc'|'antiguedad-desc'|'antiguedad-asc'>('default');
  const [justificacionAnulacion, setJustificacionAnulacion] = useState('');
  const [nuevoEstadoSeleccionado, setNuevoEstadoSeleccionado] = useState<'activo'|'inactivo'|'anulado'>('inactivo');
  const [movimientosDetalle, setMovimientosDetalle] = useState<any[]>([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [pdfRangeInicio, setPdfRangeInicio]       = useState('');
  const [pdfRangeFin, setPdfRangeFin]             = useState('');
  const [ahorroPdfSelected, setAhorroPdfSelected] = useState<any>(null);
  const [isAporteDialogOpen, setIsAporteDialogOpen] = useState(false);
  const [formAporteMonto, setFormAporteMonto]       = useState('');
  const [formAporteFecha, setFormAporteFecha]       = useState('');
  const [formAporteDesc, setFormAporteDesc]         = useState('');
  const [formAportePeriodoId, setFormAportePeriodoId] = useState('');
  const [periodos, setPeriodos]                     = useState<any[]>([]);
  const [isConfirmEditDialogOpen, setIsConfirmEditDialogOpen] = useState(false);
  const [isConfirmSaldoBajoOpen,  setIsConfirmSaldoBajoOpen]  = useState(false);
  const [isConfirmAporteBajoOpen, setIsConfirmAporteBajoOpen] = useState(false);
  const [formObservaciones, setFormObservaciones]             = useState<string>('');
  const [editHasMovimientos, setEditHasMovimientos]           = useState<boolean>(false);
  const [loadingEditMovs, setLoadingEditMovs]                 = useState<boolean>(false);
  const itemsPerPage = 10;

  // ── Solicitudes de ahorro permanente (solo admin) ────────────────────────
  const [solicitudes, setSolicitudes]                   = useState<any[]>([]);
  const [isRechazarDialogOpen, setIsRechazarDialogOpen] = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<any>(null);
  const [notaRechazo, setNotaRechazo]                   = useState('');
  const [savingSolicitud, setSavingSolicitud]           = useState(false);

  // ── Aportes reportados por asociados (admin) ──────────────────────────────
  const [aportesPendientes, setAportesPendientes]       = useState<any[]>([]);
  const [isRechazarAporteOpen, setIsRechazarAporteOpen] = useState(false);
  const [aporteSeleccionado, setAporteSeleccionado]     = useState<any>(null);
  const [notaRechazoAporte, setNotaRechazoAporte]       = useState('');
  const [savingAporte, setSavingAporte]                 = useState(false);

  const [ahorros, setAhorros]                     = useState<any[]>([]);
  const [asociadosDisponibles, setAsociadosDisponibles] = useState<any[]>([]);
  const [loading, setLoading]                     = useState(true);

  // ── Auditoría desplegable ─────────────────────────────────────────────────
  const [expandedAhorroId, setExpandedAhorroId]       = useState<string | null>(null);
  const [auditoriaPorAhorro, setAuditoriaPorAhorro]   = useState<Record<string, any[]>>({});
  const [loadingAuditoria, setLoadingAuditoria]       = useState<string | null>(null);


  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      const [{ data, error }, asociadosData, configData, periodosData] = await Promise.all([
        supabase
          .from('ahorros_permanentes')
          .select('*, asociados(nombre, cedula)')
          .order('created_at', { ascending: false }),
        asociadosApi.getAll(),
        supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', 'cuota_ahorro_permanente')
          .maybeSingle(),
        supabase
          .from('periodos')
          .select('id, nombre, estado, fecha_inicio, fecha_fin')
          .order('fecha_inicio', { ascending: false }),
      ]);
      if (!periodosData.error && periodosData.data) {
        setPeriodos(periodosData.data);
        // Pre-seleccionar el período activo
        const activo = periodosData.data.find((p: any) => p.estado === 'activo');
        if (activo) setFormAportePeriodoId(activo.id);
      }
      if (error) throw error;
      if (!configData.error && configData.data) {
        const monto = parseFloat(configData.data.valor);
        if (!isNaN(monto) && monto > 0) {
          setMontoObligatorio(monto);
          setTempMontoObligatorio(monto.toString());
        }
      }


      const mapeados = (data || []).map((a: any) => ({
        id:            a.id,
        asociado:      a.asociados?.nombre  ?? 'Sin nombre',
        cedula:        a.asociados?.cedula  ?? '',
        asociado_id:   a.asociado_id,
        montoAhorrado: Number(a.monto_ahorrado) || 0,
        cuotaMensual:  a.cuota_mensual,
        fechaInicio:   a.created_at?.split('T')[0] ?? '',
        estado:        a.estado === 'activo',
        anulado:       a.anulado,
        motivoAnulacion: a.motivo_anulacion || '',
        observaciones: a.observaciones || '',
        createdAt:     a.created_at,
      }));

      setAhorros(mapeados);

      // Excluir del selector a los asociados que ya tienen ahorro permanente activo
      const idsConAhorro = new Set(
        mapeados.filter(a => a.estado === true && !a.anulado).map(a => a.asociado_id)
      );
      setAsociadosDisponibles(
        (asociadosData || []).filter((a: any) => !idsConAhorro.has(a.id))
      );

      // solicitudes_ahorro y solicitudes_aporte no existen en el esquema actual
      // Las solicitudes y aportes se gestionan directamente desde ahorros_permanentes y pagos_ahorro_permanente
    } catch (err: any) {
      toast.error('Error al cargar ahorros: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Filtros / orden / paginación ──────────────────────────────────────────
  const ahorrosActivos = userRole === 'asociado'
    ? ahorros.filter(a => a.cedula === userData?.cedula && !a.anulado)
    : ahorros.filter(a => !a.anulado);

  const filteredAhorros = ahorrosActivos.filter(a => {
    const term = searchTerm.toLowerCase();
    return !term ||
      a.asociado.toLowerCase().includes(term) ||
      a.cedula.includes(searchTerm) ||
      a.id.toLowerCase().includes(term);
  });

  const sortAhorros = (list: any[]) => {
    const s = [...list];
    switch (sortBy) {
      case 'saldo-desc':      return s.sort((a, b) => b.montoAhorrado - a.montoAhorrado);
      case 'saldo-asc':       return s.sort((a, b) => a.montoAhorrado - b.montoAhorrado);
      case 'antiguedad-desc': return s.sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
      case 'antiguedad-asc':  return s.sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime());
      default: return s;
    }
  };
  const sortedAhorros = sortAhorros(filteredAhorros);

  const ahorrosAnulados = userRole === 'asociado'
    ? ahorros.filter(a => a.cedula === userData?.cedula && a.anulado)
    : ahorros.filter(a => a.anulado);

  const filteredAhorrosAnulados = ahorrosAnulados.filter(a => {
    const term = searchTerm.toLowerCase();
    return !term || a.asociado.toLowerCase().includes(term) || a.cedula.includes(searchTerm);
  });

  const totalPages      = Math.ceil(sortedAhorros.length / itemsPerPage);
  const startIndex      = (currentPage - 1) * itemsPerPage;
  const endIndex        = startIndex + itemsPerPage;
  const currentAhorros  = sortedAhorros.slice(startIndex, endIndex);

  const totalPagesAnulados   = Math.ceil(filteredAhorrosAnulados.length / itemsPerPage);
  const startIndexAnulados   = (currentPageAnulados - 1) * itemsPerPage;
  const endIndexAnulados     = startIndexAnulados + itemsPerPage;
  const currentAhorrosAnulados = filteredAhorrosAnulados.slice(startIndexAnulados, endIndexAnulados);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const formatCurrencyInput = (value: string): string => {
    const clean = value.replace(/[^\d.]/g, '');
    if (!clean) return '';
    const num = parseFloat(clean);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(num);
  };
  const parseCurrencyInput = (v: string): number =>
    parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;

  const handleCuotaMensualChange  = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormCuotaMensual(e.target.value.replace(/[^\d.,]/g, ''));
  const handleCuotaMensualBlur    = () =>
    formCuotaMensual && setFormCuotaMensual(formatCurrencyInput(parseCurrencyInput(formCuotaMensual).toString()));
  const [saldoInicialError, setSaldoInicialError] = useState<string>('');

  const handleSaldoInicialChange  = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.,]/g, '');
    setFormSaldoInicial(raw);
    const num = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
    if (num > 0 && num < montoObligatorio) {
      setSaldoInicialError(
        `El saldo inicial debe ser igual o mayor a ${montoObligatorio.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}`
      );
    } else {
      setSaldoInicialError('');
    }
  };
  const handleSaldoInicialBlur    = () => {
    if (formSaldoInicial) setFormSaldoInicial(formatCurrencyInput(parseCurrencyInput(formSaldoInicial).toString()));
  };

  const handleOpenCreateDialog = async (item?: any) => {
    if (item) {
      setSelectedItem(item);
      setFormAsociadoId(item.asociado_id);
      setFormCuotaMensual(formatCurrencyInput(item.cuotaMensual.toString()));
      setFormSaldoInicial(item.montoAhorrado.toString().replace(/\./g, ','));
      setFormFechaInicio(item.fechaInicio);
      setFormObservaciones(item.observaciones || '');
      // Verificar si ya hay pagos registrados (determina si la fecha de inicio es editable)
      setLoadingEditMovs(true);
      setIsCreateDialogOpen(true);
      try {
        const { count } = await supabase
          .from('pagos_ahorro_permanente')
          .select('id', { count: 'exact', head: true })
          .eq('ahorro_permanente_id', item.id);
        setEditHasMovimientos((count ?? 0) > 0);
      } catch {
        setEditHasMovimientos(true); // En caso de error, tratar como si hubiera movimientos (más seguro)
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

  // ── Abrir detalle y cargar movimientos ───────────────────────────────────
  const handleOpenDetail = async (ahorro: any) => {
    setSelectedItem(ahorro);
    setMovimientosDetalle([]);
    setIsDetailDialogOpen(true);
    setLoadingMovimientos(true);
    try {
      const { data, error } = await supabase
        .from('pagos_ahorro_permanente')
        .select('*, periodos(nombre)')
        .eq('ahorro_permanente_id', ahorro.id)
        .order('fecha_pago', { ascending: false });
      if (!error && data) {
        setMovimientosDetalle(data);
        // Sincronizar saldo real en la lista
        const ultimoMov = data.filter((m: any) => !m.anulado)[0];
        if (ultimoMov) {
          const saldoReal = ultimoMov.saldo_nuevo;
          setAhorros(prev => prev.map(a =>
            a.id === ahorro.id ? { ...a, montoAhorrado: saldoReal } : a
          ));
          setSelectedItem((prev: any) => ({ ...prev, montoAhorrado: saldoReal }));
        }
      }
    } catch { /* sin movimientos aún */ }
    setLoadingMovimientos(false);
  };

  // ── Auditoría: carga lazy por ahorro ─────────────────────────────────────
  const cargarAuditoria = async (ahorroId: string) => {
    if (expandedAhorroId === ahorroId) { setExpandedAhorroId(null); return; }
    if (auditoriaPorAhorro[ahorroId]) { setExpandedAhorroId(ahorroId); return; }
    setLoadingAuditoria(ahorroId);
    const { data } = await supabase
      .from('pagos_ahorro_permanente')
      .select('*')
      .eq('ahorro_permanente_id', ahorroId)
      .order('created_at', { ascending: false });
    setAuditoriaPorAhorro(prev => ({ ...prev, [ahorroId]: data ?? [] }));
    setExpandedAhorroId(ahorroId);
    setLoadingAuditoria(null);
  };

  const invalidarAuditoria = (ahorroId: string) =>
    setAuditoriaPorAhorro(prev => { const n = { ...prev }; delete n[ahorroId]; return n; });

  // ── Helpers compartidos ───────────────────────────────────────────────────
  // registrarAjuste eliminado — movimientos_ahorro no existe en el esquema.
  // Los cambios de estado quedan auditados vía updated_at en ahorros_permanentes.

  const notificarAsociado = (asociadoId: string, titulo: string, mensaje: string, tipo: string) =>
    supabase.from('notificaciones').insert({ titulo, mensaje, tipo, leida: false, asociado_id: asociadoId });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleToggleEstado = async () => {
    if (!selectedItem) return;
    const justificacion = justificacionAnulacion.trim();
    if (!justificacion) {
      toast.error('La justificación es obligatoria');
      return;
    }
    try {
      const { id, asociado_id, asociado, montoAhorrado } = selectedItem;
      if (nuevoEstadoSeleccionado === 'anulado') {
        await ahorroPermanenteApi.anular(id, justificacion);
        setAhorros(prev => prev.map(a =>
          a.id === id ? { ...a, anulado: true, estado: false, motivoAnulacion: justificacion } : a
        ));
        await notificarAsociado(asociado_id, '❌ Ahorro permanente anulado',
          `Tu ahorro permanente ha sido anulado. Motivo: ${justificacion}`, 'ahorro_anulado');
        toast.success(`Ahorro de "${asociado}" anulado`);
      } else {
        const esActivo = nuevoEstadoSeleccionado === 'activo';
        await ahorroPermanenteApi.update(id, { estado: esActivo ? 'activo' : 'inactivo' });
        setAhorros(prev => prev.map(a => a.id === id ? { ...a, estado: esActivo } : a));
        await notificarAsociado(
          asociado_id,
          esActivo ? '✅ Ahorro permanente activado' : '⚠️ Ahorro permanente desactivado',
          esActivo
            ? `Tu ahorro permanente ha sido reactivado. Motivo: ${justificacion}`
            : `Tu ahorro permanente ha sido desactivado. Motivo: ${justificacion}`,
          esActivo ? 'ahorro_activado' : 'ahorro_inactivado'
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

  const handleAnular = async () => {
    if (!selectedItem || !justificacionAnulacion.trim()) {
      toast.error('La justificación es obligatoria para anular un ahorro');
      return;
    }
    const justificacion = justificacionAnulacion.trim();
    try {
      const { id, asociado_id, asociado, montoAhorrado } = selectedItem;
      await ahorroPermanenteApi.anular(id, justificacion);
      setAhorros(prev => prev.map(a =>
        a.id === id ? { ...a, anulado: true, estado: false, motivoAnulacion: justificacion } : a
      ));
      await notificarAsociado(asociado_id, '❌ Ahorro permanente anulado',
        `Tu ahorro permanente ha sido anulado. Motivo: ${justificacion}`, 'ahorro_anulado');
      invalidarAuditoria(id);
      toast.success(`Ahorro de "${asociado}" anulado exitosamente`);
    } catch (err: any) {
      toast.error('Error al anular ahorro: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedItem(null);
    setJustificacionAnulacion('');
  };

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
          clave: 'cuota_ahorro_permanente',
          valor: monto.toString(),
          descripcion: 'Monto obligatorio mensual para el plan de ahorro permanente',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'clave' });
      if (error) throw error;
      setMontoObligatorio(monto);
      setIsEditingMonto(false);
      toast.success('✅ Configuración actualizada', { description: `Monto obligatorio: ${formatCurrency(monto)}` });
    } catch (err: any) {
      toast.error('Error al guardar configuración: ' + err.message);
    }
  };

  const handleCancelEditMonto = () => {
    setTempMontoObligatorio(montoObligatorio.toString());
    setIsEditingMonto(false);
  };



  const handleSaveAhorro = async (skipSaldoCheck = false) => {
    if (!formAsociadoId) { toast.error('❌ Error de validación', { description: 'Selecciona un asociado' }); return; }
    const cuota = parseCurrencyInput(formCuotaMensual);
    if (!cuota || cuota <= 0) { toast.error('❌ Error de validación', { description: 'La cuota debe ser mayor a cero' }); return; }
    if (cuota < montoObligatorio) {
      toast.error('❌ Cuota insuficiente', {
        description: `La cuota mínima obligatoria es ${montoObligatorio.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}. No se puede crear un ahorro permanente con un monto menor.`,
      });
      return;
    }
    const saldo = parseCurrencyInput(formSaldoInicial);
    if (saldo < 0) { toast.error('❌ Error de validación', { description: 'El saldo inicial debe ser ≥ 0' }); return; }
    if (!skipSaldoCheck && saldo > 0 && saldo < montoObligatorio) {
      setIsConfirmSaldoBajoOpen(true);
      return;
    }
    if (!formFechaInicio) { toast.error('❌ Error de validación', { description: 'Selecciona una fecha de inicio' }); return; }

    // Solo ahorros activos pueden ser editados
    if (selectedItem && !selectedItem.estado) {
      toast.error('Solo se pueden editar ahorros en estado Activo');
      return;
    }

    // Al CREAR: verificar que el asociado no tenga ya un ahorro permanente activo
    if (!selectedItem) {
      const { data: existente } = await supabase
        .from('ahorros_permanentes')
        .select('id')
        .eq('asociado_id', formAsociadoId)
        .eq('estado', 'activo')
        .eq('anulado', false)
        .limit(1);
      if (existente && existente.length > 0) {
        toast.error('El asociado ya tiene un ahorro permanente activo', {
          description: 'No se puede crear otro hasta que el actual sea liquidado en la fecha de corte.',
        });
        return;
      }
    }

    const asociado = asociadosDisponibles.find(a => a.id === formAsociadoId);

    try {
      if (selectedItem) {
        // Construir payload de actualización (fecha_inicio no existe en el esquema)
        const updatePayload: Record<string, any> = { cuota_mensual: cuota };
        await ahorroPermanenteApi.update(selectedItem.id, updatePayload);

        // Guardar observaciones por separado para no romper si la columna no existe
        if (formObservaciones.trim() !== selectedItem.observaciones) {
          try {
            await supabase
              .from('ahorros_permanentes')
              .update({ observaciones: formObservaciones.trim() || null })
              .eq('id', selectedItem.id);
          } catch { /* columna observaciones opcional */ }
        }

        // Actualizar estado local
        const localUpdate: Record<string, any> = {
          cuotaMensual:  cuota,
          observaciones: formObservaciones.trim(),
        };
        setAhorros(prev => prev.map(a =>
          a.id === selectedItem.id ? { ...a, ...localUpdate } : a
        ));

        // Mensaje con los cambios realizados
        const cambios: string[] = [];
        if (cuota !== selectedItem.cuotaMensual) cambios.push(`cuota: ${formatCurrency(cuota)}`);
        if (formObservaciones.trim() !== selectedItem.observaciones) cambios.push('observaciones actualizadas');
        toast.success('✅ Ahorro actualizado', {
          description: cambios.length > 0
            ? cambios.join(' · ')
            : `Sin cambios en "${selectedItem.asociado}"`,
        });
      } else {
        const nuevo = await ahorroPermanenteApi.create({
          asociado_id:    formAsociadoId,
          cuota_mensual:  cuota,
          monto_ahorrado: saldo,
          estado:         'activo',
          anulado:        false,
        });

        // Si el saldo inicial es mayor a 0, registrar pago de apertura
        if (saldo > 0) {
          const periodoId = await resolverPeriodoId();
          const fechaApertura = formFechaInicio || new Date().toISOString().split('T')[0];
          const { error: movErr } = await supabase
            .from('pagos_ahorro_permanente')
            .insert({
              ahorro_permanente_id: nuevo.id,
              asociado_id:          formAsociadoId,
              periodo_id:           periodoId,
              mes_correspondiente:  fechaApertura,
              fecha_pago:           fechaApertura,
              fecha_movimiento:     fechaApertura,
              monto_cuota:          saldo,
              monto_total_pagado:   saldo,
              monto:                saldo,
              saldo_anterior:       0,
              saldo_nuevo:          saldo,
              tipo_movimiento:      'Apertura',
              anulado:              false,
              observacion:          'Saldo inicial cargado al crear el plan',
            });
          if (movErr) toast.error('Ahorro creado, pero error al registrar saldo inicial: ' + movErr.message);
        }

        const nowIso = new Date().toISOString();
        setAhorros(prev => [{
          id: nuevo.id,
          asociado:      asociado?.nombre ?? '',
          cedula:        asociado?.cedula ?? '',
          asociado_id:   formAsociadoId,
          montoAhorrado: saldo,
          cuotaMensual:  cuota,
          fechaInicio:   nowIso.split('T')[0],
          estado:        true,
          anulado:       false,
          motivoAnulacion: '',
          createdAt:     nowIso,
        }, ...prev]);
        toast.success('✅ Ahorro registrado exitosamente', {
          description: saldo > 0
            ? `Saldo inicial: ${formatCurrency(saldo)} | Cuota mensual: ${formatCurrency(cuota)}`
            : `Cuota mensual: ${formatCurrency(cuota)}`,
        });
      }
    } catch (err: any) {
      toast.error('Error al guardar ahorro: ' + err.message);
    }

    setIsCreateDialogOpen(false);
    setSelectedItem(null);
    setFormAsociadoId(''); setFormCuotaMensual(''); setFormSaldoInicial('0,0'); setFormFechaInicio('');
    setFormObservaciones(''); setEditHasMovimientos(false); setLoadingEditMovs(false);
  };

  // ── Helper: obtiene el id del período activo (o null si no existe) ──────────
  async function resolverPeriodoId(): Promise<string | null> {
    const { data } = await supabase
      .from('periodos')
      .select('id')
      .eq('estado', 'activo')
      .order('fecha_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  }

  // ── Registrar aporte — punto de entrada (valida y muestra advertencia si aplica) ──
  const handleRegistrarAporte = () => {
    const monto = parseCurrencyInput(formAporteMonto);
    const hoy   = new Date().toISOString().split('T')[0];
    if (!monto || monto <= 0)    { toast.error('El monto debe ser mayor a cero'); return; }
    if (!formAporteFecha)        { toast.error('Selecciona la fecha del aporte'); return; }
    if (formAporteFecha < hoy)   { toast.error('La fecha del aporte no puede ser anterior a hoy'); return; }
    if (!selectedItem)           return;

    // Advertencia si el monto está por debajo del mínimo obligatorio
    if (monto < montoObligatorio) {
      setIsConfirmAporteBajoOpen(true);
      return;
    }

    ejecutarRegistrarAporte();
  };

  // ── Lógica real de guardado (llamada directamente o tras confirmación) ────
  const ejecutarRegistrarAporte = async () => {
    const monto = parseCurrencyInput(formAporteMonto);   // re-parsear: esta función no tiene acceso al scope de handleRegistrarAporte
    setSavingAporte(true);
    try {
      // Usar saldo real desde BD para evitar desincronización
      const { data: dbAhorro } = await supabase
        .from('ahorros_permanentes')
        .select('monto_ahorrado')
        .eq('id', selectedItem.id)
        .single();
      const saldoAnterior = dbAhorro?.monto_ahorrado ?? selectedItem.montoAhorrado;
      const saldoNuevo    = saldoAnterior + monto;

      // Insertar pago — periodo_id elegido por el admin en el formulario
      const { error: movErr } = await supabase
        .from('pagos_ahorro_permanente')
        .insert({
          ahorro_permanente_id: selectedItem.id,
          asociado_id:          selectedItem.asociado_id,
          periodo_id:           formAportePeriodoId || null,
          mes_correspondiente:  formAporteFecha,
          fecha_pago:           formAporteFecha,
          fecha_movimiento:     formAporteFecha,
          monto_cuota:          monto,
          monto_total_pagado:   monto,
          monto:                monto,
          saldo_anterior:       saldoAnterior,
          saldo_nuevo:          saldoNuevo,
          tipo_movimiento:      'Aporte',
          anulado:              false,
          observacion:          formAporteDesc.trim() || null,
        });
      if (movErr) throw movErr;

      // Actualizar saldo en ahorros_permanentes
      const { data: updData, error: updErr } = await supabase
        .from('ahorros_permanentes')
        .update({ monto_ahorrado: saldoNuevo })
        .eq('id', selectedItem.id)
        .select('monto_ahorrado')
        .single();
      if (updErr) throw updErr;

      // Usar el saldo confirmado por la BD
      const saldoConfirmado = updData?.monto_ahorrado ?? saldoNuevo;
      setSelectedItem((prev: any) => ({ ...prev, montoAhorrado: saldoConfirmado }));
      setAhorros(prev => prev.map(a =>
        a.id === selectedItem.id ? { ...a, montoAhorrado: saldoConfirmado } : a
      ));

      // Recargar pagos con nombre del período
      const { data: movs } = await supabase
        .from('pagos_ahorro_permanente')
        .select('*, periodos(nombre)')
        .eq('ahorro_permanente_id', selectedItem.id)
        .order('fecha_pago', { ascending: false });
      setMovimientosDetalle(movs || []);

      toast.success('Aporte registrado exitosamente', {
        description: `${formatCurrency(monto)} — Nuevo saldo: ${formatCurrency(saldoNuevo)}`,
      });
      setIsAporteDialogOpen(false);
      setFormAporteMonto('');
      setFormAporteFecha('');
      setFormAporteDesc('');
      // Restaurar período activo como selección por defecto
      const activo = periodos.find((p: any) => p.estado === 'activo');
      if (activo) setFormAportePeriodoId(activo.id);
    } catch (err: any) {
      toast.error('Error al registrar aporte: ' + err.message);
    } finally {
      setSavingAporte(false);
    }
  };

  // ── Generar PDF con rango de fechas ───────────────────────────────────────
  const handleOpenPdfDialog = async (ahorro: any) => {
    setAhorroPdfSelected(ahorro);
    const hoy = new Date().toISOString().split('T')[0];
    setPdfRangeFin(hoy);
    setPdfRangeInicio(ahorro.fechaInicio || hoy);
    setIsPdfRangeDialogOpen(true);

    // Cargar pagos reales desde la BD para este ahorro
    try {
      const { data, error } = await supabase
        .from('pagos_ahorro_permanente')
        .select('*')
        .eq('ahorro_permanente_id', ahorro.id)
        .order('fecha_pago', { ascending: true });
      if (!error) setMovimientosDetalle(data || []);
    } catch { /* ignorar */ }
  };

  const handleGenerarPDF = () => {
    if (!ahorroPdfSelected) return;
    if (!pdfRangeInicio || !pdfRangeFin) {
      toast.error('Selecciona el rango de fechas para el extracto');
      return;
    }
    if (new Date(pdfRangeInicio) > new Date(pdfRangeFin)) {
      toast.error('La fecha de inicio no puede ser mayor a la fecha de fin');
      return;
    }
    const movsFiltrados = movimientosDetalle.filter(m => {
      const fm = m.fecha_pago ?? m.fecha_movimiento;
      return fm >= pdfRangeInicio && fm <= pdfRangeFin;
    });
    const pdfData = {
      asociado:          ahorroPdfSelected.asociado,
      cedula:            ahorroPdfSelected.cedula,
      fechaAfiliacion:   ahorroPdfSelected.fechaInicio,
      aporteActual:      ahorroPdfSelected.cuotaMensual,
      fechaUltimoAporte: (movsFiltrados[0]?.fecha_pago ?? movsFiltrados[0]?.fecha_movimiento) ?? ahorroPdfSelected.fechaInicio,
      totalAportes:      movsFiltrados.length,
      saldoAcumulado:    ahorroPdfSelected.montoAhorrado,
      estado:            ahorroPdfSelected.estado,
      rangoInicio:       pdfRangeInicio,
      rangoFin:          pdfRangeFin,
      movimientos:       movsFiltrados,
    };
    const success = generateAhorroPermanentePDF(pdfData);
    if (success) {
      toast.success('PDF de ahorro permanente descargado correctamente');
    } else {
      toast.error('Error al generar el PDF. Intenta nuevamente.');
    }
    setIsPdfRangeDialogOpen(false);
    setAhorroPdfSelected(null);
  };

  // ── Admin: aprobar solicitud ──────────────────────────────────────────────
  const handleAprobarSolicitud = async (sol: any) => {
    try {
      // 1. Crear el ahorro permanente
      const nuevo = await ahorroPermanenteApi.create({
        asociado_id:    sol.asociado_id,
        cuota_mensual:  montoObligatorio,
        monto_ahorrado: 0,
        estado:         'activo',
        anulado:        false,
      });

      // 2. solicitudes_ahorro no existe — actualizar estado local directamente

      // 3. Notificar al asociado
      await supabase.from('notificaciones').insert({
        titulo:      '✅ Solicitud de ahorro aprobada',
        mensaje:     `Tu solicitud de ahorro permanente fue aprobada. Tu cuota mensual es ${formatCurrency(montoObligatorio)}.`,
        tipo:        'ahorro_aprobado',
        leida:       false,
        asociado_id: sol.asociado_id,
      });

      // 4. Actualizar estado local
      setSolicitudes(prev =>
        prev.map(s => s.id === sol.id ? { ...s, estado: 'aprobada' } : s)
      );
      const aprobadoIso = new Date().toISOString();
      setAhorros(prev => [{
        id:              nuevo.id,
        asociado:        sol.asociados?.nombre ?? '',
        cedula:          sol.asociados?.cedula ?? '',
        asociado_id:     sol.asociado_id,
        montoAhorrado:   0,
        cuotaMensual:    montoObligatorio,
        fechaInicio:     aprobadoIso.split('T')[0],
        estado:          true,
        anulado:         false,
        motivoAnulacion: '',
        createdAt:       aprobadoIso,
      }, ...prev]);

      toast.success(`✅ Solicitud aprobada`, {
        description: `Ahorro permanente creado para ${sol.asociados?.nombre ?? 'el asociado'}.`,
      });
    } catch (err: any) {
      toast.error('Error al aprobar la solicitud: ' + err.message);
    }
  };

  // ── Admin: confirmar aporte reportado ────────────────────────────────────
  const handleConfirmarAporte = async (ap: any) => {
    try {
      // Saldo real desde BD
      const { data: dbAhorro } = await supabase
        .from('ahorros_permanentes')
        .select('monto_ahorrado')
        .eq('id', ap.ahorro_id)
        .single();
      const saldoAnterior = dbAhorro?.monto_ahorrado ?? 0;
      const saldoNuevo    = saldoAnterior + ap.monto;

      // Registrar pago — periodo_id resuelto del período activo
      const periodoId = await resolverPeriodoId();
      const { error: movErr } = await supabase
        .from('pagos_ahorro_permanente')
        .insert({
          ahorro_permanente_id: ap.ahorro_id,
          asociado_id:          ap.asociado_id,
          periodo_id:           periodoId,
          mes_correspondiente:  ap.fecha_pago,
          fecha_pago:           ap.fecha_pago,
          fecha_movimiento:     ap.fecha_pago,
          monto_cuota:          ap.monto,
          monto_total_pagado:   ap.monto,
          monto:                ap.monto,
          saldo_anterior:       saldoAnterior,
          saldo_nuevo:          saldoNuevo,
          tipo_movimiento:      'Aporte',
          anulado:              false,
          observacion:          `${ap.medio_pago ?? ''}${ap.nota ? ' — ' + ap.nota : ''}`,
        });
      if (movErr) throw movErr;

      // Actualizar saldo
      await supabase
        .from('ahorros_permanentes')
        .update({ monto_ahorrado: saldoNuevo })
        .eq('id', ap.ahorro_id);

      // solicitudes_aporte no existe — el estado se actualiza solo en memoria

      // Notificar al asociado
      await supabase.from('notificaciones').insert({
        titulo:      '✅ Aporte confirmado',
        mensaje:     `Tu aporte de ${formatCurrency(ap.monto)} (${ap.medio_pago}) fue confirmado. Nuevo saldo: ${formatCurrency(saldoNuevo)}.`,
        tipo:        'aporte_confirmado',
        leida:       false,
        asociado_id: ap.asociado_id,
      });

      // Actualizar estado local
      setAportesPendientes(prev =>
        prev.map(a => a.id === ap.id ? { ...a, estado: 'aprobada' } : a)
      );
      setAhorros(prev =>
        prev.map(a => a.id === ap.ahorro_id ? { ...a, montoAhorrado: saldoNuevo } : a)
      );

      toast.success(`✅ Aporte de ${formatCurrency(ap.monto)} confirmado`, {
        description: `Nuevo saldo de ${ap.asociados?.nombre ?? 'el asociado'}: ${formatCurrency(saldoNuevo)}`,
      });
    } catch (err: any) {
      toast.error('Error al confirmar el aporte: ' + err.message);
    }
  };

  // ── Admin: rechazar aporte reportado ─────────────────────────────────────
  const handleRechazarAporte = async () => {
    if (!aporteSeleccionado) return;
    if (!notaRechazoAporte.trim()) { toast.error('Escribe el motivo del rechazo'); return; }
    setSavingAporte(true);
    try {
      // solicitudes_aporte no existe — el rechazo se refleja solo en estado local

      await supabase.from('notificaciones').insert({
        titulo:      '❌ Aporte no confirmado',
        mensaje:     `Tu reporte de aporte de ${formatCurrency(aporteSeleccionado.monto)} no fue confirmado. Motivo: ${notaRechazoAporte.trim()}`,
        tipo:        'aporte_rechazado',
        leida:       false,
        asociado_id: aporteSeleccionado.asociado_id,
      });

      setAportesPendientes(prev =>
        prev.map(a => a.id === aporteSeleccionado.id ? { ...a, estado: 'rechazada', nota_admin: notaRechazoAporte.trim() } : a)
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

  // ── Admin: rechazar solicitud ─────────────────────────────────────────────
  const handleRechazarSolicitud = async () => {
    if (!solicitudSeleccionada) return;
    if (!notaRechazo.trim()) { toast.error('Escribe el motivo del rechazo'); return; }
    setSavingSolicitud(true);
    try {
      // solicitudes_ahorro no existe — el rechazo se refleja solo en estado local

      // Notificar al asociado
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
        description: `Se notificó a ${solicitudSeleccionada.asociados?.nombre ?? 'el asociado'}.`,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando ahorros permanentes...</p>
        </div>
      </div>
    );
  }

  const renderTable = (ahorrosList: any[], isAnulados: boolean = false) => (
    <>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asociado</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Saldo actual</TableHead>
              <TableHead>Cuota mensual</TableHead>
              <TableHead>Fecha inicio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ahorrosList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    <PiggyBank className="size-10 text-slate-300 mb-3" />
                    {searchTerm ? (
                      <>
                        <p className="text-slate-500">No se encontraron resultados para <span className="font-semibold">"{searchTerm}"</span></p>
                        <Button variant="link" size="sm" onClick={() => setSearchTerm('')}>Limpiar búsqueda</Button>
                      </>
                    ) : isAnulados ? (
                      <p className="text-slate-500">No hay ahorros anulados</p>
                    ) : (
                      <p className="text-slate-500">No hay ahorros permanentes registrados</p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              ahorrosList.map((ahorro) => (
                <Fragment key={ahorro.id}>
                <TableRow className={`cursor-pointer hover:bg-slate-50 transition-colors ${!ahorro.estado && !ahorro.anulado ? 'bg-slate-50 opacity-80' : ''}`} onClick={() => handleOpenDetail(ahorro)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isAnulados ? 'bg-slate-100' : ahorro.estado ? 'bg-emerald-100' : 'bg-yellow-50'}`}>
                        <PiggyBank className={`size-4 ${isAnulados ? 'text-slate-600' : ahorro.estado ? 'text-emerald-600' : 'text-yellow-500'}`} />
                      </div>
                      <p className="text-slate-900">{ahorro.asociado}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{ahorro.cedula}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-900 font-medium">{formatCurrency(Number(ahorro.montoAhorrado) || 0)}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{formatCurrency(ahorro.cuotaMensual)}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{ahorro.fechaInicio}</p>
                  </TableCell>
                  <TableCell>
                    {isAnulados ? (
                      <Badge variant="secondary" className="bg-red-100 text-red-700">Anulado</Badge>
                    ) : userRole === 'admin' ? (
                      <Switch
                        checked={ahorro.estado}
                        onCheckedChange={() => {
                          setSelectedItem(ahorro);
                          setNuevoEstadoSeleccionado(ahorro.estado ? 'inactivo' : 'activo');
                          setJustificacionAnulacion('');
                          setIsToggleEstadoDialogOpen(true);
                        }}
                      />
                    ) : (
                      <Badge variant={ahorro.estado ? 'default' : 'secondary'} className={ahorro.estado ? 'bg-emerald-600' : ''}>
                        {ahorro.estado ? 'Activo' : 'Inactivo'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 justify-end items-center">
                      {/* ── Registrar Aporte: visible directamente en el listado ── */}
                      {!isAnulados && userRole === 'admin' && ahorro.estado && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          title="Registrar aporte"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(ahorro);
                            setMovimientosDetalle([]);   // limpiar movimientos de otro registro
                            setFormAporteMonto('');
                            setFormAporteFecha(new Date().toISOString().split('T')[0]);
                            setFormAporteDesc('');
                            setIsAporteDialogOpen(true);
                          }}
                        >
                          <Plus className="size-3.5" />
                          Aporte
                        </Button>
                      )}
                      {/* Auditoría desplegable */}
                      <Button
                        variant="ghost" size="sm"
                        title="Ver historial"
                        className={`hover:bg-slate-100 ${expandedAhorroId === ahorro.id ? 'bg-slate-100' : ''}`}
                        onClick={(e) => { e.stopPropagation(); cargarAuditoria(ahorro.id); }}
                      >
                        {loadingAuditoria === ahorro.id
                          ? <Loader2 className="size-4 animate-spin text-slate-500" />
                          : <ChevronDown className={`size-4 text-slate-500 transition-transform ${expandedAhorroId === ahorro.id ? 'rotate-180' : ''}`} />
                        }
                      </Button>
                      {!isAnulados && userRole === 'admin' && ahorro.estado && (
                        <Button variant="outline" size="sm" title="Editar" onClick={() => handleOpenCreateDialog(ahorro)}>
                          <Edit className="size-4" />
                        </Button>
                      )}
                      {!isAnulados && userRole === 'admin' && ahorro.estado && (
                        <Button variant="outline" size="sm" title="Anular" onClick={() => {
                          setSelectedItem(ahorro);
                          setJustificacionAnulacion('');
                          setIsDeleteDialogOpen(true);
                        }}>
                          <Ban className="size-4 text-red-600" />
                        </Button>
                      )}
                      <Button
                        variant="outline" size="sm"
                        title="Descargar extracto PDF"
                        className="hover:bg-emerald-50"
                        onClick={() => handleOpenPdfDialog(ahorro)}
                      >
                        <FileText className="size-4 text-emerald-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* ── Fila de auditoría desplegable ───────────────────────── */}
                {expandedAhorroId === ahorro.id && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="p-0 border-t-0">
                      <div className="bg-slate-50 border-t border-b border-slate-200 px-6 py-3">
                        {(auditoriaPorAhorro[ahorro.id] ?? []).length === 0 ? (
                          <p className="text-sm text-slate-400 py-1">Sin movimientos registrados aún.</p>
                        ) : (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                              Historial de movimientos
                            </p>
                            <div className="divide-y divide-slate-100">
                              {(auditoriaPorAhorro[ahorro.id] ?? []).map((mov: any) => (
                                <div key={mov.id} className="flex items-center justify-between py-2 text-sm gap-4">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                                      mov.tipo_movimiento === 'Ajuste'   ? 'bg-slate-200 text-slate-700' :
                                      mov.tipo_movimiento === 'Interés'  ? 'bg-emerald-100 text-emerald-700' :
                                      mov.tipo_movimiento === 'Retiro'   ? 'bg-red-100 text-red-700' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>
                                      {mov.tipo_movimiento}
                                    </span>
                                    <span className="text-slate-600 truncate">{mov.descripcion || '—'}</span>
                                  </div>
                                  <div className="flex items-center gap-6 shrink-0 text-right">
                                    {mov.monto > 0 && (
                                      <span className="font-medium text-emerald-700">+{formatCurrency(mov.monto)}</span>
                                    )}
                                    <span className="text-slate-400 text-xs w-24">{mov.fecha_movimiento}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );

  const renderPagination = (total: number, page: number, setPage: (p: number) => void, start: number, end: number, count: number) => (
    <div className="flex items-center justify-between">
      <p className="text-sm text-slate-600">
        Mostrando {count === 0 ? 0 : start + 1} a {Math.min(end, count)} de {count} registros
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
          <ChevronLeft className="size-4" />
        </Button>
        {Array.from({ length: total }, (_, i) => i + 1).map(p => (
          <Button
            key={p}
            variant={page === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPage(p)}
            className={page === p ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {p}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => setPage(Math.min(total, page + 1))} disabled={page === total}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Ahorro Permanente</h1>
            <p className="text-slate-600">{userRole === 'asociado' ? 'Consulta tus ahorros permanentes' : 'Gestiona los ahorros permanentes de los asociados'}</p>
          </div>
          {userRole === 'admin' && (
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleOpenCreateDialog()}>
              <Plus className="size-4" />
              Nuevo ahorro
            </Button>
          )}
        </div>

        {userRole === 'admin' && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    <PiggyBank className="size-6 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-emerald-900">Configuración del Plan de Ahorro Permanente</CardTitle>
                    <p className="text-sm text-emerald-700 mt-1">Monto obligatorio mensual que deben aportar todos los asociados</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="montoObligatorio" className="text-emerald-900 font-semibold">
                    Monto Obligatorio Mensual
                  </Label>
                  {!isEditingMonto ? (
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-3xl font-bold text-emerald-600">{formatCurrency(montoObligatorio)}</p>
                      <Button variant="outline" size="sm" onClick={() => { setIsEditingMonto(true); setTempMontoObligatorio(montoObligatorio.toString()); }} className="gap-2">
                        <Edit className="size-4" />
                        Modificar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mt-2">
                      <Input
                        id="montoObligatorio"
                        type="number"
                        value={tempMontoObligatorio}
                        onChange={(e) => setTempMontoObligatorio(e.target.value)}
                        placeholder="Ej: 50000"
                        className="max-w-xs"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleSaveMontoObligatorio} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                        <Check className="size-4" />
                        Guardar
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCancelEditMonto}>Cancelar</Button>
                    </div>
                  )}
                  <p className="text-xs text-emerald-600 mt-2">Este monto se aplicará como aporte obligatorio para todos los nuevos asociados</p>
                </div>
              </div>

            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Gestión de Ahorros Permanentes</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nombre o cédula..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setCurrentPageAnulados(1); }}
                  />
                </div>
                {userRole === 'admin' && (
                  <Select value={sortBy} onValueChange={(value: any) => { setSortBy(value); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Ordenar por..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Sin ordenar</SelectItem>
                      <SelectItem value="saldo-desc">Saldo (mayor a menor)</SelectItem>
                      <SelectItem value="saldo-asc">Saldo (menor a mayor)</SelectItem>
                      <SelectItem value="antiguedad-desc">Más antiguos primero</SelectItem>
                      <SelectItem value="antiguedad-asc">Más recientes primero</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="activos" className="w-full">
              <TabsList className={`grid w-full mb-4 ${userRole === 'admin' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="activos" className="gap-2">
                  <PiggyBank className="size-4" />
                  Ahorros Activos ({filteredAhorros.length})
                </TabsTrigger>
                <TabsTrigger value="anulados" className="gap-2">
                  <FileText className="size-4" />
                  Ahorros Anulados ({filteredAhorrosAnulados.length})
                </TabsTrigger>
                {userRole === 'admin' && (
                  <TabsTrigger value="solicitudes" className="gap-2">
                    <ClipboardList className="size-4" />
                    Solicitudes
                    {(solicitudes.filter(s => s.estado === 'pendiente').length + aportesPendientes.filter(a => a.estado === 'pendiente').length) > 0 && (
                      <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {solicitudes.filter(s => s.estado === 'pendiente').length + aportesPendientes.filter(a => a.estado === 'pendiente').length}
                      </span>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="activos" className="space-y-4">
                {renderTable(currentAhorros, false)}
                {sortedAhorros.length > 0 && renderPagination(totalPages, currentPage, setCurrentPage, startIndex, endIndex, sortedAhorros.length)}
              </TabsContent>

              <TabsContent value="anulados" className="space-y-4">
                {renderTable(currentAhorrosAnulados, true)}
                {filteredAhorrosAnulados.length > 0 && renderPagination(totalPagesAnulados, currentPageAnulados, setCurrentPageAnulados, startIndexAnulados, endIndexAnulados, filteredAhorrosAnulados.length)}
              </TabsContent>

              {userRole === 'admin' && (
                <TabsContent value="solicitudes" className="space-y-6">

                  {/* ── Sección: Solicitudes de apertura ─────────────────── */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <ClipboardList className="size-4 text-amber-600" />
                      Solicitudes de apertura
                    </h3>
                    {solicitudes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <ClipboardList className="size-10 text-slate-300 mb-3" />
                        <p className="text-slate-500">No hay solicitudes de ahorro permanente</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {solicitudes.map(sol => (
                          <div key={sol.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
                            sol.estado === 'pendiente' ? 'bg-amber-50 border-amber-200' :
                            sol.estado === 'aprobada'  ? 'bg-emerald-50 border-emerald-200' :
                            'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                sol.estado === 'pendiente' ? 'bg-amber-100' :
                                sol.estado === 'aprobada'  ? 'bg-emerald-100' : 'bg-red-100'
                              }`}>
                                {sol.estado === 'pendiente' && <Clock className="size-5 text-amber-600" />}
                                {sol.estado === 'aprobada'  && <CheckCircle2 className="size-5 text-emerald-600" />}
                                {sol.estado === 'rechazada' && <XCircle className="size-5 text-red-500" />}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{sol.asociados?.nombre ?? '—'}</p>
                                <p className="text-xs text-slate-500">Cédula: {sol.asociados?.cedula ?? '—'} · {new Date(sol.created_at).toLocaleDateString('es-CO')}</p>
                                {sol.nota_asociado && (
                                  <p className="text-xs text-slate-600 mt-0.5 italic">"{sol.nota_asociado}"</p>
                                )}
                                {sol.nota_admin && sol.estado === 'rechazada' && (
                                  <p className="text-xs text-red-600 mt-0.5">Motivo: {sol.nota_admin}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {sol.estado === 'pendiente' ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => handleAprobarSolicitud(sol)}
                                  >
                                    <Check className="size-4" /> Aprobar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                                    onClick={() => { setSolicitudSeleccionada(sol); setNotaRechazo(''); setIsRechazarDialogOpen(true); }}
                                  >
                                    <X className="size-4" /> Rechazar
                                  </Button>
                                </>
                              ) : (
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                  sol.estado === 'aprobada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {sol.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Sección: Aportes reportados por asociados ─────────── */}
                  <div className="space-y-3 border-t border-slate-100 pt-5">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Send className="size-4 text-blue-600" />
                      Aportes reportados por asociados
                      {aportesPendientes.filter(a => a.estado === 'pendiente').length > 0 && (
                        <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                          {aportesPendientes.filter(a => a.estado === 'pendiente').length} pendiente{aportesPendientes.filter(a => a.estado === 'pendiente').length > 1 ? 's' : ''}
                        </span>
                      )}
                    </h3>
                    {aportesPendientes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Send className="size-10 text-slate-300 mb-3" />
                        <p className="text-slate-500">No hay aportes reportados</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {aportesPendientes.map(ap => (
                          <div key={ap.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
                            ap.estado === 'pendiente'   ? 'bg-blue-50 border-blue-200' :
                            ap.estado === 'aprobada'    ? 'bg-emerald-50 border-emerald-200' :
                            'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                ap.estado === 'pendiente'  ? 'bg-blue-100' :
                                ap.estado === 'aprobada'   ? 'bg-emerald-100' : 'bg-red-100'
                              }`}>
                                {ap.estado === 'pendiente'   && <Clock className="size-5 text-blue-600" />}
                                {ap.estado === 'aprobada'    && <CheckCircle2 className="size-5 text-emerald-600" />}
                                {ap.estado === 'rechazada'   && <XCircle className="size-5 text-red-500" />}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{ap.asociados?.nombre ?? '—'}</p>
                                <p className="text-xs text-slate-500">
                                  Cédula: {ap.asociados?.cedula ?? '—'} · Reportado: {new Date(ap.created_at).toLocaleDateString('es-CO')}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  <span className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 font-medium text-slate-700">
                                    {formatCurrency(ap.monto)}
                                  </span>
                                  <span className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600">
                                    {ap.medio_pago}
                                  </span>
                                  <span className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-500">
                                    Pago: {ap.fecha_pago}
                                  </span>
                                </div>
                                {ap.nota && (
                                  <p className="text-xs text-slate-600 mt-0.5 italic">"{ap.nota}"</p>
                                )}
                                {ap.nota_admin && ap.estado === 'rechazada' && (
                                  <p className="text-xs text-red-600 mt-0.5">Motivo rechazo: {ap.nota_admin}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {ap.estado === 'pendiente' ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => handleConfirmarAporte(ap)}
                                  >
                                    <Check className="size-4" /> Confirmar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                                    onClick={() => { setAporteSeleccionado(ap); setNotaRechazoAporte(''); setIsRechazarAporteOpen(true); }}
                                  >
                                    <X className="size-4" /> Rechazar
                                  </Button>
                                </>
                              ) : (
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                  ap.estado === 'aprobada'   ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {ap.estado === 'aprobada'   ? 'Confirmado' : 'Rechazado'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* ── Crear / Editar ──────────────────────────────────────────────────── */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) { setSelectedItem(null); setFormObservaciones(''); setEditHasMovimientos(false); setLoadingEditMovs(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Editar ahorro permanente' : 'Nuevo ahorro permanente'}</DialogTitle>
            <DialogDescription>
              {selectedItem
                ? `Modifica los datos del ahorro de "${selectedItem.asociado}". El saldo solo cambia mediante aportes registrados.`
                : 'Registra un nuevo ahorro permanente para un asociado'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Asociado — siempre deshabilitado al editar */}
            <div className="space-y-2">
              <Label htmlFor="asociado">Asociado *</Label>
              <Select value={formAsociadoId} onValueChange={setFormAsociadoId} disabled={!!selectedItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar asociado...">
                    {selectedItem ? selectedItem.asociado : 'Seleccionar asociado...'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {asociadosDisponibles.filter(a => a.estado).map(asociado => (
                    <SelectItem key={asociado.id} value={asociado.id}>
                      {asociado.nombre} ({asociado.cedula})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cuota mensual — siempre editable */}
            <div className="space-y-2">
              <Label htmlFor="cuota">Cuota mensual obligatoria *</Label>
              <Input
                id="cuota"
                type="text"
                placeholder="100.000,0"
                value={formCuotaMensual}
                onChange={handleCuotaMensualChange}
                onBlur={handleCuotaMensualBlur}
              />
              <p className="text-xs text-slate-500">
                Monto mensual obligatorio — mínimo{' '}
                <span className="font-semibold text-emerald-700">
                  {montoObligatorio.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}
                </span>
              </p>
            </div>

            {/* Saldo inicial — solo al crear */}
            {!selectedItem && (
              <div className="space-y-2">
                <Label htmlFor="saldo" className={saldoInicialError ? 'text-red-600' : ''}>
                  Saldo inicial
                </Label>
                <Input
                  id="saldo"
                  type="text"
                  placeholder="0,0"
                  value={formSaldoInicial}
                  onChange={handleSaldoInicialChange}
                  onBlur={handleSaldoInicialBlur}
                  className={saldoInicialError
                    ? 'border-red-500 focus-visible:ring-red-400 bg-red-50 text-red-700 placeholder:text-red-300'
                    : ''}
                />
                {saldoInicialError
                  ? <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                      <span>⚠️</span> {saldoInicialError}
                    </p>
                  : <p className="text-xs text-slate-500">
                      Monto inicial del plan (opcional, déjelo en 0 si no aplica)
                    </p>
                }
              </div>
            )}

            {/* Fecha de inicio — al crear: requerida · al editar: solo si no hay movimientos */}
            {!selectedItem ? (
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha de inicio *</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={formFechaInicio}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormFechaInicio(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="fecha-edit" className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-slate-400" />
                  Fecha de inicio
                  {!loadingEditMovs && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                      editHasMovimientos
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {editHasMovimientos ? 'No editable' : 'Editable'}
                    </span>
                  )}
                </Label>
                {loadingEditMovs ? (
                  <div className="h-9 rounded-md bg-slate-100 animate-pulse" />
                ) : editHasMovimientos ? (
                  <div className="flex items-center px-3 h-9 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500 select-none">
                    {formFechaInicio}
                    <span className="ml-auto text-xs text-slate-400">Existen movimientos registrados</span>
                  </div>
                ) : (
                  <>
                    <Input
                      id="fecha-edit"
                      type="date"
                      value={formFechaInicio}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormFechaInicio(e.target.value)}
                    />
                    <p className="text-xs text-amber-600">Solo es editable porque aún no hay movimientos registrados.</p>
                  </>
                )}
              </div>
            )}

            {/* Observaciones — solo al editar */}
            {selectedItem && (
              <div className="space-y-2">
                <Label htmlFor="observaciones" className="flex items-center gap-1.5">
                  <ClipboardList className="size-3.5 text-slate-400" />
                  Observaciones internas
                </Label>
                <Textarea
                  id="observaciones"
                  placeholder="Notas del administrador sobre este ahorro (acuerdos, convenios, novedades)..."
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  className="resize-none text-sm"
                  rows={2}
                />
                <p className="text-xs text-slate-500">Nota interna. No es visible para el asociado.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); setSelectedItem(null); setFormObservaciones(''); setEditHasMovimientos(false); setLoadingEditMovs(false); }}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                if (selectedItem) {
                  // Edición: pedir confirmación primero
                  const cuota = parseCurrencyInput(formCuotaMensual);
                  if (!cuota || cuota <= 0) { toast.error('❌ Error de validación', { description: 'La cuota debe ser mayor a cero' }); return; }
                  setIsConfirmEditDialogOpen(true);
                } else {
                  handleSaveAhorro();
                }
              }}
            >
              {selectedItem ? 'Actualizar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detalle con historial de transacciones ──────────────────────────── */}
      <Dialog open={isDetailDialogOpen} onOpenChange={(open) => { setIsDetailDialogOpen(open); if (!open) { setSelectedItem(null); setMovimientosDetalle([]); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del ahorro permanente</DialogTitle>
            <DialogDescription>Información completa y historial de transacciones</DialogDescription>
          </DialogHeader>
          {selectedItem && (() => {
            const ultimoMovActivo = [...movimientosDetalle]
              .filter(m => !m.anulado)
              .sort((a, b) => new Date(b.fecha_movimiento).getTime() - new Date(a.fecha_movimiento).getTime())[0];
            const saldoRealDetalle = ultimoMovActivo?.saldo_nuevo ?? selectedItem.montoAhorrado ?? 0;
            return (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="info" className="gap-2">
                  <PiggyBank className="size-4" /> Información
                </TabsTrigger>
                <TabsTrigger value="historial" className="gap-2">
                  <History className="size-4" /> Historial de depósitos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label className="text-slate-500 text-xs">Asociado</Label>
                    <p className="text-slate-900 font-medium">{selectedItem.asociado}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Cédula</Label>
                    <p className="text-slate-900">{selectedItem.cedula}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Estado del plan</Label>
                    <div className="mt-1">
                      <Badge
                        variant={selectedItem.anulado ? 'secondary' : 'default'}
                        className={selectedItem.anulado ? 'bg-red-100 text-red-700' : selectedItem.estado ? 'bg-emerald-600' : 'bg-yellow-100 text-yellow-700'}
                      >
                        {selectedItem.anulado ? 'Anulado' : selectedItem.estado ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Saldo actual</Label>
                    <p className="text-emerald-700 font-bold text-lg">{formatCurrency(saldoRealDetalle)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Cuota mensual</Label>
                    <p className="text-slate-900">{formatCurrency(selectedItem.cuotaMensual)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Fecha de inicio</Label>
                    <p className="text-slate-900">{selectedItem.fechaInicio}</p>
                  </div>
                  {selectedItem.motivoAnulacion && (
                    <div className="col-span-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <Label className="text-red-600 text-xs">Motivo de anulación</Label>
                      <p className="text-red-700 mt-1">{selectedItem.motivoAnulacion}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="historial" className="space-y-3">
                {loadingMovimientos ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mr-3" />
                    <p className="text-sm text-slate-500">Cargando movimientos...</p>
                  </div>
                ) : movimientosDetalle.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <History className="size-10 text-slate-300 mb-3" />
                    <p className="text-slate-500">No hay transacciones registradas para este plan</p>
                    <p className="text-xs text-slate-400 mt-1">Los depósitos y ajustes aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {movimientosDetalle.map((mov) => (
                      <div key={mov.id} className={`flex items-center justify-between p-3 rounded-lg border ${mov.anulado ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-emerald-100'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${mov.tipo_movimiento === 'Aporte' ? 'bg-emerald-100' : mov.tipo_movimiento === 'Retiro' ? 'bg-red-100' : 'bg-blue-100'}`}>
                            <DollarSign className={`size-3 ${mov.tipo_movimiento === 'Aporte' ? 'text-emerald-600' : mov.tipo_movimiento === 'Retiro' ? 'text-red-600' : 'text-blue-600'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700">{mov.tipo_movimiento}</p>
                            <p className="text-xs text-slate-500">
                              {mov.fecha_movimiento ?? mov.fecha_pago}
                              {mov.periodos?.nombre && (
                                <span className="ml-1 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-medium">
                                  {mov.periodos.nombre}
                                </span>
                              )}
                              {mov.descripcion ? ` — ${mov.descripcion}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${mov.tipo_movimiento === 'Retiro' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {mov.tipo_movimiento === 'Retiro' ? '-' : '+'}{formatCurrency(mov.monto)}
                          </p>
                          <p className="text-xs text-slate-400">Saldo: {formatCurrency(mov.saldo_nuevo)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {movimientosDetalle.length > 0 && (() => {
                  const ultimoMov = [...movimientosDetalle]
                    .filter(m => !m.anulado)
                    .sort((a, b) => new Date(b.fecha_movimiento).getTime() - new Date(a.fecha_movimiento).getTime())[0];
                  const saldoReal = ultimoMov?.saldo_nuevo ?? selectedItem?.montoAhorrado ?? 0;
                  const totalAportado = movimientosDetalle
                    .filter(m => (m.tipo_movimiento === 'Aporte' || m.tipo_movimiento === 'Apertura') && !m.anulado)
                    .reduce((acc, m) => acc + m.monto, 0);
                  return (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Número de aportes:</span>
                        <span className="font-semibold text-slate-700">
                          {movimientosDetalle.filter(m => m.tipo_movimiento === 'Aporte' && !m.anulado).length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Total aportado:</span>
                        <span className="font-semibold text-emerald-700">
                          {formatCurrency(totalAportado)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-1 mt-1">
                        <span className="text-slate-700">Saldo actual:</span>
                        <span className="text-emerald-700 text-base">
                          {formatCurrency(saldoReal)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
            );
          })()}
          <DialogFooter>
            <Button onClick={() => { setIsDetailDialogOpen(false); setSelectedItem(null); setMovimientosDetalle([]); }}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Registrar Aporte ────────────────────────────────────────────────── */}
      <Dialog open={isAporteDialogOpen} onOpenChange={(open) => { setIsAporteDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Aporte</DialogTitle>
            <DialogDescription>
              {selectedItem && `Asociado: ${selectedItem.asociado} — Saldo actual: ${formatCurrency(
                Number(
                  [...movimientosDetalle].filter(m => !m.anulado)
                    .sort((a,b) => new Date(b.fecha_movimiento).getTime() - new Date(a.fecha_movimiento).getTime())[0]?.saldo_nuevo
                  ?? selectedItem.montoAhorrado
                ) || 0
              )}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="aporte-monto">Monto del aporte *</Label>
              <Input
                id="aporte-monto"
                type="text"
                placeholder="50.000,0"
                value={formAporteMonto}
                onChange={(e) => setFormAporteMonto(e.target.value.replace(/[^\d.,]/g, ''))}
                onBlur={() => formAporteMonto && setFormAporteMonto(formatCurrencyInput(parseCurrencyInput(formAporteMonto).toString()))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aporte-fecha">Fecha del aporte *</Label>
              <Input
                id="aporte-fecha"
                type="date"
                value={formAporteFecha}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormAporteFecha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aporte-periodo">Período contable *</Label>
              <Select value={formAportePeriodoId} onValueChange={setFormAportePeriodoId}>
                <SelectTrigger id="aporte-periodo">
                  <SelectValue placeholder="Selecciona un período..." />
                </SelectTrigger>
                <SelectContent>
                  {periodos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {p.nombre}
                        {p.estado === 'activo' && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                            Activo
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="aporte-desc">Descripción (opcional)</Label>
              <Input
                id="aporte-desc"
                type="text"
                placeholder="Ej: Aporte mensual abril 2026"
                value={formAporteDesc}
                onChange={(e) => setFormAporteDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAporteDialogOpen(false)} disabled={savingAporte}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleRegistrarAporte} disabled={savingAporte}>
              {savingAporte ? 'Guardando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmación de anulación ────────────────────────────────────────── */}

      {/* ── Advertencia: saldo inicial menor al mínimo ───────────────────────── */}
      {/* ── Advertencia: aporte menor al mínimo obligatorio ─────────────────── */}
      <AlertDialog open={isConfirmAporteBajoOpen} onOpenChange={setIsConfirmAporteBajoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Aporte por debajo del mínimo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  El monto ingresado es{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(parseCurrencyInput(formAporteMonto))}
                  </span>
                  , que está <span className="font-semibold">por debajo del mínimo obligatorio</span> de{' '}
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(montoObligatorio)}
                  </span>.
                </p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs font-medium">
                  ⚠️ Registrar un aporte inferior al mínimo puede generar inconsistencias en el historial del asociado y afectar los cálculos del período.
                </div>
                <p>Como administrador, puede continuar si existe una justificación válida (pago parcial acordado, abono, etc.).</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmAporteBajoOpen(false)}>
              Cancelar — corregir monto
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => { setIsConfirmAporteBajoOpen(false); ejecutarRegistrarAporte(); }}
            >
              Sí, registrar de todas formas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmSaldoBajoOpen} onOpenChange={setIsConfirmSaldoBajoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              ¿Está seguro del saldo inicial?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  El saldo inicial ingresado es{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(parseCurrencyInput(formSaldoInicial))}
                  </span>
                  , que está <span className="font-semibold">por debajo del mínimo obligatorio</span> de{' '}
                  <span className="font-semibold text-emerald-700">
                    {montoObligatorio.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}
                  </span>.
                </p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs font-medium">
                  ⚠️ Esto generará un desequilibrio en el historial del asociado. Se recomienda usar <strong>0</strong> si no hay saldo de apertura, o un valor igual o superior al mínimo.
                </div>
                <p>¿Desea continuar de todas formas?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmSaldoBajoOpen(false)}>
              Cancelar — corregir valor
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => { setIsConfirmSaldoBajoOpen(false); handleSaveAhorro(true); }}
            >
              Sí, continuar de todas formas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) { setSelectedItem(null); setJustificacionAnulacion(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              ¿Confirmar anulación del ahorro permanente?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Estás a punto de anular el ahorro permanente de:</p>

                {/* Bloque de datos del ahorro a anular */}
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Asociado:</span>
                    <span className="font-semibold text-slate-800">{selectedItem?.asociado}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cédula:</span>
                    <span className="text-slate-700">{selectedItem?.cedula}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Saldo acumulado:</span>
                    <span className="font-semibold text-red-700">{selectedItem ? formatCurrency(selectedItem.montoAhorrado) : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fecha de inicio:</span>
                    <span className="text-slate-700">{selectedItem?.fechaInicio}</span>
                  </div>
                </div>

                <p className="text-xs text-red-600 font-medium">
                  ⚠ Esta acción no se puede deshacer. El registro quedará en el historial como anulado.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Campo de justificación obligatorio */}
          <div className="px-1 pb-2 space-y-2">
            <Label htmlFor="justificacion" className="text-slate-700 font-medium">
              Motivo de la anulación <span className="text-red-500">*</span>
            </Label>
            <Input
              id="justificacion"
              placeholder="Describe el motivo de la anulación..."
              value={justificacionAnulacion}
              onChange={(e) => setJustificacionAnulacion(e.target.value)}
              className={justificacionAnulacion.trim() ? 'border-red-400 focus-visible:ring-red-400' : 'border-slate-300'}
              autoFocus
            />
            <p className="text-xs text-slate-400">Este motivo quedará registrado en el historial del asociado.</p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSelectedItem(null); setJustificacionAnulacion(''); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAnular}
              className="bg-red-600 hover:bg-red-700"
              disabled={!justificacionAnulacion.trim()}
            >
              Sí, anular ahorro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Cambiar estado (Activo / Inactivo / Anulado) ─────────────────────── */}
      <AlertDialog open={isToggleEstadoDialogOpen} onOpenChange={(open) => {
        setIsToggleEstadoDialogOpen(open);
        if (!open) { setSelectedItem(null); setJustificacionAnulacion(''); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar estado del ahorro</AlertDialogTitle>
            <AlertDialogDescription>
              Selecciona el nuevo estado para el ahorro de <span className="font-semibold">"{selectedItem?.asociado}"</span>.
              Estado actual: <Badge className={selectedItem?.estado ? 'bg-emerald-600 ml-1' : 'bg-yellow-100 text-yellow-700 ml-1'}>{selectedItem?.estado ? 'Activo' : 'Inactivo'}</Badge>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(['activo', 'inactivo', 'anulado'] as const).map(estado => (
                <button
                  key={estado}
                  onClick={() => { setNuevoEstadoSeleccionado(estado); if (estado !== 'anulado') setJustificacionAnulacion(''); }}
                  className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    nuevoEstadoSeleccionado === estado
                      ? estado === 'activo' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : estado === 'inactivo' ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                        : 'border-red-500 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {estado === 'activo' ? 'Activo' : estado === 'inactivo' ? 'Inactivo' : 'Anulado'}
                </button>
              ))}
            </div>
            <div className={`space-y-2 p-3 rounded-lg border ${
              nuevoEstadoSeleccionado === 'anulado'  ? 'bg-red-50 border-red-200' :
              nuevoEstadoSeleccionado === 'inactivo' ? 'bg-yellow-50 border-yellow-200' :
              'bg-emerald-50 border-emerald-200'
            }`}>
              <Label className={`font-medium ${
                nuevoEstadoSeleccionado === 'anulado'  ? 'text-red-700' :
                nuevoEstadoSeleccionado === 'inactivo' ? 'text-yellow-700' :
                'text-emerald-700'
              }`}>
                Justificación <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder={
                  nuevoEstadoSeleccionado === 'anulado'  ? 'Motivo de la anulación...' :
                  nuevoEstadoSeleccionado === 'inactivo' ? 'Motivo de la desactivación...' :
                  'Motivo de la reactivación...'
                }
                value={justificacionAnulacion}
                onChange={(e) => setJustificacionAnulacion(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSelectedItem(null); setJustificacionAnulacion(''); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleEstado}
              disabled={!justificacionAnulacion.trim()}
              className={
                nuevoEstadoSeleccionado === 'activo' ? 'bg-emerald-600 hover:bg-emerald-700' :
                nuevoEstadoSeleccionado === 'inactivo' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-red-600 hover:bg-red-700'
              }
            >
              Confirmar cambio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmación de edición de cuota mensual ────────────────────────── */}
      <AlertDialog open={isConfirmEditDialogOpen} onOpenChange={setIsConfirmEditDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-emerald-500" />
              ¿Confirmar edición del ahorro?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  Estás a punto de modificar el ahorro de{' '}
                  <span className="font-semibold text-slate-800">{selectedItem?.asociado}</span>.
                </p>
                <div className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                  <div className="text-center flex-1">
                    <p className="text-xs text-slate-400">Cuota anterior</p>
                    <p className="font-semibold text-slate-700">{selectedItem ? formatCurrency(selectedItem.cuotaMensual) : ''}</p>
                  </div>
                  <div className="text-slate-400 font-bold">→</div>
                  <div className="text-center flex-1">
                    <p className="text-xs text-slate-400">Nueva cuota</p>
                    <p className="font-semibold text-emerald-700">{formCuotaMensual ? formatCurrency(parseCurrencyInput(formCuotaMensual)) : ''}</p>
                  </div>
                </div>
                {!editHasMovimientos && formFechaInicio !== selectedItem?.fechaInicio && (
                  <div className="flex items-center gap-3 py-2 px-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-center flex-1">
                      <p className="text-xs text-amber-500">Fecha inicio anterior</p>
                      <p className="font-semibold text-slate-700">{selectedItem?.fechaInicio ?? '—'}</p>
                    </div>
                    <div className="text-amber-400 font-bold">→</div>
                    <div className="text-center flex-1">
                      <p className="text-xs text-amber-500">Nueva fecha inicio</p>
                      <p className="font-semibold text-amber-700">{formFechaInicio}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-400">Los cambios se aplicarán de forma inmediata.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmEditDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setIsConfirmEditDialogOpen(false);
                handleSaveAhorro();
              }}
            >
              Sí, confirmar cambio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Admin: Rechazar solicitud ────────────────────────────────────────── */}
      <AlertDialog open={isRechazarDialogOpen} onOpenChange={(open) => {
        setIsRechazarDialogOpen(open);
        if (!open) { setSolicitudSeleccionada(null); setNotaRechazo(''); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-500" />
              Rechazar solicitud de ahorro permanente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a rechazar la solicitud de{' '}
              <span className="font-semibold">{solicitudSeleccionada?.asociados?.nombre ?? '—'}</span>.
              El asociado recibirá una notificación con el motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-slate-700 font-medium">
              Motivo del rechazo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Explica el motivo del rechazo..."
              value={notaRechazo}
              onChange={(e) => setNotaRechazo(e.target.value)}
              className="min-h-[80px]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingSolicitud}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRechazarSolicitud}
              disabled={!notaRechazo.trim() || savingSolicitud}
            >
              {savingSolicitud ? 'Guardando...' : 'Confirmar rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Admin: Rechazar aporte reportado ────────────────────────────────── */}
      <AlertDialog open={isRechazarAporteOpen} onOpenChange={(open) => {
        setIsRechazarAporteOpen(open);
        if (!open) { setAporteSeleccionado(null); setNotaRechazoAporte(''); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-500" />
              Rechazar aporte reportado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  Vas a rechazar el aporte de{' '}
                  <span className="font-semibold">{aporteSeleccionado?.asociados?.nombre ?? '—'}</span>{' '}
                  por{' '}
                  <span className="font-semibold text-slate-800">{aporteSeleccionado ? formatCurrency(aporteSeleccionado.monto) : ''}</span>{' '}
                  vía <span className="font-medium">{aporteSeleccionado?.medio_pago}</span>.
                </p>
                <p className="text-xs text-slate-400">El asociado recibirá una notificación con el motivo del rechazo.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-slate-700 font-medium">
              Motivo del rechazo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Explica el motivo del rechazo..."
              value={notaRechazoAporte}
              onChange={(e) => setNotaRechazoAporte(e.target.value)}
              className="min-h-[80px]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingAporte}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRechazarAporte}
              disabled={!notaRechazoAporte.trim() || savingAporte}
            >
              {savingAporte ? 'Guardando...' : 'Confirmar rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Rango de fechas para extracto PDF ───────────────────────────────── */}
      <Dialog open={isPdfRangeDialogOpen} onOpenChange={(open) => { setIsPdfRangeDialogOpen(open); if (!open) setAhorroPdfSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-emerald-600" />
              Extracto de ahorro permanente
            </DialogTitle>
            <DialogDescription>
              Selecciona el rango de fechas para generar el extracto de <span className="font-semibold">{ahorroPdfSelected?.asociado}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Saldo actual:</span>
                  <p className="font-bold text-emerald-700">{ahorroPdfSelected ? formatCurrency(ahorroPdfSelected.montoAhorrado) : ''}</p>
                </div>
                <div>
                  <span className="text-slate-500">Estado:</span>
                  <p className="font-medium">{ahorroPdfSelected?.estado ? 'Activo' : 'Inactivo'}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rangeInicio" className="flex items-center gap-2">
                  <Calendar className="size-4 text-slate-400" /> Fecha inicio
                </Label>
                <Input
                  id="rangeInicio"
                  type="date"
                  value={pdfRangeInicio}
                  onChange={(e) => setPdfRangeInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rangeFin" className="flex items-center gap-2">
                  <Calendar className="size-4 text-slate-400" /> Fecha fin
                </Label>
                <Input
                  id="rangeFin"
                  type="date"
                  value={pdfRangeFin}
                  onChange={(e) => setPdfRangeFin(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsPdfRangeDialogOpen(false); setAhorroPdfSelected(null); }}>Cancelar</Button>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleGenerarPDF}>
              <TrendingUp className="size-4" />
              Generar extracto PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
