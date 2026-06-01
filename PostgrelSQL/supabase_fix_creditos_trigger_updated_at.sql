-- =============================================================================
-- FIX: record "new" has no field "updated_at" al confirmar simulación
-- Causa: trigger trg_updated_at_creditos / trg_creditos_updated_at sigue
--        activo pero la columna updated_at fue eliminada de la tabla creditos.
-- Solución: eliminar los triggers huérfanos sobre creditos.
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

-- Eliminar triggers que referencian updated_at en creditos (ambos posibles nombres)
DROP TRIGGER IF EXISTS trg_updated_at_creditos    ON public.creditos;
DROP TRIGGER IF EXISTS trg_creditos_updated_at    ON public.creditos;

-- Recargar caché
NOTIFY pgrst, 'reload schema';

-- Verificación: no debe aparecer ningún trigger de updated_at sobre creditos
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'creditos'
ORDER BY trigger_name;
