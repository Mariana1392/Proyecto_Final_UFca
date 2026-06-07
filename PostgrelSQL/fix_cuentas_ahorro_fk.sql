-- ============================================================
-- FIX: cuentas_ahorro.asociado_id → ON DELETE SET NULL
-- Problema: FK bloquea borrar usuarios porque cuentas_ahorro
--           tiene registros apuntando a ese usuario/asociado
-- ============================================================

-- Opción A: si la FK apunta a usuarios(id)
ALTER TABLE cuentas_ahorro
  DROP CONSTRAINT IF EXISTS cuentas_ahorro_asociado_id_fkey;

ALTER TABLE cuentas_ahorro
  ALTER COLUMN asociado_id DROP NOT NULL;

ALTER TABLE cuentas_ahorro
  ADD CONSTRAINT cuentas_ahorro_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- Recargar schema de PostgREST
NOTIFY pgrst, 'reload schema';
