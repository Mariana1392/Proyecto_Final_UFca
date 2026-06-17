import { BarChart2, Download, Receipt } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import { TIPOS_CREDITO } from '../../lib/constants';
import { formatCurrency } from '../../lib/formatters';
import { calcularCuota, calcularCuotaSimple, descargarPDFAmortizacion } from './creditoHelpers';
import type { CreditosHook } from './useCreditos';

interface CreditoDialogSimulacionProps {
  hook: CreditosHook;
}

export default function CreditoDialogSimulacion({ hook }: CreditoDialogSimulacionProps) {
  const {
    isSimulacionOpen, setIsSimulacionOpen,
    tablaSimulacion,
    parseMonto,
    formMonto,
    formTasa,
    formPlazo,
    formAsociadoId,
    formTipoInteres,
    asociadosDisponibles,
    formTipo,
    handleEnviarSimulacion,
    enviandoSimulacion,
  } = hook;

  return (
    <Dialog open={isSimulacionOpen} onOpenChange={setIsSimulacionOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-700">
            <BarChart2 className="size-5" />
            {formTipoInteres === 'simple'
              ? 'Simulación de Crédito — Interés Simple'
              : 'Simulación de Crédito — Método Francés'}
          </DialogTitle>
          <DialogDescription>
            {formTipoInteres === 'simple'
              ? 'Tabla de pagos con interés constante sobre el capital original. Revisa el plan de pagos antes de enviarlo al asociado.'
              : 'Tabla de amortización con cuota fija. Revisa el plan de pagos antes de enviarlo al asociado.'}
          </DialogDescription>
        </DialogHeader>

        {tablaSimulacion.length > 0 && (() => {
          const monto   = parseMonto(formMonto);
          const tasa    = parseFloat(formTasa) || 0;
          const plazo   = parseInt(formPlazo)  || 0;
          const cuota   = formTipoInteres === 'simple'
            ? calcularCuotaSimple(monto, tasa, plazo)
            : calcularCuota(monto, tasa, plazo);
          const totalPagado  = cuota * plazo;
          const totalInteres = totalPagado - monto;
          const asociado     = asociadosDisponibles.find(a => a.id === formAsociadoId);
          const fmt          = (n: number) => formatCurrency(n);

          return (
            <div className="space-y-5">
              {/* Resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Monto solicitado', val: fmt(monto), color: 'bg-blue-50 border-blue-200 text-blue-700' },
                  { label: 'Cuota mensual',    val: fmt(cuota), color: 'bg-purple-50 border-purple-200 text-purple-700' },
                  { label: 'Total intereses',  val: fmt(totalInteres), color: 'bg-amber-50 border-amber-200 text-amber-700' },
                  { label: 'Total a pagar',    val: fmt(totalPagado),  color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                ].map(c => (
                  <div key={c.label} className={`p-3 rounded-xl border ${c.color}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{c.label}</p>
                    <p className="text-base font-black mt-1">{c.val}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-2.5">
                <span><strong>Asociado:</strong> {asociado?.nombre ?? '—'}</span>
                <span>·</span>
                <span><strong>Tasa:</strong> {tasa}%</span>
                <span>·</span>
                <span><strong>Plazo:</strong> {plazo} meses</span>
                <span>·</span>
                <span><strong>Tipo:</strong> {TIPOS_CREDITO.find(t => t.value === formTipo)?.label ?? formTipo}</span>
              </div>

              {/* Tabla */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800 text-white sticky top-0">
                      <tr>
                        {['#', 'Fecha de pago', 'Cuota', 'Interés', 'Capital', 'Saldo'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tablaSimulacion.map((fila, idx) => (
                        <tr key={fila.numero} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 font-bold text-slate-500">{fila.numero}</td>
                          <td className="px-3 py-2 text-slate-700">{fila.fecha}</td>
                          <td className="px-3 py-2 font-semibold text-purple-700">{fmt(fila.cuota)}</td>
                          <td className="px-3 py-2 text-amber-600">{fmt(fila.interes)}</td>
                          <td className="px-3 py-2 text-blue-600">{fmt(fila.capital)}</td>
                          <td className="px-3 py-2 font-bold text-slate-800">{fmt(fila.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold text-slate-700 sticky bottom-0">
                      <tr>
                        <td className="px-3 py-2.5" colSpan={2}>TOTALES</td>
                        <td className="px-3 py-2.5 text-purple-700">{fmt(totalPagado)}</td>
                        <td className="px-3 py-2.5 text-amber-600">{fmt(totalInteres)}</td>
                        <td className="px-3 py-2.5 text-blue-600">{fmt(monto)}</td>
                        <td className="px-3 py-2.5 text-emerald-600">$ 0</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Nota informativa */}
              <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ Esta simulación <strong>no registra el crédito</strong>. Al enviarla al asociado, quedará en estado <strong>"Simulación"</strong> hasta que él confirme o rechace. Solo entonces se registrará oficialmente.
              </p>
            </div>
          );
        })()}

        <DialogFooter className="gap-2 pt-2 flex-wrap">
          <Button variant="outline" onClick={() => setIsSimulacionOpen(false)}>
            Volver al formulario
          </Button>
          {tablaSimulacion.length > 0 && (
            <Button
              variant="outline"
              className="border-slate-400 text-slate-700 hover:bg-slate-50 gap-2"
              onClick={() => descargarPDFAmortizacion(tablaSimulacion, {
                monto:          parseMonto(formMonto),
                tasa:           parseFloat(formTasa) || 0,
                plazo:          parseInt(formPlazo)  || 0,
                nombreAsociado: asociadosDisponibles.find(a => a.id === formAsociadoId)?.nombre,
                tipoInteres:    formTipoInteres,
              })}
            >
              <Download className="size-4" /> Descargar PDF
            </Button>
          )}
          <Button
            className="bg-purple-600 hover:bg-purple-700 gap-2"
            onClick={handleEnviarSimulacion}
            disabled={enviandoSimulacion}
          >
            {enviandoSimulacion ? (
              <><div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enviando...</>
            ) : (
              <><Receipt className="size-4" /> Enviar al asociado para confirmar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
