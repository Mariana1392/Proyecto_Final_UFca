import {
  Banknote, DollarSign, Calendar, CreditCard as CreditCardIcon,
  AlertTriangle, CheckCircle2, History, FileText, Upload, XCircle,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import { formatCurrency } from '../../lib/formatters';
import type { CreditosHook } from './useCreditos';

interface CreditoDialogPagoProps {
  hook: CreditosHook;
  isAsociado?: boolean;
}

export default function CreditoDialogPago({ hook, isAsociado = false }: CreditoDialogPagoProps) {
  const {
    isPagoDialogOpen, setIsPagoDialogOpen,
    selectedItem, setSelectedItem,
    historialPagos, setHistorialPagos,
    loadingPagos,
    pagoMonto, setPagoMonto,
    pagoFecha, setPagoFecha,
    pagoMetodo, setPagoMetodo,
    pagoComprobante, setPagoComprobante,
    pagoObservacion, setPagoObservacion,
    handleRegistrarPago,
    pagando,
  } = hook;

  return (
    <Dialog open={isPagoDialogOpen} onOpenChange={(open) => {
      setIsPagoDialogOpen(open);
      if (!open) { setSelectedItem(null); setHistorialPagos([]); }
    }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-5 text-emerald-600" /> Pagar cuota del crédito
          </DialogTitle>
          <DialogDescription>
            {selectedItem && (isAsociado
              ? `Saldo pendiente: ${formatCurrency(selectedItem.saldo)}`
              : `${selectedItem.asociado} · Saldo pendiente: ${formatCurrency(selectedItem.saldo)}`
            )}
          </DialogDescription>
        </DialogHeader>

        {selectedItem && (() => {
          const saldo        = selectedItem.saldo ?? 0;
          const cuota        = selectedItem.cuotaMensual ?? 0;
          const tasaAnual    = selectedItem.tasaInteres  ?? 0;
          const tasaMensual  = tasaAnual > 0 ? tasaAnual / 100 / 12 : 0;
          const montoPago    = parseFloat(pagoMonto.replace(/[^\d.]/g, '')) || 0;
          const interesPrev  = Math.round(saldo * tasaMensual);
          const capitalPrev  = Math.max(0, Math.round(montoPago - interesPrev));
          const saldoNuevo   = Math.max(0, saldo - capitalPrev);
          const numCuotaNext = historialPagos.length + 1;

          const fechaBase = selectedItem.fechaDesembolso
            ? new Date(selectedItem.fechaDesembolso + 'T00:00:00') : new Date();
          const fechaVenc = new Date(
            fechaBase.getFullYear(),
            fechaBase.getMonth() + numCuotaNext,
            fechaBase.getDate()
          );

          return (
            <div className="space-y-5 py-1">

              {/* Resumen del crédito */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-indigo-500 uppercase">Monto original</p>
                  <p className="text-sm font-bold text-indigo-700 mt-0.5">{formatCurrency(selectedItem.monto)}</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-orange-500 uppercase">Saldo pendiente</p>
                  <p className="text-sm font-bold text-orange-700 mt-0.5">{formatCurrency(saldo)}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-blue-500 uppercase">Cuota mensual</p>
                  <p className="text-sm font-bold text-blue-700 mt-0.5">{formatCurrency(cuota)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">N° cuota a pagar</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">
                    {numCuotaNext} de {selectedItem.plazo}
                  </p>
                </div>
              </div>

              {/* Fecha vencimiento cuota */}
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-sm">
                <Calendar className="size-4 text-yellow-600 shrink-0" />
                <span className="text-slate-600">
                  Vencimiento cuota {numCuotaNext}:{' '}
                  <span className="font-bold text-yellow-700">
                    {fechaVenc.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </span>
              </div>

              {/* Formulario de pago */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos del pago</p>

                {/* Botón de cancelación total del crédito (solo admin) */}
                {!isAsociado && saldo > 0 && (
                  <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
                    <XCircle className="size-4 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-red-700">Cancelación total del crédito</p>
                      <p className="text-[10px] text-red-500">Paga el saldo completo en una sola transacción</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-bold text-red-700 border border-red-300 rounded-lg px-2.5 py-1.5 hover:bg-red-100 whitespace-nowrap transition-colors"
                      onClick={() => setPagoMonto(String(saldo))}
                    >
                      Usar {formatCurrency(saldo)}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={isAsociado ? 'asoc-pago-monto' : 'pago-monto'} className="flex items-center gap-1.5">
                      <DollarSign className="size-3.5 text-emerald-500" /> Monto a pagar <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={isAsociado ? 'asoc-pago-monto' : 'pago-monto'}
                      type="text"
                      placeholder={formatCurrency(cuota)}
                      value={pagoMonto}
                      onChange={e => setPagoMonto(e.target.value.replace(/[^\d.]/g, ''))}
                      className={
                        pagoMonto && parseFloat(pagoMonto) < cuota && cuota > 0
                          ? 'border-red-400 focus-visible:ring-red-400'
                          : pagoMonto && parseFloat(pagoMonto) >= cuota && cuota > 0
                          ? 'border-emerald-400 focus-visible:ring-emerald-400'
                          : ''
                      }
                    />
                    {pagoMonto && parseFloat(pagoMonto) < cuota && cuota > 0 ? (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                        <AlertTriangle className="size-3 shrink-0" />
                        Mínimo a pagar: <strong>{formatCurrency(cuota)}</strong>
                      </p>
                    ) : pagoMonto && parseFloat(pagoMonto) > cuota && cuota > 0 ? (
                      <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="size-3 shrink-0" />
                        Excedente <strong>{formatCurrency(parseFloat(pagoMonto) - cuota)}</strong> se abonará al capital
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400">Mínimo: <strong>{formatCurrency(cuota)}</strong> · puedes pagar más para reducir capital</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={isAsociado ? 'asoc-pago-fecha' : 'pago-fecha'} className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-slate-500" /> Fecha del pago <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={isAsociado ? 'asoc-pago-fecha' : 'pago-fecha'}
                      type="date"
                      value={pagoFecha}
                      onChange={e => setPagoFecha(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <CreditCardIcon className="size-3.5 text-slate-500" /> Método de pago
                  </Label>
                  <Select value={pagoMetodo} onValueChange={(v) => { setPagoMetodo(v); setPagoComprobante(null); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                      <SelectItem value="transferencia">🏦 Transferencia bancaria</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Comprobante — obligatorio si es transferencia */}
                {pagoMetodo === 'transferencia' && (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Upload className="size-3.5 text-blue-500" />
                      Comprobante de transferencia <span className="text-red-500">*</span>
                    </Label>
                    <div
                      className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-colors ${
                        pagoComprobante
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                      }`}
                      onClick={() => document.getElementById(isAsociado ? 'asoc-comprobante-input' : 'admin-comprobante-input')?.click()}
                    >
                      <input
                        id={isAsociado ? 'asoc-comprobante-input' : 'admin-comprobante-input'}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={e => setPagoComprobante(e.target.files?.[0] ?? null)}
                      />
                      {pagoComprobante ? (
                        <>
                          <CheckCircle2 className="size-6 text-emerald-500" />
                          <p className="text-sm font-medium text-emerald-700 text-center break-all">{pagoComprobante.name}</p>
                          <p className="text-xs text-slate-500">{(pagoComprobante.size / 1024).toFixed(0)} KB · haz clic para cambiar</p>
                        </>
                      ) : (
                        <>
                          <Upload className="size-6 text-blue-400" />
                          <p className="text-sm font-medium text-blue-700">Haz clic para adjuntar el comprobante</p>
                          <p className="text-xs text-slate-500">JPG, PNG o PDF · máx. 5 MB</p>
                        </>
                      )}
                    </div>
                    {!pagoComprobante && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="size-3" /> Requerido para pagos por transferencia
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor={isAsociado ? 'asoc-pago-obs' : 'pago-obs'} className="flex items-center gap-1.5">
                    <FileText className="size-3.5 text-slate-500" /> Observación <span className="text-xs text-slate-400 font-normal">(opcional)</span>
                  </Label>
                  <Textarea
                    id={isAsociado ? 'asoc-pago-obs' : 'pago-obs'}
                    placeholder="Ej: Pago parcial, referencia de transferencia, etc."
                    className="resize-none text-sm"
                    rows={2}
                    value={pagoObservacion}
                    onChange={e => setPagoObservacion(e.target.value)}
                  />
                </div>
              </div>

              {/* Preview del desglose */}
              {montoPago > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Desglose del pago</p>
                  {(() => {
                    const capitalNormal = Math.max(0, Math.round(cuota - interesPrev));
                    const abonoExtra    = Math.max(0, capitalPrev - capitalNormal);
                    return montoPago > cuota ? (
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase">Interés</p>
                          <p className="text-sm font-bold text-orange-600">{formatCurrency(interesPrev)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase">Capital cuota</p>
                          <p className="text-sm font-bold text-blue-600">{formatCurrency(capitalNormal)}</p>
                        </div>
                        <div className="bg-violet-50 rounded-lg p-1 border border-violet-200">
                          <p className="text-[10px] text-violet-600 uppercase font-semibold">Abono extra</p>
                          <p className="text-sm font-bold text-violet-700">+{formatCurrency(abonoExtra)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase">Nuevo saldo</p>
                          <p className="text-sm font-bold text-emerald-700">{formatCurrency(saldoNuevo)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase">Interés</p>
                          <p className="text-sm font-bold text-orange-600">{formatCurrency(interesPrev)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase">Capital</p>
                          <p className="text-sm font-bold text-blue-600">{formatCurrency(capitalPrev)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase">Nuevo saldo</p>
                          <p className="text-sm font-bold text-emerald-700">{formatCurrency(saldoNuevo)}</p>
                        </div>
                      </div>
                    );
                  })()}
                  {montoPago > cuota && cuota > 0 && (
                    <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      El excedente se aplica directamente al capital, reduciendo el saldo más rápido
                    </p>
                  )}
                  {saldoNuevo <= 0 && (
                    <div className="flex items-center gap-2 pt-1 text-emerald-700 font-semibold text-sm">
                      <CheckCircle2 className="size-4" /> ¡Este pago cancela el crédito completamente!
                    </div>
                  )}
                </div>
              )}

              {/* Historial de pagos (admin view shows full table, asociado shows compact) */}
              {!isAsociado && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <History className="size-4 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Historial de pagos ({historialPagos.length})
                    </p>
                  </div>
                  {loadingPagos ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
                    </div>
                  ) : historialPagos.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-slate-400 gap-1.5">
                      <Banknote className="size-7" />
                      <p className="text-sm">Sin pagos registrados aún</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                            <tr>
                              <th className="text-center px-2 py-2 font-semibold text-slate-500">#</th>
                              <th className="text-left   px-2 py-2 font-semibold text-slate-500">Fecha</th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">Pagado</th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">Capital</th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">Interés</th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">Saldo tras pago</th>
                              <th className="text-center px-2 py-2 font-semibold text-slate-500">Método</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historialPagos.map((p: any) => (
                              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                <td className="px-2 py-1.5 text-center text-slate-500">{p.num_cuota ?? '—'}</td>
                                <td className="px-2 py-1.5 text-slate-600">
                                  {new Date(p.fecha_pago).toLocaleDateString('es-CO', {
                                    day: '2-digit', month: 'short', year: 'numeric'
                                  })}
                                </td>
                                <td className="px-2 py-1.5 text-right font-semibold text-emerald-700">
                                  {formatCurrency(p.monto_pagado)}
                                </td>
                                <td className="px-2 py-1.5 text-right text-blue-600">{formatCurrency(p.capital)}</td>
                                <td className="px-2 py-1.5 text-right text-orange-600">{formatCurrency(p.interes)}</td>
                                <td className="px-2 py-1.5 text-right text-indigo-600">{formatCurrency(p.saldo_despues)}</td>
                                <td className="px-2 py-1.5 text-center text-slate-500 capitalize">{p.metodo_pago ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Asociado view: compact history */}
              {isAsociado && historialPagos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <History className="size-4 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Pagos anteriores ({historialPagos.length})
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="max-h-40 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                          <tr>
                            <th className="px-2 py-2 text-center text-slate-500">#</th>
                            <th className="px-2 py-2 text-left text-slate-500">Fecha</th>
                            <th className="px-2 py-2 text-right text-slate-500">Pagado</th>
                            <th className="px-2 py-2 text-right text-slate-500">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historialPagos.map((p: any) => (
                            <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                              <td className="px-2 py-1.5 text-center text-slate-500">{p.num_cuota ?? '—'}</td>
                              <td className="px-2 py-1.5 text-slate-600">
                                {new Date(p.fecha_pago).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold text-emerald-700">{formatCurrency(p.monto_pagado)}</td>
                              <td className="px-2 py-1.5 text-right text-indigo-600">{formatCurrency(p.saldo_despues)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsPagoDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleRegistrarPago}
            disabled={
              pagando ||
              !selectedItem ||
              (selectedItem?.saldo ?? 0) <= 0 ||
              (parseFloat(pagoMonto.replace(/[^\d.]/g, '')) || 0) <= 0 ||
              (selectedItem?.cuotaMensual > 0 && (parseFloat(pagoMonto.replace(/[^\d.]/g, '')) || 0) < selectedItem.cuotaMensual) ||
              (parseFloat(pagoMonto.replace(/[^\d.]/g, '')) || 0) > (selectedItem?.saldo ?? 0) ||
              !pagoFecha ||
              (pagoMetodo === 'transferencia' && !pagoComprobante)
            }
          >
            {pagando
              ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> Procesando...</>
              : <><Banknote className="size-4" /> Registrar pago</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
