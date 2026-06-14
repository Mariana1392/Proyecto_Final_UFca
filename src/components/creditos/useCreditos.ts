// ── useCreditos.ts ────────────────────────────────────────────────────────────
// Orquestador principal del módulo de créditos.
// Mantiene únicamente el estado compartido entre sub-hooks, la función
// cargarDatos y la composición de los sub-hooks especializados.

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import { asociadosApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { TIPOS_CREDITO } from '../../lib/constants';
import {
  generateCreditoPDF,
  generateCarteraPDF,
  generateComprobantePagoPDF,
  generateHistorialCreditoPDF,
} from '../utils/pdfGenerator';
import { useCreditosPagos }       from './useCreditosPagos';
import { useCreditosSimulacion }   from './useCreditosSimulacion';
import { useCreditosSolicitudes }  from './useCreditosSolicitudes';
import { useCreditosDesembolso }   from './useCreditosDesembolso';
import { useCreditosCRUD }         from './useCreditosCRUD';
import { useCreditosFiltros }      from './useCreditosFiltros';

export function useCreditos(userData?: any) {
  const { can, user } = useAuth();

  // ── Paginación / búsqueda / filtros admin ─────────────────────────────────
  const [searchTerm, setSearchTerm]               = useState('');
  const [filterEstado, setFilterEstado]           = useState('');
  const [currentPage, setCurrentPage]             = useState(1);
  const [currentPageAnulados, setCurrentPageAnulados] = useState(1);
  const [currentPageRechazados, setCurrentPageRechazados] = useState(1);
  const itemsPerPage = 10;

  // ── Filtros exclusivos para vista asociado ────────────────────────────────
  const [asocSearch, setAsocSearch]             = useState('');
  const [asocFilterEstado, setAsocFilterEstado] = useState('');
  const [asocFechaDesde, setAsocFechaDesde]     = useState('');
  const [asocFechaHasta, setAsocFechaHasta]     = useState('');
  const [asocSortBy, setAsocSortBy]             = useState<'fecha_desc'|'fecha_asc'|'estado'|'monto_desc'|'monto_asc'>('fecha_desc');
  const [asocTabFilter, setAsocTabFilter]       = useState<'activos'|'finalizados'>('activos');

  // ── Diálogos no gestionados por sub-hooks ─────────────────────────────────
  const [isDetailDialogOpen, setIsDetailDialogOpen]   = useState(false);
  const [isInformeDialogOpen, setIsInformeDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem]               = useState<any>(null);

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [creditos, setCreditos]                     = useState<any[]>([]);
  const [asociadosDisponibles, setAsociadosDisponibles] = useState<any[]>([]);
  const [loading, setLoading]                       = useState(true);

  // ── Autocompletado buscador principal ─────────────────────────────────────
  const [showSearchSugg, setShowSearchSugg] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── State elevado (compartido entre cargarDatos y sub-hooks) ─────────────
  const [creditosSimulacion, setCreditosSimulacion] = useState<any[]>([]);
  const [solicitudesCredito, setSolicitudesCredito] = useState<any[]>([]);
  const [misSolicitudes, setMisSolicitudes]         = useState<any[]>([]);

  // ── Utilidades ────────────────────────────────────────────────────────────
  const parseMonto = (v: string) => parseInt(v.replace(/\./g, '').replace(/[^\d]/g, ''), 10) || 0;

  // ── Carga de datos desde Supabase ─────────────────────────────────────────
  async function cargarDatos() {
    try {
      setLoading(true);
      // ── Fetch creditos + asociados en paralelo ────────────────────────────
      const [creditosRes, asociadosData] = await Promise.all([
        supabase.from('creditos').select('*').order('created_at', { ascending: false }),
        asociadosApi.getAll(),
      ]);
      if (creditosRes.error) throw creditosRes.error;

      // ── Join manual: traer nombre/cedula de cada asociado_id único ────────
      const asocIds = [...new Set((creditosRes.data || []).map((c: any) => c.asociado_id).filter(Boolean))];
      const usuariosMap: Record<string, { nombre: string; cedula: string }> = {};
      if (asocIds.length > 0) {
        const { data: usrsData } = await supabase
          .from('usuarios').select('id, nombre, cedula').in('id', asocIds);
        (usrsData || []).forEach((u: any) => { usuariosMap[u.id] = u; });
      }
      const creditosData = {
        data: (creditosRes.data || []).map((c: any) => ({
          ...c, usuarios: usuariosMap[c.asociado_id] ?? null,
        })),
      };

      // La detección de mora es ahora responsabilidad exclusiva de Supabase pg_cron
      // (supabase_pg_cron_mora_automatica.sql — se ejecuta diariamente a medianoche).
      // El frontend solo lee el campo 'estado' tal como viene de la BD.

      // Mapear a shape local
      const mapeados = (creditosData.data || []).map((c: any) => ({
        id:                 c.id,
        asociado:           c.usuarios?.nombre ?? 'Sin nombre',
        cedula:             c.usuarios?.cedula || '',
        asociado_id:        c.asociado_id,
        tipo:               c.tipo ?? 'libre_inversion',
        monto:              c.monto,
        tasaInteres:        c.tasa_interes ?? 0,
        plazo:              c.plazo_meses,
        cuotaMensual:       c.cuota_mensual,
        saldo:              c.saldo,
        fechaDesembolso:    c.fecha_desembolso,
        estadoAprobacion:   c.estado ?? 'pendiente',
        descripcionSoporte: c.observaciones ?? c.descripcion_soporte ?? '',
        urlDocumento:       c.url_comprobante_solicitud ?? '',
        estado:             c.estado,
        anulado:            c.anulado,
        motivoAnulacion:    c.motivo_anulacion ?? '',
        fechaEstadoCambio:  c.fecha_estado_cambio ?? '',
        motivoEstadoCambio: c.motivo_estado_cambio ?? '',
        tipoInteres:        c.tipo_interes ?? 'compuesto',
        referidoNombre:     c.referido_nombre ?? '',
        createdAt:          c.created_at,
      }));

      const noSimulacion = mapeados.filter((c: any) => c.estadoAprobacion !== 'simulacion');
      setCreditos(noSimulacion);
      setCreditosSimulacion(mapeados.filter((c: any) => c.estadoAprobacion === 'simulacion'));
      setAsociadosDisponibles(asociadosData || []);

      // ── Solicitudes pendientes / en revisión (para el tab admin) ──────────
      const solicitudesMapped = noSimulacion
        .filter((c: any) => c.estadoAprobacion === 'pendiente' || c.estadoAprobacion === 'en_revision')
        .map((c: any) => ({
          ...c,
          plazoMeses:       c.plazo,
          tipoCreditoLabel: TIPOS_CREDITO.find(t => t.value === c.tipo)?.label ?? c.tipo,
          destino:          c.descripcionSoporte ?? '',
          observaciones:    '',
          banco:            c.banco            ?? '',
          tipoCuenta:       c.tipoCuenta       ?? '',
          numeroCuenta:     c.numeroCuenta     ?? '',
          asociadoId:       c.asociado_id,
        }));
      setSolicitudesCredito(solicitudesMapped);
      setMisSolicitudes([]);
    } catch (err: any) {
      toast.error('Error al cargar créditos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void cargarDatos(); }, []);

  // ── Tiempo real: recarga cuando cambian créditos o transacciones ──────────
  useRealtimeSubscription(
    'realtime:creditos',
    ['creditos', 'transacciones'],
    cargarDatos,
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSearchSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Sub-hooks ─────────────────────────────────────────────────────────────
  const crud = useCreditosCRUD({
    selectedItem, setSelectedItem,
    setCreditos, asociadosDisponibles,
    cargarDatos, userData, parseMonto,
  });

  const pagos = useCreditosPagos({
    selectedItem, setSelectedItem,
    setCreditos, cargarDatos, userData, user,
  });

  const simulacion = useCreditosSimulacion({
    formAsociadoId:    crud.formAsociadoId,
    formMonto:         crud.formMonto,
    formTasa:          crud.formTasa,
    formPlazo:         crud.formPlazo,
    formFecha:         crud.formFecha,
    formTipo:          crud.formTipo,
    formTipoInteres:   crud.formTipoInteres,
    formDescSoporte:   crud.formDescSoporte,
    asociadosDisponibles,
    setIsCreateDialogOpen: crud.setIsCreateDialogOpen,
    setSelectedItem,
    setFormArchivoFile: crud.setFormArchivoFile,
    cargarDatos,
    parseMonto,
    setCreditosSimulacion,
  });

  const solicitudes = useCreditosSolicitudes({
    setCreditos, userData,
    setSolicitudesCredito, setMisSolicitudes,
  });

  const desembolso = useCreditosDesembolso({
    selectedItem, setSelectedItem, cargarDatos,
  });

  const filtros = useCreditosFiltros({
    creditos, can, userData,
    searchTerm, filterEstado,
    currentPage, currentPageAnulados, currentPageRechazados, itemsPerPage,
    asocSearch, asocFilterEstado, asocFechaDesde, asocFechaHasta, asocSortBy,
    asocTabFilter,
    formMonto:       crud.formMonto,
    formTasa:        crud.formTasa,
    formPlazo:       crud.formPlazo,
    formTipoInteres: crud.formTipoInteres,
    parseMonto,
  });

  // ── Exportar historial de pagos a CSV ─────────────────────────────────────
  const exportarHistorialCSV = (historial: any[], credito: any) => {
    const numCredito = `CRE-${String(credito.id ?? '').substring(0, 8).toUpperCase()}`;
    const headers = ['N° Cuota','Fecha Pago','Monto Pagado','Capital','Interés','Saldo Antes','Saldo Después','Método','Registrado Por','Observación'];
    const rows = [...historial].reverse().map((p: any) => [
      p.num_cuota ?? '', p.fecha_pago ?? '',
      p.monto_pagado ?? 0, p.capital ?? 0, p.interes ?? 0,
      p.saldo_antes ?? 0, p.saldo_despues ?? 0,
      p.metodo_pago ?? '', p.usuarios?.nombre ?? p.registrado_por ?? '',
      p.observacion ?? '',
    ]);
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Historial_${numCredito}_${credito.asociado?.replace(/\s+/g, '_') || ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    // Auth
    can, user,
    // Estado compartido
    searchTerm, setSearchTerm,
    filterEstado, setFilterEstado,
    currentPage, setCurrentPage,
    currentPageAnulados, setCurrentPageAnulados,
    currentPageRechazados, setCurrentPageRechazados,
    itemsPerPage,
    asocSearch, setAsocSearch,
    asocFilterEstado, setAsocFilterEstado,
    asocFechaDesde, setAsocFechaDesde,
    asocFechaHasta, setAsocFechaHasta,
    asocSortBy, setAsocSortBy,
    asocTabFilter, setAsocTabFilter,
    isDetailDialogOpen, setIsDetailDialogOpen,
    isInformeDialogOpen, setIsInformeDialogOpen,
    selectedItem, setSelectedItem,
    creditos, setCreditos,
    asociadosDisponibles,
    loading,
    showSearchSugg, setShowSearchSugg,
    searchRef,
    creditosSimulacion,
    solicitudesCredito, setSolicitudesCredito,
    misSolicitudes,
    cargarDatos,
    parseMonto,
    // CRUD
    ...crud,
    // Pagos
    isPagoDialogOpen: pagos.isPagoDialogOpen, setIsPagoDialogOpen: pagos.setIsPagoDialogOpen,
    pagoMonto: pagos.pagoMonto, setPagoMonto: pagos.setPagoMonto,
    pagoMetodo: pagos.pagoMetodo, setPagoMetodo: pagos.setPagoMetodo,
    pagoObservacion: pagos.pagoObservacion, setPagoObservacion: pagos.setPagoObservacion,
    pagoFecha: pagos.pagoFecha, setPagoFecha: pagos.setPagoFecha,
    pagoComprobante: pagos.pagoComprobante, setPagoComprobante: pagos.setPagoComprobante,
    pagando: pagos.pagando,
    historialPagos: pagos.historialPagos, setHistorialPagos: pagos.setHistorialPagos,
    loadingPagos: pagos.loadingPagos,
    historialDetalle: pagos.historialDetalle, setHistorialDetalle: pagos.setHistorialDetalle,
    loadingHistorialDetalle: pagos.loadingHistorialDetalle,
    setLoadingHistorialDetalle: pagos.setLoadingHistorialDetalle,
    handleOpenPago: pagos.handleOpenPago,
    handleRegistrarPago: pagos.handleRegistrarPago,
    openPagoDialog: (c: any) => pagos.handleOpenPago(c),
    // Simulación
    isSimulacionOpen: simulacion.isSimulacionOpen, setIsSimulacionOpen: simulacion.setIsSimulacionOpen,
    tablaSimulacion: simulacion.tablaSimulacion, setTablaSimulacion: simulacion.setTablaSimulacion,
    enviandoSimulacion: simulacion.enviandoSimulacion,
    confirmandoSim: simulacion.confirmandoSim,
    rechazandoSim: simulacion.rechazandoSim,
    simSeleccionada: simulacion.simSeleccionada, setSimSeleccionada: simulacion.setSimSeleccionada,
    isConfirmSimOpen: simulacion.isConfirmSimOpen, setIsConfirmSimOpen: simulacion.setIsConfirmSimOpen,
    isRechazarSimOpen: simulacion.isRechazarSimOpen, setIsRechazarSimOpen: simulacion.setIsRechazarSimOpen,
    isSimDetalleOpen: simulacion.isSimDetalleOpen, setIsSimDetalleOpen: simulacion.setIsSimDetalleOpen,
    simDetalleData: simulacion.simDetalleData, setSimDetalleData: simulacion.setSimDetalleData,
    handleAbrirSimulacion: simulacion.handleAbrirSimulacion,
    handleEnviarSimulacion: simulacion.handleEnviarSimulacion,
    handleConfirmarSimulacion: simulacion.handleConfirmarSimulacion,
    handleRechazarSimulacion: simulacion.handleRechazarSimulacion,
    // Solicitudes
    isSolicitudDialogOpen: solicitudes.isSolicitudDialogOpen, setIsSolicitudDialogOpen: solicitudes.setIsSolicitudDialogOpen,
    totalAhorros: solicitudes.totalAhorros,
    solMonto: solicitudes.solMonto, setSolMonto: solicitudes.setSolMonto,
    solTipo: solicitudes.solTipo, setSolTipo: solicitudes.setSolTipo,
    solPlazo: solicitudes.solPlazo, setSolPlazo: solicitudes.setSolPlazo,
    solTasa: solicitudes.solTasa, setSolTasa: solicitudes.setSolTasa,
    solDestino: solicitudes.solDestino, setSolDestino: solicitudes.setSolDestino,
    solObs: solicitudes.solObs, setSolObs: solicitudes.setSolObs,
    savingSolicitud: solicitudes.savingSolicitud,
    isSolSimOpen: solicitudes.isSolSimOpen, setIsSolSimOpen: solicitudes.setIsSolSimOpen,
    tablaSolSim: solicitudes.tablaSolSim, setTablaSolSim: solicitudes.setTablaSolSim,
    isRechazarSolOpen: solicitudes.isRechazarSolOpen, setIsRechazarSolOpen: solicitudes.setIsRechazarSolOpen,
    solicitudSeleccionada: solicitudes.solicitudSeleccionada, setSolicitudSeleccionada: solicitudes.setSolicitudSeleccionada,
    notaRechazoSol: solicitudes.notaRechazoSol, setNotaRechazoSol: solicitudes.setNotaRechazoSol,
    savingRechazarSol: solicitudes.savingRechazarSol,
    solBanco: solicitudes.solBanco, setSolBanco: solicitudes.setSolBanco,
    solTipoCuenta: solicitudes.solTipoCuenta, setSolTipoCuenta: solicitudes.setSolTipoCuenta,
    solNumeroCuenta: solicitudes.solNumeroCuenta, setSolNumeroCuenta: solicitudes.setSolNumeroCuenta,
    tasasParametrizadas: solicitudes.tasasParametrizadas,
    solDocCartaLaboral: solicitudes.solDocCartaLaboral, setSolDocCartaLaboral: solicitudes.setSolDocCartaLaboral,
    solDocCedula: solicitudes.solDocCedula, setSolDocCedula: solicitudes.setSolDocCedula,
    solEsParaReferido: solicitudes.solEsParaReferido, setSolEsParaReferido: solicitudes.setSolEsParaReferido,
    solReferidoNombre: solicitudes.solReferidoNombre, setSolReferidoNombre: solicitudes.setSolReferidoNombre,
    asocIngresoMensual: solicitudes.asocIngresoMensual,
    handleSolTipoChange: solicitudes.handleSolTipoChange,
    handleSolicitarCredito: solicitudes.handleSolicitarCredito,
    handlePonerEnRevision: solicitudes.handlePonerEnRevision,
    handleAprobarSolicitudCredito: solicitudes.handleAprobarSolicitudCredito,
    handleRechazarSolicitudCredito: solicitudes.handleRechazarSolicitudCredito,
    // Desembolso
    isDesembolsoOpen: desembolso.isDesembolsoOpen, setIsDesembolsoOpen: desembolso.setIsDesembolsoOpen,
    desembolsoFecha: desembolso.desembolsoFecha, setDesembolsoFecha: desembolso.setDesembolsoFecha,
    desembolsoReferencia: desembolso.desembolsoReferencia, setDesembolsoReferencia: desembolso.setDesembolsoReferencia,
    desembolsoArchivo: desembolso.desembolsoArchivo, setDesembolsoArchivo: desembolso.setDesembolsoArchivo,
    guardandoDesembolso: desembolso.guardandoDesembolso,
    handleRegistrarDesembolso: desembolso.handleRegistrarDesembolso,
    handleVerComprobante: desembolso.handleVerComprobante,
    openDesembolsoDialog: desembolso.openDesembolsoDialog,
    // Filtros / computed
    ...filtros,
    // Handlers CRUD (alias cortos para el template)
    openAnularDialog:     (item: any) => crud.handleOpenAnular(item),
    openHardDeleteDialog: (item: any) => crud.handleOpenHardDelete(item),
    // Utilidades
    exportarHistorialCSV,
    // PDF generators
    generateCreditoPDF,
    generateCarteraPDF,
    generateComprobantePagoPDF,
    generateHistorialCreditoPDF,
  };
}

export type CreditosHook = ReturnType<typeof useCreditos>;
