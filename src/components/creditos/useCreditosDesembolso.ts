import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/formatters';

export interface UseCreditosDesembolsoParams {
  selectedItem: any;
  setSelectedItem: (v: any) => void;
  cargarDatos: () => Promise<void>;
}

export function useCreditosDesembolso({
  selectedItem,
  setSelectedItem,
  cargarDatos,
}: UseCreditosDesembolsoParams) {
  const [isDesembolsoOpen, setIsDesembolsoOpen]       = useState(false);
  const [desembolsoFecha, setDesembolsoFecha]         = useState('');
  const [desembolsoReferencia, setDesembolsoReferencia] = useState('');
  const [desembolsoArchivo, setDesembolsoArchivo]     = useState<File | null>(null);
  const [guardandoDesembolso, setGuardandoDesembolso] = useState(false);

  const handleRegistrarDesembolso = async () => {
    if (!selectedItem) return;
    if (!desembolsoFecha) { toast.error('Selecciona la fecha de desembolso'); return; }
    setGuardandoDesembolso(true);
    try {
      let comprobantePath: string | null = null;
      if (desembolsoArchivo) {
        const ext  = desembolsoArchivo.name.split('.').pop() ?? 'bin';
        const path = `${selectedItem.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('comprobantes')
          .upload(path, desembolsoArchivo, { upsert: false });
        if (upErr) throw new Error('Error al subir comprobante: ' + upErr.message);
        comprobantePath = path;
      }

      const { error } = await supabase.from('creditos').update({
        fecha_desembolso:     desembolsoFecha,
        estado:               'desembolsado',
        fecha_estado_cambio:  new Date().toISOString(),
        motivo_estado_cambio: 'Desembolso registrado por administrador',
      }).eq('id', selectedItem.id);

      if (error) throw error;

      supabase.from('notificaciones').insert({
        titulo:     '💰 Tu crédito ha sido desembolsado',
        mensaje:    `Tu crédito por ${formatCurrency(selectedItem.monto)} fue desembolsado el ${desembolsoFecha}${desembolsoReferencia ? `. Ref: ${desembolsoReferencia}` : ''}${comprobantePath ? '. Puedes ver el comprobante en Mis Créditos.' : ''}.`,
        tipo:       'credito_desembolsado',
        leida:      false,
        para_admin: false,
        asociado_id: selectedItem.asociado_id,
      }).then(() => {}, () => {});

      toast.success('✅ Desembolso registrado correctamente', {
        description: `${selectedItem.asociado} · ${formatCurrency(selectedItem.monto)} · ${desembolsoFecha}`,
      });
      setIsDesembolsoOpen(false);
      setDesembolsoFecha('');
      setDesembolsoReferencia('');
      setDesembolsoArchivo(null);
      await cargarDatos();
    } catch (err: any) {
      toast.error('Error al registrar desembolso: ' + err.message);
    } finally {
      setGuardandoDesembolso(false);
    }
  };

  const handleVerComprobante = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('comprobantes')
        .createSignedUrl(path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast.error('No se pudo abrir el comprobante: ' + err.message);
    }
  };

  const openDesembolsoDialog = (item: any) => {
    setSelectedItem(item);
    setDesembolsoFecha(new Date().toISOString().split('T')[0]);
    setDesembolsoReferencia('');
    setDesembolsoArchivo(null);
    setIsDesembolsoOpen(true);
  };

  return {
    isDesembolsoOpen, setIsDesembolsoOpen,
    desembolsoFecha, setDesembolsoFecha,
    desembolsoReferencia, setDesembolsoReferencia,
    desembolsoArchivo, setDesembolsoArchivo,
    guardandoDesembolso,
    handleRegistrarDesembolso,
    handleVerComprobante,
    openDesembolsoDialog,
  };
}
