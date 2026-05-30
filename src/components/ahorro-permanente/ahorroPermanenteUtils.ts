// ── ahorroPermanenteUtils.ts ──────────────────────────────────────────────────
// Funciones utilitarias puras (sin estado React) compartidas entre sub-hooks.

import { supabase } from '../../lib/supabase';

/** Devuelve el id del período activo, o null si no existe. */
export async function resolverPeriodoId(): Promise<string | null> {
  const { data } = await supabase
    .from('periodos')
    .select('id')
    .eq('estado', 'activo')
    .order('fecha_inicio', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** Inserta una notificación en la tabla de notificaciones. */
export const notificarAsociado = (
  asociadoId: string,
  titulo: string,
  mensaje: string,
  tipo: string,
) =>
  supabase.from('notificaciones').insert({
    titulo, mensaje, tipo, leida: false, asociado_id: asociadoId,
  });
