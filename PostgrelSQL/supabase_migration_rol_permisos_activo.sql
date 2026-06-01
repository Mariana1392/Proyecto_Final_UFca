-- =============================================================================
-- UFCA — Migración: columna `activo` en rol_permisos
--
-- Objetivo: cambiar de eliminación física a desactivación lógica.
-- Cuando un administrador "quita" un permiso de un rol, en lugar de
-- DELETE ahora se hace UPDATE SET activo = false.
-- El registro queda en la BD como historial y puede reactivarse.
--
-- Ejecutar en Supabase → SQL Editor
-- Seguro de correr múltiples veces (IF NOT EXISTS / IF EXISTS)
-- =============================================================================

-- 1. Agregar la columna `activo` a rol_permisos (si no existe)
ALTER TABLE rol_permisos
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- 2. Asegurar que todos los registros existentes estén activos
UPDATE rol_permisos SET activo = true WHERE activo IS NULL;

-- 3. Verificación — ver cuántos registros hay por estado
SELECT
  activo,
  COUNT(*) AS total
FROM rol_permisos
GROUP BY activo
ORDER BY activo DESC;
