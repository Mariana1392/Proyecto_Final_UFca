// ── AhorroDialogCrear.tsx ─────────────────────────────────────────────────────
// Diálogo para crear un nuevo ahorro permanente o editar uno existente.

import { Calendar, ClipboardList } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import { toast } from 'sonner';
import { formatCurrency, parseCurrencyInput } from '../../lib/formatters';

interface AhorroDialogCrearProps {
  open:                    boolean;
  onClose:                 () => void;
  selectedItem:            any;
  // Asociado
  formAsociadoId:          string;
  setFormAsociadoId:       (v: string) => void;
  asociadosDisponibles:    any[];
  // Cuota mensual
  formCuotaMensual:        string;
  handleCuotaMensualChange:(e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCuotaMensualBlur:  () => void;
  montoObligatorio:        number;
  // Saldo inicial
  formSaldoInicial:        string;
  handleSaldoInicialChange:(e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaldoInicialBlur:  () => void;
  saldoInicialError:       string;
  // Fecha de inicio
  formFechaInicio:         string;
  setFormFechaInicio:      (v: string) => void;
  editHasMovimientos:      boolean;
  loadingEditMovs:         boolean;
  // Observaciones (solo editar)
  formObservaciones:       string;
  setFormObservaciones:    (v: string) => void;
  // Acciones
  handleSaveAhorro:        () => void;
  setIsConfirmEditDialogOpen: (v: boolean) => void;
}

export default function AhorroDialogCrear({
  open, onClose, selectedItem,
  formAsociadoId, setFormAsociadoId, asociadosDisponibles,
  formCuotaMensual, handleCuotaMensualChange, handleCuotaMensualBlur, montoObligatorio,
  formSaldoInicial, handleSaldoInicialChange, handleSaldoInicialBlur, saldoInicialError,
  formFechaInicio, setFormFechaInicio, editHasMovimientos, loadingEditMovs,
  formObservaciones, setFormObservaciones,
  handleSaveAhorro, setIsConfirmEditDialogOpen,
}: AhorroDialogCrearProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selectedItem ? 'Editar ahorro permanente' : 'Nuevo ahorro permanente'}
          </DialogTitle>
          <DialogDescription>
            {selectedItem
              ? `Modifica los datos del ahorro de "${selectedItem.asociado}". El saldo solo cambia mediante aportes registrados.`
              : 'Registra un nuevo ahorro permanente para un asociado'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Asociado — siempre deshabilitado al editar */}
          <div className="space-y-2">
            <Label htmlFor="asociado">Asociado *</Label>
            <Select value={formAsociadoId} onValueChange={setFormAsociadoId} disabled={!!selectedItem}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar asociado...">
                  {selectedItem ? selectedItem.asociado : 'Seleccionar asociado...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {asociadosDisponibles.filter(a => a.estado).map(asociado => (
                  <SelectItem key={asociado.id} value={asociado.id}>
                    {asociado.nombre} ({asociado.cedula})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cuota mensual — siempre editable */}
          <div className="space-y-2">
            <Label htmlFor="cuota">Cuota mensual obligatoria *</Label>
            <Input
              id="cuota"
              type="text"
              placeholder="100.000,0"
              value={formCuotaMensual}
              onChange={handleCuotaMensualChange}
              onBlur={handleCuotaMensualBlur}
            />
            <p className="text-xs text-slate-500">
              Monto mensual obligatorio — mínimo{' '}
              <span className="font-semibold text-emerald-700">
                {montoObligatorio.toLocaleString('es-CO', {
                  style: 'currency', currency: 'COP', minimumFractionDigits: 0,
                })}
              </span>
            </p>
          </div>

          {/* Saldo inicial — solo al crear */}
          {!selectedItem && (
            <div className="space-y-2">
              <Label htmlFor="saldo" className={saldoInicialError ? 'text-red-600' : ''}>
                Saldo inicial
              </Label>
              <Input
                id="saldo"
                type="text"
                placeholder="0,0"
                value={formSaldoInicial}
                onChange={handleSaldoInicialChange}
                onBlur={handleSaldoInicialBlur}
                className={saldoInicialError
                  ? 'border-red-500 focus-visible:ring-red-400 bg-red-50 text-red-700 placeholder:text-red-300'
                  : ''}
              />
              {saldoInicialError
                ? <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <span>⚠️</span> {saldoInicialError}
                  </p>
                : <p className="text-xs text-slate-500">
                    Monto inicial del plan (opcional, déjelo en 0 si no aplica)
                  </p>
              }
            </div>
          )}

          {/* Fecha de inicio */}
          {!selectedItem ? (
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha de inicio *</Label>
              <Input
                id="fecha"
                type="date"
                value={formFechaInicio}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormFechaInicio(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="fecha-edit" className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-slate-400" />
                Fecha de inicio
                {!loadingEditMovs && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                    editHasMovimientos
                      ? 'bg-slate-100 text-slate-500 border-slate-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {editHasMovimientos ? 'No editable' : 'Editable'}
                  </span>
                )}
              </Label>
              {loadingEditMovs ? (
                <div className="h-9 rounded-md bg-slate-100 animate-pulse" />
              ) : editHasMovimientos ? (
                <>
                  <div className="flex items-center px-3 h-9 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500 select-none cursor-not-allowed">
                    {formFechaInicio}
                    <span className="ml-auto text-xs text-slate-400">Bloqueado</span>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <span>🔒</span> No se puede modificar la fecha de inicio porque ya existen movimientos registrados.
                  </p>
                </>

              ) : (
                <>
                  <Input
                    id="fecha-edit"
                    type="date"
                    value={formFechaInicio}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormFechaInicio(e.target.value)}
                  />
                  <p className="text-xs text-amber-600">
                    Solo es editable porque aún no hay movimientos registrados.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Observaciones — solo al editar */}
          {selectedItem && (
            <div className="space-y-2">
              <Label htmlFor="observaciones" className="flex items-center gap-1.5">
                <ClipboardList className="size-3.5 text-slate-400" />
                Observaciones internas
              </Label>
              <Textarea
                id="observaciones"
                placeholder="Notas del administrador sobre este ahorro (acuerdos, convenios, novedades)..."
                value={formObservaciones}
                onChange={(e) => setFormObservaciones(e.target.value)}
                className="resize-none text-sm"
                rows={2}
              />
              <p className="text-xs text-slate-500">Nota interna. No es visible para el asociado.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              if (selectedItem) {
                const cuota = parseCurrencyInput(formCuotaMensual);
                if (!cuota || cuota <= 0) {
                  toast.error('❌ Error de validación', { description: 'La cuota debe ser mayor a cero' });
                  return;
                }
                setIsConfirmEditDialogOpen(true);
              } else {
                handleSaveAhorro();
              }
            }}
          >
            {selectedItem ? 'Actualizar' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
