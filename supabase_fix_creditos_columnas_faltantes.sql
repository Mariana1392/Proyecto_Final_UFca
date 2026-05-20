-- =============================================================================
-- FIX: columnas faltantes en tabla creditos
-- Error: "Could not find the 'observaciones' column of 'creditos'"
-- Causa: el upgrade anterior agregó descripcion_soporte pero el código
--        usa observaciones y url_comprobante_solicitud.
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

ALTER TABLE public.creditos
  ADD COLUMN IF NOT EXISTS observaciones              TEXT,
  ADD COLUMN IF NOT EXISTS url_comprobante_solicitud  TEXT;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'creditos'
  AND column_name  IN ('observaciones', 'url_comprobante_solicitud')
ORDER BY column_name;
