-- ============================================================
-- Fix: columna estado en ahorro_permanente tiene DEFAULT 'activo'
-- (texto) pero el tipo es boolean. Corregir el default.
-- ============================================================

-- Corregir default de estado
ALTER TABLE ahorro_permanente
  ALTER COLUMN estado SET DEFAULT true;

-- Corregir default de anulado
ALTER TABLE ahorro_permanente
  ALTER COLUMN anulado SET DEFAULT false;

-- Verificar
SELECT column_name, column_default, data_type
FROM information_schema.columns
WHERE table_name = 'ahorro_permanente'
  AND column_name IN ('estado', 'anulado');
