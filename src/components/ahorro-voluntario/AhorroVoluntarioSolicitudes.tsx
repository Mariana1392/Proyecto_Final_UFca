// ── AhorroVoluntarioSolicitudes.tsx ─────────────────────────────────────────
// Pestaña "Solicitudes" (solo admin):
//   · Solicitudes de apertura de ahorro voluntario
//   · Aportes reportados por asociados pendientes de confirmación

import { Check, X, Clock, CheckCircle2, XCircle, ClipboardList, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { formatCurrency } from '../../lib/formatters';

interface AhorroVoluntarioSolicitudesProps {
  // Solicitudes de apertura
  solicitudesVol:            any[];
  handleAprobarSolicitudVol: (sol: any) => void;
  setSolVolSeleccionada:     (v: any) => void;
  setNotaRechazoVol:         (v: string) => void;
  setIsRechazarVolOpen:      (v: boolean) => void;
  // Aportes reportados
  aportesPendientesVol:        any[];
  handleConfirmarAporteVol:    (ap: any) => void;
  setAporteVolSeleccionado:    (v: any) => void;
  setNotaRechazoAporteVol:     (v: string) => void;
  setIsRechazarAporteVolOpen:  (v: boolean) => void;
}

export default function AhorroVoluntarioSolicitudes({
  solicitudesVol, handleAprobarSolicitudVol,
  setSolVolSeleccionada, setNotaRechazoVol, setIsRechazarVolOpen,
  aportesPendientesVol, handleConfirmarAporteVol,
  setAporteVolSeleccionado, setNotaRechazoAporteVol, setIsRechazarAporteVolOpen,
}: AhorroVoluntarioSolicitudesProps) {
  return (
    <div className="space-y-6">

      {/* ── Solicitudes de apertura ──────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <ClipboardList className="size-4 text-amber-600" />
          Solicitudes de apertura
        </h3>
        {solicitudesVol.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ClipboardList className="size-10 text-slate-300 mb-3" />
            <p className="text-slate-500">No hay solicitudes de ahorro voluntario</p>
          </div>
        ) : (
          <div className="space-y-3">
            {solicitudesVol.map(sol => (
              <div key={sol.id} className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-4 rounded-xl border ${
                sol.estado === 'pendiente' ? 'bg-amber-50 border-amber-200' :
                sol.estado === 'aprobada'  ? 'bg-emerald-50 border-emerald-200' :
                'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full mt-0.5 ${
                    sol.estado === 'pendiente' ? 'bg-amber-100' :
                    sol.estado === 'aprobada'  ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    {sol.estado === 'pendiente' && <Clock className="size-4 text-amber-600" />}
                    {sol.estado === 'aprobada'  && <CheckCircle2 className="size-4 text-emerald-600" />}
                    {sol.estado === 'rechazada' && <XCircle className="size-4 text-red-500" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{sol.usuarios?.nombre ?? '—'}</p>
                    <p className="text-xs text-slate-500">
                      Cédula: {sol.usuarios?.cedula ?? '—'} · {new Date(sol.created_at).toLocaleDateString('es-CO')}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {sol.nombre_plan && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{sol.nombre_plan}</span>
                      )}
                      {sol.frecuencia && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{sol.frecuencia}</span>
                      )}
                      {sol.monto_inicial > 0 && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          Inicial: {formatCurrency(sol.monto_inicial)}
                        </span>
                      )}
                      {sol.monto_objetivo > 0 && (
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                          Meta: {formatCurrency(sol.monto_objetivo)}
                        </span>
                      )}
                    </div>
                    {sol.nota_asociado && (
                      <p className="text-xs text-slate-600 mt-1 italic">"{sol.nota_asociado}"</p>
                    )}
                    {sol.nota_admin && sol.estado === 'rechazada' && (
                      <p className="text-xs text-red-600 mt-0.5">Motivo: {sol.nota_admin}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {sol.estado === 'pendiente' ? (
                    <>
                      <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleAprobarSolicitudVol(sol)}>
                        <Check className="size-4" /> Aprobar
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => { setSolVolSeleccionada(sol); setNotaRechazoVol(''); setIsRechazarVolOpen(true); }}>
                        <X className="size-4" /> Rechazar
                      </Button>
                    </>
                  ) : (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      sol.estado === 'aprobada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
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

      {/* ── Aportes reportados ───────────────────────────────────────────── */}
      <div className="space-y-3 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Send className="size-4 text-blue-600" />
          Aportes reportados por asociados
          {aportesPendientesVol.filter(a => a.estado === 'pendiente').length > 0 && (
            <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
              {aportesPendientesVol.filter(a => a.estado === 'pendiente').length} pendiente
              {aportesPendientesVol.filter(a => a.estado === 'pendiente').length > 1 ? 's' : ''}
            </span>
          )}
        </h3>
        {aportesPendientesVol.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Send className="size-10 text-slate-300 mb-3" />
            <p className="text-slate-500">No hay aportes reportados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {aportesPendientesVol.map(ap => (
              <div key={ap.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
                ap.estado === 'pendiente' ? 'bg-blue-50 border-blue-200' :
                ap.estado === 'aprobada'  ? 'bg-emerald-50 border-emerald-200' :
                'bg-red-50 border-red-200'
              }`}>
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
                      Cédula: {ap.usuarios?.cedula ?? '—'} · Reportado: {new Date(ap.created_at).toLocaleDateString('es-CO')}
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
                    {ap.nota && <p className="text-xs text-slate-600 mt-0.5 italic">"{ap.nota}"</p>}
                    {ap.nota_admin && ap.estado === 'rechazada' && (
                      <p className="text-xs text-red-600 mt-0.5">Motivo rechazo: {ap.nota_admin}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ap.estado === 'pendiente' ? (
                    <>
                      <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleConfirmarAporteVol(ap)}>
                        <Check className="size-4" /> Confirmar
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => { setAporteVolSeleccionado(ap); setNotaRechazoAporteVol(''); setIsRechazarAporteVolOpen(true); }}>
                        <X className="size-4" /> Rechazar
                      </Button>
                    </>
                  ) : (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      ap.estado === 'aprobada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
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
