-- =============================================================================
-- FIX: column "operacion" of relation "auditoria" does not exist
-- Causa: la tabla auditoria se creó con columnas (accion, detalle) pero el
--        trigger registrar_auditoria_automatica usa (operacion, datos_antes,
--        datos_despues). Hay que agregar las columnas que faltan y hacer
--        accion nullable para que el trigger también pueda insertar sin ella.
-- Ejecutar en Supabase → SQL Editor → Run  (idempotente)
-- =============================================================================

-- 1. Agregar columnas que usa el trigger automático
ALTER TABLE auditoria
  ADD COLUMN IF NOT EXISTS operacion    VARCHAR(20),   -- TG_OP: INSERT / UPDATE / DELETE
  ADD COLUMN IF NOT EXISTS datos_antes  JSONB,         -- row_to_json(OLD)
  ADD COLUMN IF NOT EXISTS datos_despues JSONB;         -- row_to_json(NEW)

-- 2. Hacer accion nullable (el trigger no la rellena; los inserts manuales sí)
ALTER TABLE auditoria
  ALTER COLUMN accion DROP NOT NULL;

-- 3. Índice útil para filtrar por operación
CREATE INDEX IF NOT EXISTS idx_auditoria_operacion ON auditoria (operacion);

-- Verificación: deben aparecer las 3 columnas nuevas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'auditoria'
  AND column_name IN ('accion','operacion','datos_antes','datos_despues')
ORDER BY column_name;
