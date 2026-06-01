-- =============================================================================
-- FIX: creditos_plazo_meses_check viola constraint al guardar crédito
-- Causa: CHECK (plazo_meses BETWEEN 1 AND 12) — solo permitía hasta 12 meses.
-- Solución: ampliar a BETWEEN 1 AND 360 (hasta 30 años).
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

-- 1. Eliminar el constraint restrictivo
ALTER TABLE public.creditos
  DROP CONSTRAINT IF EXISTS creditos_plazo_meses_check;

-- 2. Crear el constraint correcto (hasta 360 meses = 30 años)
ALTER TABLE public.creditos
  ADD CONSTRAINT creditos_plazo_meses_check
  CHECK (plazo_meses BETWEEN 1 AND 360);

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.creditos'::regclass
  AND conname = 'creditos_plazo_meses_check';
