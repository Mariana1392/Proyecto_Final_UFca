import { LogOut, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import type { RetiroStatus } from './useRetiro';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asociado: any;
  status: RetiroStatus | null;
  retirando: boolean;
  onDesactivar: () => void;
  onActualizar: () => void;
}

function StepRow({ num, ok, title, detail, bloqueado }: {
  num: string; ok: boolean; title: string; detail: string; bloqueado?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${
      ok ? 'bg-emerald-50 border-emerald-200' : bloqueado ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
    }`}>
      <div className={`shrink-0 size-7 rounded-full flex items-center justify-center font-bold text-sm ${
        ok ? 'bg-emerald-600 text-white' : bloqueado ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'
      }`}>
        {ok ? '✓' : num}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${ok ? 'text-emerald-800' : bloqueado ? 'text-red-800' : 'text-amber-800'}`}>{title}</p>
        <p className={`text-xs mt-0.5 ${ok ? 'text-emerald-600' : bloqueado ? 'text-red-600' : 'text-amber-700'}`}>{detail}</p>
      </div>
    </div>
  );
}

export function AsociadoDialogRetiro({ open, onOpenChange, asociado, status, retirando, onDesactivar, onActualizar }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="size-5 text-amber-600" /> Proceso de retiro
          </DialogTitle>
          <DialogDescription>
            {asociado?.nombre} — sigue los 4 pasos en orden antes de desactivar la cuenta.
          </DialogDescription>
        </DialogHeader>

        {status?.loading ? (
          <div className="flex items-center justify-center py-10 gap-3 text-slate-500">
            <div className="size-5 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin" />
            Verificando estado del asociado…
          </div>
        ) : status ? (() => {
          const paso1ok = status.creditosPendientes === 0;
          const paso2ok = status.tieneAlgunaLiq;
          const paso3ok = status.liquidacionPagada;
          const paso4ok = !status.usuarioActivo;
          const puedeDesactivar = paso1ok && paso3ok && !retirando;

          return (
            <div className="space-y-3 py-1">
              <StepRow num="1" ok={paso1ok} bloqueado={!paso1ok}
                title="Cerrar créditos pendientes"
                detail={paso1ok
                  ? 'Sin créditos con saldo pendiente ✓'
                  : `${status.creditosPendientes} crédito(s) con saldo pendiente. Ve al módulo Créditos y registra el pago.`
                }
              />
              <StepRow num="2" ok={paso2ok}
                title="Crear liquidación de retiro"
                detail={paso2ok
                  ? 'Liquidación registrada en el sistema ✓'
                  : 'Aún no hay liquidación. Crea una en el módulo Liquidación con todos los saldos del asociado.'
                }
              />
              <StepRow num="3" ok={paso3ok}
                title='Marcar liquidación como "Pagada"'
                detail={paso3ok
                  ? 'Liquidación pagada — ahorros cerrados automáticamente ✓'
                  : paso2ok
                  ? 'La liquidación existe pero aún no está marcada como Pagada. Ve a Liquidación y actualiza el estado.'
                  : 'Completa el paso 2 primero.'
                }
              />

              {/* Paso 4 */}
              <div className={`flex items-start gap-3 p-3 rounded-xl border ${
                paso4ok ? 'bg-emerald-50 border-emerald-200' : puedeDesactivar ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className={`shrink-0 size-7 rounded-full flex items-center justify-center font-bold text-sm ${
                  paso4ok ? 'bg-emerald-600 text-white' : puedeDesactivar ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-500'
                }`}>
                  {paso4ok ? '✓' : '4'}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${paso4ok ? 'text-emerald-800' : puedeDesactivar ? 'text-blue-800' : 'text-slate-600'}`}>
                    Desactivar cuenta
                  </p>
                  {paso4ok ? (
                    <p className="text-xs text-emerald-600 mt-0.5">Cuenta ya desactivada — proceso completado ✓</p>
                  ) : puedeDesactivar ? (
                    <div className="mt-2">
                      <p className="text-xs text-blue-700 mb-2">
                        Todos los pasos previos completados. La cuenta será desactivada y el asociado no podrá iniciar sesión.
                      </p>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                        onClick={onDesactivar} disabled={retirando}>
                        {retirando
                          ? <><div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Desactivando…</>
                          : <><LogOut className="size-3.5" /> Desactivar cuenta ahora</>
                        }
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">Disponible cuando los pasos 1 y 3 estén completos.</p>
                  )}
                </div>
              </div>

              {!paso1ok && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Paso 1 bloqueado:</strong> el asociado tiene {status.creditosPendientes} crédito(s) con saldo pendiente.
                    Ve al módulo <strong>Créditos</strong> y registra los pagos antes de continuar.
                  </span>
                </div>
              )}
            </div>
          );
        })() : (
          <p className="text-sm text-slate-500 py-4 text-center">No se pudo cargar el estado. Cierra e intenta de nuevo.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          {status && !status.loading && (
            <Button variant="ghost" className="text-slate-500 text-xs" onClick={onActualizar}>
              ↻ Actualizar estado
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
