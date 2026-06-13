// ── useCreditosFiltros.ts ─────────────────────────────────────────────────────
// Calcula todos los valores derivados (filtros, paginación, resumen de cartera,
// vista del asociado) a partir del estado del orquestador.
// No tiene estado propio (solo cómputos), por lo que no añade re-renders extra.

import { useMemo } from 'react';
import { formatCurrency } from '../../lib/formatters';
import { TIPOS_CREDITO } from '../../lib/constants';
import { ESTADOS_APROBACION, calcularCuota, calcularCuotaSimple } from './creditoHelpers';

interface UseCreditosFiltrosParams {
  creditos:              any[];
  can:                   (perm: string) => boolean;
  userData?:             any;
  // Admin filters
  searchTerm:            string;
  filterEstado:          string;
  currentPage:           number;
  currentPageAnulados:   number;
  currentPageRechazados: number;
  itemsPerPage:          number;
  // Asociado filters
  asocSearch:      string;
  asocFilterEstado: string;
  asocFechaDesde:  string;
  asocFechaHasta:  string;
  asocSortBy:      'fecha_desc' | 'fecha_asc' | 'estado' | 'monto_desc' | 'monto_asc';
  asocTabFilter?:   'activos' | 'finalizados';
  // Form values (for cuotaPreview)
  formMonto:      string;
  formTasa:       string;
  formPlazo:      string;
  formTipoInteres: 'simple' | 'compuesto';
  parseMonto: (v: string) => number;
}

export function useCreditosFiltros({
  creditos, can, userData,
  searchTerm, filterEstado,
  currentPage, currentPageAnulados, currentPageRechazados, itemsPerPage,
  asocSearch, asocFilterEstado, asocFechaDesde, asocFechaHasta, asocSortBy,
  asocTabFilter,
  formMonto, formTasa, formPlazo, formTipoInteres, parseMonto,
}: UseCreditosFiltrosParams) {

  const esVistaPropia = !can('creditos');

  // ── Bases filtradas por visibilidad ───────────────────────────────────────
  const creditosBase = useMemo(() => {
    const propia = (c: any) =>
      (userData?.id && c.asociado_id === userData.id) ||
      (userData?.cedula && c.cedula === userData.cedula);
    return esVistaPropia
      ? creditos.filter(c => !c.anulado && c.estadoAprobacion !== 'rechazado' && propia(c))
      : creditos.filter(c => !c.anulado && c.estadoAprobacion !== 'rechazado');
  }, [creditos, esVistaPropia, userData]);

  // ── Filtro principal (admin y asociado) ───────────────────────────────────
  const filteredCreditos = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return creditosBase.filter(c => {
      const matchSearch = !term || c.asociado.toLowerCase().includes(term) || c.cedula.includes(searchTerm);
      const matchEstado = !filterEstado || c.estadoAprobacion === filterEstado;
      return matchSearch && matchEstado;
    });
  }, [creditosBase, searchTerm, filterEstado]);

  // ── Rechazados ────────────────────────────────────────────────────────────
  const creditosRechazados = useMemo(() => {
    const propia = (c: any) =>
      (userData?.id && c.asociado_id === userData.id) ||
      (userData?.cedula && c.cedula === userData.cedula);
    return esVistaPropia
      ? creditos.filter(c => !c.anulado && c.estadoAprobacion === 'rechazado' && propia(c))
      : creditos.filter(c => !c.anulado && c.estadoAprobacion === 'rechazado');
  }, [creditos, esVistaPropia, userData]);

  const filteredRechazados = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return creditosRechazados.filter(c =>
      !term || c.asociado.toLowerCase().includes(term) || c.cedula.includes(searchTerm)
    );
  }, [creditosRechazados, searchTerm]);

  // ── Anulados ──────────────────────────────────────────────────────────────
  const creditosAnulados = useMemo(() => {
    const propia = (c: any) =>
      (userData?.id && c.asociado_id === userData.id) ||
      (userData?.cedula && c.cedula === userData.cedula);
    return esVistaPropia
      ? creditos.filter(c => c.anulado && propia(c))
      : creditos.filter(c => c.anulado);
  }, [creditos, esVistaPropia, userData]);

  const filteredAnulados = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return creditosAnulados.filter(c =>
      !term || c.asociado.toLowerCase().includes(term) || c.cedula.includes(searchTerm)
    );
  }, [creditosAnulados, searchTerm]);

  // ── Paginación ────────────────────────────────────────────────────────────
  const totalPages      = Math.ceil(filteredCreditos.length / itemsPerPage);
  const startIndex      = (currentPage - 1) * itemsPerPage;
  const currentList     = filteredCreditos.slice(startIndex, startIndex + itemsPerPage);

  const totalPagesAn    = Math.ceil(filteredAnulados.length / itemsPerPage);
  const startIndexAn    = (currentPageAnulados - 1) * itemsPerPage;
  const currentAnulados = filteredAnulados.slice(startIndexAn, startIndexAn + itemsPerPage);

  const totalPagesRec     = Math.ceil(filteredRechazados.length / itemsPerPage);
  const startIndexRec     = (currentPageRechazados - 1) * itemsPerPage;
  const currentRechazados = filteredRechazados.slice(startIndexRec, startIndexRec + itemsPerPage);

  // ── Resumen de cartera ────────────────────────────────────────────────────
  const carteraActivos    = creditosBase;
  const totalCartera      = carteraActivos.reduce((s, c) => s + (c.monto ?? 0), 0);
  const totalCuotaMensual = carteraActivos.reduce((s, c) => s + (c.cuotaMensual ?? 0), 0);
  const plazoPromedio     = carteraActivos.length > 0
    ? Math.round(carteraActivos.reduce((s, c) => s + (c.plazo ?? 0), 0) / carteraActivos.length)
    : 0;
  const creditosConTasa   = carteraActivos.filter(c => (c.tasaInteres ?? 0) > 0);
  const tasaPromedio      = creditosConTasa.length > 0
    ? creditosConTasa.reduce((s, c) => s + (c.tasaInteres ?? 0), 0) / creditosConTasa.length
    : 0;
  const countByEstado     = ESTADOS_APROBACION.reduce((acc, e) => {
    acc[e.value] = carteraActivos.filter(c => c.estadoAprobacion === e.value).length;
    return acc;
  }, {} as Record<string, number>);

  // ── Vista del asociado: lista y resumen personal ──────────────────────────
  const misCreditosBase = useMemo(() =>
    creditos.filter(c =>
      (userData?.id && c.asociado_id === userData.id) ||
      (userData?.cedula && c.cedula === userData.cedula)
    ),
    [creditos, userData]
  );

  const misCreditosFiltrados = useMemo(() => {
    return misCreditosBase.filter(c => {
      const isFinalizado = c.estadoAprobacion === 'pagado' || c.estadoAprobacion === 'rechazado' || c.anulado;
      if (asocTabFilter === 'finalizados') {
        return isFinalizado;
      }
      return !isFinalizado;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [misCreditosBase, asocTabFilter]);

  // Resumen personal
  const misActivos     = misCreditosBase.filter(c => !c.anulado);
  const miSaldoTotal   = misActivos.reduce((s, c) => s + (c.saldo ?? 0), 0);
  const miCuotaMensual = misActivos
    .filter(c => ['activo', 'desembolsado', 'en_mora'].includes(c.estadoAprobacion))
    .reduce((s, c) => s + (c.cuotaMensual ?? 0), 0);
  const misEnMora      = misActivos.filter(c => c.estadoAprobacion === 'en_mora').length;

  // ── Cuota preview (formulario) ────────────────────────────────────────────
  const _monto = parseMonto(formMonto);
  const _tasa  = parseFloat(formTasa)  || 0;
  const _plazo = parseInt(formPlazo)   || 0;
  const cuotaPreview = formTipoInteres === 'simple'
    ? calcularCuotaSimple(_monto, _tasa, _plazo)
    : calcularCuota(_monto, _tasa, _plazo);

  return {
    esVistaPropia,
    creditosBase,
    filteredCreditos,
    filteredRechazados,
    creditosAnulados,
    filteredAnulados,
    totalPages, startIndex, currentList,
    totalPagesAn, startIndexAn, currentAnulados,
    totalPagesRec, startIndexRec, currentRechazados,
    carteraActivos,
    totalCartera,
    totalCuotaMensual,
    plazoPromedio,
    tasaPromedio,
    countByEstado,
    misCreditosBase,
    misCreditosFiltrados,
    misActivos,
    miSaldoTotal,
    miCuotaMensual,
    misEnMora,
    cuotaPreview,
  };
}
