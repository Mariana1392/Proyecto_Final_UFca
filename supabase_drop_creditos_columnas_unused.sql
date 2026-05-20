-- =============================================================================
-- Elimina columnas sin uso de la tabla creditos
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

ALTER TABLE public.creditos
  DROP COLUMN IF EXISTS referido_nombre,
  DROP COLUMN IF EXISTS referido_cedula,
  DROP COLUMN IF EXISTS referido_telefono,
  DROP COLUMN IF EXISTS aprobado_por,
  DROP COLUMN IF EXISTS updated_at;

NOTIFY pgrst, 'reload schema';

-- Verificación: muestra las columnas que quedaron
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'creditos'
ORDER BY ordinal_position;
