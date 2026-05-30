// ── AhorroDialogsConfirmacion.tsx ─────────────────────────────────────────────
// Agrupa los 7 AlertDialogs de confirmación del módulo de ahorro permanente:
//   1. Advertencia aporte bajo el mínimo
//   2. Advertencia saldo inicial bajo el mínimo
//   3. Confirmación de anulación
//   4. Cambio de estado (Activo / Inactivo / Anulado)
//   5. Confirmación de edición de cuota
//   6. Rechazo de solicitud de apertura (admin)
//   7. Rechazo de aporte reportado (admin)

import { AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { formatCurrency, parseCurrencyInput } from '../../lib/formatters';

interface Props {
  // ── 1. Aporte bajo el mínimo ──────────────────────────────────────────────
  isConfirmAporteBajoOpen:    boolean;
  setIsConfirmAporteBajoOpen: (v: boolean) => void;
  formAporteMonto:            string;
  montoObligatorio:           number;
  ejecutarRegistrarAporte:    () => void;

  // ── 2. Saldo inicial bajo el mínimo ──────────────────────────────────────
  isConfirmSaldoBajoOpen:     boolean;
  setIsConfirmSaldoBajoOpen:  (v: boolean) => void;
  formSaldoInicial:           string;
  handleSaveAhorro:           (skip?: boolean) => void;

  // ── 3. Anulación ──────────────────────────────────────────────────────────
  isDeleteDialogOpen:         boolean;
  setIsDeleteDialogOpen:      (v: boolean) => void;
  selectedItem:               any;
  justificacionAnulacion:     string;
  setJustificacionAnulacion:  (v: string) => void;
  handleAnular:               () => void;
  setSelectedItem:            (v: any) => void;

  // ── 4. Cambio de estado ───────────────────────────────────────────────────
  isToggleEstadoDialogOpen:      boolean;
  setIsToggleEstadoDialogOpen:   (v: boolean) => void;
  nuevoEstadoSeleccionado:       'activo' | 'inactivo' | 'anulado';
  setNuevoEstadoSeleccionado:    (v: 'activo' | 'inactivo' | 'anulado') => void;
  handleToggleEstado:            () => void;

  // ── 5. Confirmación edición de cuota ──────────────────────────────────────
  isConfirmEditDialogOpen:       boolean;
  setIsConfirmEditDialogOpen:    (v: boolean) => void;
  formCuotaMensual:              string;
  formFechaInicio:               string;
  editHasMovimientos:            boolean;

  // ── 6. Rechazar solicitud (admin) ─────────────────────────────────────────
  isRechazarDialogOpen:          boolean;
  setIsRechazarDialogOpen:       (v: boolean) => void;
  solicitudSeleccionada:         any;
  setSolicitudSeleccionada:      (v: any) => void;
  notaRechazo:                   string;
  setNotaRechazo:                (v: string) => void;
  savingSolicitud:               boolean;
  handleRechazarSolicitud:       () => void;

  // ── 7. Rechazar aporte reportado (admin) ──────────────────────────────────
  isRechazarAporteOpen:          boolean;
  setIsRechazarAporteOpen:       (v: boolean) => void;
  aporteSeleccionado:            any;
  setAporteSeleccionado:         (v: any) => void;
  notaRechazoAporte:             string;
  setNotaRechazoAporte:          (v: string) => void;
  savingAporte:                  boolean;
  handleRechazarAporte:          () => void;
}

export default function AhorroDialogsConfirmacion({
  // 1
  isConfirmAporteBajoOpen, setIsConfirmAporteBajoOpen,
  formAporteMonto, montoObligatorio, ejecutarRegistrarAporte,
  // 2
  isConfirmSaldoBajoOpen, setIsConfirmSaldoBajoOpen,
  formSaldoInicial, handleSaveAhorro,
  // 3
  isDeleteDialogOpen, setIsDeleteDialogOpen,
  selectedItem, justificacionAnulacion, setJustificacionAnulacion, handleAnular, setSelectedItem,
  // 4
  isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen,
  nuevoEstadoSeleccionado, setNuevoEstadoSeleccionado, handleToggleEstado,
  // 5
  isConfirmEditDialogOpen, setIsConfirmEditDialogOpen,
  formCuotaMensual, formFechaInicio, editHasMovimientos,
  // 6
  isRechazarDialogOpen, setIsRechazarDialogOpen,
  solicitudSeleccionada, setSolicitudSeleccionada, notaRechazo, setNotaRechazo,
  savingSolicitud, handleRechazarSolicitud,
  // 7
  isRechazarAporteOpen, setIsRechazarAporteOpen,
  aporteSeleccionado, setAporteSeleccionado, notaRechazoAporte, setNotaRechazoAporte,
  savingAporte, handleRechazarAporte,
}: Props) {
  return (
    <>
      {/* ── 1. Advertencia: aporte menor al mínimo ────────────────────────── */}
      <AlertDialog open={isConfirmAporteBajoOpen} onOpenChange={setIsConfirmAporteBajoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Aporte por debajo del mínimo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  El monto ingresado es{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(parseCurrencyInput(formAporteMonto))}
                  </span>
                  , que está <span className="font-semibold">por debajo del mínimo obligatorio</span> de{' '}
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(montoObligatorio)}
                  </span>.
                </p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs font-medium">
                  ⚠️ Registrar un aporte inferior al mínimo puede generar inconsistencias en el
                  historial del asociado y afectar los cálculos del período.
                </div>
                <p>
                  Como administrador, puede continuar si existe una justificación válida
                  (pago parcial acordado, abono, etc.).
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmAporteBajoOpen(false)}>
              Cancelar — corregir monto
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => { setIsConfirmAporteBajoOpen(false); ejecutarRegistrarAporte(); }}
            >
              Sí, registrar de todas formas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── 2. Advertencia: saldo inicial menor al mínimo ─────────────────── */}
      <AlertDialog open={isConfirmSaldoBajoOpen} onOpenChange={setIsConfirmSaldoBajoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              ¿Está seguro del saldo inicial?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  El saldo inicial ingresado es{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(parseCurrencyInput(formSaldoInicial))}
                  </span>
                  , que está <span className="font-semibold">por debajo del mínimo obligatorio</span> de{' '}
                  <span className="font-semibold text-emerald-700">
                    {montoObligatorio.toLocaleString('es-CO', {
                      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
                    })}
                  </span>.
                </p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs font-medium">
                  ⚠️ Esto generará un desequilibrio en el historial del asociado. Se recomienda usar{' '}
                  <strong>0</strong> si no hay saldo de apertura, o un valor igual o superior al mínimo.
                </div>
                <p>¿Desea continuar de todas formas?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmSaldoBajoOpen(false)}>
              Cancelar — corregir valor
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => { setIsConfirmSaldoBajoOpen(false); handleSaveAhorro(true); }}
            >
              Sí, continuar de todas formas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── 3. Confirmación de anulación ──────────────────────────────────── */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) { setSelectedItem(null); setJustificacionAnulacion(''); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              ¿Confirmar anulación del ahorro permanente?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Estás a punto de anular el ahorro permanente de:</p>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Asociado:</span>
                    <span className="font-semibold text-slate-800">{selectedItem?.asociado}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cédula:</span>
                    <span className="text-slate-700">{selectedItem?.cedula}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Saldo acumulado:</span>
                    <span className="font-semibold text-red-700">
                      {selectedItem ? formatCurrency(selectedItem.montoAhorrado) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fecha de inicio:</span>
                    <span className="text-slate-700">{selectedItem?.fechaInicio}</span>
                  </div>
                </div>
                <p className="text-xs text-red-600 font-medium">
                  ⚠ Esta acción no se puede deshacer. El registro quedará en el historial como anulado.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2 space-y-2">
            <Label htmlFor="justificacion" className="text-slate-700 font-medium">
              Motivo de la anulación <span className="text-red-500">*</span>
            </Label>
            <Input
              id="justificacion"
              placeholder="Describe el motivo de la anulación..."
              value={justificacionAnulacion}
              onChange={(e) => setJustificacionAnulacion(e.target.value)}
              className={justificacionAnulacion.trim() ? 'border-red-400 focus-visible:ring-red-400' : 'border-slate-300'}
              autoFocus
            />
            <p className="text-xs text-slate-400">
              Este motivo quedará registrado en el historial del asociado.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSelectedItem(null); setJustificacionAnulacion(''); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAnular}
              className="bg-red-600 hover:bg-red-700"
              disabled={!justificacionAnulacion.trim()}
            >
              Sí, anular ahorro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── 4. Cambiar estado (Activo / Inactivo / Anulado) ───────────────── */}
      <AlertDialog
        open={isToggleEstadoDialogOpen}
        onOpenChange={(open) => {
          setIsToggleEstadoDialogOpen(open);
          if (!open) { setSelectedItem(null); setJustificacionAnulacion(''); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar estado del ahorro</AlertDialogTitle>
            <AlertDialogDescription>
              Selecciona el nuevo estado para el ahorro de{' '}
              <span className="font-semibold">"{selectedItem?.asociado}"</span>.
              Estado actual:{' '}
              <Badge className={selectedItem?.estado ? 'bg-emerald-600 ml-1' : 'bg-yellow-100 text-yellow-700 ml-1'}>
                {selectedItem?.estado ? 'Activo' : 'Inactivo'}
              </Badge>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(['activo', 'inactivo', 'anulado'] as const).map(estado => (
                <button
                  key={estado}
                  onClick={() => {
                    setNuevoEstadoSeleccionado(estado);
                    if (estado !== 'anulado') setJustificacionAnulacion('');
                  }}
                  className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    nuevoEstadoSeleccionado === estado
                      ? estado === 'activo'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : estado === 'inactivo'
                          ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                          : 'border-red-500 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {estado === 'activo' ? 'Activo' : estado === 'inactivo' ? 'Inactivo' : 'Anulado'}
                </button>
              ))}
            </div>
            <div className={`space-y-2 p-3 rounded-lg border ${
              nuevoEstadoSeleccionado === 'anulado'  ? 'bg-red-50 border-red-200' :
              nuevoEstadoSeleccionado === 'inactivo' ? 'bg-yellow-50 border-yellow-200' :
              'bg-emerald-50 border-emerald-200'
            }`}>
              <Label className={`font-medium ${
                nuevoEstadoSeleccionado === 'anulado'  ? 'text-red-700' :
                nuevoEstadoSeleccionado === 'inactivo' ? 'text-yellow-700' :
                'text-emerald-700'
              }`}>
                Justificación <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder={
                  nuevoEstadoSeleccionado === 'anulado'  ? 'Motivo de la anulación...' :
                  nuevoEstadoSeleccionado === 'inactivo' ? 'Motivo de la desactivación...' :
                  'Motivo de la reactivación...'
                }
                value={justificacionAnulacion}
                onChange={(e) => setJustificacionAnulacion(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSelectedItem(null); setJustificacionAnulacion(''); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleEstado}
              disabled={!justificacionAnulacion.trim()}
              className={
                nuevoEstadoSeleccionado === 'activo'   ? 'bg-emerald-600 hover:bg-emerald-700' :
                nuevoEstadoSeleccionado === 'inactivo' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-red-600 hover:bg-red-700'
              }
            >
              Confirmar cambio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── 5. Confirmación de edición de cuota ───────────────────────────── */}
      <AlertDialog open={isConfirmEditDialogOpen} onOpenChange={setIsConfirmEditDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-emerald-500" />
              ¿Confirmar edición del ahorro?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  Estás a punto de modificar el ahorro de{' '}
                  <span className="font-semibold text-slate-800">{selectedItem?.asociado}</span>.
                </p>
                <div className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                  <div className="text-center flex-1">
                    <p className="text-xs text-slate-400">Cuota anterior</p>
                    <p className="font-semibold text-slate-700">
                      {selectedItem ? formatCurrency(selectedItem.cuotaMensual) : ''}
                    </p>
                  </div>
                  <div className="text-slate-400 font-bold">→</div>
                  <div className="text-center flex-1">
                    <p className="text-xs text-slate-400">Nueva cuota</p>
                    <p className="font-semibold text-emerald-700">
                      {formCuotaMensual ? formatCurrency(parseCurrencyInput(formCuotaMensual)) : ''}
                    </p>
                  </div>
                </div>
                {!editHasMovimientos && formFechaInicio !== selectedItem?.fechaInicio && (
                  <div className="flex items-center gap-3 py-2 px-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-center flex-1">
                      <p className="text-xs text-amber-500">Fecha inicio anterior</p>
                      <p className="font-semibold text-slate-700">{selectedItem?.fechaInicio ?? '—'}</p>
                    </div>
                    <div className="text-amber-400 font-bold">→</div>
                    <div className="text-center flex-1">
                      <p className="text-xs text-amber-500">Nueva fecha inicio</p>
                      <p className="font-semibold text-amber-700">{formFechaInicio}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-400">Los cambios se aplicarán de forma inmediata.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmEditDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => { setIsConfirmEditDialogOpen(false); handleSaveAhorro(); }}
            >
              Sí, confirmar cambio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── 6. Rechazar solicitud (admin) ──────────────────────────────────── */}
      <AlertDialog
        open={isRechazarDialogOpen}
        onOpenChange={(open) => {
          setIsRechazarDialogOpen(open);
          if (!open) { setSolicitudSeleccionada(null); setNotaRechazo(''); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-500" />
              Rechazar solicitud de ahorro permanente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a rechazar la solicitud de{' '}
              <span className="font-semibold">
                {solicitudSeleccionada?.usuarios?.nombre ?? '—'}
              </span>.
              El asociado recibirá una notificación con el motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-slate-700 font-medium">
              Motivo del rechazo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Explica el motivo del rechazo..."
              value={notaRechazo}
              onChange={(e) => setNotaRechazo(e.target.value)}
              className="min-h-[80px]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingSolicitud}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRechazarSolicitud}
              disabled={!notaRechazo.trim() || savingSolicitud}
            >
              {savingSolicitud ? 'Guardando...' : 'Confirmar rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── 7. Rechazar aporte reportado (admin) ──────────────────────────── */}
      <AlertDialog
        open={isRechazarAporteOpen}
        onOpenChange={(open) => {
          setIsRechazarAporteOpen(open);
          if (!open) { setAporteSeleccionado(null); setNotaRechazoAporte(''); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-500" />
              Rechazar aporte reportado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  Vas a rechazar el aporte de{' '}
                  <span className="font-semibold">
                    {aporteSeleccionado?.usuarios?.nombre ?? '—'}
                  </span>{' '}
                  por{' '}
                  <span className="font-semibold text-slate-800">
                    {aporteSeleccionado ? formatCurrency(aporteSeleccionado.monto) : ''}
                  </span>{' '}
                  vía <span className="font-medium">{aporteSeleccionado?.medio_pago}</span>.
                </p>
                <p className="text-xs text-slate-400">
                  El asociado recibirá una notificación con el motivo del rechazo.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-slate-700 font-medium">
              Motivo del rechazo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Explica el motivo del rechazo..."
              value={notaRechazoAporte}
              onChange={(e) => setNotaRechazoAporte(e.target.value)}
              className="min-h-[80px]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingAporte}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRechazarAporte}
              disabled={!notaRechazoAporte.trim() || savingAporte}
            >
              {savingAporte ? 'Guardando...' : 'Confirmar rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
