// ── AhorroDialogCrear.tsx ─────────────────────────────────────────────────────
// Diálogo para crear un nuevo ahorro permanente o editar uno existente.

import { useState } from 'react';
import { Calendar, ClipboardList, Search, Check, Users } from 'lucide-react';
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
import SelectorAsociadoModal from '../SelectorAsociadoModal';

interface AhorroDialogCrearProps {
  open:                    boolean;
  onClose:                 () => void;
  selectedItem:            any;
  // Asociado
  formAsociadoId:          string;
  setFormAsociadoId:       (v: string) => void;
  asociadosDisponibles:    any[];
  autocompleteSearch:      string;
  setAutocompleteSearch:   (v: string) => void;
  showAutocomplete:        boolean;
  setShowAutocomplete:     (v: boolean) => void;
  autocompleteRef:         React.RefObject<HTMLDivElement | null>;
  acSuggestions:           any[];
  handleSelectAsociado:    (a: any) => void;
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
  autocompleteSearch, setAutocompleteSearch,
  showAutocomplete, setShowAutocomplete,
  autocompleteRef, acSuggestions, handleSelectAsociado,
  formCuotaMensual, handleCuotaMensualChange, handleCuotaMensualBlur, montoObligatorio,
  formSaldoInicial, handleSaldoInicialChange, handleSaldoInicialBlur, saldoInicialError,
  formFechaInicio, setFormFechaInicio, editHasMovimientos, loadingEditMovs,
  formObservaciones, setFormObservaciones,
  handleSaveAhorro, setIsConfirmEditDialogOpen,
}: AhorroDialogCrearProps) {
  const [isSelectorModalOpen, setIsSelectorModalOpen] = useState(false);

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
            <div className="flex gap-2">
              <div className="relative flex-1" ref={!selectedItem ? autocompleteRef : undefined}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10" />
                <Input
                  className="pl-10 pr-8"
                  placeholder="Buscar asociado por nombre o cédula..."
                  value={autocompleteSearch}
                  disabled={!!selectedItem}
                  autoComplete="off"
                  onChange={(e) => { setAutocompleteSearch(e.target.value); setFormAsociadoId(''); setShowAutocomplete(true); }}
                  onFocus={() => { if (!selectedItem) setShowAutocomplete(true); }}
                />
                {formAsociadoId && <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />}
                {showAutocomplete && !selectedItem && acSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                    {acSuggestions.map(a => (
                      <button key={a.id} type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 flex items-center justify-between group transition-colors"
                        onMouseDown={() => handleSelectAsociado(a)}>
                        <span className="font-medium text-slate-800 text-sm group-hover:text-emerald-700">{a.nombre}</span>
                        <span className="text-xs text-slate-400">{a.cedula}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showAutocomplete && !selectedItem && autocompleteSearch.length > 0 && acSuggestions.length === 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-sm text-slate-500 text-center">
                    Sin resultados para "{autocompleteSearch}"
                  </div>
                )}
              </div>
              {!selectedItem && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSelectorModalOpen(true)}
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 shrink-0 gap-1.5"
                >
                  <Users className="size-4" />
                  <span className="hidden sm:inline">Ver todos</span>
                </Button>
              )}
            </div>
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
            />
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
      <SelectorAsociadoModal
        open={isSelectorModalOpen}
        onClose={() => setIsSelectorModalOpen(false)}
        asociados={asociadosDisponibles.filter(a => a.activo !== false || a.estado_cuenta === 'activo')}
        onSelect={handleSelectAsociado}
      />
    </Dialog>
  );
}
