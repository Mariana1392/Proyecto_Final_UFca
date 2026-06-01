-- =============================================================================
-- Agrega columna monto_ahorro_propuesto a solicitudes_asociados
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

ALTER TABLE public.solicitudes_asociados
  ADD COLUMN IF NOT EXISTS monto_ahorro_propuesto NUMERIC DEFAULT NULL;

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'solicitudes_asociados'
  AND column_name  = 'monto_ahorro_propuesto';
