-- ============================================================
-- UFCA — Pre-solicitudes de crédito enviadas por asociados
-- Ejecutar en: Supabase → SQL Editor → Run
-- ============================================================

-- ── 1. Crear tabla ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credito_solicitudes (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id   UUID           NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  tipo_credito  VARCHAR(50)    NOT NULL DEFAULT 'libre_inversion'
                               CHECK (tipo_credito IN ('libre_inversion','educacion','vivienda','calamidad')),
  monto         NUMERIC(14,2)  NOT NULL CHECK (monto > 0),
  plazo_meses   INTEGER        NOT NULL CHECK (plazo_meses > 0),
  tasa_interes  NUMERIC(6,2)   NOT NULL DEFAULT 0,
  destino       TEXT           NOT NULL,
  observaciones TEXT,
  estado        VARCHAR(20)    NOT NULL DEFAULT 'pendiente'
                               CHECK (estado IN ('pendiente','aprobada','rechazada')),
  nota_admin    TEXT,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ    DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    DEFAULT NOW()
);

-- ── 2. Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cred_sol_asociado ON credito_solicitudes(asociado_id);
CREATE INDEX IF NOT EXISTS idx_cred_sol_estado   ON credito_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_cred_sol_created  ON credito_solicitudes(created_at DESC);

-- ── 3. Trigger updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_credito_solicitudes_updated_at
  BEFORE UPDATE ON credito_solicitudes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE credito_solicitudes ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
DROP POLICY IF EXISTS "cred_sol_admin_all" ON credito_solicitudes;
CREATE POLICY "cred_sol_admin_all" ON credito_solicitudes
  FOR ALL TO authenticated
  USING    (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Asociado: puede insertar y ver sus propias solicitudes
DROP POLICY IF EXISTS "cred_sol_asociado_select" ON credito_solicitudes;
CREATE POLICY "cred_sol_asociado_select" ON credito_solicitudes
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

DROP POLICY IF EXISTS "cred_sol_asociado_insert" ON credito_solicitudes;
CREATE POLICY "cred_sol_asociado_insert" ON credito_solicitudes
  FOR INSERT TO authenticated
  WITH CHECK (asociado_id = get_asociado_id());

-- ── 5. Notificaciones (si no existe la tabla) ─────────────────────────────────
-- La tabla notificaciones ya debe existir; si no, ejecuta supabase_notificaciones_admin.sql primero.
