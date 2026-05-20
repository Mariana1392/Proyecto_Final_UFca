-- =============================================================================
-- FIX: null value in column "periodo_id" of relation "creditos"
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

ALTER TABLE public.creditos
  ALTER COLUMN periodo_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'creditos'
  AND column_name  = 'periodo_id';
