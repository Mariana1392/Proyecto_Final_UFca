import {
  CreditCard, BarChart2, Users, Clock, History, FileText, Edit, Plus,
  Activity, AlertTriangle, Check, Banknote, Download, Table2, Receipt, X, Landmark, TrendingDown,
} from 'lucide-react';
import { tasaEAaMensual, calcularCuotaSimple } from './creditoHelpers';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import { toast } from 'sonner';
import { TIPOS_CREDITO } from '../../lib/constants';
import { formatCurrency } from '../../lib/formatters';
import { getEstadoBadge, ESTADOS_APROBACION, descargarPDFAmortizacion } from './creditoHelpers';
import { generateComprobantePagoPDF, generateHistorialCreditoPDF } from '../utils/pdfGenerator';
import type { CreditosHook } from './useCreditos';

interface CreditoDialogDetalleProps {
  hook: CreditosHook;
}

export default function CreditoDialogDetalle({ hook }: CreditoDialogDetalleProps) {
  const {
    isDetailDialogOpen, setIsDetailDialogOpen,
    selectedItem, setSelectedItem,
    historialDetalle, setHistorialDetalle,
    loadingHistorialDetalle,
    esVistaPropia,
    setIsDesembolsoOpen,
    setDesembolsoFecha,
    setDesembolsoReferencia,
    setDesembolsoArchivo,
    handleOpenCreate,
    exportarHistorialCSV,
  } = hook;

  return (
    <Dialog open={isDetailDialogOpen} onOpenChange={async (open) => {
      setIsDetailDialogOpen(open);
      if (!open) {
        setSelectedItem(null);
        setHistorialDetalle([]);
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-blue-600" /> Detalle del crédito
          </DialogTitle>
        </DialogHeader>

        {selectedItem && (() => {
          // ── Cálculos base ─────────────────────────────────────────────
          const monto        = selectedItem.monto        ?? 0;
          const saldo        = selectedItem.saldo        ?? monto;
          const cuota        = selectedItem.cuotaMensual ?? 0;
          const tasaAnual    = selectedItem.tasaInteres  ?? 0;
          const plazo        = selectedItem.plazo        ?? 0;
          const tipoInteres  = selectedItem.tipoInteres  ?? 'compuesto';
          // Tasa mensual efectiva desde EA — fórmula correcta
          const tasaMensual  = tasaEAaMensual(tasaAnual);

          // Cuotas pagadas: usar historial real si existe, sino estimación
          const cuotasPagadasReal = historialDetalle.length;
          const cuotasPagadas     = cuotasPagadasReal > 0
            ? cuotasPagadasReal
            : (cuota > 0 ? Math.max(0, Math.round((monto - saldo) / cuota)) : 0);
          const cuotasPendientes  = Math.max(0, plazo - cuotasPagadas);

          // Capital e intereses del historial real
          const capitalPagado    = historialDetalle.reduce((s: number, p: any) => s + (p.capital ?? 0), 0);
          const interesesPagados = historialDetalle.reduce((s: number, p: any) => s + (p.interes ?? 0), 0);

          // Intereses pendientes estimados (según tipo de interés)
          let interesesPendientes = 0;
          if (tipoInteres === 'simple') {
            // Interés simple: siempre sobre el capital original
            const interesFijo = Math.round(monto * tasaMensual);
            interesesPendientes = cuotasPendientes * interesFijo;
          } else {
            // Interés compuesto (francés): sobre el saldo pendiente
            let saldoTemp = saldo;
            for (let i = 0; i < cuotasPendientes; i++) {
              const intCuota = Math.round(saldoTemp * tasaMensual);
              const capCuota = Math.round(cuota - intCuota);
              interesesPendientes += intCuota;
              saldoTemp = Math.max(0, saldoTemp - capCuota);
            }
          }

          const fechaBase = selectedItem.fechaDesembolso
            ? new Date(selectedItem.fechaDesembolso + 'T00:00:00')
            : null;
          const fechaBaseAmort = fechaBase ?? new Date();
          const fechaVencimiento = fechaBase && plazo > 0
            ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + plazo, fechaBase.getDate())
            : null;
          const fechaVencProxima = fechaBase && cuotasPagadas < plazo
            ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + cuotasPagadas + 1, fechaBase.getDate())
            : null;

          const hoyMs    = new Date(); hoyMs.setHours(0,0,0,0);
          // Sin días de gracia: mora desde el mismo día del vencimiento (día 1 = día de vencimiento)
          const diasMora = (selectedItem.estadoAprobacion === 'en_mora' && fechaVencProxima && fechaVencProxima <= hoyMs)
            ? Math.floor((hoyMs.getTime() - fechaVencProxima.getTime()) / 86400000) + 1
            : 0;

          const numCredito = `CRE-${String(selectedItem.id ?? '').substring(0, 8).toUpperCase()}`;

          const amortizacion: {
            num: number; fecha: string; cuota: number;
            capital: number; interes: number; saldoFinal: number; pagada: boolean;
          }[] = [];
          let saldoAcum = monto;
          // Interés simple: valores fijos basados en capital original
          const interesFijoSimple = tipoInteres === 'simple' ? Math.round(monto * tasaMensual) : 0;
          const capitalFijoSimple = tipoInteres === 'simple' ? Math.round(monto / plazo)       : 0;
          const cuotaSimple       = tipoInteres === 'simple' ? calcularCuotaSimple(monto, tasaAnual, plazo) : cuota;
          for (let i = 1; i <= plazo; i++) {
            let interesCuota: number;
            let capitalCuota: number;
            let cuotaFila:    number;
            if (tipoInteres === 'simple') {
              interesCuota = interesFijoSimple;
              capitalCuota = i < plazo ? capitalFijoSimple : saldoAcum; // última cuota cierra exacto
              cuotaFila    = cuotaSimple;
            } else {
              interesCuota = Math.round(saldoAcum * tasaMensual);
              capitalCuota = Math.round(cuota - interesCuota);
              cuotaFila    = cuota;
            }
            saldoAcum = Math.max(0, saldoAcum - capitalCuota);
            const fechaCuota = new Date(fechaBaseAmort.getFullYear(), fechaBaseAmort.getMonth() + i, fechaBaseAmort.getDate());
            amortizacion.push({
              num:        i,
              fecha:      fechaCuota.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
              cuota:      cuotaFila,
              capital:    capitalCuota,
              interes:    interesCuota,
              saldoFinal: saldoAcum,
              pagada:     i <= cuotasPagadas,
            });
          }

          return (
            <div className="space-y-4 py-1">

              {/* Encabezado: número + tipo + asociado + estado */}
              <div className="rounded-xl border border-blue-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <CreditCard className="size-5 text-white" />
                    </div>
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
                    <div className="p-1.5 bg-blue-100 rounded-full">
                      <Users className="size-3.5 text-blue-600" />
                    </div>
                    <div>
                      {selectedItem.referidoNombre?.trim() ? (
                        <>
                          <p className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{selectedItem.referidoNombre}</span>
                            <span className="text-[10px] bg-purple-100 text-purple-750 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                              Referido de {selectedItem.asociado}
                            </span>
                          </p>
                          <p className="text-slate-500 text-[10px] mt-0.5">
                            Asociado garante/responsable: {selectedItem.asociado} (C.C. {selectedItem.cedula})
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-slate-900 flex items-center gap-1.5">
                            {selectedItem.asociado}
                            <span className="text-[10px] bg-blue-100 text-blue-750 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Asociado directo
                            </span>
                          </p>
                          <p className="text-slate-500 text-[10px]">C.C. {selectedItem.cedula}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Monto aprobado</span>
                    <p className="font-bold text-slate-800">{formatCurrency(monto)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Monto desembolsado</span>
                    <p className="font-bold text-slate-800">{formatCurrency(monto)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Tasa de interés</span>
                    <p className="font-bold text-orange-700">
                      {tasaAnual > 0
                        ? tipoInteres === 'simple'
                          ? `${tasaAnual}% N.A. (${(tasaMensual * 100).toFixed(4)}% m.)`
                          : `${tasaAnual}% EA (${(tasaMensual * 100).toFixed(4)}% m.e.)`
                        : 'Sin interés'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {tipoInteres === 'simple' ? 'Interés simple' : 'Interés compuesto — Francés'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Plazo total</span>
                    <p className="font-bold text-slate-800">{plazo} meses</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Fecha de inicio</span>
                    <p className="font-bold text-slate-800">
                      {selectedItem.fechaDesembolso
                        ? new Date(selectedItem.fechaDesembolso + 'T00:00:00')
                            .toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
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



              {/* Resumen financiero en tiempo real */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-700 px-4 py-2.5 flex items-center gap-2">
                  <BarChart2 className="size-4 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Resumen financiero — actualizado en tiempo real
                  </p>
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
                  <div className="bg-white p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Próxima fecha de pago</p>
                    <p className={`text-sm font-semibold mt-0.5 ${diasMora > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      {fechaVencProxima
                        ? fechaVencProxima.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                        : <span className="text-emerald-600">Pagado ✓</span>}
                    </p>
                  </div>
                  <div className={`p-3 ${diasMora > 0 ? 'bg-red-50' : 'bg-white'}`}>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Días en mora</p>
                    {diasMora > 0 ? (
                      <p className="text-base font-bold text-red-600 mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="size-3.5" /> {diasMora} días
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-emerald-600 mt-0.5">Al día ✓</p>
                    )}
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="bg-white px-4 py-3 border-t border-slate-100">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span className="font-medium">Progreso del crédito</span>
                    <span>
                      {plazo > 0 ? `${((cuotasPagadas / plazo) * 100).toFixed(0)}% completado` : '—'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${diasMora > 0 ? 'bg-red-400' : 'bg-emerald-500'}`}
                      style={{ width: plazo > 0 ? `${(cuotasPagadas / plazo) * 100}%` : '0%' }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                    <span>{selectedItem.fechaDesembolso ?? '—'}</span>
                    <span>{fechaVencimiento?.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) ?? '—'}</span>
                  </div>
                </div>
              </div>

              {/* ── Alerta de mora con cargos estimados ── */}
              {diasMora > 0 && (
                <div className="rounded-xl border border-red-300 bg-red-50 overflow-hidden">
                  <div className="bg-red-600 px-4 py-2.5 flex items-center gap-2">
                    <AlertTriangle className="size-4 text-white" />
                    <p className="text-xs font-bold text-white uppercase tracking-wider">
                      Crédito en mora · {diasMora} día{diasMora !== 1 ? 's' : ''} de atraso
                    </p>
                  </div>
                  <div className="px-4 py-3 space-y-2.5">
                    {(() => {
                      // Tasa diaria de mora ≈ (tasaMensual × 1.5) / 30
                      // La tasa de mora en Colombia suele ser 1.5× la tasa corriente (Art. 884 C.Co.)
                      const tasaDiariaCorr = tasaMensual / 30;
                      const tasaDiariaMora = tasaDiariaCorr * 1.5;
                      const interesCorr    = Math.round(saldo * tasaDiariaCorr * diasMora);
                      const interesMora    = Math.round(saldo * tasaDiariaMora * diasMora);
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div className="bg-white rounded-lg p-2.5 border border-red-200 text-center">
                            <p className="text-[10px] text-slate-400 uppercase">Días en mora</p>
                            <p className="text-base font-black text-red-600">{diasMora}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-orange-200 text-center">
                            <p className="text-[10px] text-slate-400 uppercase">Interés corriente estimado</p>
                            <p className="text-sm font-bold text-orange-600">
                              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(interesCorr)}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-red-300 text-center col-span-2 sm:col-span-1">
                            <p className="text-[10px] text-slate-400 uppercase">Interés de mora estimado</p>
                            <p className="text-sm font-black text-red-700">
                              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(interesMora)}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                    <p className="text-[10px] text-red-500 flex items-center gap-1">
                      <TrendingDown className="size-3 shrink-0" />
                      Cargos estimados · Tasa de mora = 1.5× tasa corriente (Art. 884 C.Co.) · Confirmar con la cooperativa
                    </p>
                  </div>
                </div>
              )}

              {/* Tabs: Amortización / Historial de pagos / Documentos / Auditoría */}
              <Tabs defaultValue="amortizacion">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="amortizacion" className="text-xs gap-1">
                    <Clock className="size-3" />
                    {tipoInteres === 'simple' ? 'Tabla de pagos' : 'Tabla de amortización'}
                  </TabsTrigger>
                  <TabsTrigger value="pagos" className="text-xs gap-1">
                    <History className="size-3" />
                    Pagos{historialDetalle.length > 0 && ` (${historialDetalle.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="documentos" className="text-xs gap-1">
                    <FileText className="size-3" /> Soporte
                  </TabsTrigger>
                  <TabsTrigger value="auditoria" className="text-xs gap-1">
                    <Edit className="size-3" /> Auditoría
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Tabla de amortización */}
                <TabsContent value="amortizacion" className="mt-3">
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                          <tr>
                            <th className="text-center px-2 py-2 font-semibold text-slate-500">#</th>
                            <th className="text-left   px-2 py-2 font-semibold text-slate-500">Vencimiento</th>
                            <th className="text-right  px-2 py-2 font-semibold text-slate-500">Cuota</th>
                            <th className="text-right  px-2 py-2 font-semibold text-slate-500">Capital</th>
                            <th className="text-right  px-2 py-2 font-semibold text-slate-500">
                              Interés <span className="text-orange-400 font-normal">({tasaAnual > 0 ? `${(tasaMensual * 100).toFixed(2)}%/m.e.` : '0%'})</span>
                            </th>
                            <th className="text-right  px-2 py-2 font-semibold text-slate-500">Saldo</th>
                            <th className="text-center px-2 py-2 font-semibold text-slate-500">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {amortizacion.map(row => {
                            const pagoReal = historialDetalle.find((p: any) => p.num_cuota === row.num);
                            const isPagada = pagoReal != null || row.pagada;
                            return (
                              <tr key={row.num}
                                className={`border-b border-slate-100 last:border-0 ${isPagada ? 'bg-emerald-50/40' : ''}`}>
                                <td className="px-2 py-1.5 text-center font-medium text-slate-500">{row.num}</td>
                                <td className="px-2 py-1.5 text-slate-600">{row.fecha}</td>
                                <td className="px-2 py-1.5 text-right font-medium text-slate-700">
                                  {pagoReal ? formatCurrency(pagoReal.monto_pagado) : formatCurrency(row.cuota)}
                                </td>
                                <td className="px-2 py-1.5 text-right text-slate-600">
                                  {pagoReal ? formatCurrency(pagoReal.capital) : formatCurrency(row.capital)}
                                </td>
                                <td className="px-2 py-1.5 text-right text-orange-600">
                                  {pagoReal ? formatCurrency(pagoReal.interes) : formatCurrency(row.interes)}
                                </td>
                                <td className="px-2 py-1.5 text-right font-medium text-indigo-600">
                                  {pagoReal ? formatCurrency(pagoReal.saldo_despues) : formatCurrency(row.saldoFinal)}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  {isPagada
                                    ? <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                        <Check className="size-2.5" /> Pagada
                                      </span>
                                    : <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">
                                        <Clock className="size-2.5" /> Pendiente
                                      </span>
                                  }
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                    {selectedItem.fechaDesembolso
                      ? `Los montos reales provienen de los pagos registrados · Proyección: ${tipoInteres === 'simple' ? 'interés simple sobre capital original' : 'amortización francesa (interés compuesto)'}`
                      : `Proyección calculada desde la fecha de hoy · ${tipoInteres === 'simple' ? 'Interés simple sobre capital original' : 'Amortización francesa (interés compuesto)'}`}
                  </p>
                </TabsContent>

                {/* Tab 2: Historial completo de transacciones */}
                <TabsContent value="pagos" className="mt-3">
                  {loadingHistorialDetalle ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
                    </div>
                  ) : historialDetalle.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                      <Banknote className="size-8" />
                      <p className="text-sm font-medium">Sin pagos registrados</p>
                      <p className="text-xs text-center">
                        {selectedItem.estadoAprobacion === 'desembolsado' || selectedItem.estadoAprobacion === 'en_mora'
                          ? 'El crédito está desembolsado pero aún no tiene cuotas pagadas'
                          : 'Los pagos aparecerán aquí una vez que el crédito esté activo'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-slate-600">
                          {historialDetalle.length} transacción{historialDetalle.length !== 1 ? 'es' : ''} registradas
                        </p>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm" variant="outline"
                            className="gap-1.5 text-xs h-7 border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              const ok = generateHistorialCreditoPDF(selectedItem, historialDetalle);
                              if (ok) toast.success('Historial PDF descargado');
                              else toast.error('Error al generar PDF');
                            }}
                          >
                            <Download className="size-3" /> PDF
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="gap-1.5 text-xs h-7 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => {
                              exportarHistorialCSV(historialDetalle, selectedItem);
                              toast.success('Historial CSV descargado');
                            }}
                          >
                            <Table2 className="size-3" /> CSV
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-slate-500 uppercase">Total pagado</p>
                          <p className="text-sm font-bold text-emerald-700">{formatCurrency(historialDetalle.reduce((s: number, p: any) => s + (p.monto_pagado ?? 0), 0))}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-slate-500 uppercase">Capital pagado</p>
                          <p className="text-sm font-bold text-blue-700">{formatCurrency(capitalPagado)}</p>
                        </div>
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-slate-500 uppercase">Intereses pagados</p>
                          <p className="text-sm font-bold text-orange-700">{formatCurrency(interesesPagados)}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="max-h-56 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                              <tr>
                                <th className="text-center px-2 py-2 font-semibold text-slate-500">#</th>
                                <th className="text-left   px-2 py-2 font-semibold text-slate-500">Fecha pago</th>
                                <th className="text-right  px-2 py-2 font-semibold text-slate-500">Pagado</th>
                                <th className="text-right  px-2 py-2 font-semibold text-slate-500">Capital</th>
                                <th className="text-right  px-2 py-2 font-semibold text-slate-500">Interés</th>
                                <th className="text-right  px-2 py-2 font-semibold text-slate-500">Saldo</th>
                                <th className="text-center px-2 py-2 font-semibold text-slate-500">Método</th>
                                <th className="text-center px-2 py-2 font-semibold text-slate-500">Comp.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...historialDetalle].reverse().map((p: any) => (
                                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
                                  <td className="px-2 py-2 text-center font-medium text-slate-500">{p.num_cuota ?? '—'}</td>
                                  <td className="px-2 py-2 text-slate-700">
                                    {new Date(p.fecha_pago + 'T00:00:00').toLocaleDateString('es-CO', {
                                      day: '2-digit', month: 'short', year: 'numeric',
                                    })}
                                  </td>
                                  <td className="px-2 py-2 text-right font-bold text-emerald-700">{formatCurrency(p.monto_pagado)}</td>
                                  <td className="px-2 py-2 text-right text-blue-600">{formatCurrency(p.capital)}</td>
                                  <td className="px-2 py-2 text-right text-orange-600">{formatCurrency(p.interes)}</td>
                                  <td className="px-2 py-2 text-right font-medium text-indigo-700">{formatCurrency(p.saldo_despues)}</td>
                                  <td className="px-2 py-2 text-center text-slate-500 text-[10px] capitalize whitespace-nowrap">
                                    {p.metodo_pago ?? '—'}
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <button
                                      title="Descargar comprobante"
                                      className="p-1 rounded hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors"
                                      onClick={() => {
                                        const ok = generateComprobantePagoPDF(p, selectedItem);
                                        if (ok) toast.success(`Comprobante cuota ${p.num_cuota} descargado`);
                                        else toast.error('Error al generar comprobante');
                                      }}
                                    >
                                      <Receipt className="size-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                        Haz clic en <Receipt className="size-2.5 inline" /> para descargar el comprobante individual de cada pago
                      </p>
                    </>
                  )}
                </TabsContent>

                {/* Tab 3: Documentación de soporte */}
                <TabsContent value="documentos" className="mt-3 space-y-3">
                  {(selectedItem.descripcionSoporte || selectedItem.urlDocumento) ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2.5">
                      {selectedItem.descripcionSoporte && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                            Documentos entregados
                          </p>
                          <p className="text-sm text-slate-700">{selectedItem.descripcionSoporte}</p>
                        </div>
                      )}
                      {selectedItem.urlDocumento && (
                        <a href={selectedItem.urlDocumento} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline font-medium">
                          <X className="size-3.5" /> Ver / descargar documento adjunto
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                      <FileText className="size-8" />
                      <p className="text-sm">Sin documentos de soporte registrados</p>
                    </div>
                  )}
                  {selectedItem.motivoAnulacion && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1">Motivo de anulación</p>
                      <p className="text-sm text-red-700">{selectedItem.motivoAnulacion}</p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab 4: Auditoría de ediciones */}
                <TabsContent value="auditoria" className="mt-3 space-y-3">
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Registro de modificaciones
                      </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {/* Creación */}
                      <div className="flex items-start gap-3 px-3 py-3">
                        <div className="p-1.5 bg-emerald-100 rounded-full shrink-0 mt-0.5">
                          <Plus className="size-3 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Crédito creado</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {selectedItem.createdAt
                              ? new Date(selectedItem.createdAt).toLocaleString('es-CO', {
                                  day: '2-digit', month: 'long', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })
                              : '—'}
                          </p>
                        </div>
                      </div>
                      {/* Última edición */}
                      {selectedItem.editadoPor ? (
                        <div className="flex items-start gap-3 px-3 py-3">
                          <div className="p-1.5 bg-blue-100 rounded-full shrink-0 mt-0.5">
                            <Edit className="size-3 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">Última edición</p>
                            <p className="text-xs text-slate-600 mt-0.5">
                              Por: <span className="font-semibold">{selectedItem.editadoPor}</span>
                            </p>
                            <p className="text-xs text-slate-500">
                              {selectedItem.editadoEn
                                ? new Date(selectedItem.editadoEn).toLocaleString('es-CO', {
                                    day: '2-digit', month: 'long', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })
                                : '—'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="px-3 py-4 text-center text-xs text-slate-400">
                          Sin modificaciones registradas
                        </div>
                      )}
                      {/* Cambio de estado */}
                      {selectedItem.fechaEstadoCambio && (
                        <div className="flex items-start gap-3 px-3 py-3">
                          <div className={`p-1.5 rounded-full shrink-0 mt-0.5 ${
                            selectedItem.estadoAprobacion === 'en_mora'
                              ? 'bg-red-100'
                              : selectedItem.estadoAprobacion === 'pagado'
                              ? 'bg-emerald-100'
                              : 'bg-indigo-100'
                          }`}>
                            <Activity className={`size-3 ${
                              selectedItem.estadoAprobacion === 'en_mora'
                                ? 'text-red-600'
                                : selectedItem.estadoAprobacion === 'pagado'
                                ? 'text-emerald-600'
                                : 'text-indigo-600'
                            }`} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">
                              Cambio de estado → {ESTADOS_APROBACION.find(e => e.value === selectedItem.estadoAprobacion)?.label ?? selectedItem.estadoAprobacion}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Fecha efectiva:{' '}
                              {new Date(selectedItem.fechaEstadoCambio).toLocaleDateString('es-CO', {
                                day: '2-digit', month: 'long', year: 'numeric',
                              })}
                            </p>
                            {selectedItem.motivoEstadoCambio && (
                              <p className="text-xs text-slate-600 mt-0.5">
                                Motivo: <span className="font-medium">{selectedItem.motivoEstadoCambio}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Mora automática detectada */}
                      {selectedItem.estadoAprobacion === 'en_mora' && !selectedItem.fechaEstadoCambio && (
                        <div className="flex items-start gap-3 px-3 py-3 bg-red-50/50">
                          <div className="p-1.5 bg-red-100 rounded-full shrink-0 mt-0.5">
                            <AlertTriangle className="size-3 text-red-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-red-700">En mora (detectado automáticamente)</p>
                            <p className="text-xs text-red-500 mt-0.5">
                              El crédito tiene cuotas vencidas y saldo pendiente
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Anulación */}
                      {selectedItem.anulado && (
                        <div className="flex items-start gap-3 px-3 py-3 bg-red-50/50">
                          <div className="p-1.5 bg-red-100 rounded-full shrink-0 mt-0.5">
                            <X className="size-3 text-red-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-red-700">Crédito anulado</p>
                            {selectedItem.motivoAnulacion && (
                              <p className="text-xs text-red-600 mt-0.5">Motivo: {selectedItem.motivoAnulacion}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

            </div>
          );
        })()}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Cerrar</Button>
          {selectedItem && !selectedItem.anulado && !esVistaPropia && (
            <>
              {(selectedItem.estadoAprobacion === 'aprobado' || selectedItem.estadoAprobacion === 'activo') && (
                <Button
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    setIsDetailDialogOpen(false);
                    setDesembolsoFecha(new Date().toISOString().split('T')[0]);
                    setDesembolsoReferencia('');
                    setDesembolsoArchivo(null);
                    setIsDesembolsoOpen(true);
                  }}
                >
                  <Landmark className="size-4" /> Registrar desembolso
                </Button>
              )}
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
                setIsDetailDialogOpen(false);
                handleOpenCreate(selectedItem);
              }}>
                <Edit className="size-4 mr-1.5" /> Editar crédito
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
