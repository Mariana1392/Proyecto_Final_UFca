-- ============================================================
-- MIGRACIÓN: Permitir eliminación de asociados inactivos
-- Cambia FK con ON DELETE RESTRICT → ON DELETE SET NULL
-- y hace nullable el asociado_id en tablas históricas.
--
-- INSTRUCCIONES: Pegar en Supabase → SQL Editor → Run
-- ============================================================

-- 1. PEDIDOS
ALTER TABLE pedidos ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_asociado_id_fkey;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- 2. CRÉDITOS
ALTER TABLE creditos ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE creditos DROP CONSTRAINT IF EXISTS creditos_asociado_id_fkey;
ALTER TABLE creditos ADD CONSTRAINT creditos_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- 3. PAGOS_PREMIOS
ALTER TABLE pagos_premios ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE pagos_premios DROP CONSTRAINT IF EXISTS pagos_premios_asociado_id_fkey;
ALTER TABLE pagos_premios ADD CONSTRAINT pagos_premios_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- 4. EXCEPCIONES
ALTER TABLE excepciones ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE excepciones DROP CONSTRAINT IF EXISTS excepciones_asociado_id_fkey;
ALTER TABLE excepciones ADD CONSTRAINT excepciones_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- 5. SOLICITUDES_CREDITO (también tiene RESTRICT implícito)
ALTER TABLE solicitudes_credito ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE solicitudes_credito DROP CONSTRAINT IF EXISTS solicitudes_credito_asociado_id_fkey;
ALTER TABLE solicitudes_credito ADD CONSTRAINT solicitudes_credito_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;
