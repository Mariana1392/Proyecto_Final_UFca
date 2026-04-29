-- ─────────────────────────────────────────────────────────────────────────────
-- Agrega frecuencia_ahorro y monto_objetivo a ahorro_voluntario
-- Ejecutar en Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ahorro_voluntario
  ADD COLUMN IF NOT EXISTS frecuencia_ahorro VARCHAR(20) DEFAULT 'Mensual',
  ADD COLUMN IF NOT EXISTS monto_objetivo    DECIMAL(12,2) DEFAULT NULL;

-- Verificar
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'ahorro_voluntario'
  AND column_name IN ('frecuencia_ahorro', 'monto_objetivo');
