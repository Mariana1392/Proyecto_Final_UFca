import {
  Plus, Search, X, Calendar, CreditCard, BarChart2, Check, AlertTriangle,
  Eye, Banknote, FileText, Clock, Percent, Table2, Download, CheckCircle2,
  History, Users,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter,
} from '../ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { TIPOS_CREDITO } from '../../lib/constants';
import { formatCurrency } from '../../lib/formatters';
import {
  ESTADOS_APROBACION, getEstadoBadge, calcularCuota, calcularCuotaSimple,
  generarTablaAmortizacion, generarTablaAmortizacionSimple,
  descargarPDFAmortizacion, tasaEAaMensual,
} from './creditoHelpers';
import { generateCreditoPDF } from '../utils/pdfGenerator';
import { pagosCreditoApi } from '../../lib/api';
import { toast } from 'sonner';
import type { CreditosHook } from './useCreditos';

interface CreditoVistaAsociadoProps {
  hook: CreditosHook;
  userData?: any;
}

export default function CreditoVistaAsociado({ hook, userData }: CreditoVistaAsociadoProps) {
  const {
    creditosSimulacion,
    setSimDetalleData, setIsSimDetalleOpen,
    setSimSeleccionada, setIsConfirmSimOpen, setIsRechazarSimOpen,
    simDetalleData, isSimDetalleOpen,
    isConfirmSimOpen, simSeleccionada, confirmandoSim, handleConfirmarSimulacion,
    isRechazarSimOpen, rechazandoSim, handleRechazarSimulacion,
    misActivos, misCreditosBase, miSaldoTotal, miCuotaMensual, misEnMora,
    asocSearch, setAsocSearch,
    asocFilterEstado, setAsocFilterEstado,
    asocSortBy, setAsocSortBy,
    asocFechaDesde, setAsocFechaDesde,
    asocFechaHasta, setAsocFechaHasta,
    misCreditosFiltrados,
    setSelectedItem,
    setIsDetailDialogOpen,
    setLoadingHistorialDetalle,
    setHistorialDetalle,
    handleOpenPago,
    misSolicitudes,
    // Solicitud dialog
    isSolicitudDialogOpen, setIsSolicitudDialogOpen,
    solMonto, setSolMonto,
    solTipo, setSolTipo,
    solPlazo, setSolPlazo,
    solTasa, setSolTasa,
    solDestino, setSolDestino,
    solObs, setSolObs,
    solBanco, setSolBanco,
    solTipoCuenta, setSolTipoCuenta,
    solNumeroCuenta, setSolNumeroCuenta,
    parseMonto,
    tablaSolSim, setTablaSolSim,
    isSolSimOpen, setIsSolSimOpen,
    savingSolicitud,
    handleSolicitarCredito,
    // Detail dialog (asociado version shares the same state)
    isDetailDialogOpen,
    selectedItem,
    historialDetalle,
    loadingHistorialDetalle,
  } = hook;

  const hayFiltros = asocSearch.trim() || asocFilterEstado || asocFechaDesde || asocFechaHasta;

  return (
    <>
    <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Encabezado personal ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-slate-900 dark:text-slate-100 mb-1">Mis Créditos</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Bienvenido, <span className="font-semibold text-slate-700 dark:text-slate-200">{userData?.nombre ?? userData?.email}</span>
            </p>
          </div>
          <Button
            className="gap-2 bg-blue-600 hover:bg-blue-700 shrink-0"
            onClick={() => setIsSolicitudDialogOpen(true)}
          >
            <Plus className="size-4" /> Solicitar crédito
          </Button>
        </div>

        {/* ── Simulaciones pendientes de confirmación (asociado) ── */}
        {creditosSimulacion.filter(s =>
          (userData?.id && s.asociado_id === userData.id) ||
          (userData?.cedula && s.cedula === userData.cedula)
        ).length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-200">
              <div className="p-2 bg-white/20 rounded-xl shrink-0">
                <BarChart2 className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm leading-tight">Tienes simulaciones de crédito pendientes</p>
                <p className="text-purple-200 text-xs mt-0.5">Revisa la tabla de amortización y decide si aceptas o rechazas.</p>
              </div>
              <Badge className="bg-white text-purple-700 font-black shrink-0">
                {creditosSimulacion.filter(s =>
                  (userData?.id && s.asociado_id === userData.id) ||
                  (userData?.cedula && s.cedula === userData.cedula)
                ).length}
              </Badge>
            </div>

            {creditosSimulacion
              .filter(s =>
                (userData?.id && s.asociado_id === userData.id) ||
                (userData?.cedula && s.cedula === userData.cedula)
              )
              .map(sim => {
                const _fechaSim   = sim.fechaDesembolso || new Date().toISOString().split('T')[0];
                const tabla       = (sim.tipoInteres ?? 'compuesto') === 'simple'
                  ? generarTablaAmortizacionSimple(sim.monto, sim.tasaInteres, sim.plazo, _fechaSim)
                  : generarTablaAmortizacion(sim.monto, sim.tasaInteres, sim.plazo, _fechaSim);
                const totalPagado = sim.cuotaMensual * sim.plazo;
                const totalInteres = totalPagado - sim.monto;
                const tipoLabel   = TIPOS_CREDITO.find(t => t.value === sim.tipo)?.label ?? sim.tipo;
                return (
                  <div key={sim.id} className="bg-white rounded-2xl border-2 border-purple-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                          <CreditCard className="size-5 text-white" />
                        </div>
                        <div>
                          <p className="font-black text-white text-base leading-tight">Simulación de crédito</p>
                          <p className="text-purple-200 text-xs">{tipoLabel} · Pendiente de confirmación</p>
                        </div>
                      </div>
                      <Badge className="bg-white/20 text-white border-white/30 text-xs">Simulación</Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-purple-100">
                      {[
                        { l: 'Monto del crédito',  v: formatCurrency(sim.monto),         color: 'text-indigo-700' },
                        { l: 'Cuota mensual fija',  v: formatCurrency(sim.cuotaMensual),   color: 'text-purple-700' },
                        { l: 'Plazo',               v: `${sim.plazo} meses`,               color: 'text-slate-800' },
                        { l: 'Total intereses',     v: formatCurrency(totalInteres),        color: 'text-amber-600' },
                      ].map(d => (
                        <div key={d.l} className="px-4 py-3.5 text-center">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{d.l}</p>
                          <p className={`font-black text-base mt-1 ${d.color}`}>{d.v}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-4 px-5 py-3 bg-slate-50 border-t border-purple-100 text-xs text-slate-600">
                      <span><strong>{(sim.tipoInteres ?? 'compuesto') === 'simple' ? 'Tasa N.A.:' : 'Tasa EA:'}</strong> {sim.tasaInteres}%</span>
                      <span>·</span>
                      <span><strong>Total a pagar:</strong> {formatCurrency(totalPagado)}</span>
                      <span>·</span>
                      <span><strong>Tipo:</strong> {tipoLabel}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 px-5 py-4 border-t border-purple-100">
                      <Button
                        className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700"
                        onClick={() => {
                          setSimDetalleData({ sim, tabla });
                          setIsSimDetalleOpen(true);
                        }}
                      >
                        <Table2 className="size-4" />
                        {(sim.tipoInteres ?? 'compuesto') === 'simple' ? 'Ver tabla de pagos completa' : 'Ver tabla de amortización completa'}
                      </Button>
                      <Button
                        className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => { setSimSeleccionada(sim); setIsConfirmSimOpen(true); }}
                      >
                        <Check className="size-4" /> Confirmar crédito
                      </Button>
                      <Button
                        variant="outline"
                        className="sm:w-auto border-red-300 text-red-600 hover:bg-red-50 gap-2"
                        onClick={() => { setSimSeleccionada(sim); setIsRechazarSimOpen(true); }}
                      >
                        <X className="size-4" /> Rechazar
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* ── KPIs personales ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total créditos</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{misActivos.length}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                {misCreditosBase.filter(c => c.anulado).length} anulado{misCreditosBase.filter(c => c.anulado).length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Saldo total</p>
              <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400 mt-1">{formatCurrency(miSaldoTotal)}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Capital pendiente</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Cuota mensual</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">{miCuotaMensual > 0 ? formatCurrency(miCuotaMensual) : '—'}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Próximo pago</p>
            </CardContent>
          </Card>
          <Card className={`border-0 shadow-sm ${misEnMora > 0 ? 'bg-red-50 dark:bg-red-950' : 'bg-white dark:bg-slate-800'}`}>
            <CardContent className="p-4">
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${misEnMora > 0 ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>En mora</p>
              <p className={`text-2xl font-bold mt-1 ${misEnMora > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {misEnMora > 0 ? misEnMora : '✓'}
              </p>
              <p className={`text-[10px] mt-0.5 ${misEnMora > 0 ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {misEnMora > 0 ? `crédito${misEnMora !== 1 ? 's' : ''} vencido${misEnMora !== 1 ? 's' : ''}` : 'Al día'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Barra de búsqueda y filtros ── */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-800">
          <CardContent className="p-3 space-y-2.5">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                {asocSearch && (
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setAsocSearch('')}>
                    <X className="size-3.5" />
                  </button>
                )}
                <Input
                  className="pl-9 pr-8 h-9 text-sm"
                  placeholder="Buscar por N° crédito, estado, tipo o fecha…"
                  value={asocSearch}
                  autoComplete="off"
                  onChange={(e) => setAsocSearch(e.target.value)}
                />
              </div>

              <Select value={asocFilterEstado || 'todos'} onValueChange={(v) => setAsocFilterEstado(v === 'todos' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs w-36 shrink-0">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {ESTADOS_APROBACION.map(e => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                  <SelectItem value="anulado">Anulado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={asocSortBy} onValueChange={(v) => setAsocSortBy(v as any)}>
                <SelectTrigger className="h-9 text-xs w-40 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fecha_desc">Más reciente</SelectItem>
                  <SelectItem value="fecha_asc">Más antiguo</SelectItem>
                  <SelectItem value="estado">Estado A–Z</SelectItem>
                  <SelectItem value="monto_desc">Mayor monto</SelectItem>
                  <SelectItem value="monto_asc">Menor monto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 items-center">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">Periodo:</span>
              <div className="relative flex-1">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                <Input
                  type="date" className="pl-8 h-8 text-xs"
                  value={asocFechaDesde}
                  onChange={(e) => setAsocFechaDesde(e.target.value)}
                />
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">–</span>
              <div className="relative flex-1">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                <Input
                  type="date" className="pl-8 h-8 text-xs"
                  value={asocFechaHasta}
                  onChange={(e) => setAsocFechaHasta(e.target.value)}
                />
              </div>
              {hayFiltros && (
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0 whitespace-nowrap"
                  onClick={() => { setAsocSearch(''); setAsocFilterEstado(''); setAsocFechaDesde(''); setAsocFechaHasta(''); }}
                >
                  <X className="size-3" /> Limpiar
                </button>
              )}
              <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 ml-auto">
                {misCreditosFiltrados.length} crédito{misCreditosFiltrados.length !== 1 ? 's' : ''}
              </span>
            </div>

            {hayFiltros && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700">
                {asocSearch.trim() && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                    <Search className="size-2.5" />
                    "{asocSearch.trim()}"
                    <button onClick={() => setAsocSearch('')} className="ml-0.5 hover:text-blue-900">
                      <X className="size-2.5" />
                    </button>
                  </span>
                )}
                {asocFilterEstado && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                    Estado: {ESTADOS_APROBACION.find(e => e.value === asocFilterEstado)?.label ?? asocFilterEstado}
                    <button onClick={() => setAsocFilterEstado('')} className="ml-0.5 hover:text-indigo-900">
                      <X className="size-2.5" />
                    </button>
                  </span>
                )}
                {asocFechaDesde && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Desde: {asocFechaDesde}
                    <button onClick={() => setAsocFechaDesde('')} className="ml-0.5 hover:text-slate-900">
                      <X className="size-2.5" />
                    </button>
                  </span>
                )}
                {asocFechaHasta && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Hasta: {asocFechaHasta}
                    <button onClick={() => setAsocFechaHasta('')} className="ml-0.5 hover:text-slate-900">
                      <X className="size-2.5" />
                    </button>
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-0.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {misCreditosFiltrados.length === misCreditosBase.length
                  ? <><span className="font-semibold text-slate-700 dark:text-slate-200">{misCreditosBase.length}</span> crédito{misCreditosBase.length !== 1 ? 's' : ''} en total</>
                  : <><span className="font-semibold text-blue-700">{misCreditosFiltrados.length}</span> de <span className="font-semibold text-slate-700 dark:text-slate-200">{misCreditosBase.length}</span> crédito{misCreditosBase.length !== 1 ? 's' : ''} coinciden con la búsqueda</>
                }
              </p>
              {misCreditosFiltrados.length !== misCreditosBase.length && (
                <span className="text-[10px] text-slate-400">{misCreditosBase.length - misCreditosFiltrados.length} oculto{misCreditosBase.length - misCreditosFiltrados.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Lista de créditos ── */}
        {misCreditosFiltrados.length === 0 ? (
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800">
            <CardContent className="py-16 text-center">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className={`p-4 rounded-full ${hayFiltros ? 'bg-blue-50' : 'bg-slate-100'}`}>
                  <Search className={`size-8 ${hayFiltros ? 'text-blue-400' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-600 dark:text-slate-300">
                    {hayFiltros ? 'No se encontraron créditos' : 'No tienes créditos registrados'}
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                    {hayFiltros
                      ? 'Ningún crédito coincide con los criterios ingresados'
                      : 'Cuando se apruebe un crédito a tu nombre aparecerá aquí'}
                  </p>
                  {hayFiltros && asocSearch.trim() && (
                    <p className="text-xs text-slate-400 mt-1">
                      Búsqueda: <span className="font-semibold text-slate-600">"{asocSearch.trim()}"</span>
                    </p>
                  )}
                </div>
                {hayFiltros && (
                  <Button variant="outline" size="sm" className="mt-1 gap-1.5"
                    onClick={() => { setAsocSearch(''); setAsocFilterEstado(''); setAsocFechaDesde(''); setAsocFechaHasta(''); }}>
                    <X className="size-3.5" /> Limpiar filtros y ver todos
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {misCreditosFiltrados.map(c => {
              const numCredito   = `CRE-${String(c.id).substring(0, 8).toUpperCase()}`;
              const progreso     = c.plazo > 0 ? Math.max(0, Math.min(100, ((c.monto - c.saldo) / c.monto) * 100)) : 0;
              const cuotasPag    = c.cuotaMensual > 0 ? Math.max(0, Math.round((c.monto - c.saldo) / c.cuotaMensual)) : 0;
              const cuotasPend   = Math.max(0, (c.plazo ?? 0) - cuotasPag);
              const fechaBase    = c.fechaDesembolso ? new Date(c.fechaDesembolso + 'T00:00:00') : null;
              const fechaVenc    = fechaBase && c.plazo
                ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + c.plazo, fechaBase.getDate())
                : null;
              const fechaProx    = fechaBase && cuotasPag < c.plazo
                ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + cuotasPag + 1, fechaBase.getDate())
                : null;
              const hoy          = new Date(); hoy.setHours(0, 0, 0, 0);
              const diasMora     = c.estadoAprobacion === 'en_mora' && fechaProx && fechaProx < hoy
                ? Math.floor((hoy.getTime() - fechaProx.getTime()) / 86400000) : 0;
              const estadoConfig = ESTADOS_APROBACION.find(e => e.value === c.estadoAprobacion);

              return (
                <Card
                  key={c.id}
                  className={`border shadow-sm cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    c.anulado ? 'opacity-60 bg-slate-50 dark:bg-slate-800/50' :
                    c.estadoAprobacion === 'en_mora' ? 'border-red-200 bg-red-50/30 dark:bg-red-950/30 dark:border-red-800' :
                    c.estadoAprobacion === 'pagado'  ? 'border-emerald-200 bg-emerald-50/20 dark:bg-emerald-950/20 dark:border-emerald-800' :
                    'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                  onClick={async () => {
                    setSelectedItem(c);
                    setIsDetailDialogOpen(true);
                    setLoadingHistorialDetalle(true);
                    try {
                      const pagos = await pagosCreditoApi.getByCredito(c.id);
                      setHistorialDetalle(pagos ?? []);
                    } catch { setHistorialDetalle([]); }
                    finally { setLoadingHistorialDetalle(false); }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          c.anulado ? 'bg-slate-100' :
                          c.estadoAprobacion === 'en_mora' ? 'bg-red-100' :
                          c.estadoAprobacion === 'pagado'  ? 'bg-emerald-100' :
                          'bg-blue-50'
                        }`}>
                          <CreditCard className={`size-4 ${
                            c.anulado ? 'text-slate-400' :
                            c.estadoAprobacion === 'en_mora' ? 'text-red-500' :
                            c.estadoAprobacion === 'pagado'  ? 'text-emerald-600' :
                            'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider">{numCredito}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{TIPOS_CREDITO.find(t => t.value === c.tipo)?.label ?? 'Libre inversión'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.anulado
                          ? <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">Anulado</Badge>
                          : <Badge variant="outline" className={`text-[10px] ${estadoConfig?.color ?? ''}`}>{estadoConfig?.label ?? c.estadoAprobacion}</Badge>
                        }
                        {diasMora > 0 && (
                          <Badge className="bg-red-600 text-white text-[10px] gap-0.5">
                            <AlertTriangle className="size-2.5" /> {diasMora}d mora
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Monto aprobado</p>
                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{formatCurrency(c.monto)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Plazo</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{c.plazo} meses</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cuotas</p>
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                          {cuotasPag}<span className="text-xs font-normal text-slate-400 dark:text-slate-500"> pagadas</span>
                          {cuotasPend > 0 && <span className="text-xs font-semibold text-amber-600"> · {cuotasPend} pend.</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Saldo pendiente</p>
                        <p className={`text-sm font-bold ${c.saldo <= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                          {c.saldo <= 0 ? 'Pagado ✓' : formatCurrency(c.saldo)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                      {c.tasaInteres > 0 && (
                        <span className="flex items-center gap-1">
                          <Percent className="size-3 text-orange-400" />
                          <span>{c.tasaInteres}% {(c.tipoInteres ?? 'compuesto') === 'simple' ? 'N.A.' : 'EA'}</span>
                        </span>
                      )}
                      {c.fechaDesembolso && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 text-slate-400" />
                          Inicio: <span className="font-medium text-slate-600">{c.fechaDesembolso}</span>
                        </span>
                      )}
                      {fechaVenc && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-slate-400" />
                          Vence: <span className="font-medium text-slate-600">
                            {fechaVenc.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </span>
                      )}
                      {fechaProx && c.saldo > 0 && (
                        <span className={`flex items-center gap-1 ${diasMora > 0 ? 'text-red-500 font-medium' : ''}`}>
                          <Calendar className={`size-3 ${diasMora > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
                          {diasMora > 0 ? 'Vencida:' : 'Próx. cuota:'}{' '}
                          <span className="font-medium">
                            {fechaProx.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </span>
                      )}
                    </div>

                    {c.plazo > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-1">
                          <span>{cuotasPag} de {c.plazo} cuotas pagadas</span>
                          <span className="font-semibold">{progreso.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              c.estadoAprobacion === 'en_mora' ? 'bg-red-400' :
                              c.estadoAprobacion === 'pagado'  ? 'bg-emerald-500' :
                              'bg-blue-400'
                            }`}
                            style={{ width: `${progreso}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700"
                      onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline" size="sm"
                        className="gap-1.5 h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={async () => {
                          setSelectedItem(c);
                          setIsDetailDialogOpen(true);
                          setLoadingHistorialDetalle(true);
                          try {
                            const pagos = await pagosCreditoApi.getByCredito(c.id);
                            setHistorialDetalle(pagos ?? []);
                          } catch { setHistorialDetalle([]); }
                          finally { setLoadingHistorialDetalle(false); }
                        }}
                      >
                        <Eye className="size-3" /> Ver detalle
                      </Button>
                      <div className="flex gap-1.5">
                        {!c.anulado && c.saldo > 0 && ['activo', 'desembolsado', 'en_mora'].includes(c.estadoAprobacion) && (
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
                            onClick={() => handleOpenPago(c)}
                          >
                            <Banknote className="size-3" /> Pagar cuota
                          </Button>
                        )}
                        <Button
                          variant="outline" size="sm"
                          className="gap-1.5 h-7 text-xs hover:bg-emerald-50 border-emerald-200 text-emerald-700"
                          onClick={() => {
                            const ok = generateCreditoPDF({
                              id: c.id, tipo: c.tipo, asociado: c.asociado, cedula: c.cedula,
                              monto: c.monto, plazo: c.plazo, tasaInteres: c.tasaInteres,
                              cuotaMensual: c.cuotaMensual, saldo: c.saldo,
                              fechaDesembolso: c.fechaDesembolso, estadoAprobacion: c.estadoAprobacion,
                              descripcionSoporte: c.descripcionSoporte,
                              anulado: c.anulado, motivoAnulacion: c.motivoAnulacion,
                              motivoEstadoCambio: c.motivoEstadoCambio,
                            });
                            if (ok) toast.success('Certificado descargado');
                            else toast.error('Error al generar PDF');
                          }}
                        >
                          <FileText className="size-3" /> Certificado
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Mis Solicitudes ── */}
        {misSolicitudes.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Clock className="size-4 text-amber-500" /> Mis Solicitudes
            </h2>
            <div className="space-y-2">
              {misSolicitudes.map(s => {
                const estadoColor =
                  s.estado === 'aprobada'  ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                  s.estado === 'rechazada' ? 'bg-red-100 text-red-700 border-red-200' :
                                             'bg-yellow-100 text-yellow-700 border-yellow-200';
                const estadoLabel =
                  s.estado === 'aprobada'  ? 'Aprobada' :
                  s.estado === 'rechazada' ? 'Rechazada' : 'Pendiente';
                return (
                  <Card key={s.id} className="border-0 shadow-sm bg-white dark:bg-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              {s.tipoCreditoLabel}
                            </span>
                            <Badge variant="outline" className={`text-[11px] ${estadoColor}`}>
                              {estadoLabel}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Monto solicitado:{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(s.monto)}</span>
                            {' · '}
                            Plazo: <span className="font-semibold text-slate-700">{s.plazoMeses} meses</span>
                          </p>
                          {s.destino && (
                            <p className="text-xs text-slate-400">Destino: {s.destino}</p>
                          )}
                          {s.notaAdmin && s.estado !== 'pendiente' && (
                            <p className={`text-xs mt-1 ${s.estado === 'rechazada' ? 'text-red-600' : 'text-emerald-600'}`}>
                              Nota del administrador: {s.notaAdmin}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-slate-400">
                            {new Date(s.createdAt).toLocaleDateString('es-CO', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>

    {/* ── Modal tabla completa amortización (asociado) ── */}
    <Dialog open={isSimDetalleOpen} onOpenChange={setIsSimDetalleOpen}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Tabla de amortización completa</DialogTitle>
        </DialogHeader>
        {simDetalleData && (() => {
          const { sim, tabla } = simDetalleData;
          const totalPagado   = sim.cuotaMensual * sim.plazo;
          const totalInteres  = totalPagado - sim.monto;
          const tipoLabel     = TIPOS_CREDITO.find(t => t.value === sim.tipo)?.label ?? sim.tipo;
          return (
            <>
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5">
                <div className="flex items-center gap-3 mb-4">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { l: 'Monto',           v: formatCurrency(sim.monto) },
                    { l: 'Cuota mensual',   v: formatCurrency(sim.cuotaMensual) },
                    { l: 'Total intereses', v: formatCurrency(totalInteres) },
                    { l: 'Total a pagar',   v: formatCurrency(totalPagado) },
                  ].map(d => (
                    <div key={d.l} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-purple-200 text-[10px] uppercase tracking-wide font-medium">{d.l}</p>
                      <p className="text-white font-black text-sm mt-0.5">{d.v}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Table2 className="size-3.5" />
                  {(sim.tipoInteres ?? 'compuesto') === 'simple' ? 'Tabla de pagos' : 'Tabla de amortización'} — {tabla.length} cuotas
                </p>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto" style={{ maxHeight: '42vh', overflowY: 'auto' }}>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 text-white sticky top-0 z-10">
                        <tr>
                          {['N°','Fecha de pago','Cuota total','Interés','Capital','Saldo restante'].map(h => (
                            <th key={h} className="px-4 py-3 text-left font-semibold text-xs tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tabla.map((fila, idx) => (
                          <tr key={fila.numero} className={idx % 2 === 0 ? 'bg-white hover:bg-purple-50/40' : 'bg-slate-50 hover:bg-purple-50/40'}>
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

              <div className="flex flex-col sm:flex-row gap-3 px-6 pb-6 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  className="border-slate-400 text-slate-700 hover:bg-slate-50 gap-2"
                  onClick={() => descargarPDFAmortizacion(tabla, {
                    monto:          sim.monto,
                    tasa:           sim.tasaInteres,
                    plazo:          sim.plazo,
                    nombreAsociado: userData?.nombre,
                    tipo:           tipoLabel,
                    tipoInteres:    sim.tipoInteres ?? 'compuesto',
                  })}
                >
                  <Download className="size-4" /> Descargar PDF
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2 py-5"
                  onClick={() => { setSimSeleccionada(sim); setIsSimDetalleOpen(false); setIsConfirmSimOpen(true); }}>
                  <Check className="size-5" /><span className="font-bold">Confirmar y aceptar crédito</span>
                </Button>
                <Button variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2 py-5"
                  onClick={() => { setSimSeleccionada(sim); setIsSimDetalleOpen(false); setIsRechazarSimOpen(true); }}>
                  <X className="size-5" /><span className="font-bold">Rechazar simulación</span>
                </Button>
              </div>
            </>
          );
        })()}
      </DialogContent>
    </Dialog>

    {/* ── Confirmar simulación (asociado) ── */}
    <AlertDialog open={isConfirmSimOpen} onOpenChange={setIsConfirmSimOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Confirmar y activar este crédito?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                El crédito por <strong className="text-slate-800">{simSeleccionada ? formatCurrency(simSeleccionada.monto) : ''}</strong> a{' '}
                <strong className="text-slate-800">{simSeleccionada?.plazo} meses</strong> quedará registrado como{' '}
                <strong className="text-emerald-600">Activo</strong> de inmediato en Gestión de Créditos.
              </p>
              <p className="text-xs text-slate-400">
                Esta acción no se puede deshacer. El administrador recibirá una notificación.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmarSimulacion} disabled={confirmandoSim}>
            {confirmandoSim ? 'Activando crédito...' : '🎉 Sí, activar crédito'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* ── Rechazar simulación (asociado) ── */}
    <AlertDialog open={isRechazarSimOpen} onOpenChange={setIsRechazarSimOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Rechazar esta simulación?</AlertDialogTitle>
          <AlertDialogDescription>
            Al rechazar, la simulación por <strong>{simSeleccionada ? formatCurrency(simSeleccionada.monto) : ''}</strong> se eliminará permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleRechazarSimulacion} disabled={rechazandoSim}>
            {rechazandoSim ? 'Rechazando...' : '❌ Sí, rechazar y eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* ── Dialog solicitar crédito (asociado) ── */}
    <Dialog open={isSolicitudDialogOpen} onOpenChange={(open) => {
      setIsSolicitudDialogOpen(open);
      if (!open) { setSolMonto(''); setSolTipo('libre_inversion'); setSolPlazo(''); setSolTasa(''); setSolDestino(''); setSolObs(''); setSolBanco(''); setSolTipoCuenta('ahorros'); setSolNumeroCuenta(''); }
    }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-blue-600" /> Solicitar crédito
          </DialogTitle>
          <DialogDescription>
            Completa el formulario y el administrador revisará tu solicitud.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tipo de crédito <span className="text-red-500">*</span></Label>
            <Select value={solTipo} onValueChange={setSolTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_CREDITO.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto solicitado <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Download className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                <Input className="pl-8" placeholder="0" value={solMonto} onChange={(e) => setSolMonto(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Plazo (meses) <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                <Input className="pl-8" type="number" min={1} placeholder="12" value={solPlazo} onChange={(e) => setSolPlazo(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <Percent className="size-3.5 text-slate-400" /> Tasa de interés anual (%) — opcional
            </Label>
            <Input type="number" min={0} step={0.1} placeholder="Ej. 12" value={solTasa} onChange={(e) => setSolTasa(e.target.value)} />
            <p className="text-[11px] text-slate-400">Déjalo en blanco si no conoces la tasa; el admin la definirá.</p>
          </div>

          {parseMonto(solMonto) > 0 && parseInt(solPlazo) > 0 && (() => {
            const _monto   = parseMonto(solMonto);
            const _tasa    = parseFloat(solTasa) || 0;
            const _plazo   = parseInt(solPlazo);
            const _cuota   = calcularCuota(_monto, _tasa, _plazo);
            const _total   = _cuota * _plazo;
            const _interes = _total - _monto;
            return (
              <div className="rounded-xl border border-purple-200 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="size-4 text-white" />
                    <span className="text-white text-sm font-bold">Simulación del crédito</span>
                  </div>
                  <span className="text-purple-200 text-[10px] font-medium uppercase tracking-wide">Método francés · cuota fija</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-purple-100 bg-white">
                  <div className="px-3 py-3 text-center">
                    <p className="text-[10px] text-purple-400 uppercase tracking-wide font-semibold">Cuota mensual</p>
                    <p className="text-base font-black text-purple-700 mt-0.5">{formatCurrency(_cuota)}</p>
                  </div>
                  <div className="px-3 py-3 text-center">
                    <p className="text-[10px] text-amber-500 uppercase tracking-wide font-semibold">Total intereses</p>
                    <p className="text-base font-black text-amber-600 mt-0.5">{formatCurrency(_interes)}</p>
                  </div>
                  <div className="px-3 py-3 text-center">
                    <p className="text-[10px] text-emerald-500 uppercase tracking-wide font-semibold">Total a pagar</p>
                    <p className="text-base font-black text-emerald-600 mt-0.5">{formatCurrency(_total)}</p>
                  </div>
                </div>
                <div className="flex gap-2 px-4 py-3 bg-slate-50 border-t border-purple-100">
                  <Button
                    type="button" variant="outline" size="sm"
                    className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50 gap-1.5 text-xs"
                    onClick={() => {
                      const t = generarTablaAmortizacion(_monto, _tasa, _plazo, new Date().toISOString().split('T')[0]);
                      setTablaSolSim(t);
                      setIsSolSimOpen(true);
                    }}
                  >
                    <Table2 className="size-3.5" /> Ver tabla completa ({_plazo} cuotas)
                  </Button>
                  <Button
                    type="button" variant="outline" size="sm"
                    className="border-slate-300 text-slate-600 hover:bg-slate-100 gap-1.5 text-xs"
                    onClick={() => {
                      const t = generarTablaAmortizacion(_monto, _tasa, _plazo, new Date().toISOString().split('T')[0]);
                      descargarPDFAmortizacion(t, { monto: _monto, tasa: _tasa, plazo: _plazo, nombreAsociado: userData?.nombre });
                    }}
                  >
                    <Download className="size-3.5" /> PDF
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400 text-center pb-2">
                  Cálculo orientativo · las condiciones finales las define el administrador
                </p>
              </div>
            );
          })()}

          <div className="space-y-1.5">
            <Label>Destino del crédito <span className="text-red-500">*</span></Label>
            <Input placeholder="Ej. Pago de matrícula universitaria" value={solDestino} onChange={(e) => setSolDestino(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Observaciones adicionales</Label>
            <Textarea placeholder="Información adicional para el administrador..." value={solObs} onChange={(e) => setSolObs(e.target.value)} rows={3} />
          </div>

          <div className="space-y-3 pt-1">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2 border-t border-slate-100 pt-3">
              <Users className="size-4 text-indigo-500" />
              Datos bancarios para desembolso
            </h4>
            <p className="text-[11px] text-slate-400 -mt-1">Si el crédito es aprobado, el dinero se transferirá a esta cuenta.</p>
            <div className="space-y-1.5">
              <Label>Banco <span className="text-red-500">*</span></Label>
              <Input placeholder="Ej. Bancolombia, Nequi, Davivienda…" value={solBanco} onChange={(e) => setSolBanco(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de cuenta <span className="text-red-500">*</span></Label>
                <Select value={solTipoCuenta} onValueChange={setSolTipoCuenta}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ahorros">Ahorros</SelectItem>
                    <SelectItem value="corriente">Corriente</SelectItem>
                    <SelectItem value="digital">Digital / Billetera</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Número de cuenta <span className="text-red-500">*</span></Label>
                <Input placeholder="Ej. 1234567890" value={solNumeroCuenta} onChange={(e) => setSolNumeroCuenta(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setIsSolicitudDialogOpen(false)}>Cancelar</Button>
          <Button className="bg-blue-600 hover:bg-blue-700" disabled={savingSolicitud} onClick={handleSolicitarCredito}>
            {savingSolicitud ? 'Enviando...' : 'Enviar solicitud'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ── Modal: tabla de amortización completa desde solicitud asociado ── */}
    <Dialog open={isSolSimOpen} onOpenChange={setIsSolSimOpen}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 mb-1">
            <BarChart2 className="size-5" /> Tabla de amortización — Método Francés
          </DialogTitle>
          <p className="text-purple-200 text-xs">Cuota fija mensual · cálculo orientativo, sujeto a aprobación</p>
          {tablaSolSim.length > 0 && (() => {
            const totalIntereses = tablaSolSim.reduce((s, r) => s + r.interes, 0);
            const totalPagado    = tablaSolSim.reduce((s, r) => s + r.cuota,   0);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
                  <p className="text-purple-200 text-[10px] uppercase tracking-wide">Monto</p>
                  <p className="font-bold text-sm">{formatCurrency(tablaSolSim.reduce((s,r)=>s+r.capital,0))}</p>
                </div>
                <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
                  <p className="text-purple-200 text-[10px] uppercase tracking-wide">Cuota mensual</p>
                  <p className="font-bold text-sm">{formatCurrency(tablaSolSim[0].cuota)}</p>
                </div>
                <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
                  <p className="text-purple-200 text-[10px] uppercase tracking-wide">Total intereses</p>
                  <p className="font-bold text-sm">{formatCurrency(totalIntereses)}</p>
                </div>
                <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
                  <p className="text-purple-200 text-[10px] uppercase tracking-wide">Total a pagar</p>
                  <p className="font-bold text-sm">{formatCurrency(totalPagado)}</p>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="rounded-xl overflow-hidden mx-5 my-4 border border-slate-200">
          <div style={{ maxHeight: '44vh', overflowY: 'auto' }}>
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-white sticky top-0 z-10">
                <tr>
                  {['N°', 'Fecha de pago', 'Cuota total', 'Interés', 'Capital', 'Saldo restante'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tablaSolSim.map((r, idx) => (
                  <tr key={r.numero} className={idx % 2 === 0 ? 'bg-white hover:bg-purple-50/40' : 'bg-slate-50 hover:bg-purple-50/40'}>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-black">
                        {r.numero}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium whitespace-nowrap">{r.fecha}</td>
                    <td className="px-4 py-2.5 font-black text-purple-700 whitespace-nowrap">{formatCurrency(r.cuota)}</td>
                    <td className="px-4 py-2.5 text-amber-600 font-medium whitespace-nowrap">{formatCurrency(r.interes)}</td>
                    <td className="px-4 py-2.5 text-blue-600 font-medium whitespace-nowrap">{formatCurrency(r.capital)}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-800 whitespace-nowrap">
                      {r.saldo === 0
                        ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Pagado</span>
                        : formatCurrency(r.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {tablaSolSim.length > 0 && (
                <tfoot className="bg-slate-800 text-white sticky bottom-0">
                  <tr>
                    <td colSpan={2} className="px-4 py-2.5 font-bold text-xs">TOTALES</td>
                    <td className="px-4 py-2.5 font-black text-purple-300 whitespace-nowrap">{formatCurrency(tablaSolSim.reduce((s,r)=>s+r.cuota,0))}</td>
                    <td className="px-4 py-2.5 font-bold text-amber-300 whitespace-nowrap">{formatCurrency(tablaSolSim.reduce((s,r)=>s+r.interes,0))}</td>
                    <td className="px-4 py-2.5 font-bold text-blue-300 whitespace-nowrap">{formatCurrency(tablaSolSim.reduce((s,r)=>s+r.capital,0))}</td>
                    <td className="px-4 py-2.5 font-bold text-emerald-300">$ 0</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 pb-5 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            ¿Te convence el plan? Envía tu solicitud y el administrador la revisará.
          </p>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              variant="outline"
              className="border-slate-300 text-slate-600 gap-2"
              onClick={() => descargarPDFAmortizacion(tablaSolSim, {
                monto:          tablaSolSim.reduce((s,r) => s + r.capital, 0),
                tasa:           parseFloat(solTasa) || 0,
                plazo:          tablaSolSim.length,
                nombreAsociado: userData?.nombre,
              })}
            >
              <Download className="size-4" /> Descargar PDF
            </Button>
            <Button variant="outline" onClick={() => setIsSolSimOpen(false)}>
              Volver al formulario
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 gap-2"
              disabled={savingSolicitud}
              onClick={() => { setIsSolSimOpen(false); handleSolicitarCredito(); }}
            >
              {savingSolicitud ? 'Enviando...' : '📤 Enviar solicitud'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Detalle del crédito (asociado view) ── */}
    <Dialog open={isDetailDialogOpen} onOpenChange={(open) => {
      hook.setIsDetailDialogOpen(open);
      if (!open) { hook.setSelectedItem(null); hook.setHistorialDetalle([]); }
    }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-blue-600" /> Detalle del crédito
          </DialogTitle>
        </DialogHeader>

        {selectedItem && (() => {
          const monto       = selectedItem.monto        ?? 0;
          const saldo       = selectedItem.saldo        ?? monto;
          const cuota       = selectedItem.cuotaMensual ?? 0;
          const tasaAnual   = selectedItem.tasaInteres  ?? 0;
          const plazo       = selectedItem.plazo        ?? 0;
          const tipoInteres = selectedItem.tipoInteres  ?? 'compuesto';
          // Tasa mensual efectiva desde EA — fórmula correcta
          const tasaMensual = tasaEAaMensual(tasaAnual);

          const cuotasPagadasReal = historialDetalle.length;
          // Cuotas pagadas: distinto cálculo según tipo de interés
          let cuotasPagadas: number;
          if (cuotasPagadasReal > 0) {
            cuotasPagadas = cuotasPagadasReal;
          } else if (tipoInteres === 'simple') {
            const capitalFijo = plazo > 0 ? Math.round(monto / plazo) : 0;
            cuotasPagadas = capitalFijo > 0 ? Math.max(0, Math.round((monto - saldo) / capitalFijo)) : 0;
          } else {
            cuotasPagadas = cuota > 0 ? Math.max(0, Math.round((monto - saldo) / cuota)) : 0;
          }
          const cuotasPendientes = Math.max(0, plazo - cuotasPagadas);

          const capitalPagado    = historialDetalle.reduce((s: number, p: any) => s + (p.capital ?? 0), 0);
          const interesesPagados = historialDetalle.reduce((s: number, p: any) => s + (p.interes  ?? 0), 0);

          // Intereses pendientes estimados según tipo
          let interesesPendientes = 0;
          if (tipoInteres === 'simple') {
            interesesPendientes = cuotasPendientes * Math.round(monto * tasaMensual);
          } else {
            let saldoTemp = saldo;
            for (let i = 0; i < cuotasPendientes; i++) {
              const intCuota = Math.round(saldoTemp * tasaMensual);
              const capCuota = Math.round(cuota - intCuota);
              interesesPendientes += intCuota;
              saldoTemp = Math.max(0, saldoTemp - capCuota);
            }
          }

          const fechaBase = selectedItem.fechaDesembolso
            ? new Date(selectedItem.fechaDesembolso + 'T00:00:00') : null;
          const fechaBaseAmort    = fechaBase ?? new Date();
          const fechaVencimiento  = fechaBase && plazo > 0
            ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + plazo, fechaBase.getDate()) : null;
          const fechaVencProxima  = fechaBase && cuotasPagadas < plazo
            ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + cuotasPagadas + 1, fechaBase.getDate()) : null;

          const hoyMs    = new Date(); hoyMs.setHours(0,0,0,0);
          const diasMora = (selectedItem.estadoAprobacion === 'en_mora' && fechaVencProxima && fechaVencProxima < hoyMs)
            ? Math.floor((hoyMs.getTime() - fechaVencProxima.getTime()) / 86400000) : 0;

          const numCredito = `CRE-${String(selectedItem.id ?? '').substring(0, 8).toUpperCase()}`;

          const amortizacion: { num: number; fecha: string; cuota: number; capital: number; interes: number; saldoFinal: number; pagada: boolean }[] = [];
          let saldoAcum = monto;
          const interesFijoSimple = tipoInteres === 'simple' ? Math.round(monto * tasaMensual) : 0;
          const capitalFijoSimple = tipoInteres === 'simple' ? Math.round(monto / plazo)       : 0;
          const cuotaSimple       = tipoInteres === 'simple' ? calcularCuotaSimple(monto, tasaAnual, plazo) : cuota;
          for (let i = 1; i <= plazo; i++) {
            let interesCuota: number;
            let capitalCuota: number;
            let cuotaFila:    number;
            if (tipoInteres === 'simple') {
              interesCuota = interesFijoSimple;
              capitalCuota = i < plazo ? capitalFijoSimple : saldoAcum;
              cuotaFila    = cuotaSimple;
            } else {
              interesCuota = Math.round(saldoAcum * tasaMensual);
              capitalCuota = Math.round(cuota - interesCuota);
              cuotaFila    = cuota;
            }
            saldoAcum = Math.max(0, saldoAcum - capitalCuota);
            const fechaCuota = new Date(fechaBaseAmort.getFullYear(), fechaBaseAmort.getMonth() + i, fechaBaseAmort.getDate());
            amortizacion.push({
              num: i, fecha: fechaCuota.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
              cuota: cuotaFila, capital: capitalCuota, interes: interesCuota, saldoFinal: saldoAcum, pagada: i <= cuotasPagadas,
            });
          }

          return (
            <div className="space-y-4 py-1">
              <div className="rounded-xl border border-blue-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg"><CreditCard className="size-5 text-white" /></div>
                    <div>
                      <p className="text-xs text-blue-100 font-medium">N° de crédito</p>
                      <p className="text-lg font-bold text-white tracking-wider">{numCredito}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-blue-100 mb-1">
                      {TIPOS_CREDITO.find(t => t.value === selectedItem.tipo)?.label ?? 'Crédito de consumo'}
                    </p>
                    {selectedItem.anulado
                      ? <Badge className="bg-red-500 text-white border-0">Anulado</Badge>
                      : getEstadoBadge(selectedItem.estadoAprobacion)}
                  </div>
                </div>
                <div className="bg-blue-50 px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div className="col-span-2 flex items-center gap-2 pb-2 border-b border-blue-100 mb-0.5">
                    <div className="p-1.5 bg-blue-100 rounded-full"><Users className="size-3.5 text-blue-600" /></div>
                    <div>
                      <p className="font-bold text-slate-900">{selectedItem.asociado}</p>
                      <p className="text-slate-500">C.C. {selectedItem.cedula}</p>
                    </div>
                  </div>
                  <div><span className="text-slate-400">Monto aprobado</span><p className="font-bold text-slate-800">{formatCurrency(monto)}</p></div>
                  <div><span className="text-slate-400">Cuota mensual</span><p className="font-bold text-indigo-700">{formatCurrency(cuota)}</p></div>
                  <div>
                    <span className="text-slate-400">Tasa de interés</span>
                    <p className="font-bold text-orange-700">{tasaAnual > 0 ? `${tasaAnual}% ${tipoInteres === 'simple' ? 'N.A.' : 'EA'}` : 'Sin interés'}</p>
                  </div>
                  <div><span className="text-slate-400">Plazo total</span><p className="font-bold text-slate-800">{plazo} meses</p></div>
                  <div>
                    <span className="text-slate-400">Fecha de inicio</span>
                    <p className="font-bold text-slate-800">
                      {selectedItem.fechaDesembolso
                        ? new Date(selectedItem.fechaDesembolso + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Fecha de vencimiento</span>
                    <p className="font-bold text-slate-800">
                      {fechaVencimiento
                        ? fechaVencimiento.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-700 px-4 py-2.5 flex items-center gap-2">
                  <BarChart2 className="size-4 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Resumen financiero</p>
                </div>
                <div className="grid grid-cols-3 gap-px bg-slate-200">
                  <div className={`bg-white p-3 ${diasMora > 0 ? 'bg-red-50' : ''}`}>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Saldo pendiente</p>
                    <p className={`text-base font-bold mt-0.5 ${saldo <= 0 ? 'text-emerald-600' : diasMora > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                      {saldo <= 0 ? '✓ Pagado' : formatCurrency(saldo)}
                    </p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Capital pagado</p>
                    <p className="text-base font-bold text-blue-700 mt-0.5">{formatCurrency(capitalPagado)}</p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Intereses pagados</p>
                    <p className="text-base font-bold text-orange-600 mt-0.5">{formatCurrency(interesesPagados)}</p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Intereses pendientes</p>
                    <p className="text-sm font-semibold text-amber-600 mt-0.5">
                      {cuotasPendientes > 0 ? `≈ ${formatCurrency(interesesPendientes)}` : '—'}
                    </p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Cuotas pagadas</p>
                    <p className="text-base font-bold text-emerald-700 mt-0.5">
                      {cuotasPagadas} <span className="text-xs font-normal text-slate-400">de {plazo}</span>
                    </p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Cuotas pendientes</p>
                    <p className={`text-base font-bold mt-0.5 ${cuotasPendientes > 0 ? 'text-slate-700' : 'text-emerald-600'}`}>
                      {cuotasPendientes > 0 ? cuotasPendientes : '—'}
                    </p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Valor de cuota</p>
                    <p className="text-base font-bold text-indigo-700 mt-0.5">{formatCurrency(cuota)}</p>
                  </div>
                  <div className="bg-white p-3 col-span-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Próxima fecha de pago</p>
                    <p className={`text-sm font-semibold mt-0.5 ${diasMora > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      {fechaVencProxima
                        ? fechaVencProxima.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                        : <span className="text-emerald-600">Pagado ✓</span>}
                    </p>
                  </div>
                </div>
                <div className="bg-white px-4 py-3 border-t border-slate-100">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span className="font-medium">Progreso del crédito</span>
                    <span>{plazo > 0 ? `${((cuotasPagadas / plazo) * 100).toFixed(0)}% completado` : '—'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${diasMora > 0 ? 'bg-red-400' : 'bg-emerald-500'}`}
                      style={{ width: plazo > 0 ? `${(cuotasPagadas / plazo) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>

              <Tabs defaultValue="amortizacion">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="amortizacion" className="text-xs gap-1">
                    <Clock className="size-3" /> Cuotas
                  </TabsTrigger>
                  <TabsTrigger value="pagos" className="text-xs gap-1">
                    <History className="size-3" />
                    Pagos{historialDetalle.length > 0 && ` (${historialDetalle.length})`}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="amortizacion" className="mt-3">
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                          <tr>
                            <th className="px-2 py-2 text-left text-slate-500 font-medium">#</th>
                            <th className="px-2 py-2 text-left text-slate-500 font-medium">Fecha</th>
                            <th className="px-2 py-2 text-right text-slate-500 font-medium">Cuota</th>
                            <th className="px-2 py-2 text-right text-slate-500 font-medium">Capital</th>
                            <th className="px-2 py-2 text-right text-slate-500 font-medium">Interés</th>
                            <th className="px-2 py-2 text-right text-slate-500 font-medium">Saldo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {amortizacion.map((row) => (
                            <tr key={row.num} className={row.pagada ? 'bg-emerald-50/50 opacity-60' : 'hover:bg-slate-50'}>
                              <td className="px-2 py-1.5 text-slate-400">{row.num}</td>
                              <td className="px-2 py-1.5 text-slate-600">{row.fecha}</td>
                              <td className="px-2 py-1.5 text-right font-medium text-slate-800">{formatCurrency(row.cuota)}</td>
                              <td className="px-2 py-1.5 text-right text-blue-600">{formatCurrency(row.capital)}</td>
                              <td className="px-2 py-1.5 text-right text-orange-600">{formatCurrency(row.interes)}</td>
                              <td className="px-2 py-1.5 text-right font-semibold text-indigo-700">{formatCurrency(row.saldoFinal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="outline" size="sm"
                      className="gap-1.5 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => descargarPDFAmortizacion(
                        amortizacion.map(r => ({ numero: r.num, fecha: r.fecha, cuota: r.cuota, capital: r.capital, interes: r.interes, saldo: r.saldoFinal })),
                        { monto, tasa: tasaAnual, plazo, nombreAsociado: selectedItem.asociado, tipo: selectedItem.tipo, tipoInteres }
                      )}
                    >
                      <Download className="size-3" /> Descargar PDF
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="pagos" className="mt-3">
                  {loadingHistorialDetalle ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    </div>
                  ) : historialDetalle.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                      <History className="size-7" />
                      <p className="text-sm">Sin pagos registrados aún</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                            <tr>
                              <th className="px-2 py-2 text-left text-slate-500 font-medium">Cuota</th>
                              <th className="px-2 py-2 text-left text-slate-500 font-medium">Fecha</th>
                              <th className="px-2 py-2 text-right text-slate-500 font-medium">Valor</th>
                              <th className="px-2 py-2 text-right text-slate-500 font-medium">Capital</th>
                              <th className="px-2 py-2 text-right text-slate-500 font-medium">Interés</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {historialDetalle.map((p: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-2 py-1.5 font-medium text-slate-700">#{p.num_cuota ?? idx + 1}</td>
                                <td className="px-2 py-1.5 text-slate-600">
                                  {p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </td>
                                <td className="px-2 py-1.5 text-right font-semibold text-emerald-700">{formatCurrency(p.monto_pagado ?? p.valor ?? 0)}</td>
                                <td className="px-2 py-1.5 text-right text-blue-600">{formatCurrency(p.capital ?? 0)}</td>
                                <td className="px-2 py-1.5 text-right text-orange-600">{formatCurrency(p.interes ?? 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

            </div>
          );
        })()}

        <DialogFooter>
          <Button variant="outline" onClick={() => hook.setIsDetailDialogOpen(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
