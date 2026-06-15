import { useState, useEffect } from 'react';
import {
  Plus, Search, X, Calendar, CreditCard, BarChart2, Check, AlertTriangle,
  Eye, Banknote, FileText, Clock, Percent, Table2, Download, CheckCircle2,
  History, Users, Upload, Paperclip,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
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
import CreditoDialogPago from './CreditoDialogPago';

interface CreditoVistaAsociadoProps {
  hook: CreditosHook;
  userData?: any;
}

export default function CreditoVistaAsociado({ hook, userData }: CreditoVistaAsociadoProps) {
  const [solErrors, setSolErrors] = useState<Record<string, string>>({});

  const validarSolCampo = (name: string, value: string) => {
    let error = '';
    if (name === 'monto') {
      const n = parseInt(value.replace(/\./g, '').replace(/[^\d]/g, ''), 10) || 0;
      if (!n || n <= 0) error = 'Ingresa un monto válido';
    }
    if (name === 'plazo') {
      const n = parseInt(value) || 0;
      if (!n || n <= 0) error = 'El plazo debe ser mayor a 0';
      else if (n > 12) error = 'El plazo máximo es de 12 meses';
    }
    if (name === 'banco' && !value.trim()) error = 'El banco es obligatorio';
    if (name === 'numeroCuenta' && !value.trim()) error = 'El número de cuenta es obligatorio';
    setSolErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

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
    asocTabFilter, setAsocTabFilter,
    misCreditosFiltrados,
    setSelectedItem,
    setIsDetailDialogOpen,
    setLoadingHistorialDetalle,
    setHistorialDetalle,
    handleOpenPago,
    misSolicitudes,
    // Solicitud dialog
    isSolicitudDialogOpen, setIsSolicitudDialogOpen,
    totalAhorros,
    solMonto, setSolMonto,
    solTipo,
    solPlazo, setSolPlazo,
    solTasa,
    solDestino, setSolDestino,
    solObs, setSolObs,
    solBanco, setSolBanco,
    solBancoSeleccionado, setSolBancoSeleccionado,
    solBancoSubSeleccionado, setSolBancoSubSeleccionado,
    solTipoCuenta, setSolTipoCuenta,
    solNumeroCuenta, setSolNumeroCuenta,
    solTipoDesembolso, setSolTipoDesembolso,
    solDocCartaLaboral, setSolDocCartaLaboral,
    solDocCedula, setSolDocCedula,
    tasasParametrizadas,
    handleSolTipoChange,
    parseMonto,
    tablaSolSim, setTablaSolSim,
    isSolSimOpen, setIsSolSimOpen,
    savingSolicitud,
    handleSolicitarCredito,
    // Referido
    solEsParaReferido, setSolEsParaReferido,
    solReferidoNombre, setSolReferidoNombre,
    asocIngresoMensual,
    // Detail dialog (asociado version shares the same state)
    isDetailDialogOpen,
    selectedItem,
    historialDetalle,
    loadingHistorialDetalle,
  } = hook;

  const hayFiltros = false;

  // ── Realtime: notificar al asociado cuando cambia el estado de su crédito ──
  useEffect(() => {
    if (!userData?.id) return;

    const ETIQUETAS: Record<string, string> = {
      aprobado:     '✅ Tu solicitud fue aprobada',
      rechazado:    '❌ Tu solicitud fue rechazada',
      en_revision:  '🔍 Tu solicitud está en revisión',
      desembolsado: '💰 Tu crédito fue desembolsado',
      en_mora:      '⚠️ Tu crédito entró en mora',
    };

    const canal = supabase
      .channel(`creditos-asociado-${userData.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'creditos', filter: `asociado_id=eq.${userData.id}` },
        (payload) => {
          const c = payload.new as any;
          // Actualiza el estado local sin recargar todo
          hook.setCreditos((prev: any[]) => prev.map((cr: any) =>
            cr.id === c.id
              ? { ...cr, estado: c.estado, estadoAprobacion: c.estado, motivoEstadoCambio: c.motivo_estado_cambio ?? '' }
              : cr
          ));
          // Muestra toast informativo si el estado tiene etiqueta
          const label = ETIQUETAS[c.estado as string];
          if (label) {
            toast.info(label, {
              description: `Crédito de ${formatCurrency(c.monto)}.`,
              duration: 8000,
            });
          }
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(canal); };
  }, [userData?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

        {/* ── Clasificación de Créditos por Estado de Pago ── */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button
              onClick={() => setAsocTabFilter('activos')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                asocTabFilter === 'activos'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Créditos Activos / En Curso
            </button>
            <button
              onClick={() => setAsocTabFilter('finalizados')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                asocTabFilter === 'finalizados'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Historial / Finalizados
            </button>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1">
            {misCreditosFiltrados.length} {misCreditosFiltrados.length === 1 ? 'crédito' : 'créditos'}
          </span>
        </div>

        {/* ── Lista de créditos / Estados Vacíos ── */}
        {misCreditosFiltrados.length === 0 ? (
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800">
            <CardContent className="py-16 text-center">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-900">
                  <CreditCard className="size-8 text-slate-400" />
                </div>
                {misCreditosBase.length === 0 ? (
                  <div>
                    <p className="text-base font-semibold text-slate-600 dark:text-slate-300">
                      No tienes créditos registrados
                    </p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                      Cuando se apruebe un crédito a tu nombre aparecerá aquí.
                    </p>
                  </div>
                ) : asocTabFilter === 'activos' ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-base font-semibold text-slate-600 dark:text-slate-300">
                        No tienes créditos activos en este momento
                      </p>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Si necesitas financiamiento, puedes solicitar un nuevo crédito ahora mismo.
                      </p>
                    </div>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 gap-2 text-white"
                      onClick={() => setIsSolicitudDialogOpen(true)}
                    >
                      <Plus className="size-4" /> Solicitar Crédito
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-base font-semibold text-slate-600 dark:text-slate-300">
                      Tu historial de créditos finalizados está vacío
                    </p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                      Aquí aparecerán los créditos que hayas pagado o que hayan sido rechazados o anulados.
                    </p>
                  </div>
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
      if (!open) { setSolMonto(''); setSolTipo('libre_inversion'); setSolPlazo(''); setSolTasa(''); setSolDestino(''); setSolObs(''); setSolBanco(''); setSolBancoSeleccionado(''); setSolBancoSubSeleccionado(''); setSolTipoCuenta('ahorros'); setSolNumeroCuenta(''); setSolDocCartaLaboral(null); setSolDocCedula(null); setSolEsParaReferido(false); setSolReferidoNombre(''); }
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
            <Select value={solTipo} onValueChange={handleSolTipoChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_CREDITO.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Tasa parametrizada — solo informativa */}
            {solTasa && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                <Percent className="size-3.5 text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700">
                  Tasa aplicada para este tipo de crédito:{' '}
                  <strong>{solTasa}% EA</strong> — definida por el fondo
                </p>
              </div>
            )}
          </div>

          {/* ── Destinatario del crédito: asociado o referido ── */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destinatario del crédito</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setSolEsParaReferido(false); setSolReferidoNombre(''); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  !solEsParaReferido
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <CreditCard className="size-4" />
                Para mí
              </button>
              <button
                type="button"
                onClick={() => setSolEsParaReferido(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  solEsParaReferido
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <Users className="size-4" />
                Para referido
              </button>
            </div>
            {solEsParaReferido && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label htmlFor="sol-referido-nombre" className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-purple-500" /> Nombre del referido <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sol-referido-nombre"
                  placeholder="Nombre completo de la persona referida"
                  value={solReferidoNombre}
                  onChange={(e) => setSolReferidoNombre(e.target.value)}
                  className="border-purple-200 focus-visible:ring-purple-200"
                />
                <p className="text-[11px] text-purple-500">
                  El referido no tiene cuenta en el sistema. Tú eres responsable de la deuda.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto solicitado <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                <Input
                  className={`pl-8 ${solErrors.monto ? 'border-red-400' : ''}`}
                  placeholder="0"
                  value={solMonto}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                    const formatted = raw ? parseInt(raw, 10).toLocaleString('es-CO') : '';
                    setSolMonto(formatted);
                    if (solErrors.monto) validarSolCampo('monto', formatted);
                  }}
                  onBlur={() => validarSolCampo('monto', solMonto)}
                />
              </div>
              {solErrors.monto && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{solErrors.monto}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Plazo (meses) <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                <Input
                  className={`pl-8 ${solErrors.plazo ? 'border-red-400' : ''}`}
                  type="number" min={1} max={12} placeholder="12"
                  value={solPlazo}
                  onChange={(e) => {
                    let val = e.target.value;
                    const num = parseInt(val, 10) || 0;
                    if (num > 12) {
                      val = '12';
                    }
                    setSolPlazo(val);
                    validarSolCampo('plazo', val);
                  }}
                  onBlur={e => validarSolCampo('plazo', e.target.value)}
                />
              </div>
              {solErrors.plazo && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{solErrors.plazo}</p>}
            </div>
          </div>


          {/* ── Capacidad de endeudamiento (30% del ingreso mensual) ── */}
          {!solEsParaReferido && asocIngresoMensual > 0 && (
            <div className="bg-indigo-50/50 border border-indigo-100 text-slate-700 p-3.5 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Ingreso mensual declarado:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(asocIngresoMensual)}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-indigo-100/50">
                <span className="text-slate-500 font-medium">Capacidad de endeudamiento (30%):</span>
                <span className="font-bold text-indigo-650">{formatCurrency(asocIngresoMensual * 0.3)}</span>
              </div>
            </div>
          )}

          {parseMonto(solMonto) > 0 && parseInt(solPlazo) > 0 && (() => {
            const _monto   = parseMonto(solMonto);
            const _tasa    = parseFloat(solTasa) || 0;
            const _plazo   = parseInt(solPlazo);
            const esSimple = !solEsParaReferido;
            const _cuota   = esSimple ? calcularCuotaSimple(_monto, _tasa, _plazo) : calcularCuota(_monto, _tasa, _plazo);
            const _total   = _cuota * _plazo;
            const _interes = _total - _monto;
            return (
              <div className="rounded-xl border border-purple-200 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="size-4 text-white" />
                    <span className="text-white text-sm font-bold">Simulación del crédito</span>
                  </div>
                  <span className="text-purple-200 text-[10px] font-medium uppercase tracking-wide">
                    {esSimple ? 'Interés simple · cuota de capital fija' : 'Método francés · cuota fija'}
                  </span>
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
                {!solEsParaReferido && asocIngresoMensual > 0 && _cuota > (asocIngresoMensual * 0.3) && (
                  <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border-t border-purple-100 text-xs text-amber-800">
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-600 mt-0.5" />
                    <span>
                      ⚠️ <strong>Advertencia de capacidad de pago:</strong> La cuota mensual calculada (<strong>{formatCurrency(_cuota)}</strong>) supera el 30% de tu ingreso mensual (límite: <strong>{formatCurrency(asocIngresoMensual * 0.3)}</strong>).
                    </span>
                  </div>
                )}
                <div className="flex gap-2 px-4 py-3 bg-slate-50 border-t border-purple-100">
                  <Button
                    type="button" variant="outline" size="sm"
                    className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50 gap-1.5 text-xs"
                    onClick={() => {
                      const t = esSimple
                        ? generarTablaAmortizacionSimple(_monto, _tasa, _plazo, new Date().toISOString().split('T')[0])
                        : generarTablaAmortizacion(_monto, _tasa, _plazo, new Date().toISOString().split('T')[0]);
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
                      const t = esSimple
                        ? generarTablaAmortizacionSimple(_monto, _tasa, _plazo, new Date().toISOString().split('T')[0])
                        : generarTablaAmortizacion(_monto, _tasa, _plazo, new Date().toISOString().split('T')[0]);
                      descargarPDFAmortizacion(t, { monto: _monto, tasa: _tasa, plazo: _plazo, nombreAsociado: userData?.nombre, tipoInteres: esSimple ? 'simple' : 'compuesto' });
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


          {/* ── Documentos de soporte (Mejora F) ── */}
          <div className="space-y-3 pt-1">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2 border-t border-slate-100 pt-3">
              <Paperclip className="size-4 text-emerald-500" />
              Documentos de soporte
              <span className="text-xs text-slate-400 font-normal">(opcional pero recomendado)</span>
            </h4>
            <p className="text-[11px] text-slate-400 -mt-1">Se guardarán de forma segura en el sistema para revisión del administrador.</p>

            {/* Carta laboral */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Carta laboral / comprobante de ingresos</Label>
              <label className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors group ${solDocCartaLaboral ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}>
                <Upload className={`size-4 shrink-0 ${solDocCartaLaboral ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-500'}`} />
                <div className="flex-1 min-w-0">
                  {solDocCartaLaboral ? (
                    <span className="text-xs text-emerald-700 font-medium truncate block">{solDocCartaLaboral.name}</span>
                  ) : (
                    <span className="text-xs text-slate-500">Haz clic para subir PDF, JPG o PNG — máx. 5 MB</span>
                  )}
                </div>
                {solDocCartaLaboral && (
                  <button type="button" className="text-slate-400 hover:text-red-500 transition-colors" onClick={e => { e.preventDefault(); setSolDocCartaLaboral(null); }}>
                    <X className="size-3.5" />
                  </button>
                )}
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 5 * 1024 * 1024) { toast.error('El archivo supera 5 MB'); return; }
                    setSolDocCartaLaboral(f ?? null);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {/* Cédula */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Cédula de ciudadanía</Label>
              <label className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors group ${solDocCedula ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}>
                <Upload className={`size-4 shrink-0 ${solDocCedula ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-500'}`} />
                <div className="flex-1 min-w-0">
                  {solDocCedula ? (
                    <span className="text-xs text-emerald-700 font-medium truncate block">{solDocCedula.name}</span>
                  ) : (
                    <span className="text-xs text-slate-500">Haz clic para subir PDF, JPG o PNG — máx. 5 MB</span>
                  )}
                </div>
                {solDocCedula && (
                  <button type="button" className="text-slate-400 hover:text-red-500 transition-colors" onClick={e => { e.preventDefault(); setSolDocCedula(null); }}>
                    <X className="size-3.5" />
                  </button>
                )}
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 5 * 1024 * 1024) { toast.error('El archivo supera 5 MB'); return; }
                    setSolDocCedula(f ?? null);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <Label>Tipo de desembolso <span className="text-red-500">*</span></Label>
            <Select value={solTipoDesembolso} onValueChange={(val: any) => setSolTipoDesembolso(val)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia bancaria</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {solTipoDesembolso === 'transferencia' && (
            <div className="space-y-3 pt-1">
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2 border-t border-slate-100 pt-3">
                <Users className="size-4 text-indigo-500" />
                Datos bancarios para desembolso
              </h4>
              <p className="text-[11px] text-slate-400 -mt-1">Si el crédito es aprobado, el dinero se transferirá a esta cuenta.</p>
              <div className="space-y-1.5">
                <Label>Banco <span className="text-red-500">*</span></Label>
                <Select
                  value={solBancoSeleccionado}
                  onValueChange={(val) => {
                    setSolBancoSeleccionado(val);
                    setSolBancoSubSeleccionado('');
                    if (val !== 'Otro') {
                      setSolBanco(val);
                      setSolErrors(prev => ({ ...prev, banco: '' }));
                    } else {
                      setSolBanco('');
                    }
                  }}
                >
                  <SelectTrigger className={solErrors.banco ? 'border-red-400' : ''}>
                    <SelectValue placeholder="Selecciona un banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bancolombia">Bancolombia</SelectItem>
                    <SelectItem value="Nequi">Nequi</SelectItem>
                    <SelectItem value="Daviplata">Daviplata</SelectItem>
                    <SelectItem value="BBVA">BBVA</SelectItem>
                    <SelectItem value="Davivienda">Davivienda</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
                {solBancoSeleccionado === 'Otro' && (
                  <div className="space-y-1.5 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Label className="text-xs text-slate-500 font-medium">Otros bancos colombianos <span className="text-red-500">*</span></Label>
                    <Select
                      value={solBancoSubSeleccionado}
                      onValueChange={(val) => {
                        setSolBancoSubSeleccionado(val);
                        if (val !== 'Manual') {
                          setSolBanco(val);
                          setSolErrors(prev => ({ ...prev, banco: '' }));
                        } else {
                          setSolBanco('');
                        }
                      }}
                    >
                      <SelectTrigger className={solErrors.banco ? 'border-red-400' : ''}>
                        <SelectValue placeholder="Selecciona otro banco" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Banco de Bogotá">Banco de Bogotá</SelectItem>
                        <SelectItem value="Banco de Occidente">Banco de Occidente</SelectItem>
                        <SelectItem value="Banco Popular">Banco Popular</SelectItem>
                        <SelectItem value="Banco AV Villas">Banco AV Villas</SelectItem>
                        <SelectItem value="Lulo Bank">Lulo Bank</SelectItem>
                        <SelectItem value="Nubank">Nubank (Nu Colombia)</SelectItem>
                        <SelectItem value="Banco Caja Social">Banco Caja Social</SelectItem>
                        <SelectItem value="Manual">Escribir otro banco...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {solBancoSeleccionado === 'Otro' && solBancoSubSeleccionado === 'Manual' && (
                  <div className="space-y-1.5 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Label className="text-xs text-slate-500 font-medium">Especificar banco <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="Escribe el nombre del banco"
                      value={solBanco}
                      onChange={e => {
                        setSolBanco(e.target.value);
                        if (solErrors.banco) validarSolCampo('banco', e.target.value);
                      }}
                      onBlur={e => validarSolCampo('banco', e.target.value)}
                      className={solErrors.banco ? 'border-red-400' : ''}
                    />
                  </div>
                )}
                {solErrors.banco && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{solErrors.banco}</p>}
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
                  <Input
                    placeholder="Ej. 1234567890"
                    value={solNumeroCuenta}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ''); setSolNumeroCuenta(v); if (solErrors.numeroCuenta) validarSolCampo('numeroCuenta', v); }}
                    onBlur={e => validarSolCampo('numeroCuenta', e.target.value)}
                    className={solErrors.numeroCuenta ? 'border-red-400' : ''}
                  />
                  {solErrors.numeroCuenta && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{solErrors.numeroCuenta}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setIsSolicitudDialogOpen(false)}>Cancelar</Button>
          <Button className="bg-blue-600 hover:bg-blue-700" disabled={savingSolicitud || (solEsParaReferido && !solReferidoNombre.trim()) || !(parseInt(solPlazo) > 0 && parseInt(solPlazo) <= 12)} onClick={handleSolicitarCredito}>
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
            <BarChart2 className="size-5" /> {!solEsParaReferido ? 'Tabla de pagos — Interés Simple' : 'Tabla de amortización — Método Francés'}
          </DialogTitle>
          <p className="text-purple-200 text-xs">
            {!solEsParaReferido ? 'Cuota de capital fija · cálculo orientativo, sujeto a aprobación' : 'Cuota fija mensual · cálculo orientativo, sujeto a aprobación'}
          </p>
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
                tipoInteres:    !solEsParaReferido ? 'simple' : 'compuesto',
              })}
            >
              <Download className="size-4" /> Descargar PDF
            </Button>
            <Button variant="outline" onClick={() => setIsSolSimOpen(false)}>
              Volver al formulario
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 gap-2"
              disabled={savingSolicitud || (solEsParaReferido && !solReferidoNombre.trim()) || !(parseInt(solPlazo) > 0 && parseInt(solPlazo) <= 12)}
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

    {/* ── Dialog de pago de cuota (asociado) ── */}
    <CreditoDialogPago hook={hook} isAsociado />
    </>
  );
}
