import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Search, Plus, ChevronLeft, ChevronRight, Edit, Trash2,
  Wallet, FileText, History, DollarSign, AlertTriangle, Calendar,
  TrendingUp, X, Target, ArrowDownCircle, ArrowUpCircle, Check,
  ClipboardList, Clock, CheckCircle2, XCircle, Send,
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
import { generateAhorroVoluntarioPDF, buildAhorroVoluntarioPDF } from './utils/pdfGenerator';

import { supabase } from '../lib/supabase';
import { ahorroVoluntarioApi, asociadosApi } from '../lib/api';

interface AhorroVoluntarioProps {
  userRole?: 'admin' | 'asociado' | null;
  userData?: any;
}

const FRECUENCIAS = ['Diaria', 'Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'];

export default function AhorroVoluntario({ userRole, userData }: AhorroVoluntarioProps) {
  // ── Filtros / paginación ──────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]               = useState('');
  const [filterEstado, setFilterEstado]           = useState('');
  const [filterFechaInicio, setFilterFechaInicio] = useState('');
  const [filterFechaFin, setFilterFechaFin]       = useState('');
  const [sortBy, setSortBy]                       = useState<'default'|'fecha-desc'|'fecha-asc'|'monto-desc'|'monto-asc'>('default');
  const [currentPage, setCurrentPage]             = useState(1);
  const [currentPageAnulados, setCurrentPageAnulados] = useState(1);
  const itemsPerPage = 10;

  // ── Diálogos ──────────────────────────────────────────────────────────────
  const [isCreateDialogOpen, setIsCreateDialogOpen]         = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen]         = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]         = useState(false);
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [isMovimientoDialogOpen, setIsMovimientoDialogOpen] = useState(false);

  // ── Item seleccionado ─────────────────────────────────────────────────────
  const [selectedItem, setSelectedItem]           = useState<any>(null);

  // ── Formulario crear/editar ───────────────────────────────────────────────
  const [formAsociadoId, setFormAsociadoId]       = useState<string>('');
  const [formCuotaMensual, setFormCuotaMensual]   = useState<string>('');
  const [formSaldoInicial, setFormSaldoInicial]   = useState<string>('0,0');
  const [formFechaInicio, setFormFechaInicio]     = useState<string>('');
  const [formFrecuencia, setFormFrecuencia]       = useState<string>('Mensual');
  const [formMontoObjetivo, setFormMontoObjetivo] = useState<string>('');

  // ── Autocompletado buscador principal ────────────────────────────────────
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Autocompletado de asociados (formulario) ──────────────────────────────
  const [autocompleteSearch, setAutocompleteSearch] = useState('');
  const [showAutocomplete, setShowAutocomplete]     = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // ── Movimientos ───────────────────────────────────────────────────────────
  const [movimientosDetalle, setMovimientosDetalle] = useState<any[]>([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);

  // ── Historial de modificaciones ───────────────────────────────────────────
  const [historialCambios, setHistorialCambios]     = useState<any[]>([]);
  const [formMovTipo, setFormMovTipo]   = useState<'Depósito'|'Retiro'>('Depósito');
  const [formMovMonto, setFormMovMonto] = useState('');
  const [formMovFecha, setFormMovFecha] = useState('');
  const [formMovDesc, setFormMovDesc]   = useState('');
  const [formMovMetodo, setFormMovMetodo] = useState('');
  const [savingMovimiento, setSavingMovimiento] = useState(false);

  // ── Preview PDF ───────────────────────────────────────────────────────────
  const [isPdfPreviewOpen, setIsPdfPreviewOpen]   = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl]         = useState<string>('');
  const [pdfPreviewFilename, setPdfPreviewFilename] = useState<string>('');
  const [pdfDownloadFn, setPdfDownloadFn]         = useState<(() => void) | null>(null);

  // ── Anulación ─────────────────────────────────────────────────────────────
  const [justificacionAnulacion, setJustificacionAnulacion] = useState('');

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [ahorros, setAhorros]                     = useState<any[]>([]);
  const [asociadosDisponibles, setAsociadosDisponibles] = useState<any[]>([]);
  const [loading, setLoading]                     = useState(true);

  // ── Solicitudes (admin) ───────────────────────────────────────────────────
  const [solicitudesVol, setSolicitudesVol]           = useState<any[]>([]);
  const [isRechazarVolOpen, setIsRechazarVolOpen]     = useState(false);
  const [solVolSeleccionada, setSolVolSeleccionada]   = useState<any>(null);
  const [notaRechazoVol, setNotaRechazoVol]           = useState('');
  const [savingSolVol, setSavingSolVol]               = useState(false);

  // ── Aportes reportados (admin) ────────────────────────────────────────────
  const [aportesPendientesVol, setAportesPendientesVol] = useState<any[]>([]);
  const [isRechazarAporteVolOpen, setIsRechazarAporteVolOpen] = useState(false);
  const [aporteVolSeleccionado, setAporteVolSeleccionado]     = useState<any>(null);
  const [notaRechazoAporteVol, setNotaRechazoAporteVol]       = useState('');
  const [savingAporteVol, setSavingAporteVol]                 = useState(false);

  useEffect(() => { cargarDatos(); }, []);

  // Cerrar autocompletes al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      const [{ data, error }, asociadosData] = await Promise.all([
        supabase
          .from('ahorro_voluntario')
          .select('*, asociados(nombre, cedula)')
          .order('created_at', { ascending: false }),
        asociadosApi.getAll(),
      ]);
      if (error) throw error;

      const mapeados = (data || []).map((a: any) => ({
        id:              a.id,
        asociado:        a.asociados?.nombre  ?? 'Sin nombre',
        cedula:          a.asociados?.cedula  ?? '',
        asociado_id:     a.asociado_id,
        montoAhorrado:   a.monto_ahorrado,
        cuotaMensual:    a.cuota_mensual,
        fechaInicio:     a.fecha_inicio,
        frecuencia:      a.frecuencia_ahorro  ?? 'Mensual',
        montoObjetivo:   a.monto_objetivo     ?? 0,
        estado:          a.estado,
        anulado:         a.anulado,
        motivoAnulacion: a.motivo_anulacion || '',
        createdAt:       a.created_at,
      }));

      setAhorros(mapeados);
      setAsociadosDisponibles(asociadosData || []);

      // Solicitudes y aportes pendientes (admin)
      if (userRole === 'admin') {
        const [{ data: sols }, { data: aportes }] = await Promise.all([
          supabase
            .from('solicitudes_ahorro')
            .select('*, asociados(nombre, cedula)')
            .eq('tipo', 'voluntario')
            .order('created_at', { ascending: false }),
          supabase
            .from('solicitudes_aporte')
            .select('*, asociados(nombre, cedula)')
            .eq('tipo_ahorro', 'voluntario')
            .order('created_at', { ascending: false }),
        ]);
        setSolicitudesVol(sols || []);
        setAportesPendientesVol(aportes || []);
      }
    } catch (err: any) {
      toast.error('Error al cargar ahorros voluntarios: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Filtros / orden / paginación ──────────────────────────────────────────
  const ahorrosBase = userRole === 'asociado'
    ? ahorros.filter(a => a.cedula === userData?.cedula && !a.anulado)
    : ahorros.filter(a => !a.anulado);

  const filteredAhorros = ahorrosBase.filter(a => {
    const term = searchTerm.toLowerCase();
    const matchSearch = !term ||
      a.asociado.toLowerCase().includes(term) ||
      a.cedula.includes(searchTerm) ||
      a.id.toLowerCase().includes(term);
    const matchEstado =
      !filterEstado ||
      (filterEstado === 'activo'   && a.estado === true) ||
      (filterEstado === 'inactivo' && a.estado === false);
    const matchFechaInicio = !filterFechaInicio || a.fechaInicio >= filterFechaInicio;
    const matchFechaFin    = !filterFechaFin    || a.fechaInicio <= filterFechaFin;
    return matchSearch && matchEstado && matchFechaInicio && matchFechaFin;
  });

  const sortedAhorros = [...filteredAhorros].sort((a, b) => {
    switch (sortBy) {
      case 'fecha-desc': return new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime();
      case 'fecha-asc':  return new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime();
      case 'monto-desc': return b.montoAhorrado - a.montoAhorrado;
      case 'monto-asc':  return a.montoAhorrado - b.montoAhorrado;
      default: return 0;
    }
  });

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

  const totalPagesAnulados     = Math.ceil(filteredAhorrosAnulados.length / itemsPerPage);
  const startIndexAnulados     = (currentPageAnulados - 1) * itemsPerPage;
  const endIndexAnulados       = startIndexAnulados + itemsPerPage;
  const currentAhorrosAnulados = filteredAhorrosAnulados.slice(startIndexAnulados, endIndexAnulados);

  const hayFiltros = !!(searchTerm || filterEstado || filterFechaInicio || filterFechaFin);

  // ── Helpers de formato ────────────────────────────────────────────────────
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

  const handleCuotaMensualChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormCuotaMensual(e.target.value.replace(/[^\d.,]/g, ''));
  const handleCuotaMensualBlur = () =>
    formCuotaMensual && setFormCuotaMensual(formatCurrencyInput(parseCurrencyInput(formCuotaMensual).toString()));
  const handleSaldoInicialChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormSaldoInicial(e.target.value.replace(/[^\d.,]/g, ''));
  const handleSaldoInicialBlur = () =>
    formSaldoInicial && setFormSaldoInicial(formatCurrencyInput(parseCurrencyInput(formSaldoInicial).toString()));

  const limpiarFiltros = () => {
    setSearchTerm(''); setFilterEstado(''); setFilterFechaInicio(''); setFilterFechaFin('');
    setSortBy('default'); setCurrentPage(1);
  };

  // ── Autocompletado helpers ────────────────────────────────────────────────
  const autocompleteSuggestions = asociadosDisponibles
    .filter(a => a.estado && (
      a.nombre.toLowerCase().includes(autocompleteSearch.toLowerCase()) ||
      a.cedula.includes(autocompleteSearch)
    ))
    .slice(0, 8);

  const handleSelectAsociado = (a: any) => {
    setFormAsociadoId(a.id);
    setAutocompleteSearch(`${a.nombre}  ·  ${a.cedula}`);
    setShowAutocomplete(false);
  };

  // ── Abrir detalle y cargar movimientos + historial ───────────────────────
  const handleOpenDetail = async (ahorro: any) => {
    setSelectedItem(ahorro);
    setMovimientosDetalle([]);
    setHistorialCambios([]);
    setIsDetailDialogOpen(true);
    setLoadingMovimientos(true);
    try {
      const [movsResult, histResult] = await Promise.all([
        supabase
          .from('movimientos_ahorro_voluntario')
          .select('*')
          .eq('ahorro_id', ahorro.id)
          .order('fecha_movimiento', { ascending: false }),
        supabase
          .from('historial_modificaciones_ahorro_voluntario')
          .select('*')
          .eq('ahorro_id', ahorro.id)
          .order('fecha_cambio', { ascending: false }),
      ]);

      if (!movsResult.error) {
        setMovimientosDetalle(movsResult.data || []);
        const ultimoActivo = (movsResult.data || []).filter((m: any) => !m.anulado)[0];
        if (ultimoActivo) {
          setAhorros(prev => prev.map(a =>
            a.id === ahorro.id ? { ...a, montoAhorrado: ultimoActivo.saldo_nuevo } : a
          ));
          setSelectedItem((prev: any) => ({ ...prev, montoAhorrado: ultimoActivo.saldo_nuevo }));
        }
      }
      if (!histResult.error) setHistorialCambios(histResult.data || []);
    } catch { /* sin datos */ }
    setLoadingMovimientos(false);
  };

  // ── Mes fiscal helpers ────────────────────────────────────────────────────
  const MONTO_MINIMO_VOLUNTARIO = 50_000;

  const getMesFiscal = () => {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = hoy.getMonth();
    const ultimoDelMes = new Date(año, mes + 1, 0).getDate();
    const diaFin       = Math.min(30, ultimoDelMes);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    return {
      primerDia:  fmt(new Date(año, mes, 1)),
      ultimoDia:  fmt(new Date(año, mes, diaFin)),
      nombreMes:  hoy.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
      diaFin,
    };
  };

  // ── Registrar movimiento (depósito / retiro) ──────────────────────────────
  const handleRegistrarMovimiento = async () => {
    const monto = parseCurrencyInput(formMovMonto);
    if (!monto || monto <= 0) { toast.error('El monto debe ser mayor a cero'); return; }
    if (!formMovFecha)        { toast.error('Selecciona la fecha del movimiento'); return; }
    if (!selectedItem)        return;

    // ── Reglas del negocio para depósitos voluntarios ─────────────────────
    if (formMovTipo === 'Depósito') {
      if (monto < MONTO_MINIMO_VOLUNTARIO) {
        toast.error('Monto mínimo no alcanzado', {
          description: `El depósito mínimo al ahorro voluntario es ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(MONTO_MINIMO_VOLUNTARIO)}.`,
          duration: 6000,
        });
        return;
      }
      // Validar que la fecha esté dentro del mes fiscal (día 1 al 30)
      const dia = parseInt(formMovFecha.split('-')[2], 10);
      if (dia > 30) {
        toast.error('Fecha fuera del mes fiscal', {
          description: 'El mes fiscal va del día 1 al 30. Selecciona una fecha dentro de ese rango.',
          duration: 5000,
        });
        return;
      }
    }

    setSavingMovimiento(true);
    try {
      // Leer saldo real desde BD
      const { data: dbAhorro } = await supabase
        .from('ahorro_voluntario')
        .select('monto_ahorrado')
        .eq('id', selectedItem.id)
        .single();
      const saldoAnterior = dbAhorro?.monto_ahorrado ?? selectedItem.montoAhorrado;

      if (formMovTipo === 'Retiro' && monto > saldoAnterior) {
        toast.error('El monto del retiro supera el saldo disponible');
        setSavingMovimiento(false);
        return;
      }

      const saldoNuevo = formMovTipo === 'Retiro'
        ? saldoAnterior - monto
        : saldoAnterior + monto;

      // Insertar movimiento
      const { error: movErr } = await supabase
        .from('movimientos_ahorro_voluntario')
        .insert({
          ahorro_id:        selectedItem.id,
          asociado_id:      selectedItem.asociado_id,
          tipo_movimiento:  formMovTipo,
          monto,
          saldo_anterior:   saldoAnterior,
          saldo_nuevo:      saldoNuevo,
          fecha_movimiento: formMovFecha,
          descripcion:      formMovDesc.trim() || null,
          metodo_pago:      formMovMetodo.trim() || null,
        });
      if (movErr) throw movErr;

      // Actualizar saldo en ahorro_voluntario
      const { data: updData, error: updErr } = await supabase
        .from('ahorro_voluntario')
        .update({ monto_ahorrado: saldoNuevo })
        .eq('id', selectedItem.id)
        .select('monto_ahorrado')
        .single();
      if (updErr) throw updErr;

      const saldoConfirmado = updData?.monto_ahorrado ?? saldoNuevo;
      setSelectedItem((prev: any) => ({ ...prev, montoAhorrado: saldoConfirmado }));
      setAhorros(prev => prev.map(a =>
        a.id === selectedItem.id ? { ...a, montoAhorrado: saldoConfirmado } : a
      ));

      // Recargar movimientos
      const { data: movs } = await supabase
        .from('movimientos_ahorro_voluntario')
        .select('*')
        .eq('ahorro_id', selectedItem.id)
        .order('fecha_movimiento', { ascending: false });
      setMovimientosDetalle(movs || []);

      toast.success(`${formMovTipo} registrado exitosamente`, {
        description: `${formatCurrency(monto)} — Nuevo saldo: ${formatCurrency(saldoNuevo)}`,
      });
      setIsMovimientoDialogOpen(false);
      setFormMovMonto(''); setFormMovFecha(''); setFormMovDesc(''); setFormMovMetodo('');
    } catch (err: any) {
      toast.error('Error al registrar movimiento: ' + err.message);
    } finally {
      setSavingMovimiento(false);
    }
  };

  // ── Cambiar estado ────────────────────────────────────────────────────────
  const handleToggleEstado = async (id: string) => {
    const ahorro = ahorros.find(a => a.id === id);
    if (!ahorro) return;
    try {
      await ahorroVoluntarioApi.update(id, { estado: !ahorro.estado });
      setAhorros(prev => prev.map(a => a.id === id ? { ...a, estado: !a.estado } : a));
      toast.success(`Ahorro de "${ahorro.asociado}" ${!ahorro.estado ? 'activado' : 'desactivado'} exitosamente`);
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
    setIsToggleEstadoDialogOpen(false);
    setSelectedItem(null);
  };

  // ── Anular ────────────────────────────────────────────────────────────────
  const handleAnular = async () => {
    if (!selectedItem) return;
    if (!justificacionAnulacion.trim()) {
      toast.error('La justificación es obligatoria para anular un ahorro');
      return;
    }
    try {
      const justificacion = justificacionAnulacion.trim();
      await ahorroVoluntarioApi.anular(selectedItem.id, justificacion);

      const usuarioNombre = userData?.name || userData?.nombre || userData?.email || 'Administrador';
      const fechaHoy = new Date().toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
      });

      // Notificación al asociado sobre la anulación
      await supabase.from('notificaciones').insert({
        asociado_id: selectedItem.asociado_id,
        titulo:      'Tu ahorro voluntario ha sido anulado',
        mensaje:     `Estimado(a) ${selectedItem.asociado},\n\nEl administrador ${usuarioNombre} anuló tu plan de ahorro voluntario el ${fechaHoy}.\n\nMotivo de la cancelación: "${justificacion}"\n\nSaldo acumulado al momento de la anulación: ${formatCurrency(selectedItem.montoAhorrado)}\n\nSi tienes dudas o desacuerdos, comunícate con la cooperativa.`,
        tipo:        'anulacion',
      });

      // Registrar en historial de modificaciones
      await supabase.from('historial_modificaciones_ahorro_voluntario').insert({
        ahorro_id:           selectedItem.id,
        asociado_id:         selectedItem.asociado_id,
        usuario_id:          userData?.id || null,
        usuario_nombre:      usuarioNombre,
        campos_modificados:  `ANULACIÓN DEL REGISTRO — Motivo: ${justificacion}`,
        cuota_anterior:      selectedItem.cuotaMensual,
        saldo_anterior:      selectedItem.montoAhorrado,
        frecuencia_anterior: selectedItem.frecuencia,
      });

      setAhorros(prev => prev.map(a =>
        a.id === selectedItem.id ? { ...a, anulado: true, estado: false, motivoAnulacion: justificacion } : a
      ));
      toast.success(`Ahorro de "${selectedItem.asociado}" anulado exitosamente`);
    } catch (err: any) {
      toast.error('Error al anular ahorro: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedItem(null);
    setJustificacionAnulacion('');
  };

  // ── Guardar (crear / editar) ──────────────────────────────────────────────
  const handleSaveAhorro = async () => {
    if (!formAsociadoId) { toast.error('❌ Error de validación', { description: 'Selecciona un asociado' }); return; }
    const cuota = parseCurrencyInput(formCuotaMensual);
    if (!cuota || cuota <= 0) { toast.error('❌ Error de validación', { description: 'La cuota debe ser mayor a cero' }); return; }
    const saldo = parseCurrencyInput(formSaldoInicial);
    if (!formFechaInicio) { toast.error('❌ Error de validación', { description: 'Selecciona una fecha de inicio' }); return; }

    const asociado = asociadosDisponibles.find(a => a.id === formAsociadoId);
    const montoObjetivo = formMontoObjetivo ? parseCurrencyInput(formMontoObjetivo) : null;

    try {
      if (selectedItem) {
        // Capturar valores anteriores ANTES de actualizar
        const prevCuota      = selectedItem.cuotaMensual;
        const prevSaldo      = selectedItem.montoAhorrado;
        const prevFecha      = selectedItem.fechaInicio;
        const prevFrecuencia = selectedItem.frecuencia || 'Mensual';
        const prevObjetivo   = selectedItem.montoObjetivo || null;

        await ahorroVoluntarioApi.update(selectedItem.id, {
          cuota_mensual:    cuota,
          monto_ahorrado:   saldo,
          fecha_inicio:     formFechaInicio,
          frecuencia_ahorro: formFrecuencia,
          monto_objetivo:   montoObjetivo,
        });

        // Detectar qué campos cambiaron
        const camposModificados: string[] = [];
        if (prevCuota !== cuota)           camposModificados.push('Cuota mensual');
        if (prevSaldo !== saldo)           camposModificados.push('Saldo');
        if (prevFecha !== formFechaInicio) camposModificados.push('Fecha de inicio');
        if (prevFrecuencia !== formFrecuencia) camposModificados.push('Frecuencia');
        if ((prevObjetivo ?? 0) !== (montoObjetivo ?? 0)) camposModificados.push('Monto objetivo');

        const usuarioNombre = userData?.name || userData?.nombre || userData?.email || 'Administrador';
        const fechaCambio   = new Date().toISOString();

        // Registrar en historial de modificaciones
        await supabase.from('historial_modificaciones_ahorro_voluntario').insert({
          ahorro_id:           selectedItem.id,
          asociado_id:         selectedItem.asociado_id,
          usuario_id:          userData?.id || null,
          usuario_nombre:      usuarioNombre,
          fecha_cambio:        fechaCambio,
          cuota_anterior:      prevCuota,
          frecuencia_anterior: prevFrecuencia,
          objetivo_anterior:   prevObjetivo,
          saldo_anterior:      prevSaldo,
          fecha_inicio_anterior: prevFecha,
          cuota_nueva:         cuota,
          frecuencia_nueva:    formFrecuencia,
          objetivo_nuevo:      montoObjetivo,
          saldo_nuevo:         saldo,
          fecha_inicio_nueva:  formFechaInicio,
          campos_modificados:  camposModificados.join(', ') || 'Sin cambios detectados',
        });

        // Enviar notificación al asociado
        if (camposModificados.length > 0) {
          const lineasCambios = [];
          if (prevCuota !== cuota)
            lineasCambios.push(`• Cuota: ${formatCurrency(prevCuota)} → ${formatCurrency(cuota)}`);
          if (prevFrecuencia !== formFrecuencia)
            lineasCambios.push(`• Frecuencia: ${prevFrecuencia} → ${formFrecuencia}`);
          if ((prevObjetivo ?? 0) !== (montoObjetivo ?? 0))
            lineasCambios.push(`• Monto objetivo: ${prevObjetivo ? formatCurrency(prevObjetivo) : 'Sin meta'} → ${montoObjetivo ? formatCurrency(montoObjetivo) : 'Sin meta'}`);
          if (prevFecha !== formFechaInicio)
            lineasCambios.push(`• Fecha de inicio: ${prevFecha} → ${formFechaInicio}`);

          await supabase.from('notificaciones').insert({
            asociado_id: selectedItem.asociado_id,
            titulo:      'Modificación en tu ahorro voluntario',
            mensaje:     `El administrador ${usuarioNombre} realizó cambios en tu plan de ahorro voluntario el ${new Date(fechaCambio).toLocaleDateString('es-CO')}.\n\nCambios realizados:\n${lineasCambios.join('\n')}`,
            tipo:        'modificacion',
          });
        }

        setAhorros(prev => prev.map(a =>
          a.id === selectedItem.id
            ? { ...a, cuotaMensual: cuota, montoAhorrado: saldo, fechaInicio: formFechaInicio, frecuencia: formFrecuencia, montoObjetivo: montoObjetivo ?? 0 }
            : a
        ));
        toast.success('✅ Ahorro voluntario actualizado', {
          description: camposModificados.length > 0
            ? `Campos modificados: ${camposModificados.join(', ')}`
            : `Ahorro de "${asociado?.nombre}" sin cambios`,
        });
      } else {
        const nuevo = await ahorroVoluntarioApi.create({
          asociado_id:      formAsociadoId,
          cuota_mensual:    cuota,
          monto_ahorrado:   saldo,
          fecha_inicio:     formFechaInicio,
          frecuencia_ahorro: formFrecuencia,
          monto_objetivo:   montoObjetivo,
          estado:           true,
          anulado:          false,
        });

        // Registrar saldo inicial como movimiento de apertura
        if (saldo > 0) {
          const { error: movErr } = await supabase
            .from('movimientos_ahorro_voluntario')
            .insert({
              ahorro_id:        nuevo.id,
              asociado_id:      formAsociadoId,
              tipo_movimiento:  'Depósito',
              monto:            saldo,
              saldo_anterior:   0,
              saldo_nuevo:      saldo,
              fecha_movimiento: formFechaInicio,
              descripcion:      'Saldo inicial al abrir el plan',
            });
          if (movErr) toast.error('Ahorro creado, pero error al registrar saldo inicial: ' + movErr.message);
        }

        setAhorros(prev => [{
          id: nuevo.id,
          asociado:       asociado?.nombre ?? '',
          cedula:         asociado?.cedula ?? '',
          asociado_id:    formAsociadoId,
          montoAhorrado:  saldo,
          cuotaMensual:   cuota,
          fechaInicio:    formFechaInicio,
          frecuencia:     formFrecuencia,
          montoObjetivo:  montoObjetivo ?? 0,
          estado:         true,
          anulado:        false,
          motivoAnulacion: '',
          createdAt:      new Date().toISOString(),
        }, ...prev]);
        toast.success('✅ Ahorro voluntario registrado', {
          description: saldo > 0
            ? `Saldo inicial: ${formatCurrency(saldo)} | Cuota: ${formatCurrency(cuota)} | Frecuencia: ${formFrecuencia}`
            : `Cuota: ${formatCurrency(cuota)} | Frecuencia: ${formFrecuencia}`,
        });
      }
    } catch (err: any) {
      toast.error('Error al guardar ahorro: ' + err.message);
    }

    setIsCreateDialogOpen(false);
    setSelectedItem(null);
    setFormAsociadoId(''); setFormCuotaMensual(''); setFormSaldoInicial('0,0');
    setFormFechaInicio(''); setFormFrecuencia('Mensual'); setFormMontoObjetivo('');
    setAutocompleteSearch('');
  };

  // ── Admin: aprobar solicitud voluntaria ───────────────────────────────────
  const handleAprobarSolicitudVol = async (sol: any) => {
    const formatC = (v: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);
    try {
      const nuevo = await ahorroVoluntarioApi.create({
        asociado_id:       sol.asociado_id,
        cuota_mensual:     sol.monto_inicial ?? 0,
        monto_ahorrado:    sol.monto_inicial ?? 0,
        monto_objetivo:    sol.monto_objetivo ?? null,
        fecha_inicio:      new Date().toISOString().split('T')[0],
        frecuencia_ahorro: sol.frecuencia ?? 'Mensual',
        estado:            true,
        anulado:           false,
      });

      await supabase
        .from('solicitudes_ahorro')
        .update({ estado: 'aprobada', reviewed_at: new Date().toISOString() })
        .eq('id', sol.id);

      await supabase.from('notificaciones').insert({
        titulo:      '✅ Solicitud de ahorro voluntario aprobada',
        mensaje:     `Tu plan "${sol.nombre_plan ?? 'de ahorro voluntario'}" fue aprobado con frecuencia ${sol.frecuencia ?? 'Mensual'}.`,
        tipo:        'ahorro_aprobado',
        leida:       false,
        asociado_id: sol.asociado_id,
      });

      setSolicitudesVol(prev =>
        prev.map(s => s.id === sol.id ? { ...s, estado: 'aprobada' } : s)
      );

      // Agregar inmediatamente al listado de ahorros activos
      setAhorros(prev => [{
        id:              nuevo.id,
        asociado:        sol.asociados?.nombre   ?? '',
        cedula:          sol.asociados?.cedula   ?? '',
        asociado_id:     sol.asociado_id,
        montoAhorrado:   sol.monto_inicial       ?? 0,
        cuotaMensual:    sol.monto_inicial       ?? 0,
        fechaInicio:     new Date().toISOString().split('T')[0],
        frecuencia:      sol.frecuencia          ?? 'Mensual',
        montoObjetivo:   sol.monto_objetivo      ?? 0,
        estado:          true,
        anulado:         false,
        motivoAnulacion: '',
        createdAt:       new Date().toISOString(),
      }, ...prev]);

      toast.success(`✅ Plan aprobado para ${sol.asociados?.nombre ?? 'el asociado'}`);
    } catch (err: any) {
      toast.error('Error al aprobar: ' + err.message);
    }
  };

  // ── Admin: rechazar solicitud voluntaria ──────────────────────────────────
  const handleRechazarSolicitudVol = async () => {
    if (!solVolSeleccionada) return;
    if (!notaRechazoVol.trim()) { toast.error('Escribe el motivo del rechazo'); return; }
    setSavingSolVol(true);
    try {
      await supabase
        .from('solicitudes_ahorro')
        .update({ estado: 'rechazada', nota_admin: notaRechazoVol.trim(), reviewed_at: new Date().toISOString() })
        .eq('id', solVolSeleccionada.id);

      await supabase.from('notificaciones').insert({
        titulo:      '❌ Solicitud de ahorro voluntario rechazada',
        mensaje:     `Tu solicitud "${solVolSeleccionada.nombre_plan ?? 'de ahorro voluntario'}" fue rechazada. Motivo: ${notaRechazoVol.trim()}`,
        tipo:        'ahorro_rechazado',
        leida:       false,
        asociado_id: solVolSeleccionada.asociado_id,
      });

      setSolicitudesVol(prev =>
        prev.map(s => s.id === solVolSeleccionada.id ? { ...s, estado: 'rechazada', nota_admin: notaRechazoVol.trim() } : s)
      );
      toast.success('Solicitud rechazada');
      setIsRechazarVolOpen(false);
      setSolVolSeleccionada(null);
      setNotaRechazoVol('');
    } catch (err: any) {
      toast.error('Error al rechazar: ' + err.message);
    } finally {
      setSavingSolVol(false);
    }
  };

  // ── Admin: confirmar aporte voluntario reportado ──────────────────────────
  const handleConfirmarAporteVol = async (ap: any) => {
    try {
      const { data: dbAhorro } = await supabase
        .from('ahorro_voluntario')
        .select('monto_ahorrado')
        .eq('id', ap.ahorro_id)
        .single();
      const saldoAnterior = dbAhorro?.monto_ahorrado ?? 0;
      const saldoNuevo    = saldoAnterior + ap.monto;

      const { error: movErr } = await supabase
        .from('movimientos_ahorro_voluntario')
        .insert({
          ahorro_id:        ap.ahorro_id,
          asociado_id:      ap.asociado_id,
          tipo_movimiento:  'Depósito',
          monto:            ap.monto,
          saldo_anterior:   saldoAnterior,
          saldo_nuevo:      saldoNuevo,
          fecha_movimiento: ap.fecha_pago,
          descripcion:      `${ap.medio_pago}${ap.nota ? ' — ' + ap.nota : ''}`,
        });
      if (movErr) throw movErr;

      await supabase
        .from('ahorro_voluntario')
        .update({ monto_ahorrado: saldoNuevo })
        .eq('id', ap.ahorro_id);

      await supabase
        .from('solicitudes_aporte')
        .update({ estado: 'confirmado', reviewed_at: new Date().toISOString() })
        .eq('id', ap.id);

      await supabase.from('notificaciones').insert({
        titulo:      '✅ Aporte voluntario confirmado',
        mensaje:     `Tu aporte de ${formatCurrency(ap.monto)} (${ap.medio_pago}) fue confirmado. Nuevo saldo: ${formatCurrency(saldoNuevo)}.`,
        tipo:        'aporte_confirmado',
        leida:       false,
        asociado_id: ap.asociado_id,
      });

      setAportesPendientesVol(prev =>
        prev.map(a => a.id === ap.id ? { ...a, estado: 'confirmado' } : a)
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

  // ── Admin: rechazar aporte voluntario reportado ───────────────────────────
  const handleRechazarAporteVol = async () => {
    if (!aporteVolSeleccionado) return;
    if (!notaRechazoAporteVol.trim()) { toast.error('Escribe el motivo del rechazo'); return; }
    setSavingAporteVol(true);
    try {
      await supabase
        .from('solicitudes_aporte')
        .update({
          estado:      'rechazado',
          nota_admin:  notaRechazoAporteVol.trim(),
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', aporteVolSeleccionado.id);

      await supabase.from('notificaciones').insert({
        titulo:      '❌ Aporte voluntario no confirmado',
        mensaje:     `Tu reporte de aporte de ${formatCurrency(aporteVolSeleccionado.monto)} no fue confirmado. Motivo: ${notaRechazoAporteVol.trim()}`,
        tipo:        'aporte_rechazado',
        leida:       false,
        asociado_id: aporteVolSeleccionado.asociado_id,
      });

      setAportesPendientesVol(prev =>
        prev.map(a => a.id === aporteVolSeleccionado.id ? { ...a, estado: 'rechazado', nota_admin: notaRechazoAporteVol.trim() } : a)
      );
      toast.success('Aporte rechazado y asociado notificado');
      setIsRechazarAporteVolOpen(false);
      setAporteVolSeleccionado(null);
      setNotaRechazoAporteVol('');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSavingAporteVol(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando ahorros voluntarios...</p>
        </div>
      </div>
    );
  }

  const renderEmptyState = (isAnulados: boolean) => (
    <TableRow>
      <TableCell colSpan={8} className="py-16">
        <div className="flex flex-col items-center justify-center text-center">
          <Wallet className="size-10 text-slate-300 mb-3" />
          {isAnulados ? (
            <p className="text-slate-500">No hay ahorros voluntarios anulados</p>
          ) : ahorros.filter(a => !a.anulado).length === 0 ? (
            <>
              <h3 className="text-slate-700 mb-1">No hay ahorros voluntarios registrados</h3>
              <p className="text-sm text-slate-400">Aún no se han registrado ahorros voluntarios en el sistema</p>
            </>
          ) : hayFiltros ? (
            <>
              <h3 className="text-slate-700 mb-1">No se encontraron resultados</h3>
              <p className="text-sm text-slate-400 mb-3">No existen ahorros con los criterios ingresados</p>
              <Button variant="outline" size="sm" onClick={limpiarFiltros} className="gap-2">
                <X className="size-3" /> Limpiar filtros
              </Button>
            </>
          ) : (
            <p className="text-slate-500">No se encontraron ahorros voluntarios</p>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  const renderTable = (ahorrosList: any[], isAnulados: boolean = false) => (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asociado</TableHead>
            <TableHead>Cédula</TableHead>
            <TableHead>Monto ahorrado</TableHead>
            <TableHead>Frecuencia</TableHead>
            <TableHead>Cuota</TableHead>
            <TableHead>Fecha inicio</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ahorrosList.length === 0 ? renderEmptyState(isAnulados) : (
            ahorrosList.map((ahorro) => (
              <TableRow
                key={ahorro.id}
                className={`cursor-pointer hover:bg-slate-50 transition-colors ${!ahorro.estado && !ahorro.anulado ? 'opacity-75' : ''}`}
                onClick={() => handleOpenDetail(ahorro)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${isAnulados ? 'bg-slate-100' : ahorro.estado ? 'bg-purple-100' : 'bg-yellow-50'}`}>
                      <Wallet className={`size-4 ${isAnulados ? 'text-slate-600' : ahorro.estado ? 'text-purple-600' : 'text-yellow-500'}`} />
                    </div>
                    <div>
                      <p className="text-slate-900">{ahorro.asociado}</p>
                      {ahorro.montoObjetivo > 0 && (
                        <p className="text-xs text-purple-500 flex items-center gap-1">
                          <Target className="size-3" /> Meta: {formatCurrency(ahorro.montoObjetivo)}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell><p className="text-slate-600">{ahorro.cedula}</p></TableCell>
                <TableCell>
                  <div>
                    <p className="text-slate-900 font-medium">{formatCurrency(ahorro.montoAhorrado)}</p>
                    {ahorro.montoObjetivo > 0 && (
                      <div className="w-24 bg-slate-200 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-purple-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, (ahorro.montoAhorrado / ahorro.montoObjetivo) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-purple-700 border-purple-200 bg-purple-50 text-xs">
                    {ahorro.frecuencia}
                  </Badge>
                </TableCell>
                <TableCell><p className="text-slate-600">{formatCurrency(ahorro.cuotaMensual)}</p></TableCell>
                <TableCell><p className="text-slate-600">{ahorro.fechaInicio}</p></TableCell>
                <TableCell>
                  {isAnulados ? (
                    <Badge variant="secondary" className="bg-red-100 text-red-700">Anulado</Badge>
                  ) : userRole === 'admin' ? (
                    <Switch
                      checked={ahorro.estado}
                      onCheckedChange={() => { setSelectedItem(ahorro); setIsToggleEstadoDialogOpen(true); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <Badge variant={ahorro.estado ? 'default' : 'secondary'} className={ahorro.estado ? 'bg-emerald-600' : ''}>
                      {ahorro.estado ? 'Activo' : 'Inactivo'}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2 justify-end">
                    {!isAnulados && userRole === 'admin' && (
                      <>
                        <Button variant="outline" size="sm" title="Editar" onClick={() => {
                          setSelectedItem(ahorro);
                          setFormAsociadoId(ahorro.asociado_id);
                          setAutocompleteSearch(`${ahorro.asociado}  ·  ${ahorro.cedula}`);
                          setFormCuotaMensual(formatCurrencyInput(ahorro.cuotaMensual.toString()));
                          setFormSaldoInicial(ahorro.montoAhorrado.toString().replace(/\./g, ','));
                          setFormFechaInicio(ahorro.fechaInicio);
                          setFormFrecuencia(ahorro.frecuencia || 'Mensual');
                          setFormMontoObjetivo(ahorro.montoObjetivo > 0 ? ahorro.montoObjetivo.toString() : '');
                          setIsCreateDialogOpen(true);
                        }}>
                          <Edit className="size-4" />
                        </Button>
                        <Button variant="outline" size="sm" title="Anular" onClick={() => {
                          setSelectedItem(ahorro);
                          setJustificacionAnulacion('');
                          setIsDeleteDialogOpen(true);
                        }}>
                          <Trash2 className="size-4 text-amber-600" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      title="Ver certificado PDF"
                      className="hover:bg-purple-50"
                      onClick={() => {
                        const pdfData = {
                          asociado:          ahorro.asociado,
                          cedula:            ahorro.cedula,
                          montoTotal:        ahorro.montoAhorrado,
                          ultimoAporte:      ahorro.cuotaMensual,
                          fechaUltimoAporte: ahorro.fechaInicio,
                          totalAportes:      Math.floor(ahorro.montoAhorrado / (ahorro.cuotaMensual || 1)),
                          estado:            ahorro.estado,
                        };
                        const result = buildAhorroVoluntarioPDF(pdfData);
                        if (result) {
                          setPdfPreviewUrl(result.url);
                          setPdfPreviewFilename(result.filename);
                          setPdfDownloadFn(() => result.download);
                          setIsPdfPreviewOpen(true);
                        } else {
                          toast.error('Error al generar la vista previa del PDF');
                        }
                      }}
                    >
                      <FileText className="size-4 text-purple-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
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
            className={page === p ? 'bg-purple-600 hover:bg-purple-700' : ''}
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

  // ─── Resumen de movimientos ────────────────────────────────────────────────
  const movActivos     = movimientosDetalle.filter(m => !m.anulado);
  const totalDepositado = movActivos.filter(m => m.tipo_movimiento === 'Depósito' || m.tipo_movimiento === 'Apertura').reduce((s, m) => s + m.monto, 0);
  const totalRetirado   = movActivos.filter(m => m.tipo_movimiento === 'Retiro').reduce((s, m) => s + m.monto, 0);
  const saldoRealMov    = movActivos.sort((a, b) => new Date(b.fecha_movimiento).getTime() - new Date(a.fecha_movimiento).getTime())[0]?.saldo_nuevo
                          ?? selectedItem?.montoAhorrado ?? 0;

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Ahorro Voluntario</h1>
            <p className="text-slate-600">
              {userRole === 'asociado' ? 'Consulta tus ahorros voluntarios' : 'Gestiona los ahorros voluntarios de los asociados'}
            </p>
          </div>
          {userRole === 'admin' && (
            <Button className="gap-2 bg-purple-600 hover:bg-purple-700" onClick={() => {
              setSelectedItem(null);
              setFormAsociadoId(''); setFormCuotaMensual(''); setFormSaldoInicial('0,0');
              setFormFechaInicio(''); setFormFrecuencia('Mensual'); setFormMontoObjetivo('');
              setAutocompleteSearch('');
              setIsCreateDialogOpen(true);
            }}>
              <Plus className="size-4" />
              Registrar ahorro
            </Button>
          )}
        </div>

        {/* ── Tabla ── */}
        <Card>
          <CardHeader>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <CardTitle>Gestión de Ahorros Voluntarios</CardTitle>
                <div className="relative flex-1 sm:flex-none sm:w-72" ref={searchRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10" />
                  {searchTerm && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
                      onClick={() => { setSearchTerm(''); setCurrentPage(1); setShowSearchSuggestions(false); }}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                  <Input
                    placeholder="Buscar por nombre o cédula..."
                    className="pl-10 pr-8"
                    value={searchTerm}
                    autoComplete="off"
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                      setShowSearchSuggestions(true);
                    }}
                    onFocus={() => setShowSearchSuggestions(true)}
                  />
                  {/* Sugerencias de autocompletado */}
                  {showSearchSuggestions && searchTerm.trim().length > 0 && (() => {
                    const term = searchTerm.toLowerCase();
                    // Asociados únicos que tienen ahorros y coinciden con el término
                    const seen = new Set<string>();
                    const sugerencias = ahorros
                      .filter(a => {
                        const coincide =
                          a.asociado.toLowerCase().includes(term) ||
                          a.cedula.includes(searchTerm);
                        if (!coincide || seen.has(a.asociado_id)) return false;
                        seen.add(a.asociado_id);
                        return true;
                      })
                      .slice(0, 6);
                    if (sugerencias.length === 0) return null;
                    return (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                        <p className="text-xs text-slate-400 px-3 pt-2 pb-1 border-b border-slate-100">Asociados con ahorro voluntario</p>
                        {sugerencias.map((s) => (
                          <button
                            key={s.asociado_id}
                            type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-purple-50 flex items-center justify-between group transition-colors"
                            onMouseDown={() => {
                              setSearchTerm(s.asociado);
                              setCurrentPage(1);
                              setShowSearchSuggestions(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Wallet className="size-3.5 text-purple-400" />
                              <span className="text-sm font-medium text-slate-800 group-hover:text-purple-700">{s.asociado}</span>
                            </div>
                            <span className="text-xs text-slate-400">{s.cedula}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <Select value={filterEstado} onValueChange={(v) => { setFilterEstado(v === 'todos' ? '' : v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(value: any) => { setSortBy(value); setCurrentPage(1); }}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Ordenar por..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Sin ordenar</SelectItem>
                    <SelectItem value="fecha-desc">Fecha (más reciente)</SelectItem>
                    <SelectItem value="fecha-asc">Fecha (más antigua)</SelectItem>
                    <SelectItem value="monto-desc">Monto (mayor a menor)</SelectItem>
                    <SelectItem value="monto-asc">Monto (menor a mayor)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500 whitespace-nowrap">Desde:</Label>
                  <Input type="date" value={filterFechaInicio} onChange={(e) => { setFilterFechaInicio(e.target.value); setCurrentPage(1); }} className="w-40 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500 whitespace-nowrap">Hasta:</Label>
                  <Input type="date" value={filterFechaFin} onChange={(e) => { setFilterFechaFin(e.target.value); setCurrentPage(1); }} className="w-40 text-sm" />
                </div>
                {hayFiltros && (
                  <Button variant="outline" size="sm" onClick={limpiarFiltros} className="gap-1 text-slate-500">
                    <X className="size-3" /> Limpiar
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="activos" className="w-full">
              <TabsList className={`grid w-full mb-4 ${userRole === 'admin' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="activos" className="gap-2">
                  <Wallet className="size-4" /> Ahorros Activos ({sortedAhorros.length})
                </TabsTrigger>
                <TabsTrigger value="anulados" className="gap-2">
                  <FileText className="size-4" /> Ahorros Anulados ({filteredAhorrosAnulados.length})
                </TabsTrigger>
                {userRole === 'admin' && (
                  <TabsTrigger value="solicitudes" className="gap-2">
                    <ClipboardList className="size-4" />
                    Solicitudes
                    {(solicitudesVol.filter(s => s.estado === 'pendiente').length + aportesPendientesVol.filter(a => a.estado === 'pendiente').length) > 0 && (
                      <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {solicitudesVol.filter(s => s.estado === 'pendiente').length + aportesPendientesVol.filter(a => a.estado === 'pendiente').length}
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

                  {/* ── Sección: Solicitudes de apertura ──────────────────── */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <ClipboardList className="size-4 text-amber-600" />
                      Solicitudes de apertura
                    </h3>
                    {solicitudesVol.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <ClipboardList className="size-10 text-slate-300 mb-3" />
                        <p className="text-slate-500">No hay solicitudes de ahorro voluntario</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {solicitudesVol.map(sol => (
                          <div key={sol.id} className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-4 rounded-xl border ${
                            sol.estado === 'pendiente' ? 'bg-amber-50 border-amber-200' :
                            sol.estado === 'aprobada'  ? 'bg-emerald-50 border-emerald-200' :
                            'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full mt-0.5 ${
                                sol.estado === 'pendiente' ? 'bg-amber-100' :
                                sol.estado === 'aprobada'  ? 'bg-emerald-100' : 'bg-red-100'
                              }`}>
                                {sol.estado === 'pendiente' && <Clock className="size-4 text-amber-600" />}
                                {sol.estado === 'aprobada'  && <CheckCircle2 className="size-4 text-emerald-600" />}
                                {sol.estado === 'rechazada' && <XCircle className="size-4 text-red-500" />}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{sol.asociados?.nombre ?? '—'}</p>
                                <p className="text-xs text-slate-500">Cédula: {sol.asociados?.cedula ?? '—'} · {new Date(sol.created_at).toLocaleDateString('es-CO')}</p>
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                  {sol.nombre_plan && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{sol.nombre_plan}</span>
                                  )}
                                  {sol.frecuencia && (
                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{sol.frecuencia}</span>
                                  )}
                                  {sol.monto_inicial > 0 && (
                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                      Inicial: {formatCurrency(sol.monto_inicial)}
                                    </span>
                                  )}
                                  {sol.monto_objetivo > 0 && (
                                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                      Meta: {formatCurrency(sol.monto_objetivo)}
                                    </span>
                                  )}
                                </div>
                                {sol.nota_asociado && (
                                  <p className="text-xs text-slate-600 mt-1 italic">"{sol.nota_asociado}"</p>
                                )}
                                {sol.nota_admin && sol.estado === 'rechazada' && (
                                  <p className="text-xs text-red-600 mt-0.5">Motivo: {sol.nota_admin}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {sol.estado === 'pendiente' ? (
                                <>
                                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => handleAprobarSolicitudVol(sol)}>
                                    <Check className="size-4" /> Aprobar
                                  </Button>
                                  <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                                    onClick={() => { setSolVolSeleccionada(sol); setNotaRechazoVol(''); setIsRechazarVolOpen(true); }}>
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

                  {/* ── Sección: Aportes reportados por asociados ──────────── */}
                  <div className="space-y-3 border-t border-slate-100 pt-5">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Send className="size-4 text-blue-600" />
                      Aportes reportados por asociados
                      {aportesPendientesVol.filter(a => a.estado === 'pendiente').length > 0 && (
                        <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                          {aportesPendientesVol.filter(a => a.estado === 'pendiente').length} pendiente{aportesPendientesVol.filter(a => a.estado === 'pendiente').length > 1 ? 's' : ''}
                        </span>
                      )}
                    </h3>
                    {aportesPendientesVol.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Send className="size-10 text-slate-300 mb-3" />
                        <p className="text-slate-500">No hay aportes reportados</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {aportesPendientesVol.map(ap => (
                          <div key={ap.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
                            ap.estado === 'pendiente'   ? 'bg-blue-50 border-blue-200' :
                            ap.estado === 'confirmado'  ? 'bg-emerald-50 border-emerald-200' :
                            'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                ap.estado === 'pendiente'  ? 'bg-blue-100' :
                                ap.estado === 'confirmado' ? 'bg-emerald-100' : 'bg-red-100'
                              }`}>
                                {ap.estado === 'pendiente'  && <Clock className="size-5 text-blue-600" />}
                                {ap.estado === 'confirmado' && <CheckCircle2 className="size-5 text-emerald-600" />}
                                {ap.estado === 'rechazado'  && <XCircle className="size-5 text-red-500" />}
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
                                {ap.nota_admin && ap.estado === 'rechazado' && (
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
                                    onClick={() => handleConfirmarAporteVol(ap)}
                                  >
                                    <Check className="size-4" /> Confirmar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                                    onClick={() => { setAporteVolSeleccionado(ap); setNotaRechazoAporteVol(''); setIsRechazarAporteVolOpen(true); }}
                                  >
                                    <X className="size-4" /> Rechazar
                                  </Button>
                                </>
                              ) : (
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                  ap.estado === 'confirmado' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {ap.estado === 'confirmado' ? 'Confirmado' : 'Rechazado'}
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Crear / Editar ────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) { setSelectedItem(null); setAutocompleteSearch(''); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Editar ahorro voluntario' : 'Registrar ahorro voluntario'}</DialogTitle>
            <DialogDescription>
              {selectedItem
                ? 'Actualiza la información del ahorro voluntario'
                : 'Define el plan de ahorro voluntario para un asociado'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">

            {/* ── Asociado con autocompletado ── */}
            <div className="space-y-2">
              <Label>Asociado <span className="text-red-500">*</span></Label>
              <div className="relative" ref={!selectedItem ? autocompleteRef : undefined}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                <Input
                  className="pl-10"
                  placeholder="Buscar por nombre o cédula..."
                  value={autocompleteSearch}
                  disabled={!!selectedItem}
                  onChange={(e) => {
                    setAutocompleteSearch(e.target.value);
                    setFormAsociadoId('');
                    setShowAutocomplete(true);
                  }}
                  onFocus={() => { if (!selectedItem) setShowAutocomplete(true); }}
                  autoComplete="off"
                />
                {/* Indicador de asociado seleccionado */}
                {formAsociadoId && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                )}
                {/* Dropdown de sugerencias */}
                {showAutocomplete && !selectedItem && autocompleteSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {autocompleteSuggestions.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-purple-50 flex items-center justify-between group transition-colors"
                        onMouseDown={() => handleSelectAsociado(a)}
                      >
                        <span className="font-medium text-slate-800 text-sm group-hover:text-purple-700">{a.nombre}</span>
                        <span className="text-xs text-slate-400">{a.cedula}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showAutocomplete && !selectedItem && autocompleteSearch.length > 0 && autocompleteSuggestions.length === 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-sm text-slate-500 text-center">
                    Sin resultados para "{autocompleteSearch}"
                  </div>
                )}
              </div>
              {!formAsociadoId && autocompleteSearch.length > 0 && (
                <p className="text-xs text-amber-600">Selecciona un asociado de la lista de sugerencias</p>
              )}
            </div>

            {/* ── Frecuencia de ahorro + Cuota ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="frecuencia">Frecuencia de ahorro <span className="text-red-500">*</span></Label>
                <Select value={formFrecuencia} onValueChange={setFormFrecuencia}>
                  <SelectTrigger id="frecuencia">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRECUENCIAS.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuota">Cuota por {formFrecuencia.toLowerCase()} <span className="text-red-500">*</span></Label>
                <Input
                  id="cuota"
                  type="text"
                  placeholder="50.000,0"
                  value={formCuotaMensual}
                  onChange={handleCuotaMensualChange}
                  onBlur={handleCuotaMensualBlur}
                />
              </div>
            </div>

            {/* ── Monto objetivo (opcional) ── */}
            <div className="space-y-2">
              <Label htmlFor="objetivo" className="flex items-center gap-2">
                <Target className="size-4 text-purple-500" />
                Monto objetivo
                <span className="text-xs text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Input
                id="objetivo"
                type="text"
                placeholder="Ej: 2.000.000,0"
                value={formMontoObjetivo}
                onChange={(e) => setFormMontoObjetivo(e.target.value.replace(/[^\d.,]/g, ''))}
                onBlur={() => formMontoObjetivo && setFormMontoObjetivo(formatCurrencyInput(parseCurrencyInput(formMontoObjetivo).toString()))}
              />
              <p className="text-xs text-slate-400">Meta de ahorro que desea alcanzar el asociado</p>
            </div>

            {/* ── Saldo inicial + Fecha ── */}
            <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha de inicio <span className="text-red-500">*</span></Label>
                <Input id="fecha" type="date" value={formFechaInicio} onChange={(e) => setFormFechaInicio(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); setSelectedItem(null); setAutocompleteSearch(''); }}>
              Cancelar
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleSaveAhorro}>
              {selectedItem ? 'Actualizar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Detalle con transacciones ─────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isDetailDialogOpen} onOpenChange={(open) => {
        setIsDetailDialogOpen(open);
        if (!open) { setSelectedItem(null); setMovimientosDetalle([]); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del ahorro voluntario</DialogTitle>
            <DialogDescription>Información completa y transacciones del plan</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="info" className="gap-2">
                  <Wallet className="size-4" /> Información
                </TabsTrigger>
                <TabsTrigger value="transacciones" className="gap-2">
                  <History className="size-4" /> Transacciones
                  {movimientosDetalle.length > 0 && (
                    <Badge className="ml-1 bg-purple-600 text-white text-xs px-1.5 py-0">{movimientosDetalle.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="historial" className="gap-2">
                  <FileText className="size-4" /> Historial
                  {historialCambios.length > 0 && (
                    <Badge className="ml-1 bg-slate-500 text-white text-xs px-1.5 py-0">{historialCambios.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* ── Tab Información ── */}
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
                    <Label className="text-slate-500 text-xs">Estado</Label>
                    <div className="mt-1">
                      <Badge className={selectedItem.anulado ? 'bg-red-100 text-red-700' : selectedItem.estado ? 'bg-emerald-600' : 'bg-yellow-100 text-yellow-700'}>
                        {selectedItem.anulado ? 'Anulado' : selectedItem.estado ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Saldo actual</Label>
                    <p className="text-purple-700 font-bold text-lg">{formatCurrency(selectedItem.montoAhorrado)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Frecuencia de ahorro</Label>
                    <Badge variant="outline" className="mt-1 text-purple-700 border-purple-200 bg-purple-50">
                      {selectedItem.frecuencia || 'Mensual'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Cuota por {(selectedItem.frecuencia || 'Mensual').toLowerCase()}</Label>
                    <p className="text-slate-900">{formatCurrency(selectedItem.cuotaMensual)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Fecha de inicio</Label>
                    <p className="text-slate-900">{selectedItem.fechaInicio}</p>
                  </div>
                  {selectedItem.montoObjetivo > 0 && (
                    <div className="col-span-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Target className="size-4 text-purple-600" />
                          <Label className="text-purple-700 text-xs font-semibold">Monto objetivo</Label>
                        </div>
                        <span className="text-purple-700 font-bold">{formatCurrency(selectedItem.montoObjetivo)}</span>
                      </div>
                      <div className="w-full bg-purple-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (selectedItem.montoAhorrado / selectedItem.montoObjetivo) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-purple-600 mt-1 text-right">
                        {((selectedItem.montoAhorrado / selectedItem.montoObjetivo) * 100).toFixed(1)}% alcanzado
                      </p>
                    </div>
                  )}
                  {selectedItem.motivoAnulacion && (
                    <div className="col-span-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <Label className="text-red-600 text-xs">Motivo de anulación</Label>
                      <p className="text-red-700 mt-1">{selectedItem.motivoAnulacion}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── Tab Transacciones ── */}
              <TabsContent value="transacciones" className="space-y-3">
                {/* Botones de acción */}
                {!selectedItem.anulado && selectedItem.estado && userRole === 'admin' && (
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => {
                        setFormMovTipo('Depósito');
                        setFormMovMonto('');
                        setFormMovFecha(new Date().toISOString().split('T')[0]);
                        setFormMovDesc('');
                        setFormMovMetodo('');
                        setIsMovimientoDialogOpen(true);
                      }}
                    >
                      <ArrowDownCircle className="size-4" /> Depósito
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setFormMovTipo('Retiro');
                        setFormMovMonto('');
                        setFormMovFecha(new Date().toISOString().split('T')[0]);
                        setFormMovDesc('');
                        setFormMovMetodo('');
                        setIsMovimientoDialogOpen(true);
                      }}
                    >
                      <ArrowUpCircle className="size-4" /> Retiro
                    </Button>
                  </div>
                )}

                {/* Lista de transacciones */}
                {loadingMovimientos ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-3" />
                    <p className="text-sm text-slate-500">Cargando transacciones...</p>
                  </div>
                ) : movimientosDetalle.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <History className="size-10 text-slate-300 mb-3" />
                    <p className="text-slate-500">No hay transacciones registradas</p>
                    <p className="text-xs text-slate-400 mt-1">Los depósitos y retiros aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {movimientosDetalle.map((mov) => (
                      <div
                        key={mov.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          mov.anulado ? 'bg-slate-50 border-slate-200 opacity-60' :
                          mov.tipo_movimiento === 'Depósito' ? 'bg-white border-emerald-100' :
                          mov.tipo_movimiento === 'Retiro'   ? 'bg-white border-red-100' :
                          mov.tipo_movimiento === 'Interés'  ? 'bg-white border-blue-100' :
                          'bg-white border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            mov.tipo_movimiento === 'Depósito' ? 'bg-emerald-100' :
                            mov.tipo_movimiento === 'Retiro'   ? 'bg-red-100' :
                            mov.tipo_movimiento === 'Interés'  ? 'bg-blue-100' : 'bg-slate-100'
                          }`}>
                            {mov.tipo_movimiento === 'Retiro'
                              ? <ArrowUpCircle className="size-3 text-red-600" />
                              : mov.tipo_movimiento === 'Interés'
                              ? <TrendingUp className="size-3 text-blue-600" />
                              : <ArrowDownCircle className="size-3 text-emerald-600" />
                            }
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-700">{mov.tipo_movimiento}</p>
                              {mov.anulado && <Badge variant="secondary" className="text-xs px-1 py-0 bg-slate-200 text-slate-500">Anulado</Badge>}
                            </div>
                            <p className="text-xs text-slate-400">
                              <Calendar className="size-3 inline mr-1" />
                              {mov.fecha_movimiento}
                              {mov.metodo_pago ? ` · ${mov.metodo_pago}` : ''}
                              {mov.descripcion ? ` · ${mov.descripcion}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${mov.tipo_movimiento === 'Retiro' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {mov.tipo_movimiento === 'Retiro' ? '−' : '+'}{formatCurrency(mov.monto)}
                          </p>
                          <p className="text-xs text-slate-400">Saldo: {formatCurrency(mov.saldo_nuevo)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Resumen de transacciones */}
                {movimientosDetalle.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total depositado:</span>
                      <span className="font-semibold text-emerald-700">{formatCurrency(totalDepositado)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total retirado:</span>
                      <span className="font-semibold text-red-600">{formatCurrency(totalRetirado)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total transacciones:</span>
                      <span className="font-semibold text-slate-700">{movimientosDetalle.length}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-1 mt-1">
                      <span className="text-slate-700">Saldo actual:</span>
                      <span className="text-purple-700 text-base">{formatCurrency(saldoRealMov)}</span>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Tab Historial de modificaciones ── */}
              <TabsContent value="historial" className="space-y-3">
                {loadingMovimientos ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500 mr-3" />
                    <p className="text-sm text-slate-500">Cargando historial...</p>
                  </div>
                ) : historialCambios.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <FileText className="size-10 text-slate-300 mb-3" />
                    <p className="text-slate-500">Sin modificaciones registradas</p>
                    <p className="text-xs text-slate-400 mt-1">Cada vez que se edite este ahorro quedará registrado aquí</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {historialCambios.map((h, idx) => (
                      <div key={h.id ?? idx} className={`rounded-lg border p-3 space-y-2 ${
                        h.campos_modificados?.startsWith('ANULACIÓN')
                          ? 'bg-red-50 border-red-200'
                          : 'bg-white border-slate-200'
                      }`}>
                        {/* Encabezado: fecha + usuario */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-700">
                              {h.campos_modificados?.startsWith('ANULACIÓN') ? '🚫 Anulación del registro' : '✏️ Modificación'}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(h.fecha_cambio).toLocaleString('es-CO', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                              {' · '}<span className="font-medium text-slate-600">{h.usuario_nombre}</span>
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {h.campos_modificados?.startsWith('ANULACIÓN') ? 'Anulación' : h.campos_modificados || 'Cambio'}
                          </Badge>
                        </div>

                        {/* Tabla de valores anteriores vs nuevos (solo si no es anulación) */}
                        {!h.campos_modificados?.startsWith('ANULACIÓN') && (
                          <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-2">
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Valores anteriores</p>
                              {h.cuota_anterior != null && (
                                <p className="text-slate-600">Cuota: <span className="font-medium">{formatCurrency(h.cuota_anterior)}</span></p>
                              )}
                              {h.frecuencia_anterior && (
                                <p className="text-slate-600">Frecuencia: <span className="font-medium">{h.frecuencia_anterior}</span></p>
                              )}
                              {h.objetivo_anterior != null && h.objetivo_anterior > 0 && (
                                <p className="text-slate-600">Meta: <span className="font-medium">{formatCurrency(h.objetivo_anterior)}</span></p>
                              )}
                              {h.saldo_anterior != null && (
                                <p className="text-slate-600">Saldo: <span className="font-medium">{formatCurrency(h.saldo_anterior)}</span></p>
                              )}
                              {h.fecha_inicio_anterior && (
                                <p className="text-slate-600">Fecha inicio: <span className="font-medium">{h.fecha_inicio_anterior}</span></p>
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold text-purple-600 uppercase tracking-wide text-[10px]">Valores nuevos</p>
                              {h.cuota_nueva != null && (
                                <p className="text-slate-600">Cuota: <span className="font-medium text-purple-700">{formatCurrency(h.cuota_nueva)}</span></p>
                              )}
                              {h.frecuencia_nueva && (
                                <p className="text-slate-600">Frecuencia: <span className="font-medium text-purple-700">{h.frecuencia_nueva}</span></p>
                              )}
                              {h.objetivo_nuevo != null && h.objetivo_nuevo > 0 && (
                                <p className="text-slate-600">Meta: <span className="font-medium text-purple-700">{formatCurrency(h.objetivo_nuevo)}</span></p>
                              )}
                              {h.saldo_nuevo != null && (
                                <p className="text-slate-600">Saldo: <span className="font-medium text-purple-700">{formatCurrency(h.saldo_nuevo)}</span></p>
                              )}
                              {h.fecha_inicio_nueva && (
                                <p className="text-slate-600">Fecha inicio: <span className="font-medium text-purple-700">{h.fecha_inicio_nueva}</span></p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {historialCambios.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 text-sm text-slate-500 flex justify-between">
                    <span>Total de modificaciones:</span>
                    <span className="font-semibold text-slate-700">{historialCambios.length}</span>
                  </div>
                )}
              </TabsContent>

            </Tabs>
          )}
          <DialogFooter>
            <Button onClick={() => { setIsDetailDialogOpen(false); setSelectedItem(null); setMovimientosDetalle([]); setHistorialCambios([]); }}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Registrar movimiento (depósito / retiro) ──────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isMovimientoDialogOpen} onOpenChange={(open) => { if (!open) setIsMovimientoDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formMovTipo === 'Depósito'
                ? <><ArrowDownCircle className="size-5 text-emerald-600" /> Registrar Depósito</>
                : <><ArrowUpCircle className="size-5 text-red-600" /> Registrar Retiro</>
              }
            </DialogTitle>
            <DialogDescription>
              {selectedItem && (
                <>
                  Asociado: <span className="font-semibold">{selectedItem.asociado}</span>
                  {' — '}Saldo disponible:{' '}
                  <span className="font-semibold text-purple-700">
                    {formatCurrency(
                      movActivos.sort((a, b) => new Date(b.fecha_movimiento).getTime() - new Date(a.fecha_movimiento).getTime())[0]?.saldo_nuevo
                      ?? selectedItem.montoAhorrado
                    )}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">

            {/* ── Banner mes fiscal (solo depósitos) ── */}
            {formMovTipo === 'Depósito' && (() => {
              const { nombreMes, primerDia, diaFin } = getMesFiscal();
              return (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-0.5">
                  <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    Mes fiscal: <span className="capitalize ml-1">{nombreMes}</span>
                    <span className="font-normal text-blue-600 ml-1">
                      (día 1 al {diaFin})
                    </span>
                  </p>
                  <p className="text-xs text-blue-700">
                    Mínimo por depósito: <strong>{formatCurrency(MONTO_MINIMO_VOLUNTARIO)}</strong>
                    {' · '}La fecha debe estar entre el día 1 y el día {diaFin} del mes en curso.
                  </p>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Monto <span className="text-red-500">*</span>
                  {formMovTipo === 'Depósito' && (
                    <span className="ml-1 text-xs text-blue-600 font-normal">
                      (mín. {formatCurrency(MONTO_MINIMO_VOLUNTARIO)})
                    </span>
                  )}
                </Label>
                <Input
                  type="text"
                  placeholder="50.000,0"
                  value={formMovMonto}
                  onChange={(e) => setFormMovMonto(e.target.value.replace(/[^\d.,]/g, ''))}
                  onBlur={() => formMovMonto && setFormMovMonto(formatCurrencyInput(parseCurrencyInput(formMovMonto).toString()))}
                  className={formMovTipo === 'Retiro' ? 'border-red-200 focus-visible:ring-red-300' : 'border-emerald-200 focus-visible:ring-emerald-300'}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha <span className="text-red-500">*</span></Label>
                {formMovTipo === 'Depósito' ? (() => {
                  const { primerDia, ultimoDia } = getMesFiscal();
                  return (
                    <Input
                      type="date"
                      value={formMovFecha}
                      onChange={(e) => setFormMovFecha(e.target.value)}
                      min={primerDia}
                      max={ultimoDia}
                    />
                  );
                })() : (
                  <Input
                    type="date"
                    value={formMovFecha}
                    onChange={(e) => setFormMovFecha(e.target.value)}
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Método de pago <span className="text-xs text-slate-400">(opcional)</span></Label>
              <Select value={formMovMetodo} onValueChange={setFormMovMetodo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia bancaria</SelectItem>
                  <SelectItem value="PSE">PSE</SelectItem>
                  <SelectItem value="Consignación">Consignación</SelectItem>
                  <SelectItem value="Débito automático">Débito automático</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción <span className="text-xs text-slate-400">(opcional)</span></Label>
              <Input
                type="text"
                placeholder="Ej: Ahorro quincenal mayo 2026"
                value={formMovDesc}
                onChange={(e) => setFormMovDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovimientoDialogOpen(false)} disabled={savingMovimiento}>
              Cancelar
            </Button>
            <Button
              className={formMovTipo === 'Depósito' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
              onClick={handleRegistrarMovimiento}
              disabled={savingMovimiento}
            >
              {savingMovimiento ? 'Guardando...' : `Confirmar ${formMovTipo}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Anular con justificación ─────────────────────────────────────────── */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        setIsDeleteDialogOpen(open);
        if (!open) { setSelectedItem(null); setJustificacionAnulacion(''); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              ¿Confirmar anulación del ahorro voluntario?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Estás a punto de anular el ahorro voluntario de:</p>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Asociado:</span>
                    <span className="font-semibold text-slate-800">{selectedItem?.asociado}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Saldo acumulado:</span>
                    <span className="font-semibold text-red-700">{selectedItem ? formatCurrency(selectedItem.montoAhorrado) : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Frecuencia:</span>
                    <span className="text-slate-700">{selectedItem?.frecuencia}</span>
                  </div>
                </div>
                <p className="text-xs text-red-600 font-medium">⚠ Esta acción no se puede deshacer.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2 space-y-2">
            <Label htmlFor="justificacion" className="text-slate-700 font-medium">
              Motivo de la anulación <span className="text-red-500">*</span>
            </Label>
            <Input
              id="justificacion"
              placeholder="Describe el motivo de la anulación..."
              value={justificacionAnulacion}
              onChange={(e) => setJustificacionAnulacion(e.target.value)}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSelectedItem(null); setJustificacionAnulacion(''); }}>Cancelar</AlertDialogCancel>
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

      {/* ── Cambiar estado ───────────────────────────────────────────────────── */}
      <AlertDialog open={isToggleEstadoDialogOpen} onOpenChange={(open) => {
        setIsToggleEstadoDialogOpen(open);
        if (!open) setSelectedItem(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de estado?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de <strong>{selectedItem?.estado ? 'desactivar' : 'activar'}</strong> el ahorro voluntario de{' '}
              <span className="font-semibold">"{selectedItem?.asociado}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleToggleEstado(selectedItem?.id)}
              className={selectedItem?.estado ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              {selectedItem?.estado ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Vista previa del PDF ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={isPdfPreviewOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsPdfPreviewOpen(false);
            // Liberar el blob URL de memoria al cerrar
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl('');
            setPdfDownloadFn(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
          {/* Cabecera */}
          <DialogHeader className="px-5 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="size-5 text-purple-600" />
                  Vista previa — Certificado de Ahorro Voluntario
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-slate-500">
                  {pdfPreviewFilename}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* iframe con el PDF */}
          <div className="flex-1 overflow-hidden bg-slate-100">
            {pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0"
                title="Vista previa del certificado PDF"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
              </div>
            )}
          </div>

          {/* Pie con acciones */}
          <div className="px-5 py-3 border-t border-slate-200 shrink-0 flex items-center justify-between bg-slate-50">
            <p className="text-xs text-slate-500">
              Revisa el documento antes de descargarlo
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsPdfPreviewOpen(false);
                  if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
                  setPdfPreviewUrl('');
                  setPdfDownloadFn(null);
                }}
              >
                Cerrar
              </Button>
              <Button
                className="gap-2 bg-purple-600 hover:bg-purple-700"
                onClick={() => {
                  pdfDownloadFn?.();
                  toast.success('Certificado descargado correctamente');
                }}
              >
                <TrendingUp className="size-4" />
                Descargar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Admin: rechazar solicitud voluntaria ─────────────────────────────── */}
      <AlertDialog open={isRechazarVolOpen} onOpenChange={(o) => {
        setIsRechazarVolOpen(o);
        if (!o) { setSolVolSeleccionada(null); setNotaRechazoVol(''); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-500" />
              Rechazar solicitud de ahorro voluntario
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a rechazar el plan <span className="font-semibold">"{solVolSeleccionada?.nombre_plan ?? '—'}"</span>{' '}
              de <span className="font-semibold">{solVolSeleccionada?.asociados?.nombre ?? '—'}</span>.
              El asociado recibirá una notificación con el motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label className="font-medium">Motivo del rechazo <span className="text-red-500">*</span></Label>
            <Textarea
              placeholder="Explica el motivo..."
              value={notaRechazoVol}
              onChange={e => setNotaRechazoVol(e.target.value)}
              className="min-h-[80px]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingSolVol}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRechazarSolicitudVol}
              disabled={!notaRechazoVol.trim() || savingSolVol}
            >
              {savingSolVol ? 'Guardando...' : 'Confirmar rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Admin: rechazar aporte voluntario reportado ──────────────────────── */}
      <AlertDialog open={isRechazarAporteVolOpen} onOpenChange={(o) => {
        setIsRechazarAporteVolOpen(o);
        if (!o) { setAporteVolSeleccionado(null); setNotaRechazoAporteVol(''); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-500" />
              Rechazar aporte voluntario reportado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  Vas a rechazar el aporte de{' '}
                  <span className="font-semibold">{aporteVolSeleccionado?.asociados?.nombre ?? '—'}</span>{' '}
                  por{' '}
                  <span className="font-semibold text-slate-800">{aporteVolSeleccionado ? formatCurrency(aporteVolSeleccionado.monto) : ''}</span>{' '}
                  vía <span className="font-medium">{aporteVolSeleccionado?.medio_pago}</span>.
                </p>
                <p className="text-xs text-slate-400">El asociado recibirá una notificación con el motivo del rechazo.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label className="font-medium">Motivo del rechazo <span className="text-red-500">*</span></Label>
            <Textarea
              placeholder="Explica el motivo del rechazo..."
              value={notaRechazoAporteVol}
              onChange={e => setNotaRechazoAporteVol(e.target.value)}
              className="min-h-[80px]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingAporteVol}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRechazarAporteVol}
              disabled={!notaRechazoAporteVol.trim() || savingAporteVol}
            >
              {savingAporteVol ? 'Guardando...' : 'Confirmar rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
