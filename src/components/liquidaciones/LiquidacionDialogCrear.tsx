import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { FileCog, Check, CheckCircle2, Info, FileText, Upload, X, AlertTriangle, Plus } from 'lucide-react';
import { TIPOS_LIQUIDACION as TIPOS_LIQ } from '../../lib/constants';
import { fmtCOP } from './liquidacionUtils';
import { Concepto } from './liquidacionTypes';
import type { AlertConfig } from './useLiquidacionStepper';

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
  
  alertConfig: AlertConfig | null;
  setAlertConfig: (cfg: AlertConfig | null) => void;
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
  montoCalculado, saving, handleSave,
  alertConfig, setAlertConfig
}: LiquidacionDialogCrearProps) {
  return (
    <>
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
        <div className="flex items-start gap-0 mt-2 w-full max-w-sm mx-auto mb-6">
          {([
            { n: 1 as const, label: 'Información' },
            { n: 2 as const, label: 'Resumen' },
          ] as { n: 1|2|3; label: string }[]).map((s, i) => (
            <div key={s.n} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  formStep > s.n
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : formStep === s.n
                      ? 'bg-white border-emerald-600 text-emerald-700'
                      : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  {formStep > s.n ? <Check className="size-4" /> : s.n}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${formStep >= s.n ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < 1 && (
                <div className={`flex-1 h-0.5 mb-4 mx-2 transition-colors ${formStep > s.n ? 'bg-emerald-500' : 'bg-slate-200'}`} />
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
                  <div className="flex items-center h-10 px-3 rounded-md border border-slate-200 bg-slate-50 gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap">
                      En proceso
                    </span>
                    <span className="text-[10px] text-slate-500 leading-tight">Se marca como <strong>Pagada</strong> al adjuntar soporte.</span>
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

              <div className="pt-3 border-t border-slate-100 flex justify-between">
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancelar</Button>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50" onClick={irAPaso2} disabled={!formAsociadoId || !formFechaCorte || generando}>
                  {generando ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Calculando…</> : 'Siguiente → Confirmar'}
                </Button>
              </div>
            </div>
          )}

          {/* ══ PASO 2: Resumen y Confirmación ══ */}
          {formStep === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Revisa los conceptos antes de registrar la liquidación.</p>
              </div>

              {formConceptos.length === 0 && (
                <div className="p-4 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  No hay saldos a favor o en contra para liquidar.
                </div>
              )}

              <div className="space-y-2">
                {formConceptos.map(c => (
                  <div key={c.id} className={`grid grid-cols-[1fr,auto,130px] gap-3 items-center px-4 py-3 rounded-lg border ${c.tipo === 'credito' ? 'border-emerald-100 bg-emerald-50/50' : 'border-red-100 bg-red-50/50'}`}>
                    <p className="text-sm font-medium text-slate-700">{c.nombre}</p>
                    <div className="flex justify-center">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide ${c.tipo === 'credito' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {c.tipo === 'credito' ? 'Crédito (+)' : 'Débito (−)'}
                      </span>
                    </div>
                    <p className={`text-right font-bold ${c.tipo === 'credito' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {fmtCOP(parseFloat(c.monto) || 0)}
                    </p>
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
                  El monto final es menor o igual a cero (saldo a favor del fondo).
                </div>
              )}

              <div className="pt-4 mt-2 border-t border-slate-100 flex justify-between items-center">
                <Button variant="outline" className="gap-1" onClick={() => setFormStep(1)}>← Modificar info</Button>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50" onClick={handleSave} disabled={saving || formConceptos.length === 0}>
                  {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Guardando…</> : <><CheckCircle2 className="size-4" /> Finalizar y Guardar</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    
    <AlertDialog open={!!alertConfig} onOpenChange={o => !o && setAlertConfig(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={`flex items-center gap-2 ${alertConfig?.isDestructive ? 'text-red-600' : 'text-slate-900'}`}>
            <AlertTriangle className="size-5" />
            {alertConfig?.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line text-sm mt-2">
            {alertConfig?.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel onClick={() => {
            if (alertConfig?.onCancel) alertConfig.onCancel();
            setAlertConfig(null);
          }}>
            {alertConfig?.cancelText || 'Cancelar'}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={alertConfig?.onConfirm}
            className={alertConfig?.isDestructive ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            {alertConfig?.confirmText || 'Aceptar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
