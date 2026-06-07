-- ============================================================
-- FIX DEFINITIVO — basado en las FK reales de la BD
-- Cambia todas las FK con NO ACTION → SET NULL en usuarios(id)
-- ============================================================

BEGIN;

-- ── creditos ─────────────────────────────────────────────────
ALTER TABLE creditos DROP CONSTRAINT IF EXISTS creditos_asociado_id_fkey;
ALTER TABLE creditos ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE creditos ADD CONSTRAINT creditos_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE creditos DROP CONSTRAINT IF EXISTS creditos_anulado_por_fkey;
ALTER TABLE creditos ADD CONSTRAINT creditos_anulado_por_fkey
  FOREIGN KEY (anulado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── cuentas_ahorro ───────────────────────────────────────────
ALTER TABLE cuentas_ahorro DROP CONSTRAINT IF EXISTS cuentas_ahorro_anulado_por_fkey;
ALTER TABLE cuentas_ahorro ADD CONSTRAINT cuentas_ahorro_anulado_por_fkey
  FOREIGN KEY (anulado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── distribuciones_utilidades ────────────────────────────────
ALTER TABLE distribuciones_utilidades DROP CONSTRAINT IF EXISTS distribuciones_utilidades_asociado_id_fkey;
ALTER TABLE distribuciones_utilidades ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE distribuciones_utilidades ADD CONSTRAINT distribuciones_utilidades_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── excepciones ──────────────────────────────────────────────
ALTER TABLE excepciones DROP CONSTRAINT IF EXISTS excepciones_asociado_id_fkey;
ALTER TABLE excepciones ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE excepciones ADD CONSTRAINT excepciones_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── liquidaciones ────────────────────────────────────────────
ALTER TABLE liquidaciones DROP CONSTRAINT IF EXISTS liquidaciones_asociado_id_fkey;
ALTER TABLE liquidaciones ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE liquidaciones ADD CONSTRAINT liquidaciones_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── notificaciones ───────────────────────────────────────────
ALTER TABLE notificaciones DROP CONSTRAINT IF EXISTS fk_notificaciones_asociado_id;
ALTER TABLE notificaciones ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE notificaciones ADD CONSTRAINT fk_notificaciones_asociado_id
  FOREIGN KEY (asociado_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── referidos ────────────────────────────────────────────────
ALTER TABLE referidos DROP CONSTRAINT IF EXISTS referidos_asociado_id_fkey;
ALTER TABLE referidos ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE referidos ADD CONSTRAINT referidos_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE referidos DROP CONSTRAINT IF EXISTS referidos_asociado_convertido_id_fkey;
ALTER TABLE referidos ALTER COLUMN asociado_convertido_id DROP NOT NULL;
ALTER TABLE referidos ADD CONSTRAINT referidos_asociado_convertido_id_fkey
  FOREIGN KEY (asociado_convertido_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── solicitudes_asociados ────────────────────────────────────
ALTER TABLE solicitudes_asociados DROP CONSTRAINT IF EXISTS solicitudes_asociados_aprobado_por_fkey;
ALTER TABLE solicitudes_asociados ADD CONSTRAINT solicitudes_asociados_aprobado_por_fkey
  FOREIGN KEY (aprobado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── transacciones ────────────────────────────────────────────
ALTER TABLE transacciones DROP CONSTRAINT IF EXISTS transacciones_asociado_id_fkey;
ALTER TABLE transacciones ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE transacciones ADD CONSTRAINT transacciones_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE transacciones DROP CONSTRAINT IF EXISTS transacciones_anulado_por_fkey;
ALTER TABLE transacciones ADD CONSTRAINT transacciones_anulado_por_fkey
  FOREIGN KEY (anulado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE transacciones DROP CONSTRAINT IF EXISTS transacciones_registrado_por_fkey;
ALTER TABLE transacciones ADD CONSTRAINT transacciones_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── usuarios (auto-referencia) ───────────────────────────────
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_referido_por_id_fkey;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_referido_por_id_fkey
  FOREIGN KEY (referido_por_id) REFERENCES usuarios(id) ON DELETE SET NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
