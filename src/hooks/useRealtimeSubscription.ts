// useRealtimeSubscription.ts
// Hook reutilizable para suscribirse a cambios en tablas de Supabase en tiempo real.
// Usa un ref para el callback, por lo que siempre ejecuta la versión más reciente
// sin necesidad de reiniciar el canal cuando el componente re-renderiza.
//
// Mejora I: expone `isConnected` para que el componente muestre un indicador de
// reconexión, y recarga datos automáticamente cuando el WebSocket se recupera.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * @param channelName  Nombre único del canal (debe ser único en toda la app)
 * @param tables       Tablas a escuchar (INSERT, UPDATE, DELETE)
 * @param callback     Función a llamar cuando hay cambios (normalmente cargarDatos)
 * @param debounceMs   Tiempo de espera para agrupar eventos rápidos (default 600ms)
 * @returns            { isConnected } — true si el WebSocket está activo
 */
export function useRealtimeSubscription(
  channelName: string,
  tables: string[],
  callback: () => void,
  debounceMs = 600,
): { isConnected: boolean } {
  const callbackRef       = useRef(callback);
  callbackRef.current     = callback;

  const timerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDisconnected   = useRef(false);       // bandera para detectar reconexión
  const [isConnected, setIsConnected] = useState(true);

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

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        // Si estábamos desconectados, recargar datos al reconectar
        if (wasDisconnected.current) {
          wasDisconnected.current = false;
          fire();
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setIsConnected(false);
        wasDisconnected.current = true;
      }
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isConnected };
}
