import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

export interface AuditoriaEntry {
  id: string;
  registroId: string;
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
  asociadoNombre: string;
  asociadoCedula: string;
  tipo: 'estado' | 'edicion' | 'eliminacion' | 'creacion';
}

export function useAuditoria(asociadosRef: React.MutableRefObject<any[]>) {
  const [auditoriaGlobal, setAuditoriaGlobal]     = useState<AuditoriaEntry[]>([]);
  const [auditoriaAsociado, setAuditoriaAsociado] = useState<AuditoriaEntry[]>([]);
  const [loadingAuditoria, setLoadingAuditoria]   = useState(false);

  function mapearFila(r: any, snap?: any[]): AuditoriaEntry {
    let detalleStr = '—';
    let usuario    = 'Sistema';
    const dd = r.datos_despues ?? r.detalle;
    if (dd && typeof dd === 'object') {
      detalleStr = dd.descripcion || '—';
      usuario    = dd.admin || 'Sistema';
    } else if (typeof dd === 'string') {
      detalleStr = dd;
      const match = dd.match(/Por:\s*([^|]+)/);
      usuario = match ? match[1].trim() : 'Sistema';
    }
    const asociadoLocal = (snap || []).find((a: any) => a.id === r.registro_id);
    return {
      id:             r.id,
      registroId:     r.registro_id,
      fecha:          new Date(r.created_at).toLocaleString('es-CO'),
      accion:         r.accion,
      detalle:        detalleStr,
      usuario,
      asociadoNombre: asociadoLocal?.nombre || '(eliminado)',
      asociadoCedula: asociadoLocal?.cedula || '—',
      tipo:           (r.accion ?? '').toLowerCase().includes('estado')  ? 'estado'
                    : (r.accion ?? '').toLowerCase().includes('edic')   ? 'edicion'
                    : (r.accion ?? '').toLowerCase().includes('elim')   ? 'eliminacion'
                    : 'creacion',
    };
  }

  async function registrarAuditoria(
    asociadoId: string,
    accion: string,
    descripcion: string,
    adminNombre: string,
    adminId?: string | null,
  ) {
    const { error } = await supabase.from('auditoria').insert({
      tabla:         'usuarios',
      registro_id:   asociadoId,
      usuario_id:    adminId ?? null,
      accion,
      datos_despues: { descripcion, admin: adminNombre, fecha: new Date().toISOString() },
    });
    if (error) toast.error('Error al guardar auditoría: ' + error.message);
  }

  async function cargarAuditoriaAsociado(id: string) {
    setLoadingAuditoria(true);
    try {
      const { data, error } = await supabase
        .from('auditoria')
        .select('id, registro_id, accion, datos_despues, created_at')
        .eq('tabla', 'usuarios')
        .eq('registro_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAuditoriaAsociado((data || []).map(r => mapearFila(r)));
    } catch (err: any) {
      toast.error('Error al cargar historial: ' + err.message);
      setAuditoriaAsociado([]);
    } finally {
      setLoadingAuditoria(false);
    }
  }

  async function cargarAuditoriaGlobal(snap?: any[]) {
    try {
      const { data, error } = await supabase
        .from('auditoria')
        .select('id, registro_id, accion, datos_despues, created_at')
        .eq('tabla', 'usuarios')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const source = snap ?? asociadosRef.current;
      setAuditoriaGlobal((data || []).map(r => mapearFila(r, source)));
    } catch (err: any) {
      toast.error('Error al cargar auditoría: ' + err.message);
    }
  }

  const clearAuditoriaAsociado = () => setAuditoriaAsociado([]);

  return {
    auditoriaGlobal,
    auditoriaAsociado,
    loadingAuditoria,
    registrarAuditoria,
    cargarAuditoriaAsociado,
    cargarAuditoriaGlobal,
    clearAuditoriaAsociado,
  };
}
