import { Label } from '../ui/label';
import { AlertTriangle, XCircle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';

interface Props {
  openAdvertencia: boolean;
  onOpenChangeAdvertencia: (open: boolean) => void;
  openConfirm: boolean;
  onOpenChangeConfirm: (open: boolean) => void;
  asociado: any;
  deleteJustification: string;
  setDeleteJustification: (v: string) => void;
  onPrimeraConfirmacion: () => void;
  onConfirmFinal: () => void;
  onCancelar: () => void;
}

export function AsociadoDialogEliminar({
  openAdvertencia, onOpenChangeAdvertencia,
  openConfirm, onOpenChangeConfirm,
  asociado, deleteJustification, setDeleteJustification,
  onPrimeraConfirmacion, onConfirmFinal, onCancelar,
}: Props) {
  return (
    <>
      {/* Paso 1 — Advertencia */}
      <AlertDialog open={openAdvertencia} onOpenChange={onOpenChangeAdvertencia}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="size-6" />
              ⚠️ ELIMINACIÓN PERMANENTE - Primera Confirmación
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded">
                <p className="text-red-900 font-semibold mb-2">Está a punto de ELIMINAR PERMANENTEMENTE al asociado:</p>
                <div className="bg-white p-3 rounded border border-red-200 mt-2">
                  <p className="text-slate-900"><strong>Nombre:</strong> {asociado?.nombre}</p>
                  <p className="text-slate-900"><strong>Cédula:</strong> {asociado?.cedula}</p>
                  <p className="text-slate-900"><strong>Estado:</strong>{' '}
                    <span className={asociado?.estado ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                      {asociado?.estado ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </p>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-300 p-4 rounded">
                <p className="text-yellow-900 font-semibold mb-2">⚠️ CRITERIOS DE ELIMINACIÓN:</p>
                <ul className="text-sm text-yellow-800 space-y-2 ml-4 list-disc">
                  <li><strong>Solo asociados INACTIVOS</strong> pueden ser eliminados</li>
                  <li><strong>NO debe tener créditos con saldo pendiente</strong></li>
                  <li><strong>NO debe tener cuentas de ahorro con saldo</strong></li>
                  <li><strong>NO debe tener productos activos</strong> en el sistema</li>
                  <li>Esta acción <strong>NO SE PUEDE DESHACER</strong></li>
                </ul>
              </div>
              <p className="text-slate-600 text-sm italic">
                ℹ️ Si continúa, se le solicitará proporcionar una <strong>justificación obligatoria</strong> en el siguiente paso.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancelar}>❌ Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onPrimeraConfirmacion} className="bg-orange-600 hover:bg-orange-700">
              ⚠️ Continuar con Eliminación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paso 2 — Justificación */}
      <AlertDialog open={openConfirm} onOpenChange={onOpenChangeConfirm}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="size-6" />
              🔴 CONFIRMACIÓN FINAL - Justificación Obligatoria
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="bg-red-100 border-l-4 border-red-700 p-4 rounded">
                <p className="text-red-900 font-bold mb-2">⚠️ ÚLTIMA ADVERTENCIA - Esta acción es IRREVERSIBLE</p>
                <p className="text-red-800">Está a punto de eliminar permanentemente a <strong>"{asociado?.nombre}"</strong> del sistema.</p>
              </div>
              <div className="space-y-3">
                <Label htmlFor="justification" className="text-slate-900 font-semibold">
                  📝 Justificación de Eliminación (Obligatorio - mínimo 20 caracteres):
                </Label>
                <textarea
                  id="justification"
                  value={deleteJustification}
                  onChange={e => setDeleteJustification(e.target.value)}
                  placeholder="Ejemplo: Asociado retirado voluntariamente el 15/01/2025. Todas las obligaciones financieras liquidadas."
                  className="w-full min-h-[120px] p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  maxLength={500}
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {deleteJustification.length}/500 caracteres
                    {deleteJustification.length > 0 && deleteJustification.length < 20 && (
                      <span className="text-red-600 ml-2">⚠️ Se requieren al menos 20 caracteres</span>
                    )}
                  </span>
                  {deleteJustification.length >= 20 && <span className="text-emerald-600">✓ Justificación válida</span>}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { onOpenChangeConfirm(false); setDeleteJustification(''); onCancelar(); }}>
              ❌ Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmFinal}
              className="bg-red-600 hover:bg-red-700"
              disabled={!deleteJustification.trim() || deleteJustification.trim().length < 20}
            >
              🗑️ ELIMINAR PERMANENTEMENTE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
