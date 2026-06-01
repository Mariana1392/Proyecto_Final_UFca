-- ============================================================
-- UFCA - Crear tabla auditoria (faltaba en el schema original)
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS auditoria (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla        VARCHAR(100) NOT NULL,
  registro_id  UUID,
  asociado_id  UUID REFERENCES asociados(id) ON DELETE SET NULL,
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accion       VARCHAR(100) NOT NULL,
  detalle      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabla       ON auditoria(tabla);
CREATE INDEX IF NOT EXISTS idx_auditoria_asociado_id ON auditoria(asociado_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id  ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at  ON auditoria(created_at DESC);

-- RLS
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria_select" ON auditoria
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "auditoria_insert" ON auditoria
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Verificar
SELECT COUNT(*) AS registros FROM auditoria;
