import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { FileCog, Check, CheckCircle2, Info, FileText, Upload, X, AlertTriangle, Plus } from 'lucide-react';
import { TIPOS_LIQUIDACION as TIPOS_LIQ } from '../../lib/constants';
import { fmtCOP } from './liquidacionUtils';
import { Concepto } from './liquidacionTypes';

interface LiquidacionDialogCrearProps {
  isCreateOpen: boolean;
  setIsCreateOpen: (b: boolean) => void;
  resetForm: () => void;
  formStep: 1|2|3;
  setFormStep: (n: 1|2|3) => void;
  
  // Step 1
  formAsocSearch: string;
  setFormAsocSearch: (s: string) => void;
  formAsociadoId: string;
  setFormAsociadoId: (s: string) => void;
  showAcomplete: boolean;
  setShowAcomplete: (b: boolean) => void;
  acSuggestions: any[];
  handleSelectAsociado: (a: any) => void;
  datosAsocLoading: boolean;
  
  formTipo: string;
  setFormTipo: (s: string) => void;
  formFechaCorte: string;
  setFormFechaCorte: (s: string) => void;
  formFechaLiq: string;
  setFormFechaLiq: (s: string) => void;
  formMotivo: string;
  setFormMotivo: (s: string) => void;
  formObservaciones: string;
  setFormObservaciones: (s: string) => void;
  
  formArchivoFile: File | null;
  setFormArchivoFile: (f: File | null) => void;
  dragOver: boolean;
  setDragOver: (b: boolean) => void;
  handleFileSelect: (f: File) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  acRef: React.RefObject<HTMLDivElement | null>;
  
  irAPaso2: () => void;
  
  // Step 2
  formAhorroPerm: string;
  setFormAhorroPerm: (s: string) => void;
  formAhorroVol: string;
  setFormAhorroVol: (s: string) => void;
  formAhorros: string;
  setFormAhorros: (s: string) => void;
  formUtilidades: string;
  setFormUtilidades: (s: string) => void;
  formCreditoPend: string;
  setFormCreditoPend: (s: string) => void;
  setConceptosGenerados: (b: boolean) => void;
  
  generando: boolean;
  irAPaso3: () => void;
  
  // Step 3
  formConceptos: Concepto[];
  addConcepto: () => void;
  updateConcepto: (id: number, field: keyof Concepto, value: string) => void;
  removeConcepto: (id: number) => void;
  montoCalculado: number;
  saving: boolean;
  handleSave: () => void;
}

export function LiquidacionDialogCrear({
  isCreateOpen, setIsCreateOpen, resetForm, formStep, setFormStep,
  formAsocSearch, setFormAsocSearch, formAsociadoId, setFormAsociadoId,
  showAcomplete, setShowAcomplete, acSuggestions, handleSelectAsociado, datosAsocLoading,
  formTipo, setFormTipo, formFechaCorte, setFormFechaCorte,
  formFechaLiq, setFormFechaLiq, formMotivo, setFormMotivo,
  formObservaciones, setFormObservaciones,
  formArchivoFile, setFormArchivoFile, dragOver, setDragOver,
  handleFileSelect, fileRef, acRef, irAPaso2,
  formAhorroPerm, setFormAhorroPerm, formAhorroVol, setFormAhorroVol,
  formAhorros, setFormAhorros,
  formUtilidades, setFormUtilidades, formCreditoPend, setFormCreditoPend,
  setConceptosGenerados, generando, irAPaso3,
  formConceptos, addConcepto, updateConcepto, removeConcepto,
  montoCalculado, saving, handleSave
}: LiquidacionDialogCrearProps) {
  return (
    <Dialog open={isCreateOpen} onOpenChange={open => { if (!open) resetForm(); setIsCreateOpen(open); }}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCog className="size-5 text-emerald-600" /> Nueva liquidación
          </DialogTitle>
          <DialogDescription>
            Registra la liquidación de un asociado. Completa la información básica, revisa los saldos y ajusta los conceptos antes de guardar.
          </DialogDescription>
        </DialogHeader>

        {/* ── Stepper header ── */}
        <div className="flex items-start gap-0 mt-2">
          {([
            { n: 1 as const, label: 'Información' },
            { n: 2 as const, label: 'Saldos' },
            { n: 3 as const, label: 'Conceptos' },
          ] as { n: 1|2|3; label: string }[]).map((s, i) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 min-w-[56px]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  formStep > s.n
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : formStep === s.n
                      ? 'bg-white border-emerald-600 text-emerald-700'
                      : 'bg-white border-slate-300 text-slate-400'
                }`}>
                  {formStep > s.n ? <Check className="size-3.5" /> : s.n}
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap ${formStep >= s.n ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div className={`flex-1 h-0.5 mb-4 mx-1 rounded transition-colors ${formStep > s.n ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-4">

          {/* ══ PASO 1: Información básica ══ */}
          {formStep === 1 && (
            <div className="space-y-4">
              {/* Asociado */}
              <div className="space-y-2" ref={acRef}>
                <Label>Asociado *</Label>
                <div className="relative">
                  <Input
                    placeholder="Buscar por nombre o cédula..."
                    value={formAsocSearch} autoComplete="off"
                    onChange={e => { setFormAsocSearch(e.target.value); setFormAsociadoId(''); setShowAcomplete(true); }}
                    onFocus={() => setShowAcomplete(true)}
                  />
                  {showAcomplete && acSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                      {acSuggestions.map(a => (
                        <div key={a.id} className="px-3 py-2.5 hover:bg-emerald-50 cursor-pointer text-sm border-b border-slate-50 last:border-0"
                          onMouseDown={() => handleSelectAsociado(a)}>
                          <p className="font-medium text-slate-900">{a.nombre}</p>
                          <p className="text-xs text-slate-400">C.C. {a.cedula}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {formAsociadoId && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" />
                    Asociado seleccionado
                    {datosAsocLoading && ' · Cargando saldos financieros…'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de liquidación *</Label>
                  <Select value={formTipo} onValueChange={v => setFormTipo(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS_LIQ.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border border-slate-200 bg-slate-50 gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                      En proceso
                    </span>
                    <span className="text-xs text-slate-400">Se marca como <strong>Pagada</strong> al subir el comprobante</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de corte *</Label>
                  <Input type="date" value={formFechaCorte} onChange={e => setFormFechaCorte(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500">Fecha de liquidación <span className="text-xs">(opcional)</span></Label>
                  <Input type="date" value={formFechaLiq} min={new Date().toISOString().split('T')[0]} onChange={e => setFormFechaLiq(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivo <span className="text-xs text-slate-400">(opcional)</span></Label>
                <Input placeholder="Ej: Retiro voluntario — carta radicada 12/01/2025" value={formMotivo} onChange={e => setFormMotivo(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Observaciones <span className="text-xs text-slate-400">(opcional)</span></Label>
                <Textarea rows={2} placeholder="Notas adicionales..." value={formObservaciones} onChange={e => setFormObservaciones(e.target.value)} />
              </div>

              {/* Archivo inicial */}
              <div className="space-y-2">
                <Label>Documento de soporte inicial <span className="text-xs text-slate-400">(PDF, imagen o Word — máx. 10 MB)</span></Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                  onClick={() => fileRef.current?.click()}
                >
                  {formArchivoFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-700">
                      <FileText className="size-4" />
                      <span className="text-sm font-medium">{formArchivoFile.name}</span>
                      <button type="button" onClick={e => { e.stopPropagation(); setFormArchivoFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                        <X className="size-4 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-slate-400">
                      <Upload className="size-6 mx-auto mb-1" />
                      <p className="text-xs">Arrastra un archivo o haz clic para seleccionar</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between">
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancelar</Button>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50" onClick={irAPaso2} disabled={!formAsociadoId || !formFechaCorte}>
                  Siguiente → Saldos
                </Button>
              </div>
            </div>
          )}

          {/* ══ PASO 2: Saldos del asociado ══ */}
          {formStep === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
                <Info className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-800 space-y-1">
                  <p className="font-semibold">Saldos del socio — cargados automáticamente</p>
                  <p>Verifica los valores y ajústalos si es necesario antes de continuar.</p>
                  <ul className="ml-3 space-y-0.5 list-disc">
                    <li><strong>Créditos (+):</strong> Ahorro permanente · Ahorro voluntario · Utilidades (solo nov/dic)</li>
                    <li><strong>Débitos (−):</strong> Saldo de crédito pendiente</li>
                  </ul>
                </div>
              </div>

              {datosAsocLoading && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500" />
                  Cargando saldos financieros del asociado…
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Abonos a favor (Créditos +) */}
                <div className="border border-emerald-100 bg-emerald-50/10 dark:bg-emerald-950/5 rounded-xl p-4 space-y-4">
                  <p className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-emerald-100/50 pb-2">
                    <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    Conceptos a favor (Créditos +)
                  </p>

                  <div className="space-y-1.5">
                    <Label className="flex justify-between items-center text-xs text-emerald-700 font-semibold w-full">
                      <span>Ahorros</span>
                      <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide">Crédito (+)</span>
                    </Label>
                    <Input
                      placeholder="0"
                      value={formAhorros}
                      onChange={e => {
                        const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                        const formatted = raw ? parseInt(raw, 10).toLocaleString('es-CO') : '';
                        setFormAhorros(formatted);
                        setConceptosGenerados(false);
                      }}
                      className="border-emerald-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 font-semibold text-emerald-800 dark:text-emerald-300"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium px-0.5 pt-0.5 border-t border-slate-100 dark:border-slate-800 mt-1.5">
                      <span>Ahorro permanente: <strong className="text-slate-700 dark:text-slate-300">${formAhorroPerm || '0'}</strong></span>
                      <span>Ahorro voluntario: <strong className="text-slate-700 dark:text-slate-300">${formAhorroVol || '0'}</strong></span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex justify-between items-center text-xs text-slate-700 font-semibold w-full">
                      <span>Utilidades del fondo</span>
                      <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide">Crédito (+)</span>
                    </Label>
                    <Input
                      placeholder={formFechaCorte && new Date(formFechaCorte + 'T00:00:00').getMonth() >= 10 ? 'Se calcula automáticamente' : 'No aplica (solo nov/dic)'}
                      value={formUtilidades}
                      disabled={!!formFechaCorte && new Date(formFechaCorte + 'T00:00:00').getMonth() < 10}
                      onChange={e => {
                        const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                        const formatted = raw ? parseInt(raw, 10).toLocaleString('es-CO') : '';
                        setFormUtilidades(formatted);
                        setConceptosGenerados(false);
                      }}
                      className="border-slate-200 font-semibold"
                    />
                    <p className="text-[10px] text-slate-400 leading-normal pt-0.5">
                      {formFechaCorte && new Date(formFechaCorte + 'T00:00:00').getMonth() < 10
                        ? '⚠ El asociado se retira antes de noviembre — no tiene derecho a utilidades'
                        : 'Se calculará en base a intereses acumulados del fondo'}
                    </p>
                  </div>
                </div>

                {/* Descuentos (Débitos -) */}
                <div className="border border-red-100 bg-red-50/10 dark:bg-red-950/5 rounded-xl p-4 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <p className="text-xs font-black text-red-800 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-red-100 pb-2">
                      <span className="size-2 rounded-full bg-red-500 shrink-0" />
                      Conceptos en contra (Débitos -)
                    </p>

                    <div className="space-y-1.5">
                      <Label className="flex justify-between items-center text-xs text-red-700 font-semibold w-full">
                        <span>Saldo crédito pendiente</span>
                        <span className="text-[9px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide">Débito (−)</span>
                      </Label>
                      <Input
                        placeholder="0"
                        value={formCreditoPend}
                        onChange={e => {
                          const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                          const formatted = raw ? parseInt(raw, 10).toLocaleString('es-CO') : '';
                          setFormCreditoPend(formatted);
                          setConceptosGenerados(false);
                        }}
                        className="border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-400/30 font-semibold text-red-800 dark:text-red-300"
                      />
                    </div>
                  </div>

                  {/* Nota explicativa de balance de altura */}
                  <div className="text-[11px] text-slate-400 border-t border-red-100/50 pt-3 mt-4 leading-normal">
                    <p className="font-semibold text-slate-500">Nota sobre débitos:</p>
                    <p className="mt-0.5 leading-relaxed">
                      Cualquier deuda de crédito pendiente se descontará del saldo total a favor del asociado durante el cálculo de la liquidación final.
                    </p>
                  </div>
                </div>
              </div>

              {(formAhorros || formCreditoPend || formUtilidades) && (() => {
                const parseVal = (s: string) => parseFloat(String(s).replace(/\./g, '').replace(/[^\d.-]/g, '')) || 0;
                const totCred = parseVal(formAhorros) + parseVal(formUtilidades);
                const totDeb = parseVal(formCreditoPend);
                const estimado = totCred - totDeb;
                return (
                  <div className="grid grid-cols-3 gap-3 text-center pt-2">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/25 rounded-xl border border-emerald-100 dark:border-emerald-800">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total créditos</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">+{fmtCOP(totCred)}</p>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-950/25 rounded-xl border border-red-100 dark:border-red-800">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total débitos</p>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">−{fmtCOP(totDeb)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/25 rounded-xl border border-blue-100 dark:border-blue-800">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Monto estimado</p>
                      <p className="text-sm font-black text-blue-700 dark:text-blue-400">{fmtCOP(estimado)}</p>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-slate-100 flex justify-between">
                <Button variant="outline" className="gap-1" onClick={() => setFormStep(1)}>← Anterior</Button>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={irAPaso3} disabled={generando}>
                  {generando ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Generando…</> : 'Siguiente → Conceptos'}
                </Button>
              </div>
            </div>
          )}

          {/* ══ PASO 3: Conceptos finales ══ */}
          {formStep === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Revisa y ajusta los conceptos antes de registrar. Son editables.</p>
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={addConcepto}><Plus className="size-3" /> Agregar concepto</Button>
              </div>

              {formConceptos.length === 0 && (
                <div className="p-4 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  No hay conceptos aún. Usa el botón <strong>Agregar concepto</strong> para añadirlos manualmente.
                </div>
              )}

              <div className="space-y-2">
                {formConceptos.map(c => (
                  <div key={c.id} className={`grid grid-cols-[1fr,auto,130px,auto] gap-2 items-center p-2 rounded-lg border ${c.tipo === 'credito' ? 'border-emerald-100 bg-emerald-50/30' : 'border-red-100 bg-red-50/30'}`}>
                    <Input placeholder="Nombre del concepto" value={c.nombre} onChange={e => updateConcepto(c.id, 'nombre', e.target.value)} className="h-8 text-sm" />
                    <Select value={c.tipo} onValueChange={v => updateConcepto(c.id, 'tipo', v)}>
                      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credito" className="text-xs text-emerald-700">Crédito (+)</SelectItem>
                        <SelectItem value="debito"  className="text-xs text-red-700">Débito (−)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Monto COP" value={c.monto} onChange={e => updateConcepto(c.id, 'monto', e.target.value.replace(/[^\d.]/g, ''))} className="h-8 text-sm text-right" />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeConcepto(c.id)}><X className="size-4" /></Button>
                  </div>
                ))}
              </div>

              {/* Resumen */}
              <div className="border-t border-slate-200 pt-3 grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <p className="text-xs text-slate-400">Total créditos</p>
                  <p className="font-bold text-emerald-700">+{fmtCOP(formConceptos.filter(c=>c.tipo==='credito').reduce((s,c)=>s+(parseFloat(c.monto)||0),0))}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-slate-400">Total débitos</p>
                  <p className="font-bold text-red-600">−{fmtCOP(formConceptos.filter(c=>c.tipo==='debito').reduce((s,c)=>s+Math.abs(parseFloat(c.monto)||0),0))}</p>
                </div>
                <div className={`p-3 rounded-lg ${montoCalculado >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  <p className="text-xs text-slate-400">Monto final</p>
                  <p className={`font-bold text-lg ${montoCalculado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmtCOP(montoCalculado)}</p>
                </div>
              </div>

              {montoCalculado <= 0 && formConceptos.length > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-700">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  El monto final debe ser mayor a cero para guardar la liquidación.
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-between">
                <Button variant="outline" className="gap-1" onClick={() => setFormStep(2)}>← Anterior</Button>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50" onClick={handleSave} disabled={saving || formConceptos.length === 0 || montoCalculado <= 0}>
                  {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Guardando…</> : <><CheckCircle2 className="size-4" /> Finalizar y Guardar</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
