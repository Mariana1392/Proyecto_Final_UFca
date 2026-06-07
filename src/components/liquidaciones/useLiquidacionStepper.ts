import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Concepto, LiqDoc } from './liquidacionTypes';
import { fmtCOP } from './liquidacionUtils';

interface UseLiquidacionStepperProps {
  userData: any;
  setLiquidaciones: any;
  setIsCreateOpen: (b: boolean) => void;
  cargarDatos: () => Promise<void>;
  registrarAuditLiq: (liqId: string, asocId: string, accion: string, detalle: any) => Promise<void>;
}

export function useLiquidacionStepper({ userData, setLiquidaciones, setIsCreateOpen, cargarDatos, registrarAuditLiq }: UseLiquidacionStepperProps) {
  const [formAsociadoId, setFormAsociadoId] = useState('');
  const [formAsocSearch, setFormAsocSearch] = useState('');
  const [showAcomplete, setShowAcomplete] = useState(false);
  const [formTipo, setFormTipo] = useState('retiro');
  const [formFechaCorte, setFormFechaCorte] = useState('');
  const [formFechaLiq, setFormFechaLiq] = useState('');
  const [formEstado, setFormEstado] = useState('En proceso');
  const [formMotivo, setFormMotivo] = useState('');
  const [formObservaciones, setFormObservaciones] = useState('');
  
  const [formAhorroPerm, setFormAhorroPerm] = useState('');
  const [formAhorroVol, setFormAhorroVol] = useState('');
  const [formCreditoPend, setFormCreditoPend] = useState('');
  const [formUtilidades, setFormUtilidades] = useState('');
  
  const [generando, setGenerando] = useState(false);
  const [conceptosGenerados, setConceptosGenerados] = useState(false);
  const [datosAsocLoading, setDatosAsocLoading] = useState(false);
  
  const [formStep, setFormStep] = useState<1|2|3>(1);
  const [formConceptos, setFormConceptos] = useState<Concepto[]>([]);
  
  const [formArchivoFile, setFormArchivoFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<HTMLDivElement>(null);

  const cargarDatosAsociado = async (id: string) => {
    setDatosAsocLoading(true);
    try {
      const [ahPermRes, ahVolRes, crRes] = await Promise.all([
        supabase.from('cuentas_ahorro').select('monto_ahorrado').eq('tipo','permanente').eq('asociado_id', id).eq('anulado', false),
        supabase.from('cuentas_ahorro').select('monto_ahorrado').eq('tipo','voluntario').eq('asociado_id', id).eq('anulado', false),
        supabase.from('creditos').select('saldo').eq('asociado_id', id).in('estado', ['activo', 'pendiente', 'aprobado', 'desembolsado', 'en_mora']).eq('anulado', false),
      ]);
      const totAP = (ahPermRes.data || []).reduce((s: number, r: any) => s + (Number(r.monto_ahorrado) || 0), 0);
      const totAV = (ahVolRes.data  || []).reduce((s: number, r: any) => s + (Number(r.monto_ahorrado) || 0), 0);
      const totCr = (crRes.data     || []).reduce((s: number, r: any) => s + (Number(r.saldo)          || 0), 0);
      setFormAhorroPerm(totAP > 0 ? String(Math.round(totAP)) : '');
      setFormAhorroVol(totAV  > 0 ? String(Math.round(totAV))  : '');
      setFormCreditoPend(totCr > 0 ? String(Math.round(totCr)) : '');
    } catch {
      // Fallo silencioso
    } finally {
      setDatosAsocLoading(false);
    }
  };

  const handleSelectAsociado = (a: any) => {
    setFormAsociadoId(a.id);
    setFormAsocSearch(`${a.nombre}  ·  ${a.cedula}`);
    setShowAcomplete(false);
    setConceptosGenerados(false);
    setFormConceptos([]);
    cargarDatosAsociado(a.id);
  };

  const resetForm = () => {
    setFormAsociadoId(''); setFormAsocSearch('');
    setFormTipo('retiro'); setFormFechaCorte(''); setFormFechaLiq('');
    setFormEstado('En proceso'); setFormMotivo(''); setFormObservaciones('');
    setFormAhorroPerm(''); setFormAhorroVol(''); setFormCreditoPend(''); setFormUtilidades('');
    setConceptosGenerados(false);
    setFormConceptos([]);
    setFormArchivoFile(null);
    setFormStep(1);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleGenerarConceptos = async (): Promise<boolean> => {
    if (!formAsociadoId) { toast.error('Selecciona un asociado primero'); return false; }
    if (!formFechaCorte) { toast.error('Ingresa la fecha de corte'); return false; }

    setGenerando(true);
    try {
      const fechaCorteDate = new Date(formFechaCorte + 'T00:00:00');
      const mesCorte = fechaCorteDate.getMonth();
      const aplicaUtilidades = mesCorte >= 10;

      let utilidadesAsociado = parseFloat(formUtilidades) || 0;
      if (aplicaUtilidades && !formUtilidades) {
        const [moraRes, interesRes, asocCountRes] = await Promise.all([
          supabase.from('transacciones').select('monto_mora').eq('tipo','aporte_permanente').gt('monto_mora', 0),
          supabase.from('transacciones').select('interes').in('tipo',['pago_credito','abono_capital']).gt('interes', 0),
          supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('estado_cuenta', 'activo'),
        ]);
        const totalMora = ((moraRes.data || []) as any[]).reduce((s, r) => s + (Number(r.monto_mora) || 0), 0);
        const totalInteres = ((interesRes.data || []) as any[]).reduce((s, r) => s + (Number(r.interes) || 0), 0);
        const count = (asocCountRes as any).count ?? 1;
        utilidadesAsociado = count > 0 ? Math.round((totalMora + totalInteres) / count) : 0;
        if (utilidadesAsociado > 0) setFormUtilidades(String(utilidadesAsociado));
      }

      const ap = parseFloat(formAhorroPerm) || 0;
      const av = parseFloat(formAhorroVol) || 0;
      const cr = parseFloat(formCreditoPend) || 0;
      const util = parseFloat(formUtilidades) || utilidadesAsociado;

      const nuevosConceptos: Concepto[] = [];
      let nextId = 1;
      if (ap > 0) nuevosConceptos.push({ id: nextId++, nombre: 'Ahorro permanente acumulado', monto: String(Math.round(ap)), tipo: 'credito' });
      if (av > 0) nuevosConceptos.push({ id: nextId++, nombre: 'Ahorro voluntario acumulado', monto: String(Math.round(av)), tipo: 'credito' });
      if (util > 0) nuevosConceptos.push({ id: nextId++, nombre: `Utilidades del fondo (${mesCorte === 10 ? 'noviembre' : 'diciembre'} ${fechaCorteDate.getFullYear()})`, monto: String(Math.round(util)), tipo: 'credito' });
      if (cr > 0) nuevosConceptos.push({ id: nextId++, nombre: 'Saldo de crédito pendiente', monto: String(Math.round(cr)), tipo: 'debito' });

      if (nuevosConceptos.length === 0) {
        toast.error('No hay saldos para este asociado. Puedes agregar los conceptos manualmente.');
        setGenerando(false);
        return true;
      }

      setFormConceptos(nuevosConceptos);
      setConceptosGenerados(true);
      const msgUtil = aplicaUtilidades && util > 0
        ? ` · Utilidades: ${fmtCOP(util)}`
        : !aplicaUtilidades ? ' · Sin utilidades (aplica solo en nov/dic)' : '';
      toast.success(`${nuevosConceptos.length} conceptos generados${msgUtil}`);
      return true;
    } catch (err: any) {
      toast.error('Error al generar conceptos: ' + err.message);
      return false;
    } finally {
      setGenerando(false);
    }
  };

  const irAPaso2 = async () => {
    if (!formAsociadoId) { toast.error('Selecciona un asociado'); return; }
    if (!formFechaCorte) { toast.error('Ingresa la fecha de corte'); return; }

    const { data: credActivos } = await supabase
      .from('creditos')
      .select('id, monto, saldo, estado')
      .eq('asociado_id', formAsociadoId)
      .in('estado', ['desembolsado', 'en_mora'])
      .eq('anulado', false)
      .gt('saldo', 0);

    if (credActivos && credActivos.length > 0) {
      const totalDeuda = credActivos.reduce((s: number, c: any) => s + (Number(c.saldo) || 0), 0);
      toast.error(
        `El asociado tiene ${credActivos.length} crédito(s) activo(s) con saldo pendiente de $${totalDeuda.toLocaleString('es-CO')}. ` +
        `Debe cancelar sus deudas antes de liquidar.`,
        { duration: 6000 }
      );
      return;
    }

    setFormStep(2);
  };

  const irAPaso3 = async () => {
    const ok = await handleGenerarConceptos();
    if (ok) setFormStep(3);
  };

  const montoCalculado = formConceptos.reduce((s, c) => {
    const v = parseFloat(String(c.monto).replace(/[^\d.-]/g, '')) || 0;
    return s + (c.tipo === 'credito' ? v : -Math.abs(v));
  }, 0);

  const handleSave = async () => {
    if (!formAsociadoId) { toast.error('Selecciona un asociado'); return; }
    if (!formFechaCorte) { toast.error('Ingresa la fecha de corte'); return; }
    if (formConceptos.length === 0) { toast.error('Debes agregar al menos un concepto'); return; }
    if (formConceptos.some(c => !c.nombre.trim())) { toast.error('Todos los conceptos deben tener nombre'); return; }
    if (formConceptos.some(c => isNaN(parseFloat(String(c.monto))) || parseFloat(String(c.monto)) <= 0)) { toast.error('Los montos de los conceptos deben ser mayores a cero'); return; }
    if (montoCalculado <= 0) { toast.error('El monto total debe ser mayor a cero'); return; }

    let urlFinal: string | null = null;
    if (formArchivoFile) {
      try {
        const ext = formArchivoFile.name.split('.').pop() ?? 'bin';
        const path = `${formAsociadoId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('liquidaciones-documentos').upload(path, formArchivoFile, { upsert: true });
        if (upErr) throw new Error('Error al subir archivo: ' + upErr.message);
        const { data: urlData } = supabase.storage.from('liquidaciones-documentos').getPublicUrl(path);
        urlFinal = urlData.publicUrl;
      } catch (err: any) { toast.error(err.message); return; }
    }

    setSaving(true);
    try {
      const docInicial: LiqDoc[] = urlFinal ? [{
        id: crypto.randomUUID(),
        nombre: formArchivoFile!.name,
        url: urlFinal,
        tipo_archivo: (formArchivoFile!.name.split('.').pop() ?? 'pdf').toLowerCase(),
        subido_por: userData?.id ?? null,
        subido_por_nombre: userData?.name ?? userData?.nombre ?? 'Administrador',
        created_at: new Date().toISOString(),
      }] : [];

      const detalle = {
        fechaCorte: formFechaCorte,
        fechaLiquidacion: formFechaLiq || null,
        estado: formEstado,
        motivo: formMotivo.trim() || null,
        observaciones: formObservaciones.trim() || null,
        conceptos: formConceptos,
        documentos: docInicial,
        calculo: {
          salarioMensual: 0,
          fechaIngreso: '',
          diasVacPendientes: 0
        },
      };

      const payload = {
        asociado_id: formAsociadoId,
        tipo: formTipo,
        monto_total: montoCalculado,
        fecha: new Date().toISOString().split('T')[0],
        detalle,
        estado: formEstado,
        fecha_corte: formFechaCorte,
        fecha_liquidacion: formFechaLiq || null,
      };

      const { data, error } = await supabase.from('liquidaciones').insert([payload]).select().single();
      if (error) throw error;

      // Procesar acciones automáticas según el tipo de liquidación
      if (['retiro', 'fallecimiento'].includes(formTipo)) {
        // Desactivar el usuario
        const { error: errUsr } = await supabase.from('usuarios').update({ estado_cuenta: 'inactivo' }).eq('id', formAsociadoId);
        if (errUsr) console.error('Error al desactivar usuario:', errUsr);
      } else if (formTipo === 'anual') {
        // Reiniciar ahorros sin desactivar al usuario
        const { error: errAh } = await supabase.from('cuentas_ahorro').update({ monto_ahorrado: 0 }).eq('asociado_id', formAsociadoId).eq('anulado', false);
        if (errAh) console.error('Error al reiniciar ahorros:', errAh);
      }

      await registrarAuditLiq(data.id, formAsociadoId, 'CREACION_LIQUIDACION', {
        tipo: formTipo, montoTotal: montoCalculado, estado: formEstado,
        fechaCorte: formFechaCorte, cantConceptos: formConceptos.length, docSubido: !!urlFinal
      });

      toast.success('Liquidación creada correctamente');
      setIsCreateOpen(false);
      resetForm();
      cargarDatos();
    } catch (err: any) {
      toast.error('Error al crear liquidación: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addConcepto = () => setFormConceptos(p => [...p, { id: Date.now(), nombre: '', monto: '', tipo: 'credito' }]);
  const removeConcepto = (id: number) => setFormConceptos(p => p.filter(c => c.id !== id));
  const updateConcepto = (id: number, field: keyof Concepto, value: string) =>
    setFormConceptos(p => p.map(c => c.id === id ? { ...c, [field]: value } : c));

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error('El archivo supera los 10 MB'); return; }
    const allowed = ['application/pdf','image/jpeg','image/png','image/webp',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) { toast.error('Formato no permitido (PDF, JPG, PNG, Word)'); return; }
    setFormArchivoFile(file);
  };

  return {
    formAsociadoId, setFormAsociadoId,
    formAsocSearch, setFormAsocSearch,
    showAcomplete, setShowAcomplete,
    formTipo, setFormTipo,
    formFechaCorte, setFormFechaCorte,
    formFechaLiq, setFormFechaLiq,
    formEstado, setFormEstado,
    formMotivo, setFormMotivo,
    formObservaciones, setFormObservaciones,
    formAhorroPerm, setFormAhorroPerm,
    formAhorroVol, setFormAhorroVol,
    formCreditoPend, setFormCreditoPend,
    formUtilidades, setFormUtilidades,
    generando, conceptosGenerados, datosAsocLoading,
    formStep, setFormStep,
    formConceptos, setFormConceptos,
    formArchivoFile, setFormArchivoFile,
    dragOver, setDragOver,
    saving,
    fileRef, acRef,
    handleSelectAsociado, resetForm,
    handleGenerarConceptos, irAPaso2, irAPaso3, handleSave,
    montoCalculado, addConcepto, removeConcepto, updateConcepto, handleFileSelect
  };
}
