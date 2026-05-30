// ── AhorroVoluntarioDialogCrear.tsx ─────────────────────────────────────────
// Diálogo de creación / edición de un ahorro voluntario.

import { Search, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';

interface AhorroVoluntarioDialogCrearProps {
  isCreateDialogOpen:    boolean;
  setIsCreateDialogOpen: (v: boolean) => void;
  selectedItem:          any;
  setSelectedItem:       (v: any) => void;
  // Formulario
  formAsociadoId:        string;
  formSaldoInicial:      string;
  formFechaInicio:       string;
  setFormFechaInicio:    (v: string) => void;
  // Autocompletado
  autocompleteSearch:    string;
  setAutocompleteSearch: (v: string) => void;
  setFormAsociadoId:     (v: string) => void;
  showAutocomplete:      boolean;
  setShowAutocomplete:   (v: boolean) => void;
  autocompleteRef:       React.RefObject<HTMLDivElement | null>;
  autocompleteSuggestions: any[];
  handleSelectAsociado:  (a: any) => void;
  // Frecuencia y objetivo
  formFrecuencia:       string;
  setFormFrecuencia:    (v: string) => void;
  formMontoObjetivo:    string;
  setFormMontoObjetivo: (v: string) => void;
  // Handlers
  handleSaldoInicialChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaldoInicialBlur:   () => void;
  handleSaveAhorro:         (forzar?: boolean) => void;
}

export default function AhorroVoluntarioDialogCrear({
  isCreateDialogOpen, setIsCreateDialogOpen,
  selectedItem, setSelectedItem,
  formAsociadoId, formSaldoInicial, formFechaInicio, setFormFechaInicio,
  autocompleteSearch, setAutocompleteSearch, setFormAsociadoId,
  showAutocomplete, setShowAutocomplete,
  autocompleteRef, autocompleteSuggestions, handleSelectAsociado,
  formFrecuencia, setFormFrecuencia,
  formMontoObjetivo, setFormMontoObjetivo,
  handleSaldoInicialChange, handleSaldoInicialBlur,
  handleSaveAhorro,
}: AhorroVoluntarioDialogCrearProps) {
  const handleClose = () => {
    setIsCreateDialogOpen(false);
    setSelectedItem(null);
    setAutocompleteSearch('');
    setFormFrecuencia('');
    setFormMontoObjetivo('');
  };

  return (
    <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selectedItem ? 'Editar ahorro voluntario' : 'Registrar ahorro voluntario'}
          </DialogTitle>
          <DialogDescription>
            {selectedItem
              ? 'Actualiza la información del ahorro voluntario'
              : 'Define el plan de ahorro voluntario para un asociado'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* ── Asociado con autocompletado ── */}
          <div className="space-y-2">
            <Label>Asociado <span className="text-red-500">*</span></Label>
            <div className="relative" ref={!selectedItem ? autocompleteRef : undefined}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                className="pl-10"
                placeholder="Buscar por nombre o cédula..."
                value={autocompleteSearch}
                disabled={!!selectedItem}
                onChange={(e) => {
                  setAutocompleteSearch(e.target.value);
                  setFormAsociadoId('');
                  setShowAutocomplete(true);
                }}
                onFocus={() => { if (!selectedItem) setShowAutocomplete(true); }}
                autoComplete="off"
              />
              {formAsociadoId && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
              )}
              {showAutocomplete && !selectedItem && autocompleteSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {autocompleteSuggestions.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-purple-50 flex items-center justify-between group transition-colors"
                      onMouseDown={() => handleSelectAsociado(a)}
                    >
                      <span className="font-medium text-slate-800 text-sm group-hover:text-purple-700">{a.nombre}</span>
                      <span className="text-xs text-slate-400">{a.cedula}</span>
                    </button>
                  ))}
                </div>
              )}
              {showAutocomplete && !selectedItem && autocompleteSearch.length > 0 && autocompleteSuggestions.length === 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-sm text-slate-500 text-center">
                  Sin resultados para "{autocompleteSearch}"
                </div>
              )}
            </div>
            {!formAsociadoId && autocompleteSearch.length > 0 && (
              <p className="text-xs text-amber-600">Selecciona un asociado de la lista de sugerencias</p>
            )}
          </div>

          {/* ── Saldo inicial + Fecha ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="saldo">Saldo inicial</Label>
              <Input
                id="saldo"
                type="text"
                placeholder="0,0"
                value={formSaldoInicial}
                onChange={handleSaldoInicialChange}
                onBlur={handleSaldoInicialBlur}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha de inicio <span className="text-red-500">*</span></Label>
              <Input
                id="fecha"
                type="date"
                value={formFechaInicio}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormFechaInicio(e.target.value)}
              />
            </div>
          </div>

          {/* ── Frecuencia de ahorro + Monto objetivo (opcionales) ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="frecuencia">
                Frecuencia de ahorro
                <span className="ml-1 text-xs text-slate-400">(opcional)</span>
              </Label>
              <Select
                value={formFrecuencia || 'sin-frecuencia'}
                onValueChange={(v) => setFormFrecuencia(v === 'sin-frecuencia' ? '' : v)}
              >
                <SelectTrigger id="frecuencia">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin-frecuencia">Sin especificar</SelectItem>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="ocasional">Ocasional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="objetivo">
                Monto objetivo
                <span className="ml-1 text-xs text-slate-400">(opcional)</span>
              </Label>
              <Input
                id="objetivo"
                type="number"
                min="0"
                step="1000"
                placeholder="Ej: 500000"
                value={formMontoObjetivo}
                onChange={(e) => setFormMontoObjetivo(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => handleSaveAhorro()}>
            {selectedItem ? 'Actualizar' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
