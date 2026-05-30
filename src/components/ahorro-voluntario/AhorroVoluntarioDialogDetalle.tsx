// ── AhorroVoluntarioDialogDetalle.tsx ───────────────────────────────────────
// Diálogo de detalle: información, historial de transacciones y auditoría.

import {
  Wallet, History, FileText, ArrowDownCircle, ArrowUpCircle, Calendar, Target, RefreshCw,
} from 'lucide-react';

// ── Parsear metadatos de observaciones ──────────────────────────────────────
function parsarMetadatos(obs: string) {
  if (!obs) return { frecuencia: '', objetivo: '', nota: obs };
  const match = obs.match(/^\[([^\]]+)\](.*)/s);
  if (!match) return { frecuencia: '', objetivo: '', nota: obs };
  const partesMeta = match[1];
  const nota = match[2].trim();
  let frecuencia = '';
  let objetivo   = '';
  partesMeta.split('|').forEach(part => {
    const p = part.trim();
    if (p.startsWith('Frecuencia:')) frecuencia = p.replace('Frecuencia:', '').trim();
    if (p.startsWith('Objetivo:'))   objetivo   = p.replace('Objetivo:', '').trim();
  });
  return { frecuencia, objetivo, nota };
}
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { formatCurrency } from '../../lib/formatters';
import type { UserRole } from '../../contexts/AuthContext';

interface AhorroVoluntarioDialogDetalleProps {
  isDetailDialogOpen:    boolean;
  setIsDetailDialogOpen: (v: boolean) => void;
  selectedItem:          any;
  setSelectedItem:       (v: any) => void;
  movimientosDetalle:    any[];
  setMovimientosDetalle: (v: any[]) => void;
  historialCambios:      any[];
  setHistorialCambios:   (v: any[]) => void;
  loadingMovimientos:    boolean;
  totalDepositado:       number;
  saldoRealMov:          number;
  userRole?:             UserRole | null;
  onOpenMovimiento:      (tipo: 'Depósito' | 'Retiro') => void;
}

export default function AhorroVoluntarioDialogDetalle({
  isDetailDialogOpen, setIsDetailDialogOpen,
  selectedItem, setSelectedItem,
  movimientosDetalle, setMovimientosDetalle,
  historialCambios, setHistorialCambios,
  loadingMovimientos,
  totalDepositado, saldoRealMov,
  userRole, onOpenMovimiento,
}: AhorroVoluntarioDialogDetalleProps) {

  const handleClose = () => {
    setIsDetailDialogOpen(false);
    setSelectedItem(null);
    setMovimientosDetalle([]);
    setHistorialCambios([]);
  };

  const meta = selectedItem ? parsarMetadatos(selectedItem.observaciones ?? '') : null;

  return (
    <Dialog open={isDetailDialogOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del ahorro voluntario</DialogTitle>
          <DialogDescription>Información completa y transacciones del plan</DialogDescription>
        </DialogHeader>

        {selectedItem && (
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="info" className="gap-2">
                <Wallet className="size-4" /> Información
              </TabsTrigger>
              <TabsTrigger value="transacciones" className="gap-2">
                <History className="size-4" /> Transacciones
                {movimientosDetalle.length > 0 && (
                  <Badge className="ml-1 bg-purple-600 text-white text-xs px-1.5 py-0">
                    {movimientosDetalle.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="historial" className="gap-2">
                <FileText className="size-4" /> Historial
                {historialCambios.length > 0 && (
                  <Badge className="ml-1 bg-slate-500 text-white text-xs px-1.5 py-0">
                    {historialCambios.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Información ── */}
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
                  <Label className="text-slate-500 text-xs">Estado</Label>
                  <div className="mt-1">
                    <Badge className={
                      selectedItem.anulado ? 'bg-red-100 text-red-700' :
                      selectedItem.estado  ? 'bg-emerald-600' :
                      'bg-yellow-100 text-yellow-700'
                    }>
                      {selectedItem.anulado ? 'Anulado' : selectedItem.estado ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs">Saldo actual</Label>
                  <p className="text-purple-700 font-bold text-lg">{formatCurrency(selectedItem.montoAhorrado)}</p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs">Fecha de registro</Label>
                  <p className="text-slate-900">{selectedItem.fechaInicio}</p>
                </div>
                {/* Frecuencia y objetivo de ahorro (si existen en observaciones) */}
                {meta && (meta.frecuencia || meta.objetivo) && (
                  <div className="col-span-2 p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                    <Label className="text-purple-700 text-xs font-semibold uppercase tracking-wide">
                      Plan de ahorro
                    </Label>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {meta.frecuencia && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <RefreshCw className="size-3.5 text-purple-500 shrink-0" />
                          <span className="text-slate-500">Frecuencia:</span>
                          <span className="font-medium capitalize">{meta.frecuencia}</span>
                        </div>
                      )}
                      {meta.objetivo && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Target className="size-3.5 text-purple-500 shrink-0" />
                          <span className="text-slate-500">Objetivo:</span>
                          <span className="font-medium">{meta.objetivo}</span>
                        </div>
                      )}
                    </div>
                    {meta.nota && (
                      <p className="text-xs text-slate-500 border-t border-purple-100 pt-1 mt-1">
                        {meta.nota}
                      </p>
                    )}
                  </div>
                )}
                {selectedItem.motivoAnulacion && (
                  <div className="col-span-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <Label className="text-red-600 text-xs">Motivo de anulación</Label>
                    <p className="text-red-700 mt-1">{selectedItem.motivoAnulacion}</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Transacciones ── */}
            <TabsContent value="transacciones" className="space-y-3">
              {!selectedItem.anulado && selectedItem.estado && userRole === 'admin' && (
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline"
                    className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => onOpenMovimiento('Depósito')}>
                    <ArrowDownCircle className="size-4" /> Depósito
                  </Button>
                  <Button size="sm" variant="outline"
                    className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => onOpenMovimiento('Retiro')}>
                    <ArrowUpCircle className="size-4" /> Retiro
                  </Button>
                </div>
              )}

              {loadingMovimientos ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-3" />
                  <p className="text-sm text-slate-500">Cargando transacciones...</p>
                </div>
              ) : movimientosDetalle.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <History className="size-10 text-slate-300 mb-3" />
                  <p className="text-slate-500">No hay pagos registrados</p>
                  <p className="text-xs text-slate-400 mt-1">Los depósitos aparecerán aquí</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {movimientosDetalle.map((mov) => (
                    <div key={mov.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-white border-emerald-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-emerald-100">
                          <ArrowDownCircle className="size-3 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Depósito</p>
                          <p className="text-xs text-slate-400">
                            <Calendar className="size-3 inline mr-1" />
                            {mov.fecha_pago}{mov.observacion ? ` · ${mov.observacion}` : ''}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-emerald-600">+{formatCurrency(mov.monto)}</p>
                    </div>
                  ))}
                </div>
              )}

              {movimientosDetalle.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total depositado:</span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(totalDepositado)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total pagos:</span>
                    <span className="font-semibold text-slate-700">{movimientosDetalle.length}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-1 mt-1">
                    <span className="text-slate-700">Saldo actual:</span>
                    <span className="text-purple-700 text-base">{formatCurrency(saldoRealMov)}</span>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Historial de modificaciones ── */}
            <TabsContent value="historial" className="space-y-3">
              {loadingMovimientos ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500 mr-3" />
                  <p className="text-sm text-slate-500">Cargando historial...</p>
                </div>
              ) : historialCambios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FileText className="size-10 text-slate-300 mb-3" />
                  <p className="text-slate-500">Sin modificaciones registradas</p>
                  <p className="text-xs text-slate-400 mt-1">Cada vez que se edite este ahorro quedará registrado aquí</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {historialCambios.map((h, idx) => (
                    <div key={h.id ?? idx} className={`rounded-lg border p-3 space-y-2 ${
                      h.campos_modificados?.startsWith('ANULACIÓN')
                        ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            {h.campos_modificados?.startsWith('ANULACIÓN') ? '🚫 Anulación del registro' : '✏️ Modificación'}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(h.fecha_cambio).toLocaleString('es-CO', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                            {' · '}<span className="font-medium text-slate-600">{h.usuario_nombre}</span>
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {h.campos_modificados?.startsWith('ANULACIÓN') ? 'Anulación' : h.campos_modificados || 'Cambio'}
                        </Badge>
                      </div>
                      {!h.campos_modificados?.startsWith('ANULACIÓN') && (
                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-2">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Valores anteriores</p>
                            {(h.saldo_antes ?? h.saldo_anterior) != null && (
                              <p className="text-slate-600">Saldo: <span className="font-medium">{formatCurrency(h.saldo_antes ?? h.saldo_anterior)}</span></p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold text-purple-600 uppercase tracking-wide text-[10px]">Valores nuevos</p>
                            {(h.saldo_despues ?? h.saldo_nuevo) != null && (
                              <p className="text-slate-600">Saldo: <span className="font-medium text-purple-700">{formatCurrency(h.saldo_despues ?? h.saldo_nuevo)}</span></p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {historialCambios.length > 0 && (
                <div className="pt-2 border-t border-slate-100 text-sm text-slate-500 flex justify-between">
                  <span>Total de modificaciones:</span>
                  <span className="font-semibold text-slate-700">{historialCambios.length}</span>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button onClick={handleClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
