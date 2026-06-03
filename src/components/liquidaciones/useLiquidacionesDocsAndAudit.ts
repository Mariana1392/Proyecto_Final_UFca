import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { LiqDoc, AuditEntry } from './liquidacionTypes';

export function useLiquidacionesDocs(userData: any, setLiquidaciones: any) {
  const [docsLiquidacion, setDocsLiquidacion] = useState<LiqDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);
  const [uploadDocNombre, setUploadDocNombre] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const cargarDocumentos = async (liqId: string) => {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from('liquidaciones')
        .select('detalle')
        .eq('id', liqId)
        .single();
      if (error) throw error;
      const det = (data?.detalle as any) ?? {};
      const docs = (det.documentos as LiqDoc[]) ?? [];
      setDocsLiquidacion([...docs].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch {
      setDocsLiquidacion([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleUploadDoc = async (handleCargarAuditoria?: any, handleCambiarEstado?: any) => {
    if (!uploadDocFile) { toast.error('Selecciona un archivo'); return; }
    if (!uploadDocNombre.trim()) { toast.error('Ingresa un nombre para el documento'); return; }
    if (!selectedItem) return;

    setUploadingDoc(true);
    try {
      const ext = uploadDocFile.name.split('.').pop() ?? 'bin';
      const path = `${selectedItem.asociado_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('liquidaciones-documentos')
        .upload(path, uploadDocFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('liquidaciones-documentos').getPublicUrl(path);

      const nuevoDoc: LiqDoc = {
        id: crypto.randomUUID(),
        nombre: uploadDocNombre.trim(),
        url: urlData.publicUrl,
        tipo_archivo: uploadDocFile.type || ext,
        subido_por: userData?.id ?? null,
        subido_por_nombre: userData?.name ?? userData?.nombre ?? 'Administrador',
        created_at: new Date().toISOString(),
      };

      const docsActualizados = [...docsLiquidacion, nuevoDoc];

      const { error: detErr } = await supabase.rpc('actualizar_liquidacion', {
        p_id: selectedItem.id,
        p_documentos: docsActualizados,
      });

      if (detErr) throw detErr;

      setDocsLiquidacion(docsActualizados);
      setLiquidaciones((prev: any[]) => prev.map(l => l.id === selectedItem.id ? { ...l, documentos: docsActualizados } : l));

      toast.success('Documento subido correctamente');
      setIsUploadDocOpen(false);
      setUploadDocFile(null);
      setUploadDocNombre('');

      if (handleCargarAuditoria) {
        await handleCargarAuditoria(selectedItem.id, selectedItem.asociado_id, 'SUBIR_DOCUMENTO', { nombreDoc: nuevoDoc.nombre, url: nuevoDoc.url });
      }

      if (selectedItem?.estado === 'En proceso' && handleCambiarEstado) {
        await handleCambiarEstado({ ...selectedItem, documentos: docsActualizados }, 'Pagada', handleCargarAuditoria);
      }
    } catch (err: any) {
      toast.error('Error al subir: ' + err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDownloadDoc = async (doc: LiqDoc) => {
    try {
      const response = await fetch(doc.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.nombre}.${doc.tipo_archivo.split('/').pop() || 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Error al descargar: ' + err.message);
    }
  };

  const handleDeleteDoc = async (docId: string, handleCargarAuditoria?: any) => {
    if (!selectedItem) return;
    try {
      const docsA = docsLiquidacion.filter(d => d.id !== docId);
      const docEliminado = docsLiquidacion.find(d => d.id === docId);

      const { error } = await supabase.rpc('actualizar_liquidacion', {
        p_id: selectedItem.id,
        p_documentos: docsA,
      });

      if (error) throw error;
      setDocsLiquidacion(docsA);
      setLiquidaciones((prev: any[]) => prev.map(l => l.id === selectedItem.id ? { ...l, documentos: docsA } : l));
      toast.success('Documento eliminado');

      if (handleCargarAuditoria && docEliminado) {
         await handleCargarAuditoria(selectedItem.id, selectedItem.asociado_id, 'ELIMINAR_DOCUMENTO', { nombreDoc: docEliminado.nombre });
      }
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    }
  };

  return {
    docsLiquidacion,
    loadingDocs,
    isUploadDocOpen, setIsUploadDocOpen,
    uploadDocFile, setUploadDocFile,
    uploadDocNombre, setUploadDocNombre,
    uploadingDoc,
    selectedItem, setSelectedItem,
    cargarDocumentos,
    handleUploadDoc,
    handleDownloadDoc,
    handleDeleteDoc
  };
}

export function useLiquidacionesAudit(userData: any) {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const cargarAuditoria = async (liqId: string) => {
    setLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from('auditoria')
        .select('id, accion, datos_despues, usuario_id, created_at')
        .eq('registro_id', liqId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAuditEntries(data || []);
    } catch {
      setAuditEntries([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  const registrarAuditLiq = async (liqId: string, asociadoId: string, accion: string, detalle: Record<string, any>) => {
    try {
      await supabase.from('auditoria').insert({
        tabla: 'liquidaciones',
        registro_id: liqId,
        asociado_id: asociadoId,
        usuario_id: userData?.id ?? null,
        accion,
        datos_despues: detalle,
      });
    } catch {
      // Fallo silencioso
    }
  };

  return {
    auditEntries,
    loadingAudit,
    auditOpen, setAuditOpen,
    cargarAuditoria,
    registrarAuditLiq
  };
}
