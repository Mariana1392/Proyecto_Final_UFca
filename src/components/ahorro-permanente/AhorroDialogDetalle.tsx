// ── AhorroDialogDetalle.tsx ───────────────────────────────────────────────────
// Diálogo de detalle del ahorro permanente: información + historial de depósitos.

import { PiggyBank, History, DollarSign } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { formatCurrency } from '../../lib/formatters';

interface AhorroDialogDetalleProps {
  open:               boolean;
  onClose:            () => void;
  selectedItem:       any;
  movimientosDetalle: any[];
  loadingMovimientos: boolean;
}

export default function AhorroDialogDetalle({
  open, onClose, selectedItem, movimientosDetalle, loadingMovimientos,
}: AhorroDialogDetalleProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del ahorro permanente</DialogTitle>
          <DialogDescription>Información completa y historial de transacciones</DialogDescription>
        </DialogHeader>

        {selectedItem && (() => {
          const ultimoMovActivo = [...movimientosDetalle]
            .filter(m => !m.anulado)
            .sort((a, b) =>
              new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime()
            )[0];
          const saldoRealDetalle = selectedItem.montoAhorrado ?? ultimoMovActivo?.saldo_despues ?? 0;

          return (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="info" className="gap-2">
                  <PiggyBank className="size-4" /> Información
                </TabsTrigger>
                <TabsTrigger value="historial" className="gap-2">
                  <History className="size-4" /> Historial de depósitos
                </TabsTrigger>
              </TabsList>

              {/* ── Tab: Información ─────────────────────────────────────── */}
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
                    <Label className="text-slate-500 text-xs">Estado del plan</Label>
                    <div className="mt-1">
                      <Badge
                        variant={selectedItem.anulado ? 'secondary' : 'default'}
                        className={
                          selectedItem.anulado
                            ? 'bg-red-100 text-red-700'
                            : selectedItem.estado
                              ? 'bg-emerald-600'
                              : 'bg-yellow-100 text-yellow-700'
                        }
                      >
                        {selectedItem.anulado ? 'Anulado' : selectedItem.estado ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Saldo actual</Label>
                    <p className="text-emerald-700 font-bold text-lg">
                      {formatCurrency(saldoRealDetalle)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Cuota mensual</Label>
                    <p className="text-slate-900">{formatCurrency(selectedItem.cuotaMensual)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Fecha de inicio</Label>
                    <p className="text-slate-900">{selectedItem.fechaInicio}</p>
                  </div>
                  {selectedItem.motivoAnulacion && (
                    <div className="col-span-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <Label className="text-red-600 text-xs">Motivo de anulación</Label>
                      <p className="text-red-700 mt-1">{selectedItem.motivoAnulacion}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── Tab: Historial ───────────────────────────────────────── */}
              <TabsContent value="historial" className="space-y-3">
                {loadingMovimientos ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mr-3" />
                    <p className="text-sm text-slate-500">Cargando movimientos...</p>
                  </div>
                ) : movimientosDetalle.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <History className="size-10 text-slate-300 mb-3" />
                    <p className="text-slate-500">No hay transacciones registradas para este plan</p>
                    <p className="text-xs text-slate-400 mt-1">Los depósitos y ajustes aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {movimientosDetalle.map((mov) => (
                      <div
                        key={mov.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          mov.anulado
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : 'bg-white border-emerald-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-emerald-100">
                            <DollarSign className="size-3 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700">Aporte</p>
                            <p className="text-xs text-slate-500">
                              {mov.fecha_pago}
                              {mov.periodos?.nombre && (
                                <span className="ml-1 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-medium">
                                  {mov.periodos.nombre}
                                </span>
                              )}
                              {mov.descripcion ? ` — ${mov.descripcion}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-600">
                            +{formatCurrency(mov.monto)}
                          </p>
                          <p className="text-xs text-slate-400">Saldo: {formatCurrency(mov.saldo_despues ?? 0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {movimientosDetalle.length > 0 && (() => {
                  const ultimoMov = [...movimientosDetalle]
                    .filter(m => !m.anulado)
                    .sort((a, b) =>
                      new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime()
                    )[0];
                  const saldoReal = selectedItem?.montoAhorrado ?? ultimoMov?.saldo_despues ?? 0;
                  const totalAportado = movimientosDetalle
                    .filter(m => !m.anulado)
                    .reduce((acc, m) => acc + m.monto, 0);
                  return (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Número de aportes:</span>
                        <span className="font-semibold text-slate-700">
                          {movimientosDetalle.filter(m => !m.anulado).length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Total aportado:</span>
                        <span className="font-semibold text-emerald-700">
                          {formatCurrency(totalAportado)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-1 mt-1">
                        <span className="text-slate-700">Saldo actual:</span>
                        <span className="text-emerald-700 text-base">
                          {formatCurrency(saldoReal)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          );
        })()}

        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
