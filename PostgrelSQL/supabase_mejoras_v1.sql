-- =============================================================================
-- UFCA — Mejoras v1
--
-- Contenido:
--   1. Constraint de fecha coherente en periodos
--   2. Función + triggers para auto-actualizar updated_at en todas las tablas
--
-- ✅ Seguro de ejecutar múltiples veces (idempotente).
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================


-- =============================================================================
-- MEJORA 1 — Constraint de fecha coherente en periodos
--
-- Ya existe: periodo_fechas_validas → CHECK (fecha_fin > fecha_inicio)
-- Nueva:     chk_periodo_cierre    → fecha_cierre no puede ser anterior al inicio
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE periodos
    ADD CONSTRAINT chk_periodo_cierre
      CHECK (
        fecha_cierre IS NULL
        OR fecha_cierre >= fecha_inicio::timestamptz
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- MEJORA 2 — Trigger automático para updated_at
--
-- La función fn_set_updated_at() se reutiliza en todas las tablas.
-- CREATE OR REPLACE TRIGGER requiere PostgreSQL ≥ 14 (Supabase usa ≥ 15).
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── roles ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_roles
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── permisos ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_permisos
  BEFORE UPDATE ON permisos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── usuarios ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_usuarios
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── configuracion ─────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_configuracion
  BEFORE UPDATE ON configuracion
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── periodos ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_periodos
  BEFORE UPDATE ON periodos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── asociados ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_asociados
  BEFORE UPDATE ON asociados
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── solicitudes_asociados ─────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_solicitudes_asociados
  BEFORE UPDATE ON solicitudes_asociados
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── comite_evaluador ──────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_comite_evaluador
  BEFORE UPDATE ON comite_evaluador
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── ahorros_permanentes ───────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_ahorros_permanentes
  BEFORE UPDATE ON ahorros_permanentes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── pagos_ahorro_permanente ───────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_pagos_ahorro_permanente
  BEFORE UPDATE ON pagos_ahorro_permanente
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── ahorros_voluntarios ───────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_ahorros_voluntarios
  BEFORE UPDATE ON ahorros_voluntarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── pagos_ahorro_voluntario ───────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_pagos_ahorro_voluntario
  BEFORE UPDATE ON pagos_ahorro_voluntario
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── creditos ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_creditos
  BEFORE UPDATE ON creditos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── cuotas_credito ────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_cuotas_credito
  BEFORE UPDATE ON cuotas_credito
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── pagos_credito ─────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_pagos_credito
  BEFORE UPDATE ON pagos_credito
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── liquidaciones ─────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_liquidaciones
  BEFORE UPDATE ON liquidaciones
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── excepciones ───────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_excepciones
  BEFORE UPDATE ON excepciones
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── notificaciones ────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_updated_at_notificaciones
  BEFORE UPDATE ON notificaciones
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- =============================================================================
-- VERIFICACIÓN: muestra todos los triggers creados
-- Debe listar 18 triggers trg_updated_at_*
-- =============================================================================

SELECT
  trigger_name,
  event_object_table AS tabla,
  event_manipulation AS evento,
  action_timing      AS momento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_updated_at_%'
ORDER BY event_object_table;
