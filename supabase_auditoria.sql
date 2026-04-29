-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLA AUDITORÍA — Ejecutar en Supabase Dashboard → SQL Editor → Run
-- Registra todas las acciones administrativas del sistema UFCA
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS auditoria (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  accion      VARCHAR(100) NOT NULL,
  tabla       VARCHAR(100),
  registro_id UUID,
  detalle     JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabla      ON auditoria(tabla);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario    ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria(created_at DESC);

-- RLS
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo admins ven auditoría"
  ON auditoria FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "Solo admins insertan auditoría"
  ON auditoria FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Solo admins eliminan auditoría"
  ON auditoria FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

NOTIFY pgrst, 'reload schema';

-- Verificar
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'auditoria' ORDER BY ordinal_position;
