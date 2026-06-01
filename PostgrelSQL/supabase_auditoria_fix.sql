-- ============================================================
-- UFCA - Fix tabla auditoria para guardar detalle como TEXT
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Asegurarse que la tabla existe con la estructura correcta
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla       ON auditoria(tabla);
CREATE INDEX IF NOT EXISTS idx_auditoria_registro_id ON auditoria(registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_asociado_id ON auditoria(asociado_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at  ON auditoria(created_at DESC);

-- RLS
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas anteriores si existen y recrearlas
DROP POLICY IF EXISTS "auditoria_select" ON auditoria;
DROP POLICY IF EXISTS "auditoria_insert" ON auditoria;

-- Cualquier usuario autenticado puede ver registros de auditoría de asociados
CREATE POLICY "auditoria_select" ON auditoria
  FOR SELECT TO authenticated
  USING (true);

-- Cualquier usuario autenticado puede insertar
CREATE POLICY "auditoria_insert" ON auditoria
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Verificar que quedó bien
SELECT COUNT(*) AS total_registros FROM auditoria;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'auditoria';
