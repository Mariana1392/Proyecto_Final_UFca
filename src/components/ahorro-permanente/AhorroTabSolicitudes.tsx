// ── AhorroTabSolicitudes.tsx ──────────────────────────────────────────────────
// Contenido del tab "Solicitudes" (solo admin):
//   · Sección: solicitudes de apertura de ahorro permanente
//   · Sección: aportes reportados por asociados pendientes de confirmación

import { Check, X, Clock, CheckCircle2, XCircle, ClipboardList, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { formatCurrency } from '../../lib/formatters';

interface AhorroTabSolicitudesProps {
  // Solicitudes de apertura
  solicitudes:            any[];
  handleAprobarSolicitud: (sol: any) => void;
  setSolicitudSeleccionada: (v: any) => void;
  setNotaRechazo:         (v: string) => void;
  setIsRechazarDialogOpen:(v: boolean) => void;

  // Aportes reportados
  aportesPendientes:      any[];
  handleConfirmarAporte:  (ap: any) => void;
  setAporteSeleccionado:  (v: any) => void;
  setNotaRechazoAporte:   (v: string) => void;
  setIsRechazarAporteOpen:(v: boolean) => void;
}

export default function AhorroTabSolicitudes({
  solicitudes,
  handleAprobarSolicitud,
  setSolicitudSeleccionada, setNotaRechazo, setIsRechazarDialogOpen,
  aportesPendientes,
  handleConfirmarAporte,
  setAporteSeleccionado, setNotaRechazoAporte, setIsRechazarAporteOpen,
}: AhorroTabSolicitudesProps) {
  return (
    <div className="space-y-6">

      {/* ── Solicitudes de apertura ──────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <ClipboardList className="size-4 text-amber-600" />
          Solicitudes de apertura
        </h3>

        {solicitudes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ClipboardList className="size-10 text-slate-300 mb-3" />
            <p className="text-slate-500">No hay solicitudes de ahorro permanente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {solicitudes.map(sol => (
              <div
                key={sol.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
                  sol.estado === 'pendiente' ? 'bg-amber-50 border-amber-200' :
                  sol.estado === 'aprobada'  ? 'bg-emerald-50 border-emerald-200' :
                  'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    sol.estado === 'pendiente' ? 'bg-amber-100' :
                    sol.estado === 'aprobada'  ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    {sol.estado === 'pendiente' && <Clock className="size-5 text-amber-600" />}
                    {sol.estado === 'aprobada'  && <CheckCircle2 className="size-5 text-emerald-600" />}
                    {sol.estado === 'rechazada' && <XCircle className="size-5 text-red-500" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{sol.usuarios?.nombre ?? '—'}</p>
                    <p className="text-xs text-slate-500">
                      Cédula: {sol.usuarios?.cedula ?? '—'} ·{' '}
                      {new Date(sol.created_at).toLocaleDateString('es-CO')}
                    </p>
                    {sol.nota_asociado && (
                      <p className="text-xs text-slate-600 mt-0.5 italic">"{sol.nota_asociado}"</p>
                    )}
                    {sol.nota_admin && sol.estado === 'rechazada' && (
                      <p className="text-xs text-red-600 mt-0.5">Motivo: {sol.nota_admin}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {sol.estado === 'pendiente' ? (
                    <>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleAprobarSolicitud(sol)}
                      >
                        <Check className="size-4" /> Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setSolicitudSeleccionada(sol);
                          setNotaRechazo('');
                          setIsRechazarDialogOpen(true);
                        }}
                      >
                        <X className="size-4" /> Rechazar
                      </Button>
                    </>
                  ) : (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      sol.estado === 'aprobada'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {sol.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Aportes reportados por asociados ────────────────────────────── */}
      <div className="space-y-3 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Send className="size-4 text-blue-600" />
          Aportes reportados por asociados
          {aportesPendientes.filter(a => a.estado === 'pendiente').length > 0 && (
            <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
              {aportesPendientes.filter(a => a.estado === 'pendiente').length} pendiente
              {aportesPendientes.filter(a => a.estado === 'pendiente').length > 1 ? 's' : ''}
            </span>
          )}
        </h3>

        {aportesPendientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Send className="size-10 text-slate-300 mb-3" />
            <p className="text-slate-500">No hay aportes reportados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {aportesPendientes.map(ap => (
              <div
                key={ap.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
                  ap.estado === 'pendiente' ? 'bg-blue-50 border-blue-200' :
                  ap.estado === 'aprobada'  ? 'bg-emerald-50 border-emerald-200' :
                  'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    ap.estado === 'pendiente' ? 'bg-blue-100' :
                    ap.estado === 'aprobada'  ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    {ap.estado === 'pendiente' && <Clock className="size-5 text-blue-600" />}
                    {ap.estado === 'aprobada'  && <CheckCircle2 className="size-5 text-emerald-600" />}
                    {ap.estado === 'rechazada' && <XCircle className="size-5 text-red-500" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{ap.usuarios?.nombre ?? '—'}</p>
                    <p className="text-xs text-slate-500">
                      Cédula: {ap.usuarios?.cedula ?? '—'} · Reportado:{' '}
                      {new Date(ap.created_at).toLocaleDateString('es-CO')}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 font-medium text-slate-700">
                        {formatCurrency(ap.monto)}
                      </span>
                      <span className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600">
                        {ap.medio_pago}
                      </span>
                      <span className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-500">
                        Pago: {ap.fecha_pago}
                      </span>
                    </div>
                    {ap.nota && (
                      <p className="text-xs text-slate-600 mt-0.5 italic">"{ap.nota}"</p>
                    )}
                    {ap.nota_admin && ap.estado === 'rechazada' && (
                      <p className="text-xs text-red-600 mt-0.5">Motivo rechazo: {ap.nota_admin}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {ap.estado === 'pendiente' ? (
                    <>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleConfirmarAporte(ap)}
                      >
                        <Check className="size-4" /> Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setAporteSeleccionado(ap);
                          setNotaRechazoAporte('');
                          setIsRechazarAporteOpen(true);
                        }}
                      >
                        <X className="size-4" /> Rechazar
                      </Button>
                    </>
                  ) : (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      ap.estado === 'aprobada'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {ap.estado === 'aprobada' ? 'Confirmado' : 'Rechazado'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
