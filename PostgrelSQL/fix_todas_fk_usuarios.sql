-- ============================================================
-- FIX DEFINITIVO: todas las FK que apuntan a usuarios(id)
-- y a asociados(id) → ON DELETE SET NULL
-- Así se pueden borrar usuarios sin errores de FK
-- ============================================================

-- ── TABLA: transacciones ─────────────────────────────────────
ALTER TABLE transacciones
  DROP CONSTRAINT IF EXISTS transacciones_asociado_id_fkey;
ALTER TABLE transacciones
  ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE transacciones
  ADD CONSTRAINT transacciones_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── TABLA: cuentas_ahorro ────────────────────────────────────
ALTER TABLE cuentas_ahorro
  DROP CONSTRAINT IF EXISTS cuentas_ahorro_asociado_id_fkey;
ALTER TABLE cuentas_ahorro
  ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE cuentas_ahorro
  ADD CONSTRAINT cuentas_ahorro_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── TABLA: creditos ──────────────────────────────────────────
ALTER TABLE creditos
  DROP CONSTRAINT IF EXISTS creditos_asociado_id_fkey;
ALTER TABLE creditos
  ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE creditos
  ADD CONSTRAINT creditos_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

ALTER TABLE creditos
  DROP CONSTRAINT IF EXISTS creditos_aprobado_por_fkey;
ALTER TABLE creditos
  ADD CONSTRAINT creditos_aprobado_por_fkey
  FOREIGN KEY (aprobado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── TABLA: pagos_credito ─────────────────────────────────────
ALTER TABLE pagos_credito
  DROP CONSTRAINT IF EXISTS pagos_credito_asociado_id_fkey;
ALTER TABLE pagos_credito
  ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE pagos_credito
  ADD CONSTRAINT pagos_credito_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- ── TABLA: liquidaciones ─────────────────────────────────────
ALTER TABLE liquidaciones
  DROP CONSTRAINT IF EXISTS liquidaciones_asociado_id_fkey;
ALTER TABLE liquidaciones
  ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE liquidaciones
  ADD CONSTRAINT liquidaciones_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

ALTER TABLE liquidaciones
  DROP CONSTRAINT IF EXISTS liquidaciones_procesado_por_fkey;
ALTER TABLE liquidaciones
  ADD CONSTRAINT liquidaciones_procesado_por_fkey
  FOREIGN KEY (procesado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE liquidaciones
  DROP CONSTRAINT IF EXISTS liquidaciones_usuario_id_fkey;
ALTER TABLE liquidaciones
  ADD CONSTRAINT liquidaciones_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── TABLA: solicitudes_asociados ─────────────────────────────
ALTER TABLE solicitudes_asociados
  DROP CONSTRAINT IF EXISTS solicitudes_asociados_aprobado_por_fkey;
ALTER TABLE solicitudes_asociados
  ADD CONSTRAINT solicitudes_asociados_aprobado_por_fkey
  FOREIGN KEY (aprobado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── TABLA: comite_evaluador ──────────────────────────────────
ALTER TABLE comite_evaluador
  DROP CONSTRAINT IF EXISTS comite_evaluador_evaluador_id_fkey;
ALTER TABLE comite_evaluador
  ADD CONSTRAINT comite_evaluador_evaluador_id_fkey
  FOREIGN KEY (evaluador_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── TABLA: ahorros_permanentes ───────────────────────────────
ALTER TABLE ahorros_permanentes
  DROP CONSTRAINT IF EXISTS ahorros_permanentes_asociado_id_fkey;
ALTER TABLE ahorros_permanentes
  ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE ahorros_permanentes
  ADD CONSTRAINT ahorros_permanentes_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- ── TABLA: pagos_ahorro_permanente ───────────────────────────
ALTER TABLE pagos_ahorro_permanente
  DROP CONSTRAINT IF EXISTS pagos_ahorro_permanente_asociado_id_fkey;
ALTER TABLE pagos_ahorro_permanente
  ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE pagos_ahorro_permanente
  ADD CONSTRAINT pagos_ahorro_permanente_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- ── TABLA: notificaciones ────────────────────────────────────
ALTER TABLE notificaciones
  DROP CONSTRAINT IF EXISTS notificaciones_usuario_id_fkey;
ALTER TABLE notificaciones
  ADD CONSTRAINT notificaciones_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── TABLA: excepciones ───────────────────────────────────────
ALTER TABLE excepciones
  DROP CONSTRAINT IF EXISTS excepciones_asociado_id_fkey;
ALTER TABLE excepciones
  ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE excepciones
  ADD CONSTRAINT excepciones_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

ALTER TABLE excepciones
  DROP CONSTRAINT IF EXISTS excepciones_resuelto_por_fkey;
ALTER TABLE excepciones
  ADD CONSTRAINT excepciones_resuelto_por_fkey
  FOREIGN KEY (resuelto_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── TABLA: auditoria (ya aplicado antes, pero por si acaso) ──
ALTER TABLE auditoria
  DROP CONSTRAINT IF EXISTS fk_auditoria_usuario_id;
ALTER TABLE auditoria
  DROP CONSTRAINT IF EXISTS auditoria_usuario_id_fkey;
ALTER TABLE auditoria
  DROP CONSTRAINT IF EXISTS fk_auditoria_asociado_id;
ALTER TABLE auditoria
  DROP CONSTRAINT IF EXISTS auditoria_asociado_id_fkey;

-- Recargar schema
NOTIFY pgrst, 'reload schema';
