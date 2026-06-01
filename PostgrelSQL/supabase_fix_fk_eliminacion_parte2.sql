-- ============================================================
-- MIGRACIÓN PARTE 2: FK faltantes para eliminación de asociados
-- Ejecutar en Supabase → SQL Editor → Run
-- ============================================================

-- 1. LIQUIDACIONES (añadida por supabase_liquidaciones_upgrade.sql)
--    Ya es nullable, solo cambia el ON DELETE
ALTER TABLE liquidaciones DROP CONSTRAINT IF EXISTS liquidaciones_asociado_id_fkey;
ALTER TABLE liquidaciones ADD CONSTRAINT liquidaciones_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- 2. PAGOS_CREDITO (sin ON DELETE explícito = RESTRICT por defecto)
ALTER TABLE pagos_credito ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE pagos_credito DROP CONSTRAINT IF EXISTS pagos_credito_asociado_id_fkey;
ALTER TABLE pagos_credito ADD CONSTRAINT pagos_credito_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;
