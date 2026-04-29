-- ─────────────────────────────────────────────────────────────────────────────
-- Crear bucket de Storage para documentos de créditos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Crear el bucket (si ya existe, no hace nada)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creditos-documentos',
  'creditos-documentos',
  true,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Eliminar políticas anteriores si ya existen (para poder recrearlas sin error)
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir documentos"   ON storage.objects;
DROP POLICY IF EXISTS "Documentos son públicos para lectura"             ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar documentos" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar documentos" ON storage.objects;

-- 3. Recrear políticas limpias
CREATE POLICY "Usuarios autenticados pueden subir documentos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'creditos-documentos');

CREATE POLICY "Documentos son públicos para lectura"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'creditos-documentos');

CREATE POLICY "Usuarios autenticados pueden actualizar documentos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'creditos-documentos');

CREATE POLICY "Usuarios autenticados pueden eliminar documentos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'creditos-documentos');

-- 4. Verificar
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'creditos-documentos';
