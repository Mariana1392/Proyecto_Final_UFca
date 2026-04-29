-- ═══════════════════════════════════════════════════════════════
-- Tabla: liquidacion_documentos
-- Propósito: soporte documental múltiple por liquidación
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Crear tabla
CREATE TABLE IF NOT EXISTS liquidacion_documentos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id UUID        NOT NULL REFERENCES liquidaciones(id) ON DELETE CASCADE,
  nombre         TEXT        NOT NULL,
  url            TEXT        NOT NULL,
  tipo_archivo   TEXT        NOT NULL DEFAULT 'pdf',
  subido_por     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_liq_docs_liq_id
  ON liquidacion_documentos (liquidacion_id);

-- 3. RLS
ALTER TABLE liquidacion_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access_liq_docs" ON liquidacion_documentos;
CREATE POLICY "authenticated_full_access_liq_docs"
  ON liquidacion_documentos
  FOR ALL
  TO authenticated
  USING  (true)
  WITH CHECK (true);

-- 4. Bucket de storage (si no existe)
-- Ejecutar en el panel Storage de Supabase o mediante este INSERT:
INSERT INTO storage.buckets (id, name, public)
VALUES ('liquidaciones-documentos', 'liquidaciones-documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy de storage: autenticados pueden subir y leer
DROP POLICY IF EXISTS "auth_upload_liq_docs" ON storage.objects;
CREATE POLICY "auth_upload_liq_docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'liquidaciones-documentos');

DROP POLICY IF EXISTS "public_read_liq_docs" ON storage.objects;
CREATE POLICY "public_read_liq_docs"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'liquidaciones-documentos');

DROP POLICY IF EXISTS "auth_delete_liq_docs" ON storage.objects;
CREATE POLICY "auth_delete_liq_docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'liquidaciones-documentos');

-- 5. Reload schema
NOTIFY pgrst, 'reload schema';
