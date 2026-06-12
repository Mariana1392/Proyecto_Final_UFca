-- Script mejorado para eliminar cualquier restricción de unicidad
-- Cópialo y pégalo en el SQL Editor de tu panel de Supabase y dale a "Run"

-- 1. Intentar borrar si tiene el nombre personalizado
ALTER TABLE cuentas_ahorro DROP CONSTRAINT IF EXISTS uq_cuentas_ahorro_asociado_permanente;

-- 2. Intentar borrar si tiene el nombre automático de PostgreSQL
ALTER TABLE cuentas_ahorro DROP CONSTRAINT IF EXISTS cuentas_ahorro_asociado_id_tipo_key;

-- 3. Intentar borrar índices únicos en caso de que se haya creado como índice y no como constraint
DROP INDEX IF EXISTS uq_cuentas_ahorro_asociado_permanente;
DROP INDEX IF EXISTS cuentas_ahorro_asociado_id_tipo_key;

-- Fin del script
