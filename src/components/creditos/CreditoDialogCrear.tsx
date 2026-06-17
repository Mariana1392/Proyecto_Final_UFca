import { useRef, useMemo, useState } from 'react';
import { CreditCard, Search, Check, DollarSign, Percent, Clock, Calendar, FileText, Paperclip, Upload, ExternalLink, AlertTriangle, BarChart2, X, Info, Shield, ShieldAlert, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import { TIPOS_CREDITO } from '../../lib/constants';
import { formatCurrency } from '../../lib/formatters';
import { ESTADOS_APROBACION, TIPOS_INTERES } from './creditoHelpers';
import type { CreditosHook } from './useCreditos';

interface CreditoDialogCrearProps {
  hook: CreditosHook;
}

export default function CreditoDialogCrear({ hook }: CreditoDialogCrearProps) {
  const {
    isCreateDialogOpen, setIsCreateDialogOpen,
    selectedItem, setSelectedItem,
    autocompleteSearch, setAutocompleteSearch,
    autocompleteRef,
    formAsociadoId, setFormAsociadoId,
    showAutocomplete, setShowAutocomplete,
    acSuggestions,
    handleSelectAsociado,
    formTipo, setFormTipo, handleTipoChange,
    formMonto, setFormMonto,
    formTasa, setFormTasa,
    formPlazo, setFormPlazo,
    cuotaPreview,
    formFecha, setFormFecha,
    formEstadoAprobacion, setFormEstadoAprobacion,
    formEstadoOriginal,
    formFechaEstado, setFormFechaEstado,
    formMotivoEstado, setFormMotivoEstado,
    formDescSoporte, setFormDescSoporte,
    formArchivoFile, setFormArchivoFile,
    formUrlDocumento, setFormUrlDocumento,
    fileInputRef,
    dragOver, setDragOver,
    handleFileSelect,
    handleSaveCredito,
    handleAbrirSimulacion,
    formTipoInteres, setFormTipoInteres,
    saving,
    creditos,
    // Validación ahorro vs crédito
    totalAhorroAsociado, loadingAhorro,
    showExcedeAhorroStep1, setShowExcedeAhorroStep1,
    showExcedeAhorroStep2, setShowExcedeAhorroStep2,
    excedeAhorroConfirmText, setExcedeAhorroConfirmText,
    handleExcedeAhorroStep1,
    handleExcedeAhorroStep2,
    handleCancelExcedeAhorro,
    // Referido
    formEsParaReferido, setFormEsParaReferido,
    formReferidoNombre, setFormReferidoNombre,
    formIngresoMensual,
  } = hook;

  // ── Errores inline ────────────────────────────────────────────────────────
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const validarCampo = (name: string, value: string) => {
    let error = '';
    if (name === 'monto') {
      const n = parseFloat(value.replace(/\./g, '').replace(/[^\d]/g, '')) || 0;
      if (!n || n <= 0) error = 'Ingresa un monto válido';
    }
    if (name === 'plazo') {
      const p = parseInt(value);
      if (!p || p <= 0) error = 'El plazo debe ser mayor a 0';
      else if (p > 12) error = 'El plazo máximo es de 12 meses';
    }
    if (name === 'tasa') {
      const t = parseFloat(value);
      if (isNaN(t) || t < 0 || t > 100) error = 'Tasa debe estar entre 0 y 100';
    }
    if (name === 'fecha') {
      if (!value) error = 'La fecha de desembolso es obligatoria';
    }
    setFieldErrors(prev => ({ ...prev, [name]: error }));
  };

  const isFormValid = useMemo(() => {
    if (!formAsociadoId) return false;
    const montoNum = parseFloat(formMonto.replace(/\./g, '').replace(/[^\d]/g, '')) || 0;
    if (montoNum <= 0) return false;
    const plazoNum = parseInt(formPlazo) || 0;
    if (plazoNum <= 0 || plazoNum > 12) return false;
    const tasaNum = parseFloat(formTasa);
    if (isNaN(tasaNum) || tasaNum < 0 || tasaNum > 100) return false;
    if (!formFecha) return false;
    if (Object.values(fieldErrors).some(e => e !== '')) return false;
    if (formEsParaReferido && !formReferidoNombre.trim()) return false;
    return true;
  }, [formAsociadoId, formMonto, formPlazo, formTasa, formFecha, fieldErrors, formEsParaReferido, formReferidoNombre]);

  // ── Validación en tiempo real: monto vs ahorro del asociado ────────────
  const montoActual = useMemo(() =>
    parseFloat(formMonto.replace(/\./g, '').replace(/[^\d]/g, '')) || 0,
  [formMonto]);
  const excedeAhorro = formAsociadoId && !selectedItem && totalAhorroAsociado > 0 && montoActual > totalAhorroAsociado;
  const diferenciaAhorro = montoActual - totalAhorroAsociado;
  const porcentajeExceso = totalAhorroAsociado > 0 ? Math.round((diferenciaAhorro / totalAhorroAsociado) * 100) : 0;

  // ── Capacidad de endeudamiento del asociado seleccionado ──────────────────
  const creditosActivosAsoc = useMemo(() => {
    if (!formAsociadoId) return [];
    return creditos.filter(c =>
      c.asociado_id === formAsociadoId &&
      !c.anulado &&
      ['activo', 'desembolsado', 'en_mora', 'aprobado'].includes(c.estadoAprobacion)
    );
  }, [creditos, formAsociadoId]);
  const cuotaTotalAsoc = creditosActivosAsoc.reduce((s, c) => s + (c.cuotaMensual ?? 0), 0);

  return (
    <>
    <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
      setIsCreateDialogOpen(open);
      if (!open) {
        setSelectedItem(null);
        setAutocompleteSearch('');
        setFormArchivoFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-blue-600" />
            {selectedItem ? 'Editar crédito' : 'Registrar nuevo crédito'}
          </DialogTitle>
          <DialogDescription>
            {selectedItem
              ? `Modifica la información del crédito de "${selectedItem.asociado}"`
              : 'Completa todos los campos para formalizar el crédito'}
          </DialogDescription>
        </DialogHeader>

        {/* Banner de solo lectura cuando el crédito ya fue desembolsado o pagado */}
        {selectedItem && ['desembolsado', 'pagado'].includes(selectedItem.estadoAprobacion) && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg mb-2">
            <AlertTriangle className="size-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Crédito en estado "{selectedItem.estadoAprobacion === 'desembolsado' ? 'Desembolsado' : 'Pagado'}" — solo lectura
              </p>
              <p className="text-xs text-amber-700">
                {selectedItem.estadoAprobacion === 'desembolsado'
                  ? 'El dinero ya fue entregado al asociado. No se puede modificar ningún campo financiero.'
                  : 'Este crédito ya fue cancelado en su totalidad. No se pueden realizar cambios.'}
              </p>
            </div>
          </div>
        )}

        {(() => {
          const bloqueado = !!(selectedItem && ['desembolsado', 'pagado'].includes(selectedItem.estadoAprobacion));
          return (
          <div className="space-y-5 py-2">

            {/* ── Sección: Asociado ── */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">1. Asociado</p>
              <div className="relative" ref={!selectedItem ? autocompleteRef : undefined}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10" />
                <Input
                  className="pl-10 pr-8"
                  placeholder="Buscar asociado por nombre o cédula..."
                  value={autocompleteSearch}
                  disabled={!!selectedItem}
                  autoComplete="off"
                  onChange={(e) => { setAutocompleteSearch(e.target.value); setFormAsociadoId(''); setShowAutocomplete(true); }}
                  onFocus={() => { if (!selectedItem) setShowAutocomplete(true); }}
                />
                {formAsociadoId && <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />}
                {showAutocomplete && !selectedItem && acSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                    {acSuggestions.map(a => (
                      <button key={a.id} type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between group transition-colors"
                        onMouseDown={() => handleSelectAsociado(a)}>
                        <span className="font-medium text-slate-800 text-sm group-hover:text-blue-700">{a.nombre}</span>
                        <span className="text-xs text-slate-400">{a.cedula}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showAutocomplete && !selectedItem && autocompleteSearch.length > 0 && acSuggestions.length === 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-sm text-slate-500 text-center">
                    Sin resultados para "{autocompleteSearch}"
                  </div>
                )}
              </div>
              {!formAsociadoId && autocompleteSearch.length > 0 && (
                <p className="text-xs text-amber-600">Selecciona un asociado de la lista</p>
              )}

              {/* ── Indicador de capacidad de endeudamiento ── */}
              {formAsociadoId && !selectedItem && creditosActivosAsoc.length === 0 && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                  <Info className="size-3.5 shrink-0 text-emerald-500" />
                  <span>Este asociado no tiene créditos activos — sin compromisos financieros vigentes.</span>
                </div>
              )}
              {formAsociadoId && !selectedItem && creditosActivosAsoc.length > 0 && (
                <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-xs ${
                  creditosActivosAsoc.length >= 3
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <AlertTriangle className={`size-3.5 shrink-0 mt-0.5 ${creditosActivosAsoc.length >= 3 ? 'text-red-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="font-semibold">
                      {creditosActivosAsoc.length >= 3 ? '⚠️ ' : ''}
                      Este asociado ya tiene {creditosActivosAsoc.length} crédito{creditosActivosAsoc.length !== 1 ? 's' : ''} activo{creditosActivosAsoc.length !== 1 ? 's' : ''}
                    </p>
                    <p className="mt-0.5">
                      Cuota mensual acumulada actual:{' '}
                      <strong>{formatCurrency(cuotaTotalAsoc)}</strong>
                      {cuotaPreview > 0 && (
                        <>
                          {' '}· Con este nuevo crédito:{' '}
                          <strong>{formatCurrency(cuotaTotalAsoc + cuotaPreview)}</strong>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Capacidad de endeudamiento del asociado (30% del ingreso mensual) ── */}
              {formAsociadoId && !selectedItem && !formEsParaReferido && formIngresoMensual > 0 && (
                <div className="bg-indigo-50/50 border border-indigo-150 rounded-lg p-3 text-xs space-y-1.5 mt-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Ingreso mensual declarado en afiliación:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(formIngresoMensual)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-indigo-100/50">
                    <span className="text-slate-500 font-medium">Capacidad de endeudamiento máxima (30%):</span>
                    <span className="font-bold text-indigo-750">{formatCurrency(formIngresoMensual * 0.3)}</span>
                  </div>
                  {cuotaPreview > 0 && (
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-indigo-100/50">
                      <span className="text-slate-500 font-medium">Cuota proyectada + Cuotas activas:</span>
                      <span className={`font-semibold ${
                        (cuotaTotalAsoc + cuotaPreview) > (formIngresoMensual * 0.3)
                          ? 'text-red-650'
                          : 'text-emerald-700'
                      }`}>
                        {formatCurrency(cuotaTotalAsoc + cuotaPreview)}
                      </span>
                    </div>
                  )}
                  {(cuotaTotalAsoc + cuotaPreview) > (formIngresoMensual * 0.3) && (
                    <div className="flex items-start gap-1.5 pt-1.5 text-[11px] text-amber-800 border-t border-indigo-100/50 font-medium">
                      <AlertTriangle className="size-3.5 shrink-0 text-amber-600 mt-0.5" />
                      <span>
                        ⚠️ La cuota acumulada supera la capacidad de endeudamiento recomendada del asociado.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Sección: Destinatario del crédito ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destinatario</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setFormEsParaReferido(false); setFormReferidoNombre(''); setFormTipoInteres('simple'); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    !formEsParaReferido
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <CreditCard className="size-4" />
                  Para asociado
                </button>
                <button
                  type="button"
                  onClick={() => { setFormEsParaReferido(true); setFormTipoInteres('compuesto'); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    formEsParaReferido
                      ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Users className="size-4" />
                  Para referido
                </button>
              </div>
              {formEsParaReferido && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label htmlFor="referido-nombre" className="flex items-center gap-1.5">
                    <Users className="size-3.5 text-purple-500" /> Nombre del referido <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="referido-nombre"
                    placeholder="Nombre completo de la persona referida"
                    value={formReferidoNombre}
                    onChange={(e) => setFormReferidoNombre(e.target.value)}
                    disabled={bloqueado}
                    className="border-purple-200 focus-visible:ring-purple-200"
                  />
                  <p className="text-[11px] text-purple-500">
                    El referido no tiene cuenta en el sistema. La deuda es responsabilidad del asociado seleccionado.
                  </p>
                </div>
              )}
            </div>

            {/* ── Sección: Condiciones financieras ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">2. Condiciones financieras</p>
              {/* Tipo de crédito + Tipo de interés */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tipo-credito" className="flex items-center gap-1.5">
                    <CreditCard className="size-3.5 text-indigo-500" /> Tipo de crédito <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formTipo} onValueChange={(v) => handleTipoChange ? handleTipoChange(v) : setFormTipo(v)} disabled={bloqueado}>
                    <SelectTrigger id="tipo-credito">
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CREDITO.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tipo-interes" className="flex items-center gap-1.5">
                    <Percent className="size-3.5 text-violet-500" /> Tipo de interés <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formTipoInteres}
                    onValueChange={(v) => setFormTipoInteres(v as 'simple' | 'compuesto')}
                    disabled={bloqueado}
                  >
                    <SelectTrigger id="tipo-interes">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_INTERES.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="font-medium">{t.value === 'compuesto' ? 'Compuesto (Francés)' : 'Simple'}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formTipoInteres && (
                    <p className="text-[11px] text-slate-500 leading-tight">
                      {TIPOS_INTERES.find(t => t.value === formTipoInteres)?.desc}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="monto" className="flex items-center gap-1.5">
                    <DollarSign className="size-3.5 text-blue-500" /> Monto <span className="text-red-500">*</span>
                  </Label>
                  <Input id="monto" type="text" placeholder="5.000.000"
                    value={formMonto}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                      const formatted = raw ? parseInt(raw, 10).toLocaleString('es-CO') : '';
                      setFormMonto(formatted);
                      if (fieldErrors.monto) validarCampo('monto', formatted);
                    }}
                    onBlur={() => validarCampo('monto', formMonto)}
                    disabled={bloqueado}
                    className={fieldErrors.monto ? 'border-red-400' : excedeAhorro ? 'border-amber-400 ring-1 ring-amber-200' : ''}
                  />
                  {fieldErrors.monto && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{fieldErrors.monto}</p>}
                  {/* ── Alerta en tiempo real: monto excede ahorro ── */}
                  {excedeAhorro && (
                    <div className="flex items-start gap-2 px-3 py-2 mt-1.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-800 animate-in fade-in slide-in-from-top-1 duration-200">
                      <ShieldAlert className="size-4 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <p className="font-semibold">⚠️ El monto excede el ahorro del asociado</p>
                        <p className="mt-0.5">
                          Monto solicitado: <strong>{formatCurrency(montoActual)}</strong>
                          {' · '}Total ahorrado: <strong>{formatCurrency(totalAhorroAsociado)}</strong>
                          {' · '}Exceso: <strong className="text-red-600">{formatCurrency(diferenciaAhorro)} (+{porcentajeExceso}%)</strong>
                        </p>
                        <p className="mt-0.5 text-amber-600">Se requerirá doble confirmación al registrar.</p>
                      </div>
                    </div>
                  )}
                  {/* Indicador de ahorro total cuando NO excede */}
                  {formAsociadoId && !selectedItem && totalAhorroAsociado > 0 && !excedeAhorro && montoActual > 0 && (
                    <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                      <Shield className="size-3" />
                      Dentro del límite de ahorro del asociado ({formatCurrency(totalAhorroAsociado)})
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tasa" className="flex items-center gap-1.5">
                    <Percent className="size-3.5 text-orange-500" /> Tasa anual (%)
                  </Label>
                  <Input id="tasa" type="number" step="0.01" min="0" max="100"
                    placeholder="12.5"
                    value={formTasa}
                    onChange={(e) => {
                      setFormTasa(e.target.value);
                      if (fieldErrors.tasa) validarCampo('tasa', e.target.value);
                    }}
                    onBlur={(e) => validarCampo('tasa', e.target.value)}
                    disabled={bloqueado}
                    className={fieldErrors.tasa ? 'border-red-400' : ''}
                  />
                  {fieldErrors.tasa && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{fieldErrors.tasa}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plazo" className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-indigo-500" /> Plazo (meses) <span className="text-red-500">*</span>
                  </Label>
                  <Input id="plazo" type="number" min="1" max="12" placeholder="12"
                    value={formPlazo}
                    onChange={(e) => {
                      let val = e.target.value;
                      const num = parseInt(val, 10) || 0;
                      if (num > 12) {
                        val = '12';
                      }
                      setFormPlazo(val);
                      validarCampo('plazo', val);
                    }}
                    onBlur={e => validarCampo('plazo', e.target.value)}
                    disabled={bloqueado}
                    className={fieldErrors.plazo ? 'border-red-400' : ''}
                  />
                  {fieldErrors.plazo && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{fieldErrors.plazo}</p>}
                </div>
              </div>

              {/* Cuota calculada */}
              {cuotaPreview > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <DollarSign className="size-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs text-blue-600">Cuota mensual estimada</p>
                    <p className="text-lg font-bold text-blue-800">{formatCurrency(cuotaPreview)}</p>
                  </div>
                  <div className="ml-auto text-right text-xs text-blue-500">
                    <p>{formTipoInteres === 'simple' ? 'Interés simple' : 'Amortización francesa'}</p>
                    <p>{formTasa ? `${formTasa}%` : 'Sin interés'}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="fecha" className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-slate-500" /> Fecha de desembolso <span className="text-red-500">*</span>
                </Label>
                <Input id="fecha" type="date" value={formFecha}
                  min={!selectedItem ? new Date().toISOString().split('T')[0] : undefined}
                  onChange={(e) => {
                    setFormFecha(e.target.value);
                    if (fieldErrors.fecha) validarCampo('fecha', e.target.value);
                  }}
                  onBlur={(e) => validarCampo('fecha', e.target.value)}
                  disabled={bloqueado}
                  className={fieldErrors.fecha ? 'border-red-400' : ''}
                />
                {fieldErrors.fecha && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{fieldErrors.fecha}</p>}
              </div>
            </div>

            {/* ── Sección: Documentación de soporte ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">3. Documentación de soporte</p>

              {/* Descripción textual */}
              <div className="space-y-1.5">
                <Label htmlFor="desc-soporte" className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-slate-500" />
                  Descripción de documentos entregados
                  <span className="text-xs text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Textarea
                  id="desc-soporte"
                  placeholder="Ej: Cédula de ciudadanía, desprendibles de nómina últimos 3 meses, carta laboral, extractos bancarios..."
                  className="resize-none text-sm"
                  rows={3}
                  value={formDescSoporte}
                  onChange={(e) => setFormDescSoporte(e.target.value)}
                  disabled={bloqueado}
                />
              </div>

              {/* Zona de carga de archivo */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Paperclip className="size-3.5 text-slate-500" />
                  Archivo adjunto
                  <span className="text-xs text-slate-400 font-normal">
                    (opcional · PDF, JPG, PNG, Word · máx 10 MB)
                  </span>
                </Label>

                {/* Input oculto */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />

                {bloqueado ? (
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-400">
                    <Paperclip className="size-4" />
                    No se pueden adjuntar archivos en este estado
                  </div>
                ) : formArchivoFile ? (
                  <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                      <FileText className="size-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{formArchivoFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(formArchivoFile.size / 1024).toFixed(0)} KB · Se subirá al guardar
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        title="Cambiar archivo"
                        className="p-1.5 rounded-md hover:bg-emerald-100 text-slate-500 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Quitar archivo"
                        className="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition-colors"
                        onClick={() => {
                          setFormArchivoFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>

                ) : formUrlDocumento ? (
                  <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                      <FileText className="size-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {decodeURIComponent(formUrlDocumento.split('/').pop() ?? 'Documento adjunto')}
                      </p>
                      <p className="text-xs text-slate-500">Archivo guardado anteriormente</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <a
                        href={formUrlDocumento}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver documento"
                        className="p-1.5 rounded-md hover:bg-blue-100 text-blue-600 transition-colors"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                      <button
                        type="button"
                        title="Reemplazar con otro archivo"
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Quitar archivo"
                        className="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition-colors"
                        onClick={() => {
                          setFormUrlDocumento('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>

                ) : (
                  /* Zona drag-and-drop vacía */
                  <div
                    role="button"
                    tabIndex={0}
                    className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer select-none transition-all
                      ${dragOver
                        ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                    onDragOver={(e)  => { e.preventDefault(); setDragOver(true);  }}
                    onDragLeave={()  => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  >
                    <div className="flex flex-col items-center gap-2.5 pointer-events-none">
                      <div className={`p-3 rounded-full transition-colors ${dragOver ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <Upload className={`size-5 transition-colors ${dragOver ? 'text-blue-500' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          Arrastra el archivo aquí o{' '}
                          <span className="text-blue-600 underline underline-offset-2">haz clic para seleccionar</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          También puedes subir desde tu celular · PDF, JPG, PNG, Word · Máx 10 MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); setSelectedItem(null); }}>
            {selectedItem && ['desembolsado', 'pagado'].includes(selectedItem.estadoAprobacion) ? 'Cerrar' : 'Cancelar'}
          </Button>
          {/* Solo mostrar "Ver simulación" cuando es un crédito nuevo */}
          {!selectedItem && (
            <Button
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 gap-2"
              onClick={handleAbrirSimulacion}
              disabled={saving || !isFormValid}
            >
              <BarChart2 className="size-4" />
              Ver simulación primero
            </Button>
          )}
          {/* Ocultar botón guardar si el crédito está bloqueado */}
          {!(selectedItem && ['desembolsado', 'pagado'].includes(selectedItem.estadoAprobacion)) && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSaveCredito} disabled={saving || !isFormValid}>
              {saving ? 'Guardando...' : selectedItem ? 'Actualizar crédito' : 'Registrar directamente'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ══════════════════════════════════════════════════════════════════════ */}
    {/*  MODAL PASO 1: Advertencia – Monto excede ahorros                    */}
    {/* ══════════════════════════════════════════════════════════════════════ */}
    <Dialog open={showExcedeAhorroStep1} onOpenChange={(open) => { if (!open) handleCancelExcedeAhorro(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <ShieldAlert className="size-5" />
            Monto excede ahorros del asociado
          </DialogTitle>
          <DialogDescription>
            Estás a punto de registrar un crédito por un monto superior al ahorro total del asociado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
              <p className="text-[11px] text-blue-500 uppercase tracking-wider font-medium">Monto del crédito</p>
              <p className="text-lg font-bold text-blue-800 mt-0.5">{formatCurrency(montoActual)}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
              <p className="text-[11px] text-emerald-500 uppercase tracking-wider font-medium">Total ahorrado</p>
              <p className="text-lg font-bold text-emerald-800 mt-0.5">{formatCurrency(totalAhorroAsociado)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="size-5 text-red-500 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-red-800">Diferencia: {formatCurrency(diferenciaAhorro)}</p>
              <p className="text-red-600 text-xs">El crédito excede en un <strong>{porcentajeExceso}%</strong> el ahorro del asociado</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Requiere una confirmación adicional en el siguiente paso.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancelExcedeAhorro}>Cancelar</Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 gap-2"
            onClick={handleExcedeAhorroStep1}
          >
            <ShieldAlert className="size-4" />
            Entiendo, continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ══════════════════════════════════════════════════════════════════════ */}
    {/*  MODAL PASO 2: Confirmación FINAL – escribir CONFIRMAR               */}
    {/* ══════════════════════════════════════════════════════════════════════ */}
    <Dialog open={showExcedeAhorroStep2} onOpenChange={(open) => { if (!open) handleCancelExcedeAhorro(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <Shield className="size-5" />
            🔴 CONFIRMACIÓN FINAL
          </DialogTitle>
          <DialogDescription>
            Esta acción quedará registrada en el sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="px-4 py-3 bg-red-50 border-2 border-red-300 rounded-lg">
            <p className="text-sm font-semibold text-red-800 text-center">
              Estás autorizando un crédito de <strong>{formatCurrency(montoActual)}</strong> cuando
              el asociado solo tiene ahorrado <strong>{formatCurrency(totalAhorroAsociado)}</strong>.
            </p>
            <p className="text-xs text-red-600 text-center mt-1">
              Exceso: {formatCurrency(diferenciaAhorro)} (+{porcentajeExceso}%)
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmar-exceso" className="text-sm font-medium text-slate-700">
              Escribe <strong className="text-red-600">CONFIRMAR</strong> para proceder
            </Label>
            <Input
              id="confirmar-exceso"
              placeholder="Escribe CONFIRMAR"
              value={excedeAhorroConfirmText}
              onChange={(e) => setExcedeAhorroConfirmText(e.target.value.toUpperCase())}
              className={excedeAhorroConfirmText === 'CONFIRMAR' ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-red-300'}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancelExcedeAhorro}>Cancelar</Button>
          <Button
            className="bg-red-600 hover:bg-red-700 gap-2"
            onClick={handleExcedeAhorroStep2}
            disabled={excedeAhorroConfirmText !== 'CONFIRMAR'}
          >
            <Shield className="size-4" />
            Confirmar y registrar crédito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </>
  );
}
