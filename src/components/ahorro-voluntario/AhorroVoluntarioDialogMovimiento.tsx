// ── AhorroVoluntarioDialogMovimiento.tsx ─────────────────────────────────────
// Diálogo para registrar un depósito o retiro en el ahorro voluntario.

import { ArrowDownCircle, ArrowUpCircle, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { formatCurrency } from '../../lib/formatters';
import { formatCurrencyInput, parseCurrencyInput, getMesFiscal } from './useAhorroVoluntario';

interface AhorroVoluntarioDialogMovimientoProps {
  isMovimientoDialogOpen:    boolean;
  setIsMovimientoDialogOpen: (v: boolean) => void;
  selectedItem:              any;
  formMovTipo:               'Depósito' | 'Retiro';
  formMovMonto:              string;
  setFormMovMonto:           (v: string) => void;
  formMovFecha:              string;
  setFormMovFecha:           (v: string) => void;
  formMovDesc:               string;
  setFormMovDesc:            (v: string) => void;
  formMovMetodo:             string;
  setFormMovMetodo:          (v: string) => void;
  savingMovimiento:          boolean;
  montoMinimo:               number;
  handleRegistrarMovimiento: () => void;
}

export default function AhorroVoluntarioDialogMovimiento({
  isMovimientoDialogOpen, setIsMovimientoDialogOpen,
  selectedItem,
  formMovTipo, formMovMonto, setFormMovMonto,
  formMovFecha, setFormMovFecha,
  formMovDesc, setFormMovDesc,
  formMovMetodo, setFormMovMetodo,
  savingMovimiento, montoMinimo,
  handleRegistrarMovimiento,
}: AhorroVoluntarioDialogMovimientoProps) {

  return (
    <Dialog
      open={isMovimientoDialogOpen}
      onOpenChange={(open) => { if (!open) setIsMovimientoDialogOpen(false); }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {formMovTipo === 'Depósito'
              ? <><ArrowDownCircle className="size-5 text-emerald-600" /> Registrar Depósito</>
              : <><ArrowUpCircle className="size-5 text-red-600" /> Registrar Retiro</>
            }
          </DialogTitle>
          <DialogDescription>
            {selectedItem && (
              <>
                Asociado: <span className="font-semibold">{selectedItem.asociado}</span>
                {' — '}Saldo disponible:{' '}
                <span className="font-semibold text-purple-700">
                  {formatCurrency(selectedItem.montoAhorrado)}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">

          {/* ── Banner mes fiscal (solo depósitos) ── */}
          {formMovTipo === 'Depósito' && (() => {
            const { nombreMes, diaFin } = getMesFiscal();
            return (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-0.5">
                <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  Mes fiscal: <span className="capitalize ml-1">{nombreMes}</span>
                  <span className="font-normal text-blue-600 ml-1">(día 1 al {diaFin})</span>
                </p>
                <p className="text-xs text-blue-700">
                  Mínimo por depósito: <strong>{formatCurrency(montoMinimo)}</strong>
                  {' · '}La fecha debe estar entre el día 1 y el día {diaFin} del mes en curso.
                </p>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-3">
            {/* Monto */}
            <div className="space-y-2">
              <Label>
                Monto <span className="text-red-500">*</span>
                {formMovTipo === 'Depósito' && (
                  <span className="ml-1 text-xs text-blue-600 font-normal">
                    (mín. {formatCurrency(montoMinimo)})
                  </span>
                )}
              </Label>
              <Input
                type="text"
                placeholder="50.000,0"
                value={formMovMonto}
                onChange={(e) => setFormMovMonto(e.target.value.replace(/[^\d.,]/g, ''))}
                onBlur={() =>
                  formMovMonto &&
                  setFormMovMonto(formatCurrencyInput(parseCurrencyInput(formMovMonto).toString()))
                }
                className={
                  formMovTipo === 'Retiro'
                    ? 'border-red-200 focus-visible:ring-red-300'
                    : 'border-emerald-200 focus-visible:ring-emerald-300'
                }
              />
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <Label>Fecha <span className="text-red-500">*</span></Label>
              {formMovTipo === 'Depósito' ? (() => {
                const { primerDia, ultimoDia } = getMesFiscal();
                return (
                  <Input
                    type="date"
                    value={formMovFecha}
                    onChange={(e) => setFormMovFecha(e.target.value)}
                    min={primerDia}
                    max={ultimoDia}
                  />
                );
              })() : (
                <Input
                  type="date"
                  value={formMovFecha}
                  onChange={(e) => setFormMovFecha(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Método de pago */}
          <div className="space-y-2">
            <Label>Método de pago <span className="text-xs text-slate-400">(opcional)</span></Label>
            <Select value={formMovMetodo} onValueChange={setFormMovMetodo}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Efectivo">Efectivo</SelectItem>
                <SelectItem value="Transferencia">Transferencia bancaria</SelectItem>
                <SelectItem value="PSE">PSE</SelectItem>
                <SelectItem value="Consignación">Consignación</SelectItem>
                <SelectItem value="Débito automático">Débito automático</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label>Descripción <span className="text-xs text-slate-400">(opcional)</span></Label>
            <Input
              type="text"
              placeholder="Ej: Ahorro quincenal mayo 2026"
              value={formMovDesc}
              onChange={(e) => setFormMovDesc(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsMovimientoDialogOpen(false)}
            disabled={savingMovimiento}
          >
            Cancelar
          </Button>
          <Button
            className={
              formMovTipo === 'Depósito'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-600 hover:bg-red-700'
            }
            onClick={handleRegistrarMovimiento}
            disabled={savingMovimiento}
          >
            {savingMovimiento ? 'Guardando...' : `Confirmar ${formMovTipo}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
