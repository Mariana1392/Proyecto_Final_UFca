-- =============================================================================
-- FIX: Correcciones al esquema detectadas en revision
--
-- Problema 1: comite_evaluador.verificaciones default incluye 'antecedentes'
--             pero la UI ya no lo maneja (se elimino del checklist).
--
-- Problema 2: notificaciones.tipo CHECK constraint no incluye
--             'solicitud_afiliacion', pero Hero.tsx y MiSolicitud.tsx
--             insertan notificaciones con ese tipo y falla con CHECK violation.
--
-- Ejecutar en: Supabase SQL Editor
-- =============================================================================


-- -----------------------------------------------------------------------------
-- FIX 1: Actualizar default de verificaciones en comite_evaluador
--         Quita 'antecedentes' del JSONB por defecto (3 checks: no 4)
-- -----------------------------------------------------------------------------
ALTER TABLE comite_evaluador
  ALTER COLUMN verificaciones
  SET DEFAULT '{"ingresos": false, "referencias": false, "documentacion": false}'::jsonb;

-- Actualizar filas existentes que tengan el campo antecedentes en su JSONB
-- (solo las que esten en estado 'en_evaluacion' o 'pendiente', no las ya cerradas)
UPDATE comite_evaluador
SET verificaciones = verificaciones - 'antecedentes'
WHERE verificaciones ? 'antecedentes';


-- -----------------------------------------------------------------------------
-- FIX 2: Agregar 'solicitud_afiliacion' al CHECK de notificaciones.tipo
-- -----------------------------------------------------------------------------
ALTER TABLE notificaciones
  DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;

ALTER TABLE notificaciones
  ADD CONSTRAINT notificaciones_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'credito_pendiente',
    'credito_activo',
    'credito_rechazado',
    'ahorro_mora',
    'simulacion_credito',
    'afiliacion_aprobada',
    'afiliacion_rechazada',
    'pago_registrado',
    'sistema',
    'general',
    'solicitud_afiliacion'
  ]::text[]));


-- Verificacion
SELECT
  conname   AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'notificaciones'::regclass
  AND contype = 'c';
