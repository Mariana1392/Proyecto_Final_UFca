import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { 
  FileCog, Users, Calendar, Clock, BarChart2, Paperclip, 
  Info, ShieldAlert, CheckCircle2, Activity, ChevronLeft, 
  ExternalLink, Download, Trash2, Calculator, Upload
} from 'lucide-react';
import { TIPOS_LIQUIDACION as TIPOS_LIQ, ESTADOS_LIQUIDACION as ESTADOS_LIQ } from '../../lib/constants';
import { getEstadoBadge, fmtCOP, numLiq, generateLiquidacionPDF } from './liquidacionUtils';
import { Concepto, LiqDoc, AuditEntry, LiquidacionRecord } from './liquidacionTypes';
import { toast } from 'sonner';

interface LiquidacionDialogDetalleProps {
  isDetailOpen: boolean;
  setIsDetailOpen: (b: boolean) => void;
  selectedItem: any;
  setSelectedItem: (item: any) => void;
  esVistaPropia: boolean;
  
  docsLiquidacion: LiqDoc[];
  setDocsLiquidacion: (docs: LiqDoc[]) => void;
  loadingDocs: boolean;
  
  auditEntries: AuditEntry[];
  setAuditEntries: (entries: AuditEntry[]) => void;
  loadingAudit: boolean;
  auditOpen: boolean;
  setAuditOpen: React.Dispatch<React.SetStateAction<boolean>>;
  
  setIsUploadDocOpen: (b: boolean) => void;
  setUploadDocNombre: (s: string) => void;
  setUploadDocFile: (f: File | null) => void;
  handleDeleteDoc: (id: string) => void;
  
  handleCambiarEstado: (liq: any, estado: string) => void;
  
  setIsAnularOpen: (b: boolean) => void;
  setJustificacionAnulacion: (s: string) => void;
}

export function LiquidacionDialogDetalle({
  isDetailOpen, setIsDetailOpen, selectedItem, setSelectedItem, esVistaPropia,
  docsLiquidacion, setDocsLiquidacion, loadingDocs,
  auditEntries, setAuditEntries, loadingAudit, auditOpen, setAuditOpen,
  setIsUploadDocOpen, setUploadDocNombre, setUploadDocFile, handleDeleteDoc,
  handleCambiarEstado,
  setIsAnularOpen, setJustificacionAnulacion
}: LiquidacionDialogDetalleProps) {

  const si = selectedItem;
  if (!si) return null;

  const tipoLabel = TIPOS_LIQ.find(t => t.value === si.tipo)?.label ?? si.tipo ?? '—';
  const totalCreditos = (si.conceptos as Concepto[])?.filter(c => c.tipo === 'credito')
    .reduce((s, c) => s + (parseFloat(String(c.monto).replace(/[^\d.-]/g,''))||0), 0) ?? 0;
  const totalDebitos = (si.conceptos as Concepto[])?.filter(c => c.tipo === 'debito')
    .reduce((s, c) => s + Math.abs(parseFloat(String(c.monto).replace(/[^\d.-]/g,''))||0), 0) ?? 0;
  const fechaRegistroFmt = si.createdAt
    ? new Date(si.createdAt).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' })
    : '—';
  const horaRegistroFmt = si.createdAt
    ? new Date(si.createdAt).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
    : '';

  return (
    <Dialog open={isDetailOpen} onOpenChange={open => { setIsDetailOpen(open); if (!open) { setSelectedItem(null); setDocsLiquidacion([]); setAuditEntries([]); setAuditOpen(false); } }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileCog className="size-5 text-emerald-600" />
            Detalle completo de liquidación
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            {numLiq(si.id)} · {tipoLabel} · Registrada el {fechaRegistroFmt}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="info" className="text-xs gap-1"><FileCog className="size-3" />Información</TabsTrigger>
            <TabsTrigger value="conceptos" className="text-xs gap-1"><BarChart2 className="size-3" />Desglose ({(si.conceptos as Concepto[])?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="documentos" className="text-xs gap-1"><Paperclip className="size-3" />Documentos ({docsLiquidacion.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 pt-4">
            {/* ── Encabezado ── */}
            <div className="rounded-xl border overflow-hidden">
              <div className={`px-4 py-3 flex items-center justify-between ${si.anulado ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg"><FileCog className="size-5 text-white" /></div>
                  <div>
                    <p className="text-[10px] text-white/70 font-medium uppercase tracking-wider">N° Liquidación</p>
                    <p className="text-xl font-bold text-white tracking-widest font-mono">{numLiq(si.id)}</p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-xs block">{tipoLabel}</Badge>
                  {getEstadoBadge(si.estado, si.anulado)}
                </div>
              </div>

              {/* ── Datos ── */}
              <div className="bg-white border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-100 rounded-full shrink-0"><Users className="size-4 text-emerald-600" /></div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{si.asociado || '—'}</p>
                    <p className="text-xs text-slate-500">{si.cedula ? `C.C. ${si.cedula}` : 'Sin cédula registrada'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Calendar className="size-3" /> Fecha de corte</p>
                    <p className="font-bold text-slate-800">{si.fechaCorte || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Calendar className="size-3" /> Fecha de liquidación</p>
                    <p className="font-bold text-slate-800">{si.fechaLiquidacion || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="size-3" /> Fecha de registro</p>
                    <p className="font-bold text-slate-800">{fechaRegistroFmt}</p>
                    {horaRegistroFmt && <p className="text-[10px] text-slate-400 mt-0.5">{horaRegistroFmt}</p>}
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Conceptos</p>
                    <p className="font-bold text-slate-800">{(si.conceptos as Concepto[])?.length ?? 0} ítem(s)</p>
                  </div>
                </div>
              </div>

              {/* Motivo */}
              {si.motivo && (
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5">
                  <p className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold mb-0.5">Motivo</p>
                  <p className="text-sm text-slate-700">{si.motivo}</p>
                </div>
              )}
            </div>

            {/* ── Resumen financiero ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">Total créditos</p>
                <p className="text-base font-bold text-emerald-700 mt-1">+{fmtCOP(totalCreditos)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-[10px] text-red-600 uppercase tracking-wider font-semibold">Total débitos</p>
                <p className="text-base font-bold text-red-600 mt-1">−{fmtCOP(totalDebitos)}</p>
              </div>
              <div className={`border rounded-xl p-3 text-center ${si.montoFinal >= 0 ? 'bg-gradient-to-b from-emerald-50 to-teal-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Monto final</p>
                <p className={`text-xl font-bold mt-1 ${si.montoFinal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmtCOP(si.montoFinal ?? 0)}</p>
              </div>
            </div>

            {/* ── Datos del cálculo (si existen) ── */}
            {si.calculo && (
              <div className="rounded-xl border border-blue-200 overflow-hidden">
                <div className="bg-blue-600 px-4 py-2.5 flex items-center gap-2">
                  <Calculator className="size-4 text-blue-100" />
                  <p className="text-xs font-semibold text-white uppercase tracking-wider">Datos del cálculo — Saldos natillera</p>
                </div>
                <div className="bg-blue-50 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Salario mensual base</p>
                    <p className="font-bold text-slate-900 text-sm">{fmtCOP(si.calculo.salarioMensual ?? 0)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Fecha de ingreso</p>
                    <p className="font-bold text-slate-900">{si.calculo.fechaIngreso || '—'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Días vac. pendientes</p>
                    <p className="font-bold text-slate-900">{si.calculo.diasVacPendientes ?? 0} días</p>
                  </div>
                  {si.calculo.ahorroPermanente > 0 && (
                    <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Ahorro permanente</p>
                      <p className="font-bold text-emerald-700">{fmtCOP(si.calculo.ahorroPermanente)}</p>
                    </div>
                  )}
                  {si.calculo.ahorroVoluntario > 0 && (
                    <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Ahorro voluntario</p>
                      <p className="font-bold text-emerald-700">{fmtCOP(si.calculo.ahorroVoluntario)}</p>
                    </div>
                  )}
                  {si.calculo.creditoPendiente > 0 && (
                    <div className="bg-white rounded-lg p-2.5 border border-red-100">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Crédito pendiente</p>
                      <p className="font-bold text-red-600">{fmtCOP(si.calculo.creditoPendiente)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Observaciones ── */}
            {si.observaciones && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Info className="size-3.5" /> Observaciones</p>
                <p className="text-sm text-slate-700 leading-relaxed">{si.observaciones}</p>
              </div>
            )}

            {/* ── Anulación ── */}
            {si.anulado && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2"><ShieldAlert className="size-4 text-red-500" /><p className="text-xs font-bold text-red-600 uppercase tracking-wider">Liquidación Inválida — Anulada</p></div>
                <p className="text-sm text-red-700"><span className="font-semibold">Justificación:</span> {si.justificacionAnulacion || '—'}</p>
                {si.anuladoPor && (
                  <p className="text-xs text-red-500">Anulada por: <span className="font-semibold">{si.anuladoPor}</span>{si.anuladoEn && <span> · {new Date(si.anuladoEn).toLocaleString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>}</p>
                )}
              </div>
            )}

            {/* ── Cambio de estado ── */}
            {!esVistaPropia && !si.anulado && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-semibold text-slate-600 whitespace-nowrap flex items-center gap-1"><CheckCircle2 className="size-3.5 text-emerald-500" /> Cambiar estado:</p>
                <Select value={si.estado} onValueChange={v => handleCambiarEstado(si, v)}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_LIQ.map(e => <SelectItem key={e.value} value={e.value} className="text-xs">{e.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ── Auditoría ── */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <button className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left" onClick={() => setAuditOpen(o => !o)}>
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-slate-500" />
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Historial de auditoría</p>
                  {auditEntries.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">{auditEntries.length}</span>}
                </div>
                <div className={`transition-transform duration-200 ${auditOpen ? 'rotate-90' : '-rotate-90'}`}><ChevronLeft className="size-4 text-slate-400" /></div>
              </button>
              {auditOpen && (
                <div className="divide-y divide-slate-100">
                  {loadingAudit ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-slate-400"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400" /><span className="text-xs">Cargando historial...</span></div>
                  ) : auditEntries.length === 0 ? (
                    <div className="flex flex-col items-center py-8 gap-2 text-slate-400"><Clock className="size-6 text-slate-300" /><p className="text-xs">Sin eventos de auditoría registrados</p></div>
                  ) : (
                    auditEntries.map((entry, idx) => {
                      let det: Record<string, any> = {};
                      try { det = entry.detalle ? (typeof entry.detalle === 'string' ? JSON.parse(entry.detalle) : entry.detalle) : {}; } catch { det = {}; }
                      const esAnulacion = entry.accion === 'ANULACIÓN';
                      const fecha = new Date(entry.created_at).toLocaleString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
                      return (
                        <div key={entry.id} className="px-4 py-3 flex gap-3">
                          <div className="flex flex-col items-center pt-0.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${esAnulacion ? 'bg-red-100' : 'bg-slate-100'}`}>
                              {esAnulacion ? <ShieldAlert className="size-3.5 text-red-600" /> : <Activity className="size-3.5 text-slate-500" />}
                            </div>
                            {idx < auditEntries.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[16px]" />}
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-[11px] font-bold uppercase tracking-wider ${esAnulacion ? 'text-red-600' : 'text-slate-700'}`}>{entry.accion}</span>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">{fecha}</span>
                            </div>
                            {esAnulacion && (
                              <div className="space-y-0.5 text-xs text-slate-600">
                                {det.justificacion && <p><span className="text-slate-400">Motivo: </span>{det.justificacion}</p>}
                                {det.anuladoPor && <p><span className="text-slate-400">Por: </span>{det.anuladoPor}</p>}
                                {det.montoFinal !== undefined && <p><span className="text-slate-400">Monto anulado: </span><span className="font-semibold text-red-600">{fmtCOP(det.montoFinal)}</span></p>}
                              </div>
                            )}
                            {!esAnulacion && det.descripcion && <p className="text-xs text-slate-500">{det.descripcion}</p>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="conceptos" className="pt-4">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-700 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2"><BarChart2 className="size-4 text-slate-300" /><p className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Desglose de conceptos</p></div>
                <span className="text-[10px] text-slate-400">{(si.conceptos as Concepto[])?.length ?? 0} conceptos</span>
              </div>
              {(si.conceptos as Concepto[])?.length > 0 ? (
                <>
                  <div className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-100"><p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Créditos (ingresos)</p></div>
                  {(si.conceptos as Concepto[]).filter(c => c.tipo === 'credito').map((c, idx) => {
                    const monto = parseFloat(String(c.monto).replace(/[^\d.-]/g,'')) || 0;
                    return (
                      <div key={`cr-${idx}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-emerald-50/40 border-b border-slate-50">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /><span className="text-sm text-slate-700">{c.nombre}</span></div>
                        <span className="text-sm font-semibold text-emerald-700">+{fmtCOP(monto)}</span>
                      </div>
                    );
                  })}
                  {(si.conceptos as Concepto[]).some(c => c.tipo === 'debito') && (
                    <>
                      <div className="px-4 py-1.5 bg-red-50 border-y border-red-100"><p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Débitos (descuentos)</p></div>
                      {(si.conceptos as Concepto[]).filter(c => c.tipo === 'debito').map((c, idx) => {
                        const monto = Math.abs(parseFloat(String(c.monto).replace(/[^\d.-]/g,'')) || 0);
                        return (
                          <div key={`db-${idx}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-red-50/40 border-b border-slate-50">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400 shrink-0" /><span className="text-sm text-slate-700">{c.nombre}</span></div>
                            <span className="text-sm font-semibold text-red-600">−{fmtCOP(monto)}</span>
                          </div>
                        );
                      })}
                    </>
                  )}
                  <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center"><p className="text-slate-400 uppercase tracking-wider text-[10px]">Total créditos</p><p className="font-bold text-emerald-700 text-base">+{fmtCOP(totalCreditos)}</p></div>
                    <div className="text-center"><p className="text-slate-400 uppercase tracking-wider text-[10px]">Total débitos</p><p className="font-bold text-red-600 text-base">−{fmtCOP(totalDebitos)}</p></div>
                    <div className="text-center border-l border-slate-200"><p className="text-slate-400 uppercase tracking-wider text-[10px]">Neto a pagar</p><p className={`font-bold text-lg ${si.montoFinal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmtCOP(si.montoFinal ?? 0)}</p></div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center py-10 text-slate-400 gap-2"><BarChart2 className="size-8 text-slate-300" /><p className="text-sm font-medium text-slate-600">Sin conceptos registrados</p><p className="text-xs text-slate-400">Esta liquidación no tiene desglose de conceptos guardado.</p></div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="documentos" className="pt-4 space-y-3">
            {!esVistaPropia && !si.anulado && (
              <div className="flex justify-end">
                <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setUploadDocNombre(''); setUploadDocFile(null); setIsUploadDocOpen(true); }}>
                  <Upload className="size-3.5" /> Subir documento
                </Button>
              </div>
            )}
            {loadingDocs ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" /></div>
            ) : docsLiquidacion.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-400 gap-2">
                <Paperclip className="size-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">Sin documentos adjuntos</p>
                {!esVistaPropia ? <p className="text-xs text-slate-400">Sube documentos de soporte usando el botón de arriba.</p> : <p className="text-xs text-slate-400">El administrador puede adjuntar documentos a esta liquidación.</p>}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {docsLiquidacion.map(doc => {
                  const icons: Record<string, string> = { pdf:'📄', jpg:'🖼', jpeg:'🖼', png:'🖼', webp:'🖼', doc:'📝', docx:'📝' };
                  const icon = icons[doc.tipo_archivo] ?? '📎';
                  return (
                    <div key={doc.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{doc.nombre}</p>
                          <p className="text-xs text-slate-400">{(doc as any).usuarios?.nombre ?? (doc as any).subido_por_nombre ?? 'Administrador'} · {new Date(doc.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 ml-3">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" className="gap-1 text-xs h-7 text-blue-600 border-blue-200 hover:bg-blue-50"><ExternalLink className="size-3" /> Ver</Button></a>
                        <a href={doc.url} download><Button variant="outline" size="sm" className="h-7 text-emerald-600 border-emerald-200 hover:bg-emerald-50"><Download className="size-3.5" /></Button></a>
                        {!esVistaPropia && (
                          <Button variant="outline" size="sm" className="h-7 text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDeleteDoc(doc.id)}><Trash2 className="size-3.5" /></Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setIsDetailOpen(false); setSelectedItem(null); setDocsLiquidacion([]); setAuditEntries([]); setAuditOpen(false); }}>Cerrar</Button>
          {si && (
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => { const ok = generateLiquidacionPDF(si); if (ok) toast.success('PDF generado correctamente'); else toast.error('Error al generar PDF'); }}>
              <Download className="size-4" /> Descargar PDF
            </Button>
          )}
          {!esVistaPropia && si && !si.anulado && (
            <Button variant="outline" className="gap-2 border-red-200 text-red-600 hover:bg-red-50" onClick={() => { setIsDetailOpen(false); setJustificacionAnulacion(''); setIsAnularOpen(true); }}>
              <Trash2 className="size-4" /> Anular
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
