// ── useCreditosCRUD.ts ────────────────────────────────────────────────────────
// Gestiona el estado del formulario de crédito, los diálogos de creación /
// edición / anulación / eliminación definitiva y todos sus handlers.
// Recibe como parámetros el estado mínimo compartido del orquestador.

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { creditosApi } from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';
import { ESTADOS_APROBACION, calcularCuota, calcularCuotaSimple } from './creditoHelpers';

interface UseCreditosCRUDParams {
  selectedItem:        any;
  setSelectedItem:     (v: any) => void;
  setCreditos:         React.Dispatch<React.SetStateAction<any[]>>;
  asociadosDisponibles: any[];
  cargarDatos:         () => Promise<void>;
  userData?:           any;
  parseMonto:          (v: string) => number;
}

export function useCreditosCRUD({
  selectedItem,
  setSelectedItem,
  setCreditos,
  asociadosDisponibles,
  cargarDatos,
  userData,
  parseMonto,
}: UseCreditosCRUDParams) {

  // ── Diálogos CRUD ─────────────────────────────────────────────────────────
  const [isCreateDialogOpen, setIsCreateDialogOpen]         = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]         = useState(false);
  const [anulacionStep, setAnulacionStep]                   = useState<1|2>(1);
  const [anulacionConfirmText, setAnulacionConfirmText]     = useState('');
  const [anulando, setAnulando]                             = useState(false);
  const [isHardDeleteDialogOpen, setIsHardDeleteDialogOpen] = useState(false);
  const [hardDeleteStep, setHardDeleteStep]                 = useState<1|2>(1);
  const [hardDeleteConfirmText, setHardDeleteConfirmText]   = useState('');
  const [hardDeleteJustificacion, setHardDeleteJustificacion] = useState('');
  const [hardDeleting, setHardDeleting]                     = useState(false);
  const [justificacionAnulacion, setJustificacionAnulacion] = useState('');

  // ── Formulario ────────────────────────────────────────────────────────────
  const [formAsociadoId, setFormAsociadoId]           = useState('');
  const [formMonto, setFormMonto]                     = useState('');
  const [formTasa, setFormTasa]                       = useState('');
  const [formPlazo, setFormPlazo]                     = useState('');
  const [formFecha, setFormFecha]                     = useState('');
  const [formTipo, setFormTipo]                       = useState('libre_inversion');
  const [formEstadoAprobacion, setFormEstadoAprobacion] = useState('pendiente');
  const [formEstadoOriginal, setFormEstadoOriginal]   = useState('pendiente');
  const [formFechaEstado, setFormFechaEstado]         = useState('');
  const [formMotivoEstado, setFormMotivoEstado]       = useState('');
  const [formDescSoporte, setFormDescSoporte]         = useState('');
  const [formUrlDocumento, setFormUrlDocumento]       = useState('');
  const [formTipoInteres, setFormTipoInteres]         = useState<'simple' | 'compuesto'>('compuesto');
  const [saving, setSaving]                           = useState(false);

  // ── Archivo adjunto ───────────────────────────────────────────────────────
  const [formArchivoFile, setFormArchivoFile] = useState<File | null>(null);
  const [dragOver, setDragOver]               = useState(false);
  const fileInputRef                          = useRef<HTMLInputElement>(null);

  // ── Autocompletado asociados (formulario) ─────────────────────────────────
  const [autocompleteSearch, setAutocompleteSearch] = useState('');
  const [showAutocomplete, setShowAutocomplete]     = useState(false);
  const autocompleteRef                             = useRef<HTMLDivElement>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const acSuggestions = asociadosDisponibles
    .filter(a => a.estado_cuenta !== 'inactivo' && (
      a.nombre.toLowerCase().includes(autocompleteSearch.toLowerCase()) ||
      a.cedula.includes(autocompleteSearch)
    ))
    .slice(0, 8);

  const handleSelectAsociado = (a: any) => {
    setFormAsociadoId(a.id);
    setAutocompleteSearch(`${a.nombre}  ·  ${a.cedula}`);
    setShowAutocomplete(false);
  };

  // ── Abrir formulario (crear / editar) ─────────────────────────────────────
  const handleOpenCreate = (item?: any) => {
    if (item) {
      setSelectedItem(item);
      setFormAsociadoId(item.asociado_id);
      setAutocompleteSearch(`${item.asociado}  ·  ${item.cedula}`);
      setFormTipo(item.tipo ?? 'libre_inversion');
      setFormMonto(item.monto.toString());
      setFormTasa(item.tasaInteres.toString());
      setFormPlazo(item.plazo.toString());
      setFormFecha(item.fechaDesembolso ?? '');
      setFormEstadoAprobacion(item.estadoAprobacion ?? 'pendiente');
      setFormEstadoOriginal(item.estadoAprobacion ?? 'pendiente');
      setFormFechaEstado(item.fechaEstadoCambio ? item.fechaEstadoCambio.split('T')[0] : '');
      setFormMotivoEstado(item.motivoEstadoCambio ?? '');
      setFormDescSoporte(item.descripcionSoporte ?? '');
      setFormUrlDocumento(item.urlDocumento ?? '');
      setFormTipoInteres(item.tipoInteres ?? 'compuesto');
    } else {
      setSelectedItem(null);
      setFormAsociadoId(''); setAutocompleteSearch('');
      setFormTipo('libre_inversion');
      setFormMonto(''); setFormTasa(''); setFormPlazo('');
      setFormFecha(new Date().toISOString().split('T')[0]);
      setFormEstadoAprobacion('pendiente');
      setFormEstadoOriginal('pendiente');
      setFormFechaEstado(''); setFormMotivoEstado('');
      setFormDescSoporte(''); setFormUrlDocumento('');
      setFormTipoInteres('compuesto');
      setFormArchivoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    setIsCreateDialogOpen(true);
  };

  // ── Seleccionar archivo ───────────────────────────────────────────────────
  const handleFileSelect = (file: File) => {
    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo supera los ${MAX_MB} MB permitidos`);
      return;
    }
    const allowed = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.type)) {
      toast.error('Formato no permitido. Usa PDF, JPG, PNG, WEBP o Word.');
      return;
    }
    setFormArchivoFile(file);
  };

  // ── Guardar crédito (crear / editar) ─────────────────────────────────────
  const handleSaveCredito = async () => {
    if (!formAsociadoId)      { toast.error('Selecciona un asociado'); return; }
    const monto = parseMonto(formMonto);
    if (!monto || monto <= 0) { toast.error('Ingresa un monto válido'); return; }
    const tasa  = parseFloat(formTasa) || 0;
    const plazo = parseInt(formPlazo) || 0;
    if (plazo <= 0)           { toast.error('El plazo debe ser mayor a 0 meses'); return; }
    if (!formFecha)           { toast.error('Selecciona la fecha de desembolso'); return; }

    const cuota = formTipoInteres === 'simple'
      ? calcularCuotaSimple(monto, tasa, plazo)
      : calcularCuota(monto, tasa, plazo);
    setSaving(true);

    // Subir archivo si hay uno adjunto
    let urlFinal: string | null = formUrlDocumento.trim() || null;
    if (formArchivoFile) {
      try {
        const ext      = formArchivoFile.name.split('.').pop() ?? 'bin';
        const filePath = `${formAsociadoId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('creditos-documentos')
          .upload(filePath, formArchivoFile, { upsert: true });
        if (uploadError) throw new Error('Error al subir el archivo: ' + uploadError.message);
        const { data: urlData } = supabase.storage
          .from('creditos-documentos')
          .getPublicUrl(filePath);
        urlFinal = urlData.publicUrl;
      } catch (err: any) {
        toast.error(err.message);
        setSaving(false);
        return;
      }
    }

    try {
      const ahora       = new Date().toISOString();
      const adminNombre = userData?.nombre ?? userData?.email ?? 'Administrador';
      const estadoCambio = selectedItem && formEstadoAprobacion !== formEstadoOriginal;

      if (selectedItem) {
        // ── Editar ──
        const payloadEdit = {
          tipo:                      formTipo,
          monto,
          tasa_interes:              tasa,
          plazo_meses:               plazo,
          cuota_mensual:             cuota,
          tipo_interes:              formTipoInteres,
          // ⚠️ NO se toca el saldo — solo los pagos lo modifican.
          // Resetear saldo aquí borraría el historial de pagos ya registrado.
          estado:                    formEstadoAprobacion,
          fecha_desembolso:          formFecha || null,
          observaciones:             formDescSoporte.trim() || null,
          url_comprobante_solicitud: urlFinal,
          ...(estadoCambio ? {
            fecha_estado_cambio:  formFechaEstado  || ahora,
            motivo_estado_cambio: formMotivoEstado.trim() || null,
          } : {}),
        };
        await creditosApi.update(selectedItem.id, payloadEdit);
        setCreditos(prev => prev.map(c =>
          c.id === selectedItem.id ? {
            ...c,
            tipo: formTipo, monto, tasaInteres: tasa, plazo, cuotaMensual: cuota,
            // saldo NO se toca — conserva el valor actual
            fechaDesembolso:    formFecha,
            estadoAprobacion:   formEstadoAprobacion,
            descripcionSoporte: formDescSoporte,
            urlDocumento:       urlFinal ?? '',
            fechaEstadoCambio:  estadoCambio ? (formFechaEstado || ahora) : c.fechaEstadoCambio,
            motivoEstadoCambio: estadoCambio ? formMotivoEstado.trim() : c.motivoEstadoCambio,
          } : c
        ));
        toast.success('✅ Crédito actualizado correctamente', {
          description: `Editado por ${adminNombre} · ${new Date(ahora).toLocaleString('es-CO')}`,
        });
      } else {
        // ── Crear ──
        const asociado = asociadosDisponibles.find(a => a.id === formAsociadoId);
        const nuevo = await creditosApi.create({
          asociado_id:               formAsociadoId,
          tipo:                      formTipo,
          monto,
          tasa_interes:              tasa,
          plazo_meses:               plazo,
          cuota_mensual:             cuota,
          tipo_interes:              formTipoInteres,
          saldo:                     monto,
          estado:                    'activo',
          anulado:                   false,
          fecha_desembolso:          formFecha || null,
          observaciones:             formDescSoporte.trim() || null,
          url_comprobante_solicitud: urlFinal,
        });
        setCreditos(prev => [{
          id:                 nuevo.id,
          asociado:           asociado?.nombre ?? '',
          cedula:             asociado?.cedula ?? '',
          asociado_id:        formAsociadoId,
          tipo:               formTipo,
          monto, tasaInteres: tasa, plazo, cuotaMensual: cuota,
          tipoInteres:        formTipoInteres,
          saldo:              monto,
          fechaDesembolso:    formFecha,
          estadoAprobacion:   formEstadoAprobacion,
          descripcionSoporte: formDescSoporte,
          urlDocumento:       urlFinal ?? '',
          estado: 'activo', anulado: false, motivoAnulacion: '',
          editadoPor: '', editadoEn: '',
          fechaEstadoCambio:  formFechaEstado || '',
          motivoEstadoCambio: formMotivoEstado || '',
          createdAt:          ahora,
        }, ...prev]);
        toast.success('✅ Crédito registrado exitosamente', {
          description: `${asociado?.nombre} · ${formatCurrency(monto)} · ${plazo} meses`,
        });
      }

      setIsCreateDialogOpen(false);
      setSelectedItem(null);
      setFormArchivoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error('Error al guardar crédito: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Anular ────────────────────────────────────────────────────────────────
  const ESTADOS_NO_ANULABLES = new Set([
    'aprobado', 'aprobada', 'desembolsado', 'activo', 'en_mora',
  ]);

  const handleOpenAnular = (item: any) => {
    if (item.anulado) {
      toast.error('Este crédito ya se encuentra anulado');
      return;
    }
    if (ESTADOS_NO_ANULABLES.has(item.estadoAprobacion)) {
      toast.error('No se puede anular este crédito', {
        description: `Estado "${ESTADOS_APROBACION.find(e => e.value === item.estadoAprobacion)?.label ?? item.estadoAprobacion}" indica compromisos financieros activos. Solo se pueden anular créditos en estado: Pendiente, En revisión, Rechazado o Pagado.`,
      });
      return;
    }
    setSelectedItem(item);
    setJustificacionAnulacion('');
    setAnulacionConfirmText('');
    setAnulacionStep(1);
    setIsDeleteDialogOpen(true);
  };

  const handleAnular = async () => {
    if (!selectedItem) return;
    if (anulacionConfirmText !== 'ANULAR') {
      toast.error('Debes escribir ANULAR para confirmar');
      return;
    }
    setAnulando(true);
    try {
      await creditosApi.anular(selectedItem.id, justificacionAnulacion.trim());
      setCreditos(prev => prev.map(c =>
        c.id === selectedItem.id
          ? { ...c, anulado: true, motivoAnulacion: justificacionAnulacion.trim() }
          : c
      ));
      toast.success(`Crédito de "${selectedItem.asociado}" anulado correctamente`, {
        description: `Motivo: ${justificacionAnulacion.trim()}`,
      });
      setIsDeleteDialogOpen(false);
      setSelectedItem(null);
      setJustificacionAnulacion('');
      setAnulacionConfirmText('');
      setAnulacionStep(1);
    } catch (err: any) {
      toast.error('Error al anular: ' + err.message);
    } finally {
      setAnulando(false);
    }
  };

  // ── Eliminación definitiva ─────────────────────────────────────────────────
  const ESTADOS_NO_ELIMINABLES = new Set([
    'aprobado', 'aprobada', 'desembolsado', 'activo', 'en_mora',
  ]);

  const handleOpenHardDelete = (item: any) => {
    if (ESTADOS_NO_ELIMINABLES.has(item.estadoAprobacion) && !item.anulado) {
      toast.error('No se puede eliminar este crédito', {
        description: `Estado "${item.estadoAprobacion}" indica que el crédito tiene compromisos activos. Solo puedes eliminar créditos pendientes, rechazados o ya pagados.`,
      });
      return;
    }
    if ((item.saldo ?? 0) > 0 && !item.anulado) {
      toast.error('No se puede eliminar un crédito con saldo activo', {
        description: `Saldo pendiente: ${formatCurrency(item.saldo)}. Anula el crédito primero.`,
      });
      return;
    }
    setSelectedItem(item);
    setHardDeleteStep(1);
    setHardDeleteConfirmText('');
    setIsHardDeleteDialogOpen(true);
  };

  const handleHardDelete = async () => {
    if (!selectedItem) return;
    if (hardDeleteConfirmText !== 'ELIMINAR') {
      toast.error('Debes escribir ELIMINAR para confirmar');
      return;
    }
    setHardDeleting(true);
    try {
      await creditosApi.eliminar(selectedItem.id);
      setCreditos(prev => prev.filter(c => c.id !== selectedItem.id));
      toast.success(`Crédito de "${selectedItem.asociado}" eliminado definitivamente`, {
        description: `Motivo: ${hardDeleteJustificacion.trim()}`,
      });
      setIsHardDeleteDialogOpen(false);
      setSelectedItem(null);
      setHardDeleteJustificacion('');
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    } finally {
      setHardDeleting(false);
    }
  };

  return {
    // Diálogos
    isCreateDialogOpen, setIsCreateDialogOpen,
    isDeleteDialogOpen, setIsDeleteDialogOpen,
    anulacionStep, setAnulacionStep,
    anulacionConfirmText, setAnulacionConfirmText,
    anulando,
    isHardDeleteDialogOpen, setIsHardDeleteDialogOpen,
    hardDeleteStep, setHardDeleteStep,
    hardDeleteConfirmText, setHardDeleteConfirmText,
    hardDeleteJustificacion, setHardDeleteJustificacion,
    hardDeleting,
    justificacionAnulacion, setJustificacionAnulacion,
    // Formulario
    formAsociadoId, setFormAsociadoId,
    formMonto, setFormMonto,
    formTasa, setFormTasa,
    formPlazo, setFormPlazo,
    formFecha, setFormFecha,
    formTipo, setFormTipo,
    formEstadoAprobacion, setFormEstadoAprobacion,
    formEstadoOriginal,
    formFechaEstado, setFormFechaEstado,
    formMotivoEstado, setFormMotivoEstado,
    formDescSoporte, setFormDescSoporte,
    formUrlDocumento, setFormUrlDocumento,
    formTipoInteres, setFormTipoInteres,
    saving,
    // Archivo
    formArchivoFile, setFormArchivoFile,
    dragOver, setDragOver,
    fileInputRef,
    // Autocompletado
    autocompleteSearch, setAutocompleteSearch,
    showAutocomplete, setShowAutocomplete,
    autocompleteRef,
    acSuggestions,
    // Handlers
    handleSelectAsociado,
    handleOpenCreate,
    handleFileSelect,
    handleSaveCredito,
    handleOpenAnular,
    handleAnular,
    handleOpenHardDelete,
    handleHardDelete,
  };
}
