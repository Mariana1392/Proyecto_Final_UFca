import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Search, Plus, Eye, ChevronLeft, ChevronRight, Edit, Trash2,
  PiggyBank, Check, X, FileText, Calendar, TrendingUp, History,
  AlertTriangle, DollarSign, ClipboardList, Clock, CheckCircle2,
  XCircle, Send,
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
  const [formAporteMonto, setFormAporteMonto]     = useState('');
  const [formAporteFecha, setFormAporteFecha]     = useState('');
  const [formAporteDesc, setFormAporteDesc]       = useState('');
  const [isConfirmEditDialogOpen, setIsConfirmEditDialogOpen] = useState(false);
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

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      const [{ data, error }, asociadosData, configData] = await Promise.all([
        supabase
          .from('ahorro_permanente')
          .select('*, asociados(nombre, cedula)')
          .order('created_at', { ascending: false }),
        asociadosApi.getAll(),
        supabase
          .from('configuracion')
          .select('valor')
          .eq('id', 'monto_obligatorio_ahorro_permanente')
          .single(),
      ]);
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
        montoAhorrado: a.monto_ahorrado,
        cuotaMensual:  a.cuota_mensual,
        fechaInicio:   a.fecha_inicio,
        estado:        a.estado === true,
        anulado:       a.anulado,
        motivoAnulacion: a.motivo_anulacion || '',
        observaciones: a.observaciones || '',
        createdAt:     a.created_at,
      }));

      setAhorros(mapeados);
      setAsociadosDisponibles(asociadosData || []);

      // ── Cargar solicitudes y aportes (solo admin) ──────────────────────
      if (userRole === 'admin') {
        const [{ data: sols }, { data: aportes }] = await Promise.all([
          supabase
            .from('solicitudes')
            .select('*, asociados(nombre, cedula)')
            .eq('tipo', 'ahorro_permanente')
            .order('created_at', { ascending: false }),
          supabase
            .from('solicitudes')
            .select('*, asociados(nombre, cedula)')
            .eq('tipo', 'aporte_permanente')
            .order('created_at', { ascending: false }),
        ]);
        // Aplanar datos jsonb para compatibilidad con la UI
        setSolicitudes((sols || []).map((s: any) => ({
          ...s,
          nota_asociado: s.datos?.nota_asociado,
        })));
        setAportesPendientes((aportes || []).map((ap: any) => ({
          ...ap,
          tipo_ahorro: 'permanente',
          fecha_pago:  ap.datos?.fecha_pago,
          medio_pago:  ap.datos?.medio_pago,
          nota:        ap.datos?.nota,
        })));
      }
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
  const handleSaldoInicialChange  = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormSaldoInicial(e.target.value.replace(/[^\d.,]/g, ''));
  const handleSaldoInicialBlur    = () =>
    formSaldoInicial && setFormSaldoInicial(formatCurrencyInput(parseCurrencyInput(formSaldoInicial).toString()));

  const handleOpenCreateDialog = async (item?: any) => {
    if (item) {
      setSelectedItem(item);
      setFormAsociadoId(item.asociado_id);
      setFormCuotaMensual(formatCurrencyInput(item.cuotaMensual.toString()));
      setFormSaldoInicial(item.montoAhorrado.toString().replace(/\./g, ','));
      setFormFechaInicio(item.fechaInicio);
      setFormObservaciones(item.observaciones || '');
      // Verificar si ya hay movimientos (determina si fecha_inicio es editable)
      setLoadingEditMovs(true);
      setIsCreateDialogOpen(true);
      try {
        const { count } = await supabase
          .from('movimientos_ahorro_permanente')
          .select('id', { count: 'exact', head: true })
          .eq('ahorro_id', item.id);
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
        .from('movimientos_ahorro_permanente')
        .select('*')
        .eq('ahorro_id', ahorro.id)
        .order('fecha_movimiento', { ascending: false });
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleToggleEstado = async () => {
    if (!selectedItem) return;
    try {
      if (nuevoEstadoSeleccionado === 'anulado') {
        if (!justificacionAnulacion.trim()) {
          toast.error('La justificación es obligatoria para anular');
          return;
        }
        await ahorroPermanenteApi.anular(selectedItem.id, justificacionAnulacion.trim());
        setAhorros(prev => prev.map(a =>
          a.id === selectedItem.id ? { ...a, anulado: true, estado: false, motivoAnulacion: justificacionAnulacion.trim() } : a
        ));
        toast.success(`Ahorro de "${selectedItem.asociado}" anulado exitosamente`);
      } else {
        const esActivo = nuevoEstadoSeleccionado === 'activo';
        await ahorroPermanenteApi.update(selectedItem.id, { estado: esActivo });
        setAhorros(prev => prev.map(a =>
          a.id === selectedItem.id ? { ...a, estado: esActivo } : a
        ));
        toast.success(`Ahorro de "${selectedItem.asociado}" ${esActivo ? 'activado' : 'desactivado'} exitosamente`);
      }
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
    setIsToggleEstadoDialogOpen(false);
    setSelectedItem(null);
    setJustificacionAnulacion('');
  };

  const handleAnular = async () => {
    if (!selectedItem) return;
    if (!justificacionAnulacion.trim()) {
      toast.error('La justificación es obligatoria para anular un ahorro');
      return;
    }
    try {
      await ahorroPermanenteApi.anular(selectedItem.id, justificacionAnulacion.trim());
      setAhorros(prev => prev.map(a =>
        a.id === selectedItem.id ? { ...a, anulado: true, estado: false, motivoAnulacion: justificacionAnulacion.trim() } : a
      ));
      toast.success(`Ahorro de "${selectedItem.asociado}" anulado exitosamente`);
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
          id: 'monto_obligatorio_ahorro_permanente',
          valor: monto.toString(),
          descripcion: 'Monto obligatorio mensual para el plan de ahorro permanente',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
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

  const handleSaveAhorro = async () => {
    if (!formAsociadoId) { toast.error('❌ Error de validación', { description: 'Selecciona un asociado' }); return; }
    const cuota = parseCurrencyInput(formCuotaMensual);
    if (!cuota || cuota <= 0) { toast.error('❌ Error de validación', { description: 'La cuota debe ser mayor a cero' }); return; }
    const saldo = parseCurrencyInput(formSaldoInicial);
    if (saldo < 0) { toast.error('❌ Error de validación', { description: 'El saldo inicial debe ser ≥ 0' }); return; }
    if (!formFechaInicio) { toast.error('❌ Error de validación', { description: 'Selecciona una fecha de inicio' }); return; }

    // Solo ahorros activos pueden ser editados
    if (selectedItem && !selectedItem.estado) {
      toast.error('Solo se pueden editar ahorros en estado Activo');
      return;
    }

    const asociado = asociadosDisponibles.find(a => a.id === formAsociadoId);

    try {
      if (selectedItem) {
        // Construir payload de actualización
        const updatePayload: Record<string, any> = { cuota_mensual: cuota };
        // Fecha de inicio solo si no hay movimientos registrados
        if (!editHasMovimientos && formFechaInicio) {
          updatePayload.fecha_inicio = formFechaInicio;
        }
        await ahorroPermanenteApi.update(selectedItem.id, updatePayload);

        // Guardar observaciones por separado para no romper si la columna no existe
        if (formObservaciones.trim() !== selectedItem.observaciones) {
          try {
            await supabase
              .from('ahorro_permanente')
              .update({ observaciones: formObservaciones.trim() || null })
              .eq('id', selectedItem.id);
          } catch { /* columna observaciones opcional */ }
        }

        // Actualizar estado local
        const localUpdate: Record<string, any> = {
          cuotaMensual:  cuota,
          observaciones: formObservaciones.trim(),
        };
        if (!editHasMovimientos && formFechaInicio) {
          localUpdate.fechaInicio = formFechaInicio;
        }
        setAhorros(prev => prev.map(a =>
          a.id === selectedItem.id ? { ...a, ...localUpdate } : a
        ));

        // Mensaje con los cambios realizados
        const cambios: string[] = [];
        if (cuota !== selectedItem.cuotaMensual) cambios.push(`cuota: ${formatCurrency(cuota)}`);
        if (!editHasMovimientos && formFechaInicio !== selectedItem.fechaInicio) cambios.push(`fecha inicio: ${formFechaInicio}`);
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
          fecha_inicio:   formFechaInicio,
          estado:         true,
          anulado:        false,
        });

        // Si el saldo inicial es mayor a 0, registrar movimiento de apertura
        if (saldo > 0) {
          const { error: movErr } = await supabase
            .from('movimientos_ahorro_permanente')
            .insert({
              ahorro_id:        nuevo.id,
              asociado_id:      formAsociadoId,
              tipo_movimiento:  'Apertura',
              monto:            saldo,
              saldo_anterior:   0,
              saldo_nuevo:      saldo,
              fecha_movimiento: formFechaInicio,
              descripcion:      'Saldo inicial cargado al crear el plan',
            });
          if (movErr) toast.error('Ahorro creado, pero error al registrar saldo inicial: ' + movErr.message);
        }

        setAhorros(prev => [{
          id: nuevo.id,
          asociado:      asociado?.nombre ?? '',
          cedula:        asociado?.cedula ?? '',
          asociado_id:   formAsociadoId,
          montoAhorrado: saldo,
          cuotaMensual:  cuota,
          fechaInicio:   formFechaInicio,
          estado:        true,
          anulado:       false,
          motivoAnulacion: '',
          createdAt:     new Date().toISOString(),
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

  // ── Registrar aporte (depósito) ───────────────────────────────────────────
  const handleRegistrarAporte = async () => {
    const monto = parseCurrencyInput(formAporteMonto);
    if (!monto || monto <= 0) { toast.error('El monto debe ser mayor a cero'); return; }
    if (!formAporteFecha)     { toast.error('Selecciona la fecha del aporte'); return; }
    if (!selectedItem)        return;

    setSavingAporte(true);
    try {
      // Usar saldo real desde BD para evitar desincronización
      const { data: dbAhorro } = await supabase
        .from('ahorro_permanente')
        .select('monto_ahorrado')
        .eq('id', selectedItem.id)
        .single();
      const saldoAnterior = dbAhorro?.monto_ahorrado ?? selectedItem.montoAhorrado;
      const saldoNuevo    = saldoAnterior + monto;

      // Insertar movimiento
      const { error: movErr } = await supabase
        .from('movimientos_ahorro_permanente')
        .insert({
          ahorro_id:        selectedItem.id,
          asociado_id:      selectedItem.asociado_id,
          tipo_movimiento:  'Aporte',
          monto,
          saldo_anterior:   saldoAnterior,
          saldo_nuevo:      saldoNuevo,
          fecha_movimiento: formAporteFecha,
          descripcion:      formAporteDesc.trim() || null,
        });
      if (movErr) throw movErr;

      // Actualizar saldo en ahorro_permanente
      const { data: updData, error: updErr } = await supabase
        .from('ahorro_permanente')
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

      // Recargar movimientos
      const { data: movs } = await supabase
        .from('movimientos_ahorro_permanente')
        .select('*')
        .eq('ahorro_id', selectedItem.id)
        .order('fecha_movimiento', { ascending: false });
      setMovimientosDetalle(movs || []);

      toast.success('Aporte registrado exitosamente', {
        description: `${formatCurrency(monto)} — Nuevo saldo: ${formatCurrency(saldoNuevo)}`,
      });
      setIsAporteDialogOpen(false);
      setFormAporteMonto('');
      setFormAporteFecha('');
      setFormAporteDesc('');
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

    // Cargar movimientos reales desde la BD para este ahorro
    try {
      const { data, error } = await supabase
        .from('movimientos_ahorro_permanente')
        .select('*')
        .eq('ahorro_id', ahorro.id)
        .order('fecha_movimiento', { ascending: true });
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
      const fm = m.fecha_movimiento;
      return fm >= pdfRangeInicio && fm <= pdfRangeFin;
    });
    const pdfData = {
      asociado:          ahorroPdfSelected.asociado,
      cedula:            ahorroPdfSelected.cedula,
      fechaAfiliacion:   ahorroPdfSelected.fechaInicio,
      aporteActual:      ahorroPdfSelected.cuotaMensual,
      fechaUltimoAporte: movsFiltrados[0]?.fecha_movimiento ?? ahorroPdfSelected.fechaInicio,
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
        fecha_inicio:   new Date().toISOString().split('T')[0],
        estado:         true,
        anulado:        false,
      });

      // 2. Marcar solicitud como aprobada
      await supabase
        .from('solicitudes')
        .update({ estado: 'aprobada', fecha_resolucion: new Date().toISOString() })
        .eq('id', sol.id);

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
      setAhorros(prev => [{
        id:              nuevo.id,
        asociado:        sol.asociados?.nombre ?? '',
        cedula:          sol.asociados?.cedula ?? '',
        asociado_id:     sol.asociado_id,
        montoAhorrado:   0,
        cuotaMensual:    montoObligatorio,
        fechaInicio:     new Date().toISOString().split('T')[0],
        estado:          true,
        anulado:         false,
        motivoAnulacion: '',
        createdAt:       new Date().toISOString(),
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
        .from('ahorro_permanente')
        .select('monto_ahorrado')
        .eq('id', ap.ahorro_id)
        .single();
      const saldoAnterior = dbAhorro?.monto_ahorrado ?? 0;
      const saldoNuevo    = saldoAnterior + ap.monto;

      // Registrar movimiento
      const { error: movErr } = await supabase
        .from('movimientos_ahorro_permanente')
        .insert({
          ahorro_id:        ap.ahorro_id,
          asociado_id:      ap.asociado_id,
          tipo_movimiento:  'Aporte',
          monto:            ap.monto,
          saldo_anterior:   saldoAnterior,
          saldo_nuevo:      saldoNuevo,
          fecha_movimiento: ap.fecha_pago,
          descripcion:      `${ap.medio_pago}${ap.nota ? ' — ' + ap.nota : ''}`,
        });
      if (movErr) throw movErr;

      // Actualizar saldo
      await supabase
        .from('ahorro_permanente')
        .update({ monto_ahorrado: saldoNuevo })
        .eq('id', ap.ahorro_id);

      // Marcar aporte como confirmado (aprobada en la tabla unificada)
      await supabase
        .from('solicitudes')
        .update({ estado: 'aprobada', fecha_resolucion: new Date().toISOString() })
        .eq('id', ap.id);

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
      await supabase
        .from('solicitudes')
        .update({
          estado:           'rechazada',
          nota_admin:       notaRechazoAporte.trim(),
          fecha_resolucion: new Date().toISOString(),
        })
        .eq('id', aporteSeleccionado.id);

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
      await supabase
        .from('solicitudes')
        .update({
          estado:           'rechazada',
          nota_admin:       notaRechazo.trim(),
          fecha_resolucion: new Date().toISOString(),
        })
        .eq('id', solicitudSeleccionada.id);

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
                <TableRow key={ahorro.id} className={`cursor-pointer hover:bg-slate-50 transition-colors ${!ahorro.estado && !ahorro.anulado ? 'bg-slate-50 opacity-80' : ''}`} onClick={() => handleOpenDetail(ahorro)}>
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
                    <p className="text-slate-900 font-medium">{formatCurrency(ahorro.montoAhorrado)}</p>
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
                    <div className="flex gap-2 justify-end">
                      {/* Solo se editan ahorros ACTIVOS */}
                      {!isAnulados && userRole === 'admin' && ahorro.estado && (
                        <Button variant="outline" size="sm" title="Editar" onClick={() => handleOpenCreateDialog(ahorro)}>
                          <Edit className="size-4" />
                        </Button>
                      )}
                      {!isAnulados && userRole === 'admin' && (
                        <Button variant="outline" size="sm" title="Anular" onClick={() => {
                          setSelectedItem(ahorro);
                          setJustificacionAnulacion('');
                          setIsDeleteDialogOpen(true);
                        }}>
                          <Trash2 className="size-4 text-amber-600" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        title="Descargar extracto PDF"
                        className="hover:bg-emerald-50"
                        onClick={() => handleOpenPdfDialog(ahorro)}
                      >
                        <FileText className="size-4 text-emerald-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
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
    <div className="p-8 bg-slate-50 min-h-screen">
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
              <p className="text-xs text-slate-500">Monto mensual obligatorio (formato: 100.000,0)</p>
            </div>

            {/* Saldo inicial — solo al crear */}
            {!selectedItem && (
              <div className="space-y-2">
                <Label htmlFor="saldo">Saldo inicial</Label>
                <Input
                  id="saldo"
                  type="text"
                  placeholder="0,0"
                  value={formSaldoInicial}
                  onChange={handleSaldoInicialChange}
                  onBlur={handleSaldoInicialBlur}
                />
                <p className="text-xs text-slate-500">Monto inicial del plan (opcional)</p>
              </div>
            )}

            {/* Fecha de inicio — al crear: requerida · al editar: solo si no hay movimientos */}
            {!selectedItem ? (
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha de inicio *</Label>
                <Input id="fecha" type="date" value={formFechaInicio} onChange={(e) => setFormFechaInicio(e.target.value)} />
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
                    <Input id="fecha-edit" type="date" value={formFechaInicio} onChange={(e) => setFormFechaInicio(e.target.value)} />
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
            const saldoRealDetalle = ultimoMovActivo?.saldo_nuevo ?? selectedItem.montoAhorrado;
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
                {selectedItem && !selectedItem.anulado && selectedItem.estado && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        setFormAporteMonto('');
                        setFormAporteFecha(new Date().toISOString().split('T')[0]);
                        setFormAporteDesc('');
                        setIsAporteDialogOpen(true);
                      }}
                    >
                      <Plus className="size-4" /> Registrar Aporte
                    </Button>
                  </div>
                )}
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
                            <p className="text-xs text-slate-500">{mov.fecha_movimiento} {mov.descripcion ? `— ${mov.descripcion}` : ''}</p>
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
                [...movimientosDetalle].filter(m => !m.anulado).sort((a,b) => new Date(b.fecha_movimiento).getTime() - new Date(a.fecha_movimiento).getTime())[0]?.saldo_nuevo
                ?? selectedItem.montoAhorrado
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
                onChange={(e) => setFormAporteFecha(e.target.value)}
              />
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
            {nuevoEstadoSeleccionado === 'anulado' && (
              <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <Label className="text-red-700 font-medium">
                  Justificación de anulación <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Motivo de la anulación..."
                  value={justificacionAnulacion}
                  onChange={(e) => setJustificacionAnulacion(e.target.value)}
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSelectedItem(null); setJustificacionAnulacion(''); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleEstado}
              disabled={nuevoEstadoSeleccionado === 'anulado' && !justificacionAnulacion.trim()}
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
