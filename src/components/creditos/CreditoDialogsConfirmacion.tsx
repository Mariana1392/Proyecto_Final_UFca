import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { formatCurrency } from '../../lib/formatters';
import { getEstadoBadge } from './creditoHelpers';
import { TIPOS_CREDITO } from '../../lib/constants';
import type { CreditosHook } from './useCreditos';

interface CreditoDialogsConfirmacionProps {
  hook: CreditosHook;
}

export default function CreditoDialogsConfirmacion({ hook }: CreditoDialogsConfirmacionProps) {
  const {
    // Anulación
    isDeleteDialogOpen, setIsDeleteDialogOpen,
    anulacionStep, setAnulacionStep,
    anulacionConfirmText, setAnulacionConfirmText,
    justificacionAnulacion, setJustificacionAnulacion,
    anulando,
    handleAnular,
    selectedItem, setSelectedItem,
    // Hard delete
    isHardDeleteDialogOpen, setIsHardDeleteDialogOpen,
    hardDeleteStep, setHardDeleteStep,
    hardDeleteConfirmText, setHardDeleteConfirmText,
    hardDeleteJustificacion, setHardDeleteJustificacion,
    hardDeleting,
    handleHardDelete,
    // Confirmar simulación
    isConfirmSimOpen, setIsConfirmSimOpen,
    simSeleccionada,
    confirmandoSim,
    handleConfirmarSimulacion,
    // Rechazar simulación
    isRechazarSimOpen, setIsRechazarSimOpen,
    rechazandoSim,
    handleRechazarSimulacion,
    // Rechazar solicitud
    isRechazarSolOpen, setIsRechazarSolOpen,
    solicitudSeleccionada, setSolicitudSeleccionada,
    notaRechazoSol, setNotaRechazoSol,
    savingRechazarSol,
    handleRechazarSolicitudCredito,
  } = hook;

  return (
    <>
      {/* ── Anular — Paso 1: ingresar justificación ── */}
      <AlertDialog open={isDeleteDialogOpen && anulacionStep === 1}
        onOpenChange={(open) => {
          if (!open) {
            setIsDeleteDialogOpen(false);
            setSelectedItem(null);
            setJustificacionAnulacion('');
            setAnulacionConfirmText('');
            setAnulacionStep(1);
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-5 text-amber-500" />
              Anular crédito — Paso 1 de 2
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Estás a punto de anular el siguiente crédito. Esta acción <strong>no se puede deshacer</strong>.</p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Asociado:</span>
                    <span className="font-semibold text-slate-800">{selectedItem?.asociado}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Monto original:</span>
                    <span className="font-semibold">{selectedItem ? formatCurrency(selectedItem.monto) : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Estado actual:</span>
                    <span>{selectedItem ? getEstadoBadge(selectedItem.estadoAprobacion) : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tipo:</span>
                    <span>{TIPOS_CREDITO.find(t => t.value === selectedItem?.tipo)?.label ?? selectedItem?.tipo}</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="px-1 pb-2 space-y-2">
            <Label className="font-medium text-slate-700">
              Motivo de la anulación <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Describe detalladamente el motivo de la anulación (crédito erróneo, duplicado, cancelado por el asociado, etc.)..."
              value={justificacionAnulacion}
              onChange={(e) => setJustificacionAnulacion(e.target.value)}
              className="resize-none min-h-[80px]"
              autoFocus
            />
            <p className="text-xs text-slate-400">
              {justificacionAnulacion.trim().length} caracteres
              {justificacionAnulacion.trim().length < 10 && ' · mínimo 10 caracteres'}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={justificacionAnulacion.trim().length < 10}
              onClick={() => setAnulacionStep(2)}
            >
              Continuar →
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Anular — Paso 2: confirmación final ── */}
      <AlertDialog open={isDeleteDialogOpen && anulacionStep === 2}
        onOpenChange={(open) => {
          if (!open) {
            setIsDeleteDialogOpen(false);
            setSelectedItem(null);
            setJustificacionAnulacion('');
            setAnulacionConfirmText('');
            setAnulacionStep(1);
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="size-5 text-red-600" />
              Confirmación final — Paso 2 de 2
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm">
                <div className="p-3 bg-slate-50 rounded-lg border space-y-1 text-xs text-slate-700">
                  <p><span className="font-semibold">Asociado:</span> {selectedItem?.asociado}</p>
                  <p><span className="font-semibold">Monto:</span> {formatCurrency(selectedItem?.monto ?? 0)}</p>
                  <p className="text-slate-500 italic">
                    <span className="font-semibold not-italic text-slate-700">Motivo registrado:</span>{' '}
                    {justificacionAnulacion.trim()}
                  </p>
                </div>

                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    El crédito quedará marcado como <strong>anulado</strong> y no podrá operarse ni
                    eliminarse sin autorización. Esta acción queda registrada en el sistema.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium">
                    Para confirmar, escribe{' '}
                    <span className="font-bold text-red-600 tracking-wide">ANULAR</span>{' '}
                    en el campo:
                  </Label>
                  <Input
                    placeholder="Escribe ANULAR aquí..."
                    value={anulacionConfirmText}
                    onChange={(e) => setAnulacionConfirmText(e.target.value)}
                    className={`font-mono font-semibold tracking-widest ${
                      anulacionConfirmText === 'ANULAR'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : ''
                    }`}
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setAnulacionStep(1)} disabled={anulando}>
              ← Volver
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40"
              disabled={anulacionConfirmText !== 'ANULAR' || anulando}
              onClick={handleAnular}
            >
              {anulando ? 'Anulando...' : 'Confirmar anulación'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Eliminación definitiva — Paso 1 ── */}
      <AlertDialog open={isHardDeleteDialogOpen && hardDeleteStep === 1}
        onOpenChange={(open) => { if (!open) { setIsHardDeleteDialogOpen(false); setSelectedItem(null); setHardDeleteJustificacion(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="size-5" /> Eliminar crédito definitivamente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {selectedItem && (
                  <div className="p-3 bg-slate-50 rounded-lg border text-slate-700 space-y-1 text-xs">
                    <p><span className="font-semibold">Asociado:</span> {selectedItem.asociado}</p>
                    <p><span className="font-semibold">Monto:</span> {formatCurrency(selectedItem.monto)}</p>
                    <p><span className="font-semibold">Estado:</span> {selectedItem.anulado ? 'Anulado' : selectedItem.estadoAprobacion}</p>
                    {selectedItem.saldo > 0 && (
                      <p className="text-red-600 font-semibold">⚠ Saldo pendiente: {formatCurrency(selectedItem.saldo)}</p>
                    )}
                  </div>
                )}
                {selectedItem && selectedItem.saldo > 0 && !selectedItem.anulado ? (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">
                      No se puede eliminar un crédito con saldo activo ({formatCurrency(selectedItem.saldo)}).
                      Anula el crédito primero antes de eliminarlo definitivamente.
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-600">
                    Esta acción es <strong>irreversible</strong>. Se eliminará el crédito y todo su
                    historial de pagos permanentemente. ¿Deseas continuar?
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {(selectedItem?.saldo === 0 || selectedItem?.anulado) && (
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => setHardDeleteStep(2)}
              >
                Sí, continuar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Eliminación definitiva — Paso 2 ── */}
      <AlertDialog open={isHardDeleteDialogOpen && hardDeleteStep === 2}
        onOpenChange={(open) => { if (!open) { setIsHardDeleteDialogOpen(false); setSelectedItem(null); setHardDeleteStep(1); setHardDeleteJustificacion(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="size-5" /> Confirmación final — acción irreversible
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <p>
                    Estás a punto de eliminar permanentemente el crédito de{' '}
                    <strong>{selectedItem?.asociado}</strong> por{' '}
                    <strong>{formatCurrency(selectedItem?.monto ?? 0)}</strong>.
                    Esta acción no se puede deshacer.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium">
                    Justificación de la eliminación <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Describe el motivo de la eliminación..."
                    value={hardDeleteJustificacion}
                    onChange={(e) => setHardDeleteJustificacion(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium">
                    Para confirmar, escribe <span className="font-bold text-red-600">ELIMINAR</span> en el campo:
                  </Label>
                  <Input
                    placeholder="Escribe ELIMINAR aquí..."
                    value={hardDeleteConfirmText}
                    onChange={(e) => setHardDeleteConfirmText(e.target.value)}
                    className={`font-mono ${hardDeleteConfirmText === 'ELIMINAR' ? 'border-red-500 bg-red-50' : ''}`}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHardDeleteStep(1)}>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40"
              disabled={hardDeleteConfirmText !== 'ELIMINAR' || !hardDeleteJustificacion.trim() || hardDeleting}
              onClick={handleHardDelete}
            >
              {hardDeleting ? 'Eliminando...' : 'Eliminar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmar simulación ── */}
      <AlertDialog open={isConfirmSimOpen} onOpenChange={setIsConfirmSimOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar y activar este crédito?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  El crédito por <strong className="text-slate-800">{simSeleccionada ? formatCurrency(simSeleccionada.monto) : ''}</strong> a{' '}
                  <strong className="text-slate-800">{simSeleccionada?.plazo} meses</strong> quedará registrado como{' '}
                  <strong className="text-emerald-600">Activo</strong> de inmediato en Gestión de Créditos.
                </p>
                <p className="text-xs text-slate-400">
                  Esta acción no se puede deshacer. El administrador recibirá una notificación.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleConfirmarSimulacion}
              disabled={confirmandoSim}
            >
              {confirmandoSim ? 'Activando crédito...' : '🎉 Sí, activar crédito'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Rechazar simulación ── */}
      <AlertDialog open={isRechazarSimOpen} onOpenChange={setIsRechazarSimOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar esta simulación?</AlertDialogTitle>
            <AlertDialogDescription>
              Al rechazar, la simulación de crédito por <strong>{simSeleccionada ? formatCurrency(simSeleccionada.monto) : ''}</strong> se eliminará permanentemente y no quedará ningún registro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRechazarSimulacion}
              disabled={rechazandoSim}
            >
              {rechazandoSim ? 'Rechazando...' : '❌ Sí, rechazar y eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Rechazar solicitud de crédito (admin) ── */}
      <AlertDialog open={isRechazarSolOpen} onOpenChange={(open) => {
        if (!open) { setIsRechazarSolOpen(false); setSolicitudSeleccionada(null); setNotaRechazoSol(''); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="size-5 text-red-600" /> Rechazar solicitud de crédito
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {solicitudSeleccionada && (
                  <div className="p-3 bg-slate-50 rounded-lg border space-y-1 text-xs text-slate-700">
                    <p><span className="font-semibold">Asociado:</span> {solicitudSeleccionada.asociado}</p>
                    <p><span className="font-semibold">Monto:</span> {formatCurrency(solicitudSeleccionada.monto)}</p>
                    <p><span className="font-semibold">Tipo:</span> {solicitudSeleccionada.tipoCreditoLabel}</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium">
                    Motivo del rechazo <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    placeholder="Explica el motivo por el que se rechaza la solicitud..."
                    value={notaRechazoSol}
                    onChange={(e) => setNotaRechazoSol(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400">El asociado recibirá una notificación con este mensaje.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40"
              disabled={!notaRechazoSol.trim() || savingRechazarSol}
              onClick={handleRechazarSolicitudCredito}
            >
              {savingRechazarSol ? 'Rechazando...' : 'Confirmar rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
