// ── useAhorroVoluntario.ts ───────────────────────────────────────────────────
// Todo el estado, handlers y valores computados del módulo de ahorro voluntario.

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import { ahorroVoluntarioApi, asociadosApi } from '../../lib/api';
import { formatCurrency, formatCurrencyRealTime } from '../../lib/formatters';
import { buildAhorroVoluntarioPDF } from '../utils/pdfGenerator';
import type { UserRole } from '../../contexts/AuthContext';

// ── Utilidades de formato (puras, reutilizables en el UI) ────────────────────
export const formatCurrencyInput = (value: string): string => {
  const clean = value.replace(/[^\d.]/g, '');
  if (!clean) return '';
  const num = parseFloat(clean);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(num);
};

export const parseCurrencyInput = (v: string): number =>
  parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;


export const getMesFiscal = () => {
  const hoy        = new Date();
  const año        = hoy.getFullYear();
  const mes        = hoy.getMonth();
  const ultimoDelMes = new Date(año, mes + 1, 0).getDate();
  const diaFin     = Math.min(30, ultimoDelMes);
  const fmt        = (d: Date) => d.toISOString().split('T')[0];
  return {
    primerDia: fmt(new Date(año, mes, 1)),
    ultimoDia: fmt(new Date(año, mes, diaFin)),
    nombreMes: hoy.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
    diaFin,
  };
};

// ────────────────────────────────────────────────────────────────────────────

export function useAhorroVoluntario(userRole?: UserRole | null, userData?: any) {

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
  const [isPdfPreviewOpen, setIsPdfPreviewOpen]             = useState(false);
  const [isConfirmSaldoBajoVolOpen, setIsConfirmSaldoBajoVolOpen] = useState(false);
  const [isConfirmMovBajoVolOpen, setIsConfirmMovBajoVolOpen]     = useState(false);
  const [isRechazarVolOpen, setIsRechazarVolOpen]           = useState(false);
  const [isRechazarAporteVolOpen, setIsRechazarAporteVolOpen] = useState(false);

  // ── Item seleccionado ─────────────────────────────────────────────────────
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // ── Formulario crear/editar ───────────────────────────────────────────────
  const [formAsociadoId, setFormAsociadoId]     = useState('');
  const [formSaldoInicial, setFormSaldoInicial] = useState('0,0');
  const [formFechaInicio, setFormFechaInicio]   = useState('');
  const [formFrecuencia, setFormFrecuencia]     = useState('');
  const [formMontoObjetivo, setFormMontoObjetivo] = useState('');
  const [justificacionAnulacion, setJustificacionAnulacion] = useState('');

  // ── Email anulación (para abrir Gmail compose) ────────────────────────────
  const [anulacionEmailData, setAnulacionEmailData] = useState<{
    email: string; nombre: string; saldo: number; motivo: string;
  } | null>(null);

  // ── Autocompletado ────────────────────────────────────────────────────────
  const [autocompleteSearch, setAutocompleteSearch] = useState('');
  const [showAutocomplete, setShowAutocomplete]     = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const searchRef       = useRef<HTMLDivElement>(null);

  // ── Movimientos ───────────────────────────────────────────────────────────
  const [movimientosDetalle, setMovimientosDetalle] = useState<any[]>([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [historialCambios, setHistorialCambios]     = useState<any[]>([]);
  const [historialCambiosGeneralVoluntario, setHistorialCambiosGeneralVoluntario] = useState<any[]>([]);
  const [formMovTipo, setFormMovTipo]     = useState<'Depósito'|'Retiro'>('Depósito');
  const [formMovMonto, setFormMovMonto]   = useState('');
  const [formMovFecha, setFormMovFecha]   = useState('');
  const [formMovDesc, setFormMovDesc]     = useState('');
  const [formMovMetodo, setFormMovMetodo] = useState('');
  const [savingMovimiento, setSavingMovimiento] = useState(false);

  // ── PDF preview ───────────────────────────────────────────────────────────
  const [pdfPreviewUrl, setPdfPreviewUrl]           = useState('');
  const [pdfPreviewFilename, setPdfPreviewFilename] = useState('');
  const [pdfDownloadFn, setPdfDownloadFn]           = useState<(() => void) | null>(null);

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [ahorros, setAhorros]                       = useState<any[]>([]);
  const [asociadosDisponibles, setAsociadosDisponibles] = useState<any[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [montoMinimo, setMontoMinimo]               = useState(50_000);

  // ── Solicitudes (admin) ───────────────────────────────────────────────────
  const [solicitudesVol, setSolicitudesVol]           = useState<any[]>([]);
  const [solVolSeleccionada, setSolVolSeleccionada]   = useState<any>(null);
  const [notaRechazoVol, setNotaRechazoVol]           = useState('');
  const [savingSolVol, setSavingSolVol]               = useState(false);

  // ── Aportes reportados (admin) ────────────────────────────────────────────
  const [aportesPendientesVol, setAportesPendientesVol]   = useState<any[]>([]);
  const [aporteVolSeleccionado, setAporteVolSeleccionado] = useState<any>(null);
  const [notaRechazoAporteVol, setNotaRechazoAporteVol]   = useState('');
  const [savingAporteVol, setSavingAporteVol]             = useState(false);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { cargarDatos(); }, []);

  // ── Tiempo real: recarga cuando cambian cuentas o transacciones ───────────
  useRealtimeSubscription(
    'realtime:ahorro-voluntario',
    ['cuentas_ahorro', 'transacciones'],
    cargarDatos,
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node))
        setShowAutocomplete(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSearchSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Carga de datos ────────────────────────────────────────────────────────
  async function cargarDatos() {
    try {
      setLoading(true);
      const [ahorrosRes, asociadosData, configMinimo, auditRes] = await Promise.all([
        supabase.from('cuentas_ahorro')
          .select('*')
          .eq('tipo', 'voluntario')
          .order('created_at', { ascending: false }),
        asociadosApi.getAll(),
        supabase.from('configuracion').select('valor')
          .eq('clave', 'cuota_ahorro_voluntario').maybeSingle(),
        supabase
          .from('auditoria')
          .select('id, accion, operacion, datos_antes, datos_despues, usuario_id, registro_id, created_at')
          .eq('tabla', 'cuentas_ahorro')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (!configMinimo.error && configMinimo.data) {
        const v = parseFloat(configMinimo.data.valor);
        if (!isNaN(v) && v > 0) setMontoMinimo(v);
      }
      if (ahorrosRes.error) throw ahorrosRes.error;

      // Join manual: usuarios por asociado_id
      const ahIds = [...new Set((ahorrosRes.data || []).map((r: any) => r.asociado_id).filter(Boolean))];
      const ahUsrMap: Record<string, any> = {};
      if (ahIds.length > 0) {
        const { data: ahUsrs } = await supabase.from('usuarios').select('id, nombre, cedula, email').in('id', ahIds);
        (ahUsrs || []).forEach((u: any) => { ahUsrMap[u.id] = u; });
      }
      const data = (ahorrosRes.data || []).map((r: any) => ({ ...r, usuarios: ahUsrMap[r.asociado_id] ?? null }));

      const mapeados = (data || []).map((a: any) => ({
        id:              a.id,
        asociado:        a.usuarios?.nombre  ?? 'Sin nombre',
        cedula:          a.usuarios?.cedula || '',
        email:           a.usuarios?.email   ?? '',
        asociado_id:     a.asociado_id,
        montoAhorrado:   a.monto_ahorrado,
        fechaInicio:     a.created_at?.split('T')[0] ?? '',
        estado:          a.estado,
        anulado:         a.anulado,
        motivoAnulacion: a.motivo_anulacion || '',
        observaciones:   a.observaciones || '',
        createdAt:       a.created_at,
      }));

      setAhorros(mapeados);

      // Map para buscar el nombre del asociado por registro_id (cuenta_id)
      const ahorroVolMap: Record<string, any> = {};
      mapeados.forEach(a => {
        ahorroVolMap[a.id] = { asociado: a.asociado, cedula: a.cedula };
      });

      // Historial general de cambios voluntarios
      const allAudits = auditRes.error ? [] : (auditRes.data || []);
      const auditsFiltrados = allAudits.filter((r: any) => {
        // Solo mostrar cambios de cuentas que existen en el listado cargado de ahorros voluntarios
        return ahorroVolMap[r.registro_id] !== undefined;
      });

      if (auditsFiltrados.length > 0) {
        const userIds = [...new Set(auditsFiltrados.map((r: any) => r.usuario_id).filter(Boolean))];
        const usersMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: usrs } = await supabase.from('usuarios').select('id, nombre').in('id', userIds);
          (usrs || []).forEach((u: any) => { usersMap[u.id] = u.nombre; });
        }

        const histGeneral = auditsFiltrados.map((r: any) => {
          const ahorroInfo = ahorroVolMap[r.registro_id];
          const oldSaldo = r.datos_antes?.monto_ahorrado;
          const newSaldo = r.datos_despues?.monto_ahorrado;
          const oldEstado = r.datos_antes?.estado;
          const newEstado = r.datos_despues?.estado;
          const oldAnulado = r.datos_antes?.anulado;
          const newAnulado = r.datos_despues?.anulado;

          let desc = r.datos_despues?.descripcion || '';
          if (!desc) {
            const cambios: string[] = [];
            if (!r.datos_antes) {
              cambios.push(`Creación de cuenta con saldo inicial: ${formatCurrency(Number(newSaldo || 0))}`);
              if (newEstado) cambios.push(`Estado inicial: ${newEstado}`);
            } else {
              if (oldSaldo !== undefined && newSaldo !== undefined && oldSaldo !== newSaldo) {
                cambios.push(`Saldo: ${formatCurrency(Number(oldSaldo))} ➔ ${formatCurrency(Number(newSaldo))}`);
              }
              if (oldEstado !== undefined && newEstado !== undefined && oldEstado !== newEstado) {
                cambios.push(`Estado: ${oldEstado} ➔ ${newEstado}`);
              }
              if (oldAnulado !== undefined && newAnulado !== undefined && oldAnulado !== newAnulado) {
                cambios.push(newAnulado ? 'Cuenta anulada' : 'Cuenta reactivada');
              }
            }
            desc = cambios.length > 0 ? cambios.join(' · ') : `Modificación (${r.operacion || r.accion})`;
          }

          return {
            id: r.id,
            asociado: ahorroInfo?.asociado ?? 'Asociado desconocido',
            cedula: ahorroInfo?.cedula ?? '',
            accion: r.accion || r.operacion || 'MODIFICACION',
            usuario_nombre: usersMap[r.usuario_id] ?? 'Sistema/Administrador',
            fecha_cambio: r.created_at,
            detalle: desc,
          };
        });
        setHistorialCambiosGeneralVoluntario(histGeneral);
      } else {
        setHistorialCambiosGeneralVoluntario([]);
      }

      const idsConAhorro = new Set(
        mapeados.filter(a => a.estado === 'activo' && !a.anulado).map(a => a.asociado_id)
      );
      setAsociadosDisponibles((asociadosData || []).filter((a: any) => !idsConAhorro.has(a.id)));

      if (userRole === 'admin') {
        setSolicitudesVol([]);
        setAportesPendientesVol([]);
      }
    } catch (err: any) {
      toast.error('Error al cargar ahorros voluntarios: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const ahorrosBase = userRole === 'asociado'
    ? ahorros.filter(a => a.asociado_id === userData?.id && !a.anulado)
    : ahorros.filter(a => !a.anulado);

  const filteredAhorros = ahorrosBase.filter(a => {
    const term = searchTerm.toLowerCase();
    const matchSearch = !term || a.asociado.toLowerCase().includes(term)
      || a.cedula.includes(searchTerm) || a.id.toLowerCase().includes(term);
    const matchEstado = !filterEstado
      || (filterEstado === 'activo'   && a.estado === 'activo')
      || (filterEstado === 'inactivo' && a.estado === 'inactivo');
    const matchDesde = !filterFechaInicio || a.fechaInicio >= filterFechaInicio;
    const matchHasta = !filterFechaFin    || a.fechaInicio <= filterFechaFin;
    return matchSearch && matchEstado && matchDesde && matchHasta;
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
    ? ahorros.filter(a => a.asociado_id === userData?.id && a.anulado)
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

  const autocompleteSuggestions = autocompleteSearch.trim() === ''
    ? []
    : asociadosDisponibles
        .filter(a =>
          a.nombre.toLowerCase().includes(autocompleteSearch.toLowerCase()) ||
          (a.cedula && a.cedula.includes(autocompleteSearch))
        )
        .slice(0, 8);

  // Resumen para el tab de transacciones
  const totalDepositado = movimientosDetalle.reduce((s, m) => {
    const esRetiro = (m.saldo_despues ?? 0) < (m.saldo_antes ?? 0);
    return s + (esRetiro ? 0 : (m.monto ?? 0));
  }, 0);
  const saldoRealMov    = selectedItem?.montoAhorrado ?? 0;

  // ── Handlers de formulario ────────────────────────────────────────────────
  const handleSaldoInicialChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormSaldoInicial(formatCurrencyRealTime(e.target.value));

  const handleSaldoInicialBlur = () => {
    // Formateado en tiempo real
  };

  const limpiarFiltros = () => {
    setSearchTerm(''); setFilterEstado('');
    setFilterFechaInicio(''); setFilterFechaFin('');
    setSortBy('default'); setCurrentPage(1);
  };

  const handleSelectAsociado = (a: any) => {
    setFormAsociadoId(a.id);
    setAutocompleteSearch(`${a.nombre}  ·  ${a.cedula}`);
    setShowAutocomplete(false);
  };

  // ── Abrir detalle ─────────────────────────────────────────────────────────
  const handleOpenDetail = async (ahorro: any) => {
    setSelectedItem(ahorro);
    setMovimientosDetalle([]);
    setHistorialCambios([]);
    setIsDetailDialogOpen(true);
    setLoadingMovimientos(true);
    try {
      const [movsResult, auditoriaResult] = await Promise.all([
        supabase
          .from('transacciones')
          .select('*')
          .eq('ahorro_id', ahorro.id)
          .eq('tipo', 'aporte_voluntario')
          .order('created_at', { ascending: false }),
        supabase
          .from('auditoria')
          .select('id, accion, datos_antes, datos_despues, usuario_id, created_at')
          .eq('tabla', 'cuentas_ahorro')
          .eq('registro_id', ahorro.id)
          .order('created_at', { ascending: false }),
      ]);
      if (!movsResult.error) setMovimientosDetalle(movsResult.data || []);

      if (!auditoriaResult.error && (auditoriaResult.data || []).length > 0) {
        // Enriquecer con nombre de usuario
        const userIds = [...new Set((auditoriaResult.data || []).map((r: any) => r.usuario_id).filter(Boolean))];
        const usersMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: usrs } = await supabase.from('usuarios').select('id, nombre').in('id', userIds);
          (usrs || []).forEach((u: any) => { usersMap[u.id] = u.nombre; });
        }
        const historial = (auditoriaResult.data || []).map((r: any) => ({
          ...r,
          usuario_nombre: usersMap[r.usuario_id] ?? 'Administrador',
          saldo_antes:    r.datos_antes?.monto_ahorrado,
          saldo_despues:  r.datos_despues?.monto_ahorrado,
          campos_modificados: r.accion === 'EDITAR' ? 'Saldo / Observaciones' : r.accion,
          fecha_cambio:   r.created_at,
        }));
        setHistorialCambios(historial);
      } else {
        setHistorialCambios([]);
      }
    } catch { /* sin datos */ }
    setLoadingMovimientos(false);
  };

  // ── Parsear frecuencia/objetivo de observaciones ──────────────────────────
  const parsarMetadatosObservaciones = (obs: string) => {
    const match = obs?.match(/^\[Frecuencia:\s*(\w+)(?:\s*\|\s*Objetivo:\s*\$?([\d.,]+))?\]/);
    return {
      frecuencia: match?.[1] ?? '',
      objetivo:   match?.[2]?.replace(/\./g, '') ?? '',
    };
  };

  // ── Abrir editar ──────────────────────────────────────────────────────────
  const handleOpenEdit = (ahorro: any) => {
    setSelectedItem(ahorro);
    setFormAsociadoId(ahorro.asociado_id);
    setAutocompleteSearch(`${ahorro.asociado}  ·  ${ahorro.cedula}`);
    setFormSaldoInicial(formatCurrencyRealTime(ahorro.montoAhorrado.toString().replace(/\./g, ',')));
    setFormFechaInicio(ahorro.fechaInicio);
    const meta = parsarMetadatosObservaciones(ahorro.observaciones ?? '');
    setFormFrecuencia(meta.frecuencia);
    if (meta.objetivo) {
      setFormMontoObjetivo(formatCurrencyRealTime(meta.objetivo));
    } else {
      setFormMontoObjetivo('');
    }
    setIsCreateDialogOpen(true);
  };

  // ── Abrir anular ──────────────────────────────────────────────────────────
  const handleOpenAnularDialog = (ahorro: any) => {
    setSelectedItem(ahorro);
    setJustificacionAnulacion('');
    setIsDeleteDialogOpen(true);
  };

  // ── Abrir PDF ─────────────────────────────────────────────────────────────
  const handleOpenPDF = (ahorro: any) => {
    const result = buildAhorroVoluntarioPDF({
      asociado:          ahorro.asociado,
      cedula:            ahorro.cedula,
      montoTotal:        ahorro.montoAhorrado,
      ultimoAporte:      ahorro.montoAhorrado,
      fechaUltimoAporte: ahorro.fechaInicio,
      totalAportes:      1,
      estado:            ahorro.estado,
    });
    if (result) {
      setPdfPreviewUrl(result.url);
      setPdfPreviewFilename(result.filename);
      setPdfDownloadFn(() => result.download);
      setIsPdfPreviewOpen(true);
    } else {
      toast.error('Error al generar la vista previa del PDF');
    }
  };

  // ── Abrir movimiento ──────────────────────────────────────────────────────
  const handleOpenMovimiento = (tipo: 'Depósito' | 'Retiro') => {
    setFormMovTipo(tipo);
    setFormMovMonto('');
    setFormMovFecha(new Date().toISOString().split('T')[0]);
    setFormMovDesc('');
    setFormMovMetodo('');
    setIsMovimientoDialogOpen(true);
  };

  const openDeposito = (ahorro: any) => {
    setSelectedItem(ahorro);
    setFormMovTipo('Depósito');
    setFormMovMonto('');
    setFormMovFecha(new Date().toISOString().split('T')[0]);
    setFormMovDesc('');
    setFormMovMetodo('');
    setIsMovimientoDialogOpen(true);
  };

  const openRetiro = (ahorro: any) => {
    setSelectedItem(ahorro);
    setFormMovTipo('Retiro');
    setFormMovMonto(formatCurrencyInput(ahorro.montoAhorrado.toString()));
    setFormMovFecha(new Date().toISOString().split('T')[0]);
    setFormMovDesc('');
    setFormMovMetodo('');
    setIsMovimientoDialogOpen(true);
  };

  // ── Registrar movimiento ──────────────────────────────────────────────────
  const handleRegistrarMovimiento = () => {
    if (!formMovFecha) { toast.error('Selecciona la fecha del movimiento'); return; }
    if (!selectedItem) return;

    // Retiro total: no se valida monto (se usa el saldo completo desde DB)
    if (formMovTipo === 'Retiro') {
      ejecutarRegistrarMovimiento();
      return;
    }

    const monto = parseCurrencyInput(formMovMonto);
    if (!monto || monto <= 0) { toast.error('El monto debe ser mayor a cero'); return; }

    if (monto < montoMinimo) { setIsConfirmMovBajoVolOpen(true); return; }
    const dia = parseInt(formMovFecha.split('-')[2], 10);
    if (dia > 30) {
      toast.error('Fecha fuera del mes fiscal', {
        description: 'El mes fiscal va del día 1 al 30.',
        duration: 5000,
      });
      return;
    }
    ejecutarRegistrarMovimiento();
  };

  const ejecutarRegistrarMovimiento = async () => {
    setSavingMovimiento(true);
    try {
      const { data: dbAhorro } = await supabase
        .from('cuentas_ahorro').select('monto_ahorrado')
        .eq('id', selectedItem.id).single();
      const saldoAnterior = dbAhorro?.monto_ahorrado ?? selectedItem.montoAhorrado;

      // Retiro siempre es total: monto = saldo completo
      const monto = formMovTipo === 'Retiro'
        ? saldoAnterior
        : parseCurrencyInput(formMovMonto);

      if (formMovTipo === 'Retiro' && saldoAnterior <= 0) {
        toast.error('No hay saldo disponible para retirar');
        setSavingMovimiento(false);
        return;
      }

      const saldoNuevo = formMovTipo === 'Retiro' ? 0 : saldoAnterior + monto;

      const { error: movErr } = await supabase.from('transacciones').insert({
        tipo:         'aporte_voluntario',
        ahorro_id:    selectedItem.id,
        asociado_id:  selectedItem.asociado_id,
        fecha_pago:   formMovFecha,
        monto,
        saldo_antes:  saldoAnterior,
        saldo_despues: saldoNuevo,
        observacion:  formMovDesc.trim() || null,
      });
      if (movErr) throw movErr;

      const { data: updData, error: updErr } = await supabase
        .from('cuentas_ahorro')
        .update({ monto_ahorrado: saldoNuevo })
        .eq('id', selectedItem.id)
        .select('monto_ahorrado').single();
      if (updErr) throw updErr;

      const saldoConfirmado = updData?.monto_ahorrado ?? saldoNuevo;
      setSelectedItem((prev: any) => ({ ...prev, montoAhorrado: saldoConfirmado }));
      setAhorros(prev => prev.map(a =>
        a.id === selectedItem.id ? { ...a, montoAhorrado: saldoConfirmado } : a
      ));

      const { data: movs } = await supabase
        .from('transacciones').select('*')
        .eq('ahorro_id', selectedItem.id)
        .eq('tipo', 'aporte_voluntario')
        .order('created_at', { ascending: false });
      setMovimientosDetalle(movs || []);

      toast.success(
        formMovTipo === 'Retiro' ? 'Retiro total registrado' : 'Depósito registrado exitosamente',
        {
          description: formMovTipo === 'Retiro'
            ? `Se retiró ${formatCurrency(monto)} — Saldo actual: $0`
            : `${formatCurrency(monto)} — Nuevo saldo: ${formatCurrency(saldoNuevo)}`,
        },
      );
      setIsMovimientoDialogOpen(false);
      setFormMovMonto(''); setFormMovFecha(''); setFormMovDesc(''); setFormMovMetodo('');
    } catch (err: any) {
      toast.error('Error al registrar movimiento: ' + err.message);
    } finally {
      setSavingMovimiento(false);
    }
  };

  // ── Toggle estado ─────────────────────────────────────────────────────────
  const handleToggleEstado = async (id: string) => {
    const ahorro = ahorros.find(a => a.id === id);
    if (!ahorro) return;
    if (!justificacionAnulacion.trim()) { toast.error('La justificación es obligatoria'); return; }
    const justificacion = justificacionAnulacion.trim();
    const desactivando  = ahorro.estado === 'activo';
    try {
      const nuevoEstado = desactivando ? 'inactivo' : 'activo';
      await ahorroVoluntarioApi.update(id, {
        estado: nuevoEstado,
        ...(!desactivando && { anulado: false, motivo_anulacion: null }),
      });
      setAhorros(prev => prev.map(a => a.id === id ? { ...a, estado: nuevoEstado, ...(!desactivando && { anulado: false }) } : a));
      await supabase.from('notificaciones').insert({
        usuario_id: ahorro.asociado_id,
        titulo:  desactivando ? '⚠️ Ahorro voluntario desactivado' : '✅ Ahorro voluntario activado',
        mensaje: desactivando
          ? `Tu ahorro voluntario ha sido desactivado. Motivo: ${justificacion}`
          : `Tu ahorro voluntario ha sido reactivado. Motivo: ${justificacion}`,
        tipo:  desactivando ? 'ahorro_inactivado' : 'ahorro_activado',
        leida: false,
      });
      toast.success(`Ahorro de "${ahorro.asociado}" ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'} exitosamente`);
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
    setIsToggleEstadoDialogOpen(false);
    setSelectedItem(null);
    setJustificacionAnulacion('');
  };

  // ── Anular ────────────────────────────────────────────────────────────────
  const handleAnular = async () => {
    if (!selectedItem) return;
    if (!justificacionAnulacion.trim()) {
      toast.error('La justificación es obligatoria para anular un ahorro'); return;
    }
    try {
      const justificacion  = justificacionAnulacion.trim();
      await ahorroVoluntarioApi.anular(selectedItem.id, justificacion);
      const usuarioNombre = userData?.name || userData?.nombre || userData?.email || 'Administrador';
      const fechaHoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
      await supabase.from('notificaciones').insert({
        usuario_id: selectedItem.asociado_id,
        titulo:  'Tu ahorro voluntario ha sido anulado',
        mensaje: `Estimado(a) ${selectedItem.asociado},\n\nEl administrador ${usuarioNombre} anuló tu plan de ahorro voluntario el ${fechaHoy}.\n\nMotivo: "${justificacion}"\n\nSaldo al momento de la anulación: ${formatCurrency(selectedItem.montoAhorrado)}`,
        tipo:    'anulacion',
      });
      setAhorros(prev => prev.map(a =>
        a.id === selectedItem.id
          ? { ...a, anulado: true, estado: 'suspendido', motivoAnulacion: justificacion }
          : a
      ));
      toast.success(`Ahorro de "${selectedItem.asociado}" anulado exitosamente`);

      // Preparar datos para email (Gmail compose)
      if (selectedItem.email) {
        setAnulacionEmailData({
          email:  selectedItem.email,
          nombre: selectedItem.asociado,
          saldo:  selectedItem.montoAhorrado,
          motivo: justificacion,
        });
      }
    } catch (err: any) {
      toast.error('Error al anular ahorro: ' + err.message);
    }
    setIsDeleteDialogOpen(false);
    setSelectedItem(null);
    setJustificacionAnulacion('');
  };

  // ── Construir prefijo de observaciones con metadatos ─────────────────────
  const construirObservaciones = (frecuencia: string, montoObjetivo: string, notaUsuario = '') => {
    const partes: string[] = [];
    if (frecuencia) partes.push(`Frecuencia: ${frecuencia}`);
    const objetivoNum = parseCurrencyInput(montoObjetivo);
    if (objetivoNum > 0)
      partes.push(`Objetivo: $${objetivoNum.toLocaleString('es-CO')}`);
    const prefijo = partes.length > 0 ? `[${partes.join(' | ')}]` : '';
    return [prefijo, notaUsuario].filter(Boolean).join(' ');
  };

  // ── Guardar (crear / editar) ──────────────────────────────────────────────
  const handleSaveAhorro = async (forzar = false) => {
    if (!formAsociadoId) {
      toast.error('❌ Error de validación', { description: 'Selecciona un asociado' }); return;
    }
    const saldo = parseCurrencyInput(formSaldoInicial);

    if (!selectedItem) {
      const hoyStr = new Date().toISOString().split('T')[0];
      if (formFechaInicio !== hoyStr) {
        toast.error('❌ Error de validación', { description: 'La fecha de inicio debe ser el día actual' });
        return;
      }
    }

    if (!selectedItem && !forzar && saldo > 0 && saldo < montoMinimo) {
      setIsConfirmSaldoBajoVolOpen(true); return;
    }

    const asociado = asociadosDisponibles.find(a => a.id === formAsociadoId);
    const nuevasObservaciones = construirObservaciones(formFrecuencia, formMontoObjetivo);

    if (!selectedItem) {
      const { data: existente } = await supabase
        .from('cuentas_ahorro').select('id')
        .eq('tipo', 'voluntario')
        .eq('asociado_id', formAsociadoId).eq('estado', 'activo').eq('anulado', false).limit(1);
      if (existente && existente.length > 0) {
        toast.error('El asociado ya tiene un ahorro voluntario activo', {
          description: 'No se puede crear otro hasta que el actual sea liquidado.',
        });
        return;
      }
    }

    try {
      if (selectedItem) {
        // Obtener valores actuales antes de modificar (para auditoría)
        const { data: datosActuales } = await supabase
          .from('cuentas_ahorro').select('monto_ahorrado, estado, observaciones')
          .eq('id', selectedItem.id).single();

        const prevSaldo      = selectedItem.montoAhorrado;
        const prevObservaciones = datosActuales?.observaciones ?? '';

        const updatePayload: any = { monto_ahorrado: saldo };
        if (nuevasObservaciones !== undefined) updatePayload.observaciones = nuevasObservaciones || null;

        await ahorroVoluntarioApi.update(selectedItem.id, updatePayload);

        // Registrar en auditoría
        const { data: authData } = await supabase.auth.getUser();
        const adminUserId = authData?.user?.id ?? userData?.id ?? null;
        await supabase.from('auditoria').insert({
          tabla:       'cuentas_ahorro',
          registro_id: selectedItem.id,
          accion:      'EDITAR',
          usuario_id:  adminUserId,
          datos_antes: {
            tipo:           'voluntario',
            monto_ahorrado: prevSaldo,
            estado:         datosActuales?.estado ?? selectedItem.estado,
            observaciones:  prevObservaciones,
          },
          datos_despues: {
            tipo:           'voluntario',
            monto_ahorrado: saldo,
            estado:         datosActuales?.estado ?? selectedItem.estado,
            observaciones:  nuevasObservaciones,
          },
        });

        const camposModificados: string[] = [];
        if (prevSaldo !== saldo) camposModificados.push('Saldo');
        if (nuevasObservaciones !== prevObservaciones) camposModificados.push('Observaciones');

        const usuarioNombre = userData?.name || userData?.nombre || userData?.email || 'Administrador';
        if (camposModificados.length > 0) {
          await supabase.from('notificaciones').insert({
            asociado_id: selectedItem.asociado_id,
            titulo:  'Modificación en tu ahorro voluntario',
            mensaje: `El administrador ${usuarioNombre} realizó cambios en tu plan de ahorro voluntario.\n\nCambios:\n${
              prevSaldo !== saldo ? `• Saldo: ${formatCurrency(prevSaldo)} → ${formatCurrency(saldo)}\n` : ''
            }${nuevasObservaciones !== prevObservaciones ? '• Observaciones actualizadas\n' : ''}`,
            tipo:    'modificacion',
          });
        }
        setAhorros(prev => prev.map(a =>
          a.id === selectedItem.id
            ? { ...a, montoAhorrado: saldo, observaciones: nuevasObservaciones }
            : a
        ));
        toast.success('✅ Ahorro voluntario actualizado', {
          description: camposModificados.length > 0
            ? `Campos modificados: ${camposModificados.join(', ')}`
            : `Sin cambios`,
        });
      } else {
        const { data: periodo } = await supabase
          .from('periodos').select('id').eq('estado', 'activo')
          .order('fecha_inicio', { ascending: false }).limit(1).single();
        if (!periodo) throw new Error('No hay período activo');

        const nuevo = await ahorroVoluntarioApi.create({
          asociado_id: formAsociadoId, periodo_id: periodo.id,
          monto_ahorrado: saldo, estado: 'activo', anulado: false,
          observaciones: nuevasObservaciones || null,
        });

        if (saldo > 0) {
          const { error: movErr } = await supabase.from('transacciones').insert({
            tipo:          'aporte_voluntario',
            ahorro_id:     nuevo.id,
            asociado_id:   formAsociadoId,
            fecha_pago:    formFechaInicio || new Date().toISOString().split('T')[0],
            monto:         saldo,
            saldo_antes:   0,
            saldo_despues: saldo,
            observacion:   'Aporte inicial al abrir el plan',
          });
          if (movErr) toast.error('Ahorro creado, pero error al registrar aporte inicial: ' + movErr.message);
        }

        const nowIso = new Date().toISOString();
        setAhorros(prev => [{
          id: nuevo.id, asociado: asociado?.nombre ?? '', cedula: asociado?.cedula ?? '',
          email: asociado?.email ?? '',
          asociado_id: formAsociadoId, montoAhorrado: saldo,
          fechaInicio: nowIso.split('T')[0], estado: 'activo',
          anulado: false, motivoAnulacion: '', observaciones: nuevasObservaciones, createdAt: nowIso,
        }, ...prev]);
        toast.success('✅ Ahorro voluntario registrado', {
          description: saldo > 0 ? `Aporte inicial: ${formatCurrency(saldo)}` : 'Ahorro creado sin aporte inicial',
        });
      }
    } catch (err: any) {
      toast.error('Error al guardar ahorro: ' + err.message);
    }
    setIsCreateDialogOpen(false);
    setSelectedItem(null);
    setFormAsociadoId(''); setFormSaldoInicial('0,0'); setFormFechaInicio('');
    setFormFrecuencia(''); setFormMontoObjetivo('');
    setAutocompleteSearch('');
  };

  // ── Admin: aprobar solicitud voluntaria ───────────────────────────────────
  const handleAprobarSolicitudVol = async (sol: any) => {
    try {
      const { data: periodo } = await supabase
        .from('periodos').select('id').eq('estado', 'activo')
        .order('fecha_inicio', { ascending: false }).limit(1).single();
      if (!periodo) throw new Error('No hay período activo');
      const nuevo = await ahorroVoluntarioApi.create({
        asociado_id: sol.asociado_id, periodo_id: periodo.id,
        monto_ahorrado: sol.monto_inicial ?? 0, estado: 'activo', anulado: false,
      });
      await supabase.from('notificaciones').insert({
        titulo: '✅ Solicitud de ahorro voluntario aprobada',
        mensaje: 'Tu plan de ahorro voluntario fue aprobado.',
        tipo: 'pago_registrado', leida: false, usuario_id: sol.asociado_id,
      });
      setSolicitudesVol(prev => prev.map(s => s.id === sol.id ? { ...s, estado: 'aprobada' } : s));
      const nowIso = new Date().toISOString();
      setAhorros(prev => [{
        id: nuevo.id, asociado: sol.usuarios?.nombre ?? '', cedula: sol.usuarios?.cedula ?? '',
        asociado_id: sol.asociado_id, montoAhorrado: sol.monto_inicial ?? 0,
        fechaInicio: nowIso.split('T')[0], estado: 'activo',
        anulado: false, motivoAnulacion: '', createdAt: nowIso,
      }, ...prev]);
      toast.success(`✅ Plan aprobado para ${sol.usuarios?.nombre ?? 'el asociado'}`);
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
      await supabase.from('notificaciones').insert({
        titulo: '❌ Solicitud de ahorro voluntario rechazada',
        mensaje: `Tu solicitud fue rechazada. Motivo: ${notaRechazoVol.trim()}`,
        tipo: 'ahorro_rechazado', leida: false, usuario_id: solVolSeleccionada.asociado_id,
      });
      setSolicitudesVol(prev => prev.map(s =>
        s.id === solVolSeleccionada.id ? { ...s, estado: 'rechazada', nota_admin: notaRechazoVol.trim() } : s
      ));
      toast.success('Solicitud rechazada');
      setIsRechazarVolOpen(false); setSolVolSeleccionada(null); setNotaRechazoVol('');
    } catch (err: any) {
      toast.error('Error al rechazar: ' + err.message);
    } finally {
      setSavingSolVol(false);
    }
  };

  // ── Admin: confirmar aporte voluntario ────────────────────────────────────
  const handleConfirmarAporteVol = async (ap: any) => {
    try {
      const { data: dbAhorro } = await supabase
        .from('cuentas_ahorro').select('monto_ahorrado').eq('id', ap.ahorro_id).single();
      const saldoAnterior = dbAhorro?.monto_ahorrado ?? 0;
      const saldoNuevo    = saldoAnterior + ap.monto;
      const { error: movErr } = await supabase.from('transacciones').insert({
        tipo:          'aporte_voluntario',
        ahorro_id:     ap.ahorro_id,
        asociado_id:   ap.asociado_id,
        fecha_pago:    ap.fecha_pago,
        monto:         ap.monto,
        saldo_antes:   saldoAnterior,
        saldo_despues: saldoNuevo,
        observacion:   `${ap.medio_pago ?? ''}${ap.nota ? ' — ' + ap.nota : ''}` || null,
      });
      if (movErr) throw movErr;
      await supabase.from('cuentas_ahorro').update({ monto_ahorrado: saldoNuevo }).eq('id', ap.ahorro_id);
      await supabase.from('notificaciones').insert({
        titulo: '✅ Aporte voluntario confirmado',
        mensaje: `Tu aporte de ${formatCurrency(ap.monto)} fue confirmado. Nuevo saldo: ${formatCurrency(saldoNuevo)}.`,
        tipo: 'aporte_confirmado', leida: false, asociado_id: ap.asociado_id,
      });
      setAportesPendientesVol(prev => prev.map(a => a.id === ap.id ? { ...a, estado: 'aprobada' } : a));
      setAhorros(prev => prev.map(a => a.id === ap.ahorro_id ? { ...a, montoAhorrado: saldoNuevo } : a));
      toast.success(`✅ Aporte de ${formatCurrency(ap.monto)} confirmado`, {
        description: `Nuevo saldo de ${ap.usuarios?.nombre ?? 'el asociado'}: ${formatCurrency(saldoNuevo)}`,
      });
    } catch (err: any) {
      toast.error('Error al confirmar el aporte: ' + err.message);
    }
  };

  // ── Admin: rechazar aporte voluntario ─────────────────────────────────────
  const handleRechazarAporteVol = async () => {
    if (!aporteVolSeleccionado) return;
    if (!notaRechazoAporteVol.trim()) { toast.error('Escribe el motivo del rechazo'); return; }
    setSavingAporteVol(true);
    try {
      await supabase.from('notificaciones').insert({
        titulo: '❌ Aporte voluntario no confirmado',
        mensaje: `Tu reporte de aporte de ${formatCurrency(aporteVolSeleccionado.monto)} no fue confirmado. Motivo: ${notaRechazoAporteVol.trim()}`,
        tipo: 'aporte_rechazado', leida: false, asociado_id: aporteVolSeleccionado.asociado_id,
      });
      setAportesPendientesVol(prev => prev.map(a =>
        a.id === aporteVolSeleccionado.id ? { ...a, estado: 'rechazada', nota_admin: notaRechazoAporteVol.trim() } : a
      ));
      toast.success('Aporte rechazado y asociado notificado');
      setIsRechazarAporteVolOpen(false); setAporteVolSeleccionado(null); setNotaRechazoAporteVol('');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSavingAporteVol(false);
    }
  };

  return {
    // Filtros / paginación
    searchTerm, setSearchTerm, filterEstado, setFilterEstado,
    filterFechaInicio, setFilterFechaInicio, filterFechaFin, setFilterFechaFin,
    sortBy, setSortBy, currentPage, setCurrentPage,
    currentPageAnulados, setCurrentPageAnulados, itemsPerPage,
    // Diálogos
    isCreateDialogOpen, setIsCreateDialogOpen,
    isDetailDialogOpen, setIsDetailDialogOpen,
    isDeleteDialogOpen, setIsDeleteDialogOpen,
    isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen,
    isMovimientoDialogOpen, setIsMovimientoDialogOpen,
    isPdfPreviewOpen, setIsPdfPreviewOpen,
    isConfirmSaldoBajoVolOpen, setIsConfirmSaldoBajoVolOpen,
    isConfirmMovBajoVolOpen, setIsConfirmMovBajoVolOpen,
    isRechazarVolOpen, setIsRechazarVolOpen,
    isRechazarAporteVolOpen, setIsRechazarAporteVolOpen,
    // Item seleccionado
    selectedItem, setSelectedItem,
    // Formulario
    formAsociadoId, setFormAsociadoId,
    formSaldoInicial, setFormSaldoInicial,
    formFechaInicio, setFormFechaInicio,
    formFrecuencia, setFormFrecuencia,
    formMontoObjetivo, setFormMontoObjetivo,
    justificacionAnulacion, setJustificacionAnulacion,
    // Email anulación
    anulacionEmailData, setAnulacionEmailData,
    // Autocompletado
    autocompleteSearch, setAutocompleteSearch,
    showAutocomplete, setShowAutocomplete,
    showSearchSuggestions, setShowSearchSuggestions,
    autocompleteRef, searchRef,
    autocompleteSuggestions,
    // Movimientos
    movimientosDetalle, setMovimientosDetalle,
    loadingMovimientos,
    historialCambios, setHistorialCambios,
    historialCambiosGeneralVoluntario,
    formMovTipo, setFormMovTipo,
    formMovMonto, setFormMovMonto,
    formMovFecha, setFormMovFecha,
    formMovDesc, setFormMovDesc,
    formMovMetodo, setFormMovMetodo,
    savingMovimiento,
    // PDF
    pdfPreviewUrl, setPdfPreviewUrl,
    pdfPreviewFilename,
    pdfDownloadFn, setPdfDownloadFn,
    // Datos
    ahorros, loading, montoMinimo,
    // Solicitudes
    solicitudesVol, setSolicitudesVol,
    solVolSeleccionada, setSolVolSeleccionada,
    notaRechazoVol, setNotaRechazoVol,
    savingSolVol,
    aportesPendientesVol, setAportesPendientesVol,
    aporteVolSeleccionado, setAporteVolSeleccionado,
    notaRechazoAporteVol, setNotaRechazoAporteVol,
    savingAporteVol,
    // Computed
    sortedAhorros, currentAhorros, totalPages, startIndex, endIndex,
    filteredAhorrosAnulados, currentAhorrosAnulados, totalPagesAnulados,
    startIndexAnulados, endIndexAnulados, hayFiltros,
    totalDepositado, saldoRealMov,
    // Handlers
    cargarDatos, limpiarFiltros, handleSelectAsociado,
    handleSaldoInicialChange, handleSaldoInicialBlur,
    handleOpenDetail, handleOpenEdit, handleOpenAnularDialog,
    handleOpenPDF, handleOpenMovimiento, openDeposito, openRetiro,
    handleRegistrarMovimiento, ejecutarRegistrarMovimiento,
    handleToggleEstado, handleAnular, handleSaveAhorro,
    handleAprobarSolicitudVol, handleRechazarSolicitudVol,
    handleConfirmarAporteVol, handleRechazarAporteVol,
    // Utilidades (re-exportadas para los sub-componentes)
    formatCurrency,
  };
}

export type AhorroVoluntarioHook = ReturnType<typeof useAhorroVoluntario>;
