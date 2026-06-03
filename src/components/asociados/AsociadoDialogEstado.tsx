import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asociado: any;
  onConfirm: (id: string) => void;
}

export function AsociadoDialogEstado({ open, onOpenChange, asociado, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {asociado?.estado
              ? <><AlertTriangle className="size-5 text-orange-600" />¿Desactivar asociado?</>
              : <><CheckCircle2 className="size-5 text-emerald-600" />¿Activar asociado?</>
            }
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>Estás a punto de {asociado?.estado ? 'desactivar' : 'activar'} al asociado <strong>"{asociado?.nombre}"</strong>.</p>
            {asociado?.estado ? (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                <p className="text-sm text-red-800 font-semibold mb-2">⛔ Al desactivar, el asociado NO podrá:</p>
                <ul className="text-sm text-red-700 space-y-1 ml-4 list-disc">
                  <li>Solicitar nuevos créditos</li>
                  <li>Abrir cuentas de ahorro</li>
                  <li>Registrar referidos</li>
                  <li>Participar en eventos</li>
                </ul>
              </div>
            ) : (
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded">
                <p className="text-sm text-emerald-800 font-semibold mb-2">✅ Al activar, el asociado recuperará:</p>
                <ul className="text-sm text-emerald-700 space-y-1 ml-4 list-disc">
                  <li>Acceso completo a todas las operaciones</li>
                  <li>Capacidad de solicitar créditos</li>
                  <li>Apertura de cuentas de ahorro</li>
                  <li>Registro de referidos y participación en eventos</li>
                </ul>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(asociado?.id)}
            className={asociado?.estado ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'}
          >
            {asociado?.estado ? 'Desactivar' : 'Activar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
