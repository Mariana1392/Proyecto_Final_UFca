-- ============================================================
-- UFCA - Agregar columnas telefono y direccion a tabla usuarios
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS telefono  VARCHAR(30)  DEFAULT '',
  ADD COLUMN IF NOT EXISTS direccion VARCHAR(200) DEFAULT '';

-- Verificar
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'usuarios' AND column_name IN ('telefono','direccion');
