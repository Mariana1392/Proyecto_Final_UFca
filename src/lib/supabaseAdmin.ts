import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = import.meta.env.VITE_SUPABASE_URL as string;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string;

/**
 * Cliente Supabase con rol de servicio.
 * Usar SOLO en operaciones administrativas del lado del cliente de confianza
 * (p. ej. crear cuentas de Auth, invitar usuarios).
 * NUNCA exponer este cliente a código que pueda ser ejecutado por usuarios no autenticados.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession:   false,
  },
});
