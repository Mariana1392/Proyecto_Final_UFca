// useRealtimeSubscription.ts
// Hook reutilizable para suscribirse a cambios en tablas de Supabase en tiempo real.
// Usa un ref para el callback, por lo que siempre ejecuta la versión más reciente
// sin necesidad de reiniciar el canal cuando el componente re-renderiza.

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * @param channelName  Nombre único del canal (debe ser único en toda la app)
 * @param tables       Tablas a escuchar (INSERT, UPDATE, DELETE)
 * @param callback     Función a llamar cuando hay cambios (normalmente cargarDatos)
 * @param debounceMs   Tiempo de espera para agrupar eventos rápidos (default 600ms)
 */
export function useRealtimeSubscription(
  channelName: string,
  tables: string[],
  callback: () => void,
  debounceMs = 600,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fire = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current(), debounceMs);
    };

    let channel = supabase.channel(channelName);
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        fire,
      );
    }
    channel.subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
