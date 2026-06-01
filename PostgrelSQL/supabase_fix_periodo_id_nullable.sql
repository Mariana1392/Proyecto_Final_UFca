-- =============================================================================
-- FIX: null value in column "periodo_id" of relation "pagos_ahorro_permanente"
--      violates not-null constraint
-- Causa: la columna periodo_id tiene NOT NULL pero el módulo de Ahorro
--        Permanente no requiere un período activo — es un campo opcional
--        de trazabilidad que puede ser NULL cuando no aplica.
-- Ejecutar en Supabase → SQL Editor → Run  (es idempotente)
-- =============================================================================

-- Permitir NULL en periodo_id (misma lógica que en pagos_ahorro_voluntario)
ALTER TABLE pagos_ahorro_permanente
  ALTER COLUMN periodo_id DROP NOT NULL;

-- Verificación
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'pagos_ahorro_permanente'
  AND column_name = 'periodo_id';
-- Debe devolver: periodo_id | YES
