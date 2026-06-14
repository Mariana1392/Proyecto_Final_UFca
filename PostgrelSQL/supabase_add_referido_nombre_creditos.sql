-- =============================================================================
-- UFCA — Agregar campo referido_nombre a la tabla creditos
-- El referido es una persona externa que NO tiene usuario en el sistema.
-- La deuda siempre es del asociado. El nombre del referido es solo informativo.
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

ALTER TABLE public.creditos
  ADD COLUMN IF NOT EXISTS referido_nombre TEXT DEFAULT NULL;

COMMENT ON COLUMN public.creditos.referido_nombre IS
  'Nombre del referido (persona externa sin usuario). Solo informativo. La deuda es del asociado.';

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'creditos'
  AND column_name = 'referido_nombre';
