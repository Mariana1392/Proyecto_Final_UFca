import { useState, useEffect } from 'react';
import PiggyBankLoader from '../ui/PiggyBankLoader';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '../../lib/supabase';
import {
  Search, Plus, ChevronLeft, ChevronRight,
  CreditCard, FileText,
  DollarSign, Clock, X, BarChart2, Download,
  Banknote, CheckCircle2, Percent,
  Landmark, XCircle, TrendingUp, Wallet, Users, Activity,
  PieChart, Table2, Check, FileSpreadsheet, AlertTriangle, Eye,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import {
  AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialog,
} from '../ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { generateCreditosPDF } from '../utils/pdfGenerator';
import { formatCurrency } from '../../lib/formatters';
import { TIPOS_CREDITO } from '../../lib/constants';
import { useCreditos } from './useCreditos';
import { ESTADOS_APROBACION, calcularCuota, descargarPDFAmortizacion } from './creditoHelpers';
import CreditoTabla from './CreditoTabla';
import CreditoDialogCrear from './CreditoDialogCrear';
import CreditoDialogSimulacion from './CreditoDialogSimulacion';
import CreditoDialogDetalle from './CreditoDialogDetalle';
import CreditoDialogPago from './CreditoDialogPago';
import CreditoDialogDesembolso from './CreditoDialogDesembolso';
import CreditoDialogsConfirmacion from './CreditoDialogsConfirmacion';
import CreditoVistaAsociado from './CreditoVistaAsociado';

interface CreditosProps {
  userData?: any;
}

// Mapa tipo → clave en configuracion
const TIPO_TASA: Record<string, string> = {
  libre_inversion: 'tasa_libre_inversion',
  educacion:       'tasa_educacion',
  vivienda:        'tasa_vivienda',
  calamidad:       'tasa_calamidad',
};

export default function Creditos({ userData }: CreditosProps) {
  const hook = useCreditos(userData);

  // Tasas parametrizadas para mostrar simulación correcta en solicitudes
  const [tasasAdmin, setTasasAdmin] = useState<Record<string, number>>({});
  // Tipo de interés decidido por el admin por cada solicitud (id → 'simple' | 'compuesto')
  const [tipoInteresAdmin, setTipoInteresAdmin] = useState<Record<string, 'simple' | 'compuesto'>>({});
  const [montoAprobadoAdmin, setMontoAprobadoAdmin] = useState<Record<string, string>>({});
  const [plazoAprobadoAdmin, setPlazoAprobadoAdmin] = useState<Record<string, string>>({});
  const [tasaAprobadaAdmin, setTasaAprobadaAdmin] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('configuracion').select('clave, valor')
      .in('clave', Object.values(TIPO_TASA))
      .then(({ data }) => {
        const mapa: Record<string, number> = {};
        (data ?? []).forEach((r: any) => { mapa[r.clave] = parseFloat(r.valor) || 0; });
        setTasasAdmin(mapa);
      });
  }, []);
  const {
    loading,
    esVistaPropia,
    // KPI
    carteraActivos,
    creditosAnulados,
    totalCartera,
    totalCuotaMensual,
    countByEstado,
    tasaPromedio,
    plazoPromedio,
    // Filtros y búsqueda
    creditos,
    searchTerm, setSearchTerm,
    filterEstado, setFilterEstado,
    showSearchSugg, setShowSearchSugg,
    searchRef,
    // Paginación activos
    filteredCreditos,
    currentList,
    currentPage, setCurrentPage,
    totalPages,
    startIndex,
    itemsPerPage,
    // Paginación rechazados
    filteredRechazados,
    currentRechazados,
    currentPageRechazados, setCurrentPageRechazados,
    totalPagesRec,
    startIndexRec,
    // Paginación anulados
    filteredAnulados,
    currentAnulados,
    currentPageAnulados, setCurrentPageAnulados,
    totalPagesAn,
    startIndexAn,
    // Tabs extra
    solicitudesCredito,
    creditosSimulacion,
    // Acciones
    handleOpenCreate,
    handlePonerEnRevision,
    handleAprobarSolicitudCredito,
    setSolicitudSeleccionada,
    setNotaRechazoSol,
    setIsRechazarSolOpen,
    // Informe
    isInformeDialogOpen, setIsInformeDialogOpen,
    // SimDetalle (admin)
    simDetalleData,
    isSimDetalleOpen, setIsSimDetalleOpen,
    setSimSeleccionada,
    setIsConfirmSimOpen,
    setIsRechazarSimOpen,
    simSeleccionada,
  } = hook;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PiggyBankLoader title="Cargando créditos..." />
      </div>
    );
  }

  const renderPagination = (total: number, page: number, setPage: (p: number) => void, count: number, start: number) => (
    <div className="flex items-center justify-between mt-3">
      <p className="text-sm text-slate-600">
        Mostrando {count === 0 ? 0 : start + 1} a {Math.min(start + itemsPerPage, count)} de {count}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
          <ChevronLeft className="size-4" />
        </Button>
        {Array.from({ length: total }, (_, i) => i + 1).map(p => (
          <Button key={p} variant={page === p ? 'default' : 'outline'} size="sm"
            onClick={() => setPage(p)} className={page === p ? 'bg-blue-600 hover:bg-blue-700' : ''}>{p}</Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => setPage(Math.min(total, page + 1))} disabled={page === total}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );

  // ── Exportar cartera completa a CSV ──────────────────────────────────────
  const exportarCarteraCSV = () => {
    const headers = [
      'N° Crédito', 'Asociado', 'Cédula', 'Tipo', 'Monto', 'Saldo',
      'Tasa EA (%)', 'Plazo (meses)', 'Cuota Mensual', 'Estado', 'Fecha Desembolso',
    ];
    const rows = filteredCreditos.map(c => [
      `CRE-${String(c.id).substring(0, 8).toUpperCase()}`,
      c.asociado,
      c.cedula,
      TIPOS_CREDITO.find(t => t.value === c.tipo)?.label ?? c.tipo,
      c.monto ?? 0,
      c.saldo ?? 0,
      c.tasaInteres ?? 0,
      c.plazo ?? 0,
      c.cuotaMensual ?? 0,
      ESTADOS_APROBACION.find(e => e.value === c.estadoAprobacion)?.label ?? c.estadoAprobacion,
      c.fechaDesembolso ?? '',
    ]);
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Creditos_UFCA_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('📊 Créditos exportados a CSV', {
      description: `${filteredCreditos.length} crédito${filteredCreditos.length !== 1 ? 's' : ''} exportado${filteredCreditos.length !== 1 ? 's' : ''}`,
    });
  };

  // ── Ruta exclusiva para la vista propia del asociado ─────────────────────
  if (esVistaPropia) return <CreditoVistaAsociado hook={hook} userData={userData} />;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Gestión de Créditos</h1>
            <p className="text-slate-600">
              {esVistaPropia ? 'Consulta tus créditos' : 'Administra los créditos de los asociados'}
            </p>
          </div>
          {!esVistaPropia && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={exportarCarteraCSV}
                title="Exportar la lista de créditos visible a CSV"
              >
                <FileSpreadsheet className="size-4" /> Exportar CSV
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => setIsInformeDialogOpen(true)}
              >
                <BarChart2 className="size-4" /> Informe de desempeño de créditos
              </Button>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => handleOpenCreate()}>
                <Plus className="size-4" /> Nuevo crédito
              </Button>
            </div>
          )}
        </div>

        {/* ── Resumen de créditos ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Card 1 — Créditos activos + distribución por estado */}
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Créditos activos
                  </p>
                  <p className="text-3xl font-bold text-slate-900">{carteraActivos.length}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {creditosAnulados.length} anulado{creditosAnulados.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50">
                  <Users className="size-5 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex gap-1.5 flex-wrap">
                {ESTADOS_APROBACION.filter(e => countByEstado[e.value] > 0).map(e => (
                  <span key={e.value}
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${e.color}`}>
                    {countByEstado[e.value]} {e.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Card 2 — Cartera total = suma de montos otorgados */}
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Saldo total
                  </p>
                  <p className="text-2xl font-bold text-indigo-700">
                    {formatCurrency(totalCartera)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Capital otorgado en {carteraActivos.length} crédito{carteraActivos.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50">
                  <Wallet className="size-5 text-indigo-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5">
                <DollarSign className="size-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">
                  Promedio por crédito:{' '}
                  <span className="font-semibold text-slate-700">
                    {carteraActivos.length > 0
                      ? formatCurrency(Math.round(totalCartera / carteraActivos.length))
                      : '—'}
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3 — Cuota mensual total (lo que ingresa cada mes) */}
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Recaudo mensual
                  </p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {formatCurrency(totalCuotaMensual)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Suma de cuotas mensuales activas
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50">
                  <Activity className="size-5 text-emerald-600" />
                </div>
              </div>
              {/* Relación cuota / cartera: qué % de la cartera se recauda cada mes */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Cuota / Crédito</span>
                  <span>
                    {totalCartera > 0
                      ? `${((totalCuotaMensual / totalCartera) * 100).toFixed(2)}% mensual`
                      : '—'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{
                      width: totalCartera > 0
                        ? `${Math.min(100, (totalCuotaMensual / totalCartera) * 100 * 10).toFixed(1)}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4 — Créditos en mora */}
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    En mora
                  </p>
                  <p className={`text-3xl font-bold ${(countByEstado['en_mora'] ?? 0) > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {countByEstado['en_mora'] ?? 0}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {carteraActivos.length > 0
                      ? `${(((countByEstado['en_mora'] ?? 0) / carteraActivos.length) * 100).toFixed(1)}% de los créditos`
                      : 'Sin créditos activos'}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${(countByEstado['en_mora'] ?? 0) > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                  <AlertTriangle className={`size-5 ${(countByEstado['en_mora'] ?? 0) > 0 ? 'text-red-500' : 'text-slate-400'}`} />
                </div>
              </div>
              <div className="mt-3">
                {(countByEstado['en_mora'] ?? 0) > 0 ? (
                  <button
                    className="text-xs text-red-600 font-medium underline underline-offset-2 hover:text-red-800"
                    onClick={() => { setFilterEstado('en_mora'); setCurrentPage(1); }}
                  >
                    Ver créditos en mora →
                  </button>
                ) : (
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Créditos al día
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── Tabla ── */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <CardTitle>Lista de Créditos</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                {/* Buscador con autocompletado */}
                <div className="relative flex-1 sm:flex-none sm:w-64" ref={searchRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10" />
                  {searchTerm && (
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
                      onClick={() => { setSearchTerm(''); setCurrentPage(1); setShowSearchSugg(false); }}>
                      <X className="size-3.5" />
                    </button>
                  )}
                  <Input placeholder="Buscar por nombre o cédula..." className="pl-10 pr-8"
                    value={searchTerm} autoComplete="off"
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setShowSearchSugg(true); }}
                    onFocus={() => setShowSearchSugg(true)}
                  />
                  {showSearchSugg && searchTerm.trim().length > 0 && (() => {
                    const term = searchTerm.toLowerCase();
                    const seen = new Set<string>();
                    const sugs = creditos.filter(c => {
                      const match = c.asociado.toLowerCase().includes(term) || c.cedula.includes(searchTerm);
                      if (!match || seen.has(c.asociado_id)) return false;
                      seen.add(c.asociado_id); return true;
                    }).slice(0, 6);
                    if (!sugs.length) return null;
                    return (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                        <p className="text-xs text-slate-400 px-3 pt-2 pb-1 border-b border-slate-100">Asociados con crédito</p>
                        {sugs.map(s => (
                          <button key={s.asociado_id} type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between group"
                            onMouseDown={() => { setSearchTerm(s.asociado); setCurrentPage(1); setShowSearchSugg(false); }}>
                            <div className="flex items-center gap-2">
                              <CreditCard className="size-3.5 text-blue-400" />
                              <span className="text-sm font-medium text-slate-800 group-hover:text-blue-700">{s.asociado}</span>
                            </div>
                            <span className="text-xs text-slate-400">{s.cedula}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Filtro por estado de aprobación */}
                <Select value={filterEstado} onValueChange={(v) => { setFilterEstado(v === 'todos' ? '' : v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Aprobación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {ESTADOS_APROBACION.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="activos">
              <TabsList className="grid w-full grid-cols-5 mb-4">
                <TabsTrigger value="activos" className="gap-2">
                  <CreditCard className="size-4" /> Activos ({filteredCreditos.length})
                </TabsTrigger>
                <TabsTrigger value="rechazados" className="gap-2">
                  <XCircle className="size-4" /> Rechazados ({filteredRechazados.length})
                </TabsTrigger>
                <TabsTrigger value="anulados" className="gap-2">
                  <FileText className="size-4" /> Anulados ({filteredAnulados.length})
                </TabsTrigger>
                <TabsTrigger value="solicitudes" className="gap-2 relative">
                  <Clock className="size-4" /> Solicitudes
                  {solicitudesCredito.length > 0 && (
                    <span className="absolute -top-1 -right-1 size-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {solicitudesCredito.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="simulaciones" className="gap-2 relative">
                  <BarChart2 className="size-4" /> Simulaciones
                  {creditosSimulacion.length > 0 && (
                    <span className="absolute -top-1 -right-1 size-4 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {creditosSimulacion.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="activos" className="space-y-3">
                <CreditoTabla list={currentList} hook={hook} />
                {filteredCreditos.length > 0 && renderPagination(totalPages, currentPage, setCurrentPage, filteredCreditos.length, startIndex)}
              </TabsContent>
              <TabsContent value="rechazados" className="space-y-3">
                {filteredRechazados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                    <div className="p-4 bg-slate-100 rounded-full">
                      <XCircle className="size-8 text-slate-300" />
                    </div>
                    <p className="font-semibold text-slate-500">Sin créditos rechazados</p>
                    <p className="text-sm">Los créditos con estado rechazado aparecerán aquí.</p>
                  </div>
                ) : (
                  <>
                    <CreditoTabla list={currentRechazados} hook={hook} />
                    {filteredRechazados.length > 0 && renderPagination(totalPagesRec, currentPageRechazados, setCurrentPageRechazados, filteredRechazados.length, startIndexRec)}
                  </>
                )}
              </TabsContent>
              <TabsContent value="anulados" className="space-y-3">
                <CreditoTabla list={currentAnulados} isAnulados hook={hook} />
                {filteredAnulados.length > 0 && renderPagination(totalPagesAn, currentPageAnulados, setCurrentPageAnulados, filteredAnulados.length, startIndexAn)}
              </TabsContent>
              <TabsContent value="solicitudes">
                {solicitudesCredito.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                    <div className="p-4 bg-slate-100 rounded-full">
                      <CheckCircle2 className="size-8 text-slate-300" />
                    </div>
                    <p className="font-semibold text-slate-500">No hay solicitudes pendientes</p>
                    <p className="text-sm">Cuando los asociados soliciten créditos aparecerán aquí.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {solicitudesCredito.map(sol => {
                      // Usar tasa guardada; si es 0 o nula, usar la parametrizada para ese tipo
                      const tasaGuardada  = sol.tasaInteres ?? 0;
                      const claveTasa     = TIPO_TASA[sol.tipo] ?? '';
<<<<<<< HEAD
                      const defaultTasa   = tasaGuardada > 0 ? tasaGuardada : (tasasAdmin[claveTasa] ?? 0);

                      const valMonto = montoAprobadoAdmin[sol.id] ?? sol.monto.toLocaleString('es-CO');
                      const valPlazo = plazoAprobadoAdmin[sol.id] ?? String(sol.plazoMeses);
                      const valTasa  = tasaAprobadaAdmin[sol.id] ?? String(defaultTasa);

                      const montoNum = parseInt(valMonto.replace(/\./g, '').replace(/[^\d]/g, ''), 10) || 0;
                      const plazoNum = parseInt(valPlazo, 10) || 0;
                      const tasaNum  = parseFloat(valTasa) || 0;

                      const tipoInt       = tipoInteresAdmin[sol.id] ?? 'compuesto';
                      const r             = tasaNum > 0 ? (Math.pow(1 + tasaNum / 100, 1 / 12) - 1) : 0;
=======
                      const tasa          = tasaGuardada > 0 ? tasaGuardada : (tasasAdmin[claveTasa] ?? 0);
                      const tipoInt       = tipoInteresAdmin[sol.id] ?? sol.tipoInteres ?? 'compuesto';
                      const r             = tasa > 0 ? (Math.pow(1 + tasa / 100, 1 / 12) - 1) : 0;
>>>>>>> 1093451be53ebfdf5c4c9930d8bc58eb11bc0173
                      const cuotaEst      = tipoInt === 'simple'
                        ? (tasaNum > 0 ? Math.round(montoNum / plazoNum + montoNum * r) : Math.round(montoNum / plazoNum))
                        : calcularCuota(montoNum, tasaNum, plazoNum);
                      const totalPag   = cuotaEst * plazoNum;
                      const totalInt   = totalPag - montoNum;
                      const tablaAmort = (() => {
                        const rows = [];
                        let saldo = montoNum;
                        for (let i = 1; i <= plazoNum; i++) {
                          let interes: number; let capital: number;
                          if (tipoInt === 'simple') {
                            interes = Math.round(montoNum * r);
                            capital = i < plazoNum ? Math.round(montoNum / plazoNum) : saldo;
                          } else {
                            interes = Math.round(saldo * r);
                            capital = Math.min(cuotaEst - interes, saldo);
                          }
                          saldo = Math.max(0, saldo - capital);
                          rows.push({ n: i, interes, capital, saldo, cuota: cuotaEst });
                        }
                        return rows;
                      })();
                      const enRevision = sol.estadoAprobacion === 'en_revision';
                      return (
                        <Card key={sol.id} className={`border ${enRevision ? 'border-blue-200 bg-blue-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                          <CardContent className="p-4 space-y-4">

                            {/* Encabezado asociado + estado + acciones */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900">{sol.asociado}</span>
                                  <span className="text-xs text-slate-400">{sol.cedula}</span>
                                  {enRevision
                                    ? <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-[11px]">En revisión</Badge>
                                    : <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[11px]">Pendiente</Badge>
                                  }
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  Solicitado: {new Date(sol.createdAt).toLocaleString('es-CO', {
                                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <div className="flex flex-col gap-2 shrink-0">
                                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleAprobarSolicitudCredito(sol, tipoInt, montoNum, tasaNum, plazoNum)}>
                                  <Check className="size-3.5" /> Aprobar
                                </Button>
                                {!enRevision && (
                                  <Button size="sm" variant="outline" className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                                    onClick={() => handlePonerEnRevision(sol)}>
                                    <Eye className="size-3.5" /> Revisar
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={() => { setSolicitudSeleccionada(sol); setNotaRechazoSol(''); setIsRechazarSolOpen(true); }}>
                                  <X className="size-3.5" /> Rechazar
                                </Button>
                              </div>
                            </div>

                            {/* Ajuste de condiciones de crédito por el administrador */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Ajustar condiciones para aprobación</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <span className="text-[11px] text-slate-500 font-medium block">Monto Aprobado ($)</span>
                                  <Input
                                    value={valMonto}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                                      const formatted = raw ? parseInt(raw, 10).toLocaleString('es-CO') : '';
                                      setMontoAprobadoAdmin(prev => ({ ...prev, [sol.id]: formatted }));
                                    }}
                                    className="h-8 text-xs bg-white dark:bg-slate-900"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[11px] text-slate-500 font-medium block">Plazo (meses)</span>
                                  <Input
                                    type="number"
                                    value={valPlazo}
                                    onChange={(e) => setPlazoAprobadoAdmin(prev => ({ ...prev, [sol.id]: e.target.value }))}
                                    className="h-8 text-xs bg-white dark:bg-slate-900"
                                    min={1}
                                    max={12}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[11px] text-slate-500 font-medium block">Tasa de interés (% EA)</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={valTasa}
                                    onChange={(e) => setTasaAprobadaAdmin(prev => ({ ...prev, [sol.id]: e.target.value }))}
                                    className="h-8 text-xs bg-white dark:bg-slate-900"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Selector tipo de interés — decisión del admin */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-200">
                              <div className="p-1.5 bg-violet-100 rounded-lg shrink-0">
                                <Percent className="size-4 text-violet-600" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-violet-800 mb-1">Tipo de interés — decisión del administrador</p>
                                <div className="flex gap-2">
                                  {(['compuesto', 'simple'] as const).map(tipo => (
                                    <button
                                      key={tipo}
                                      onClick={() => setTipoInteresAdmin(prev => ({ ...prev, [sol.id]: tipo }))}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                        tipoInt === tipo
                                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                                          : 'bg-white text-violet-700 border-violet-200 hover:bg-violet-50'
                                      }`}
                                    >
                                      {tipo === 'compuesto' ? '📈 Interés compuesto (Francés)' : '📊 Interés simple'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Alerta de límite de ahorros para el Administrador */}
                            {montoNum > sol.totalAhorrosAsociado && (
                              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 mt-2 mb-2">
                                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                                <div>
                                  <h4 className="font-bold text-xs">Límite de préstamo excedido</h4>
                                  <p className="text-[11px] mt-0.5">
                                    El monto aprobado ({formatCurrency(montoNum)}) excede el total de los ahorros del asociado ({formatCurrency(sol.totalAhorrosAsociado)}).
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* KPIs financieros */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              {[
                                { l: 'Tipo',          v: sol.tipoCreditoLabel,       c: 'text-slate-700' },
                                { l: 'Monto',         v: formatCurrency(montoNum),  c: 'text-indigo-700 font-bold' },
                                { l: 'Plazo',         v: `${plazoNum} meses`,  c: 'text-slate-700' },
                                { l: tasaNum > 0 ? 'Tasa EA' : 'Tasa', v: tasaNum > 0 ? `${tasaNum}%` : 'Sin tasa', c: 'text-orange-600' },
                                { l: 'Cuota mensual', v: formatCurrency(cuotaEst),   c: 'text-emerald-700 font-bold' },
                              ].map(k => (
                                <div key={k.l} className="bg-white rounded-lg border border-slate-100 px-3 py-2 text-center">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{k.l}</p>
                                  <p className={`text-sm mt-0.5 ${k.c}`}>{k.v}</p>
                                </div>
                              ))}
                            </div>

                            {/* Totales */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-center">
                                <p className="text-[10px] text-amber-500 uppercase tracking-wide">Total intereses</p>
                                <p className="text-sm font-bold text-amber-700">{formatCurrency(totalInt)}</p>
                              </div>
                              <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-center">
                                <p className="text-[10px] text-indigo-500 uppercase tracking-wide">Total a pagar</p>
                                <p className="text-sm font-bold text-indigo-700">{formatCurrency(totalPag)}</p>
                              </div>
                            </div>

                            {/* Tabla de amortización colapsable */}
                            <details className="group">
                              <summary className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 select-none">
                                <Table2 className="size-3.5" />
                                Ver tabla de amortización ({plazoNum} cuotas)
                              </summary>
                              <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-800 text-white sticky top-0">
                                      <tr>
                                        {['#','Cuota','Interés','Capital','Saldo'].map(h => (
                                          <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {tablaAmort.map((f, idx) => (
                                        <tr key={f.n} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                          <td className="px-3 py-1.5 text-slate-400">{f.n}</td>
                                          <td className="px-3 py-1.5 font-medium text-purple-700 whitespace-nowrap">{formatCurrency(f.cuota)}</td>
                                          <td className="px-3 py-1.5 text-amber-600 whitespace-nowrap">{formatCurrency(f.interes)}</td>
                                          <td className="px-3 py-1.5 text-blue-600 whitespace-nowrap">{formatCurrency(f.capital)}</td>
                                          <td className="px-3 py-1.5 font-semibold whitespace-nowrap">{f.saldo === 0 ? <span className="text-emerald-600">Pagado</span> : formatCurrency(f.saldo)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </details>

                            {/* Observaciones / destino */}
                            {sol.descripcionSoporte && (
                              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                <span className="font-semibold text-slate-700">Observaciones: </span>
                                {sol.descripcionSoporte}
                              </div>
                            )}

                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ── Tab Simulaciones pendientes (admin) ── */}
              <TabsContent value="simulaciones">
                {creditosSimulacion.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    <BarChart2 className="size-10 mx-auto mb-3 opacity-30" />
                    No hay simulaciones pendientes de confirmación.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                      📊 Estas simulaciones fueron enviadas al asociado. <strong>El crédito se registrará solo cuando el asociado confirme.</strong> Si rechaza, se eliminará automáticamente.
                    </p>
                    {creditosSimulacion.map(sim => (
                      <div key={sim.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-purple-200 bg-purple-50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-purple-100 rounded-xl shrink-0">
                            <BarChart2 className="size-5 text-purple-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{sim.asociado}</p>
                            <p className="text-xs text-slate-500">{sim.cedula}</p>
                          </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-end text-right">
                          <p className="font-bold text-purple-700 text-sm">{formatCurrency(sim.monto)}</p>
                          <p className="text-xs text-slate-500">{sim.plazo} meses · {sim.tasaInteres}% {(sim.tipoInteres ?? 'compuesto') === 'simple' ? 'N.A.' : 'EA'}</p>
                        </div>
                        <div className="hidden md:block text-right">
                          <p className="font-semibold text-slate-700 text-sm">{formatCurrency(sim.cuotaMensual)}</p>
                          <p className="text-xs text-slate-400">cuota mensual</p>
                        </div>
                        <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-xs shrink-0">
                          Pendiente confirmación
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* ── Sub-componentes: todos los diálogos ── */}
      <CreditoDialogCrear hook={hook} />
      <CreditoDialogSimulacion hook={hook} />
      <CreditoDialogDetalle hook={hook} />
      <CreditoDialogPago hook={hook} />
      <CreditoDialogDesembolso hook={hook} />
      <CreditoDialogsConfirmacion hook={hook} />

      {/* ── Modal tabla completa de amortización (admin ve simulación enviada) ─── */}
      <Dialog open={isSimDetalleOpen} onOpenChange={setIsSimDetalleOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
          {simDetalleData && (() => {
            const { sim, tabla } = simDetalleData;
            const totalPagado   = sim.cuotaMensual * sim.plazo;
            const totalInteres  = totalPagado - sim.monto;
            const tipoLabel     = TIPOS_CREDITO.find(t => t.value === sim.tipo)?.label ?? sim.tipo;
            return (
              <>
                {/* Header visual */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white/20 rounded-xl">
                        <BarChart2 className="size-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-white font-black text-lg leading-tight">
                          {(sim.tipoInteres ?? 'compuesto') === 'simple' ? 'Tabla de Pagos — Interés Simple' : 'Tabla de Amortización Francesa'}
                        </h2>
                        <p className="text-purple-200 text-sm">{tipoLabel} · {sim.plazo} meses · {sim.tasaInteres}% {(sim.tipoInteres ?? 'compuesto') === 'simple' ? 'N.A.' : 'EA'}</p>
                      </div>
                    </div>
                    <button onClick={() => setIsSimDetalleOpen(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                      <X className="size-5 text-white" />
                    </button>
                  </div>

                  {/* KPIs en el header */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {[
                      { l: 'Monto',          v: formatCurrency(sim.monto) },
                      { l: 'Cuota mensual',  v: formatCurrency(sim.cuotaMensual) },
                      { l: 'Total intereses',v: formatCurrency(totalInteres) },
                      { l: 'Total a pagar',  v: formatCurrency(totalPagado) },
                    ].map(d => (
                      <div key={d.l} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
                        <p className="text-purple-200 text-[10px] uppercase tracking-wide font-medium">{d.l}</p>
                        <p className="text-white font-black text-sm mt-0.5">{d.v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabla completa */}
                <div className="px-6 py-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Table2 className="size-3.5" />
                    Plan de pagos completo — {tabla.length} cuotas
                  </p>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto" style={{ maxHeight: '45vh' }}>
                      <table className="w-full text-sm">
                        <thead className="bg-slate-800 text-white sticky top-0 z-10">
                          <tr>
                            {['N°', 'Fecha de pago', 'Cuota total', 'Interés', 'Capital', 'Saldo restante'].map(h => (
                              <th key={h} className="px-4 py-3 text-left font-semibold text-xs tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tabla.map((fila, idx) => (
                            <tr key={fila.numero}
                              className={`transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-purple-50/40' : 'bg-slate-50 hover:bg-purple-50/40'}`}>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-black">
                                  {fila.numero}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">{fila.fecha}</td>
                              <td className="px-4 py-3 font-black text-purple-700 whitespace-nowrap">{formatCurrency(fila.cuota)}</td>
                              <td className="px-4 py-3 text-amber-600 font-medium whitespace-nowrap">{formatCurrency(fila.interes)}</td>
                              <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap">{formatCurrency(fila.capital)}</td>
                              <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                                {fila.saldo === 0
                                  ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Pagado</span>
                                  : formatCurrency(fila.saldo)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-800 text-white sticky bottom-0">
                          <tr>
                            <td className="px-4 py-3 font-bold text-xs" colSpan={2}>TOTALES</td>
                            <td className="px-4 py-3 font-black text-purple-300 whitespace-nowrap">{formatCurrency(totalPagado)}</td>
                            <td className="px-4 py-3 font-bold text-amber-300 whitespace-nowrap">{formatCurrency(totalInteres)}</td>
                            <td className="px-4 py-3 font-bold text-blue-300 whitespace-nowrap">{formatCurrency(sim.monto)}</td>
                            <td className="px-4 py-3 font-bold text-emerald-300">$ 0</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer con acciones */}
                <div className="flex flex-col sm:flex-row gap-3 px-6 pb-6 pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    className="border-slate-400 text-slate-700 hover:bg-slate-50 gap-2"
                    onClick={() => descargarPDFAmortizacion(tabla, {
                      monto:          sim.monto,
                      tasa:           sim.tasaInteres,
                      plazo:          sim.plazo,
                      nombreAsociado: sim.asociado,
                      tipo:           tipoLabel,
                      tipoInteres:    sim.tipoInteres ?? 'compuesto',
                    })}
                  >
                    <Download className="size-4" /> Descargar PDF
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2 py-5"
                    onClick={() => {
                      setSimSeleccionada(sim);
                      setIsSimDetalleOpen(false);
                      setIsConfirmSimOpen(true);
                    }}
                  >
                    <Check className="size-5" />
                    <span className="font-bold">Confirmar y aceptar crédito</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2 py-5"
                    onClick={() => {
                      setSimSeleccionada(sim);
                      setIsSimDetalleOpen(false);
                      setIsRechazarSimOpen(true);
                    }}
                  >
                    <X className="size-5" />
                    <span className="font-bold">Rechazar simulación</span>
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Informe de desempeño de créditos ── */}
      <Dialog open={isInformeDialogOpen} onOpenChange={setIsInformeDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="size-5 text-emerald-600" />
              Informe de desempeño de créditos
            </DialogTitle>
            <DialogDescription>
              Vista previa del informe · {new Date().toLocaleDateString('es-CO', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const totalSolicitudes = carteraActivos.length + creditosAnulados.length;
            const desembolsados    = countByEstado['desembolsado'] ?? 0;
            const aprobados        = countByEstado['aprobado']     ?? 0;
            const pendientes       = countByEstado['pendiente']    ?? 0;
            const rechazados       = countByEstado['rechazado']    ?? 0;
            const enRevision       = countByEstado['en_revision']  ?? 0;
            const promedioCuota    = carteraActivos.length > 0
              ? Math.round(totalCuotaMensual / carteraActivos.length) : 0;
            const promedioMonto    = carteraActivos.length > 0
              ? Math.round(totalCartera / carteraActivos.length) : 0;
            const pctRecuperacion  = totalCartera > 0
              ? ((totalCuotaMensual / totalCartera) * 100).toFixed(2) : '0.00';
            const tasaAprobacion   = totalSolicitudes > 0
              ? (((desembolsados + aprobados) / totalSolicitudes) * 100).toFixed(1) : '0.0';
            const tasaRechazo      = totalSolicitudes > 0
              ? ((rechazados / totalSolicitudes) * 100).toFixed(1) : '0.0';

            return (
              <div className="space-y-5 py-1">

                {/* ── Sección 1: Resumen general ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                      <Wallet className="size-4 text-indigo-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                      1. Resumen general
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Créditos activos',       value: `${carteraActivos.length}`,          color: 'bg-blue-50 border-blue-100',    text: 'text-blue-700' },
                      { label: 'Créditos anulados',      value: `${creditosAnulados.length}`,         color: 'bg-red-50 border-red-100',      text: 'text-red-700' },
                      { label: 'Saldo total',            value: formatCurrency(totalCartera),         color: 'bg-indigo-50 border-indigo-100', text: 'text-indigo-700' },
                      { label: 'Recaudo mensual',        value: formatCurrency(totalCuotaMensual),    color: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
                      { label: 'Monto promedio',         value: formatCurrency(promedioMonto),        color: 'bg-slate-50 border-slate-200',  text: 'text-slate-700' },
                      { label: 'Cuota promedio',         value: formatCurrency(promedioCuota),        color: 'bg-slate-50 border-slate-200',  text: 'text-slate-700' },
                    ].map(({ label, value, color, text }) => (
                      <div key={label} className={`p-3 rounded-xl border ${color}`}>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                        <p className={`text-lg font-bold ${text}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Barra cuota / cartera */}
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                      <span className="font-semibold">Velocidad de recuperación mensual</span>
                      <span className="font-bold text-emerald-700">{pctRecuperacion}% mensual</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min(100, parseFloat(pctRecuperacion) * 10)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Cada mes se recauda el {pctRecuperacion}% del capital total
                    </p>
                  </div>
                </div>

                {/* ── Sección 2: Distribución por estado ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-orange-100 rounded-lg">
                      <PieChart className="size-4 text-orange-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                      2. Distribución por estado de aprobación
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Cant.</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">% del total</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Monto</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Cuota mensual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ESTADOS_APROBACION.map((e) => {
                          const count       = countByEstado[e.value] ?? 0;
                          const enEstado    = carteraActivos.filter(c => c.estadoAprobacion === e.value);
                          const montoE      = enEstado.reduce((s, c) => s + (c.monto ?? 0), 0);
                          const cuotaE      = enEstado.reduce((s, c) => s + (c.cuotaMensual ?? 0), 0);
                          const pct         = carteraActivos.length > 0
                            ? ((count / carteraActivos.length) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={e.value} className="border-b border-slate-100 last:border-0">
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${e.color}`}>
                                  {e.label}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{count}</td>
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-400 rounded-full"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-500">{pct}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium text-slate-700">{formatCurrency(montoE)}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-emerald-700">{formatCurrency(cuotaE)}</td>
                            </tr>
                          );
                        })}
                        {/* Fila de totales */}
                        <tr className="bg-slate-50 font-bold">
                          <td className="px-3 py-2.5 text-slate-700">TOTAL</td>
                          <td className="px-3 py-2.5 text-center text-slate-900">{carteraActivos.length}</td>
                          <td className="px-3 py-2.5 text-center text-slate-500">100%</td>
                          <td className="px-3 py-2.5 text-right text-indigo-700">{formatCurrency(totalCartera)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-700">{formatCurrency(totalCuotaMensual)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Sección 3: Indicadores de desempeño ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <TrendingUp className="size-4 text-blue-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                      3. Indicadores de desempeño
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        label: 'Tasa de aprobación',
                        value: `${tasaAprobacion}%`,
                        sub:   `${desembolsados + aprobados} de ${totalSolicitudes} solicitudes`,
                        color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100',
                      },
                      {
                        label: 'Tasa de rechazo',
                        value: `${tasaRechazo}%`,
                        sub:   `${rechazados} solicitudes rechazadas`,
                        color: 'text-red-700', bg: 'bg-red-50 border-red-100',
                      },
                      {
                        label: 'Créditos en proceso',
                        value: `${pendientes + enRevision}`,
                        sub:   `${pendientes} pendientes · ${enRevision} en revisión`,
                        color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-100',
                      },
                      {
                        label: 'Créditos productivos',
                        value: `${aprobados + desembolsados}`,
                        sub:   `${aprobados} aprobados · ${desembolsados} desembolsados`,
                        color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100',
                      },
                      {
                        label: 'Tasa de interés promedio EA',
                        value: tasaPromedio > 0 ? `${tasaPromedio.toFixed(2)}%` : 'Sin tasa',
                        sub:   `Sobre ${carteraActivos.filter(c => (c.tasaInteres ?? 0) > 0).length} créditos con tasa`,
                        color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100',
                      },
                      {
                        label: 'Plazo promedio',
                        value: plazoPromedio > 0 ? `${plazoPromedio} meses` : '—',
                        sub:   'Promedio de todos los créditos activos',
                        color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100',
                      },
                    ].map(({ label, value, sub, color, bg }) => (
                      <div key={label} className={`p-3 rounded-xl border ${bg} flex items-start justify-between gap-3`}>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                          <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Sección 4: Distribución por tipo de crédito ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-purple-100 rounded-lg">
                      <CreditCard className="size-4 text-purple-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                      4. Distribución por tipo de crédito
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left   px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Tipo</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Cant.</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">% créditos</th>
                          <th className="text-right  px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Saldo total</th>
                          <th className="text-right  px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Cuota mensual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TIPOS_CREDITO.map(tipo => {
                          const enTipo = carteraActivos.filter(c => c.tipo === tipo.value);
                          const count  = enTipo.length;
                          if (count === 0) return null;
                          const montoT = enTipo.reduce((s, c) => s + (c.monto ?? 0), 0);
                          const cuotaT = enTipo.reduce((s, c) => s + (c.cuotaMensual ?? 0), 0);
                          const pct    = carteraActivos.length > 0
                            ? ((count / carteraActivos.length) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={tipo.value} className="border-b border-slate-100 last:border-0">
                              <td className="px-3 py-2.5 font-medium text-slate-700">{tipo.label}</td>
                              <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{count}</td>
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-400 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-slate-500">{pct}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium text-indigo-700">{formatCurrency(montoT)}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-emerald-700">{formatCurrency(cuotaT)}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50 font-bold border-t border-slate-200">
                          <td className="px-3 py-2.5 text-slate-700">TOTAL</td>
                          <td className="px-3 py-2.5 text-center text-slate-900">{carteraActivos.length}</td>
                          <td className="px-3 py-2.5 text-center text-slate-500">100%</td>
                          <td className="px-3 py-2.5 text-right text-indigo-700">{formatCurrency(totalCartera)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-700">{formatCurrency(totalCuotaMensual)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            );
          })()}

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsInformeDialogOpen(false)}>
              Cerrar
            </Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                const ok = generateCreditosPDF({
                  creditos:         carteraActivos,
                  creditosAnulados: creditosAnulados,
                  totalCartera,
                  totalCuotaMensual,
                  tasaPromedio,
                  plazoPromedio,
                  countByEstado,
                  fechaInforme: new Date().toLocaleDateString('es-CO', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  }),
                });
                if (ok) {
                  toast.success('📊 Informe descargado correctamente');
                  setIsInformeDialogOpen(false);
                } else {
                  toast.error('Error al generar el PDF');
                }
              }}
            >
              <Download className="size-4" /> Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
