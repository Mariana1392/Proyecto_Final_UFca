-- =============================================================================
-- UFCA — Mejoras v2
--
-- Contenido:
--   1. Índices faltantes en llaves foráneas (FK sin índice = table scan en JOINs)
--   2. ON DELETE SET NULL en FKs de referencia no financiera
--      (registrado_por, aprobado_por, cerrado_por, evaluador_id, etc.)
--
-- REGLA aplicada:
--   • Datos financieros / transaccionales → RESTRICT (ya es el default, no se toca)
--   • Campos de trazabilidad / referencia  → SET NULL al borrar usuario
--
-- ✅ Seguro de ejecutar múltiples veces (idempotente).
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================


-- =============================================================================
-- PARTE 1 — ÍNDICES FALTANTES EN FOREIGN KEYS
--
-- Ya existen en la migración principal:
--   idx_ahorro_perm_asociado, idx_ahorro_perm_periodo,
--   idx_ahorro_vol_asociado,  idx_ahorro_vol_periodo,
--   idx_pago_ahorro_perm_asociado, idx_creditos_asociado,
--   idx_creditos_periodo,      idx_cuotas_credito,
--   idx_pagos_credito_credito, idx_comite_evaluador_id,
--   idx_notif_usuario,         idx_solicitudes_estado
--
-- Se agregan solo los que faltaban:
-- =============================================================================

-- ── usuarios ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_usuarios_rol_id
  ON usuarios (rol_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_asociado_id
  ON usuarios (asociado_id);

-- ── asociados ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_asociados_periodo_ingreso_id
  ON asociados (periodo_ingreso_id);

-- ── periodos ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_periodos_cerrado_por
  ON periodos (cerrado_por);

-- ── solicitudes_asociados ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_solicitudes_aprobado_por
  ON solicitudes_asociados (aprobado_por);

CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_id
  ON solicitudes_asociados (usuario_id);

-- ── pagos_ahorro_permanente ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pago_ahorro_perm_ahorro_id
  ON pagos_ahorro_permanente (ahorro_permanente_id);

CREATE INDEX IF NOT EXISTS idx_pago_ahorro_perm_periodo_id
  ON pagos_ahorro_permanente (periodo_id);

CREATE INDEX IF NOT EXISTS idx_pago_ahorro_perm_registrado_por
  ON pagos_ahorro_permanente (registrado_por);

-- ── pagos_ahorro_voluntario ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pago_ahorro_vol_ahorro_id
  ON pagos_ahorro_voluntario (ahorro_voluntario_id);

CREATE INDEX IF NOT EXISTS idx_pago_ahorro_vol_asociado_id
  ON pagos_ahorro_voluntario (asociado_id);

CREATE INDEX IF NOT EXISTS idx_pago_ahorro_vol_registrado_por
  ON pagos_ahorro_voluntario (registrado_por);

-- ── creditos ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_creditos_aprobado_por
  ON creditos (aprobado_por);

-- ── pagos_credito ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pagos_credito_cuota_id
  ON pagos_credito (cuota_id);

CREATE INDEX IF NOT EXISTS idx_pagos_credito_registrado_por
  ON pagos_credito (registrado_por);

-- ── liquidaciones ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_liquidaciones_asociado_id
  ON liquidaciones (asociado_id);

CREATE INDEX IF NOT EXISTS idx_liquidaciones_periodo_id
  ON liquidaciones (periodo_id);

CREATE INDEX IF NOT EXISTS idx_liquidaciones_usuario_id
  ON liquidaciones (usuario_id);

-- ── distribuciones_utilidades ─────────────────────────────────────────────────
-- UNIQUE (periodo_id, asociado_id) ya crea un índice compuesto que cubre ambos
-- No se necesita índice adicional

-- ── excepciones ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_excepciones_asociado_id
  ON excepciones (asociado_id);

CREATE INDEX IF NOT EXISTS idx_excepciones_credito_id
  ON excepciones (credito_id);

CREATE INDEX IF NOT EXISTS idx_excepciones_resuelto_por
  ON excepciones (resuelto_por);

-- ── notificaciones ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notificaciones_asociado_id
  ON notificaciones (asociado_id);

-- ── auditoria ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id
  ON auditoria (usuario_id);

CREATE INDEX IF NOT EXISTS idx_auditoria_asociado_id
  ON auditoria (asociado_id);

CREATE INDEX IF NOT EXISTS idx_auditoria_registro_id
  ON auditoria (registro_id);


-- =============================================================================
-- PARTE 2 — ON DELETE SET NULL EN FKs DE TRAZABILIDAD
--
-- CRITERIO:
--   • Campos financieros (asociado_id, credito_id, ahorro_id) → RESTRICT (default)
--     No se tocan: si se borra un asociado con datos, debe fallar → es correcto.
--
--   • Campos de referencia (registrado_por, aprobado_por, cerrado_por, etc.)
--     → SET NULL: si se elimina el usuario que registró, el registro histórico
--     se conserva pero queda sin referencia al usuario (aceptable para auditoría).
--
-- Técnica: DROP + recrear FK con nuevo comportamiento
--           (ALTER TABLE ... ALTER CONSTRAINT no soporta cambiar ON DELETE)
-- =============================================================================

-- ── periodos.cerrado_por ──────────────────────────────────────────────────────
ALTER TABLE periodos
  DROP CONSTRAINT IF EXISTS fk_periodos_cerrado_por;

ALTER TABLE periodos
  ADD CONSTRAINT fk_periodos_cerrado_por
    FOREIGN KEY (cerrado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- ── solicitudes_asociados.aprobado_por ────────────────────────────────────────
ALTER TABLE solicitudes_asociados
  DROP CONSTRAINT IF EXISTS solicitudes_asociados_aprobado_por_fkey;

ALTER TABLE solicitudes_asociados
  ADD CONSTRAINT fk_solicitudes_aprobado_por
    FOREIGN KEY (aprobado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- ── solicitudes_asociados.usuario_id ─────────────────────────────────────────
ALTER TABLE solicitudes_asociados
  DROP CONSTRAINT IF EXISTS solicitudes_asociados_usuario_id_fkey;

ALTER TABLE solicitudes_asociados
  ADD CONSTRAINT fk_solicitudes_usuario_id
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- ── comite_evaluador.evaluador_id ─────────────────────────────────────────────
ALTER TABLE comite_evaluador
  DROP CONSTRAINT IF EXISTS comite_evaluador_evaluador_id_fkey;

ALTER TABLE comite_evaluador
  ADD CONSTRAINT fk_comite_evaluador_id
    FOREIGN KEY (evaluador_id) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- ── pagos_ahorro_permanente.registrado_por ────────────────────────────────────
ALTER TABLE pagos_ahorro_permanente
  DROP CONSTRAINT IF EXISTS pagos_ahorro_permanente_registrado_por_fkey;

ALTER TABLE pagos_ahorro_permanente
  ADD CONSTRAINT fk_pago_ahorro_perm_registrado_por
    FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- ── pagos_ahorro_voluntario.registrado_por ────────────────────────────────────
ALTER TABLE pagos_ahorro_voluntario
  DROP CONSTRAINT IF EXISTS pagos_ahorro_voluntario_registrado_por_fkey;

ALTER TABLE pagos_ahorro_voluntario
  ADD CONSTRAINT fk_pago_ahorro_vol_registrado_por
    FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- ── creditos.aprobado_por ─────────────────────────────────────────────────────
ALTER TABLE creditos
  DROP CONSTRAINT IF EXISTS creditos_aprobado_por_fkey;

ALTER TABLE creditos
  ADD CONSTRAINT fk_creditos_aprobado_por
    FOREIGN KEY (aprobado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- ── pagos_credito.registrado_por ──────────────────────────────────────────────
ALTER TABLE pagos_credito
  DROP CONSTRAINT IF EXISTS pagos_credito_registrado_por_fkey;

ALTER TABLE pagos_credito
  ADD CONSTRAINT fk_pagos_credito_registrado_por
    FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- ── liquidaciones.usuario_id ──────────────────────────────────────────────────
ALTER TABLE liquidaciones
  DROP CONSTRAINT IF EXISTS liquidaciones_usuario_id_fkey;

ALTER TABLE liquidaciones
  ADD CONSTRAINT fk_liquidaciones_usuario_id
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- ── excepciones.resuelto_por ──────────────────────────────────────────────────
ALTER TABLE excepciones
  DROP CONSTRAINT IF EXISTS excepciones_resuelto_por_fkey;

ALTER TABLE excepciones
  ADD CONSTRAINT fk_excepciones_resuelto_por
    FOREIGN KEY (resuelto_por) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- ── notificaciones.usuario_id ─────────────────────────────────────────────────
-- Aquí SÍ hacemos CASCADE: si el usuario se elimina, sus notificaciones
-- personales no tienen sentido conservarlas.
ALTER TABLE notificaciones
  DROP CONSTRAINT IF EXISTS notificaciones_usuario_id_fkey;

ALTER TABLE notificaciones
  ADD CONSTRAINT fk_notificaciones_usuario_id
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE;

-- ── notificaciones.asociado_id ────────────────────────────────────────────────
ALTER TABLE notificaciones
  DROP CONSTRAINT IF EXISTS notificaciones_asociado_id_fkey;

ALTER TABLE notificaciones
  ADD CONSTRAINT fk_notificaciones_asociado_id
    FOREIGN KEY (asociado_id) REFERENCES asociados(id)
    ON DELETE CASCADE;

-- ── auditoria.usuario_id / asociado_id → SET NULL (registro histórico inmutable)
ALTER TABLE auditoria
  DROP CONSTRAINT IF EXISTS auditoria_usuario_id_fkey;

ALTER TABLE auditoria
  ADD CONSTRAINT fk_auditoria_usuario_id
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE SET NULL;

ALTER TABLE auditoria
  DROP CONSTRAINT IF EXISTS auditoria_asociado_id_fkey;

ALTER TABLE auditoria
  ADD CONSTRAINT fk_auditoria_asociado_id
    FOREIGN KEY (asociado_id) REFERENCES asociados(id)
    ON DELETE SET NULL;


-- =============================================================================
-- VERIFICACIÓN FINAL
-- =============================================================================

-- 1. Total de índices del proyecto
SELECT COUNT(*) AS total_indices
FROM   pg_indexes
WHERE  schemaname = 'public';

-- 2. FKs y su comportamiento ON DELETE
SELECT
  tc.table_name                             AS tabla,
  kcu.column_name                           AS columna_fk,
  rc.delete_rule                            AS on_delete,
  ccu.table_name                            AS referencia_tabla
FROM information_schema.table_constraints   tc
JOIN information_schema.key_column_usage    kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema    = 'public'
ORDER BY tc.table_name, kcu.column_name;
