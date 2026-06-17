-- =============================================================================
-- UFCA — Migración: Eliminar tablas inactivas y redundantes
--
-- Este script elimina físicamente las tablas que ya no están en uso por el sistema.
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

BEGIN;

-- Eliminar tablas con CASCADE para limpiar también llaves foráneas dependientes
DROP TABLE IF EXISTS public.credito_historial_estados CASCADE;
DROP TABLE IF EXISTS public.distribuciones_utilidades CASCADE;
DROP TABLE IF EXISTS public.referidos CASCADE;

-- Recargar el esquema de PostgREST para notificar los cambios
NOTIFY pgrst, 'reload schema';

COMMIT;
