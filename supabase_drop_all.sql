-- =============================================================================
-- UFCA — Borrar TODAS las tablas del proyecto
--
-- ⚠ ADVERTENCIA: Este script elimina TODOS los datos permanentemente.
-- Ejecutar SOLO cuando se quiera empezar desde cero.
--
-- Pasos:
--   1. Ejecutar este archivo en Supabase → SQL Editor
--   2. Luego ejecutar supabase_migration_completa_ufca.sql
-- =============================================================================

-- Desactivar verificación de FKs temporalmente para poder borrar en cualquier orden
SET session_replication_role = 'replica';

-- =============================================================================
-- TABLAS HIJAS (más dependientes primero)
-- =============================================================================

DROP TABLE IF EXISTS comite_evaluador          CASCADE;
DROP TABLE IF EXISTS distribuciones_utilidades CASCADE;
DROP TABLE IF EXISTS pagos_credito             CASCADE;
DROP TABLE IF EXISTS cuotas_credito            CASCADE;
DROP TABLE IF EXISTS creditos                  CASCADE;
DROP TABLE IF EXISTS pagos_ahorro_voluntario   CASCADE;
DROP TABLE IF EXISTS ahorros_voluntarios       CASCADE;
DROP TABLE IF EXISTS pagos_ahorro_permanente   CASCADE;
DROP TABLE IF EXISTS ahorros_permanentes       CASCADE;
DROP TABLE IF EXISTS liquidaciones             CASCADE;
DROP TABLE IF EXISTS excepciones               CASCADE;
DROP TABLE IF EXISTS solicitudes_asociados     CASCADE;
DROP TABLE IF EXISTS notificaciones            CASCADE;
DROP TABLE IF EXISTS auditoria                 CASCADE;
DROP TABLE IF EXISTS distribuciones_utilidades CASCADE;

-- =============================================================================
-- TABLAS PRINCIPALES
-- =============================================================================

DROP TABLE IF EXISTS usuarios                  CASCADE;
DROP TABLE IF EXISTS asociados                 CASCADE;
DROP TABLE IF EXISTS periodos                  CASCADE;

-- =============================================================================
-- TABLAS DE ACCESO Y PERMISOS
-- =============================================================================

DROP TABLE IF EXISTS rol_permisos              CASCADE;
DROP TABLE IF EXISTS permisos                  CASCADE;
DROP TABLE IF EXISTS roles                     CASCADE;

-- =============================================================================
-- CONFIGURACIÓN
-- =============================================================================

DROP TABLE IF EXISTS configuracion             CASCADE;

-- =============================================================================
-- TABLAS LEGACY (por si existían con nombres anteriores)
-- =============================================================================

DROP TABLE IF EXISTS ahorros                   CASCADE;
DROP TABLE IF EXISTS pagos                     CASCADE;
DROP TABLE IF EXISTS usuarios_roles            CASCADE;
DROP TABLE IF EXISTS role_permissions          CASCADE;

-- Reactivar verificación de FKs
SET session_replication_role = 'origin';

-- =============================================================================
-- VERIFICACIÓN: debe devolver 0 filas si todo se borró correctamente
-- =============================================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type   = 'BASE TABLE'
ORDER BY table_name;
