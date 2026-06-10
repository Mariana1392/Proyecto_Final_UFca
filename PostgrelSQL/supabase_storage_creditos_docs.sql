-- =============================================================================
-- UFCA — Bucket de Storage para documentos de solicitudes de crédito (Mejora F)
-- Ejecutar en Supabase → SQL Editor (una sola vez)
-- =============================================================================

-- 1. Columna para almacenar los documentos adjuntos (array JSONB)
--    Cada elemento: { tipo: 'carta-laboral'|'cedula', url: '...', nombre: '...' }
ALTER TABLE creditos ADD COLUMN IF NOT EXISTS documentos_adjuntos JSONB DEFAULT '[]'::jsonb;

-- 2. Crear el bucket privado (solo accesible con URL firmada o service_role)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creditos-docs',
  'creditos-docs',
  false,                          -- privado: los archivos NO son accesibles sin autenticación
  5242880,                        -- 5 MB máximo
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;     -- idempotente: no falla si ya existe

-- 3. Políticas RLS para el bucket
--    · Asociado: puede subir/leer SUS propios archivos (ruta: {user_id}/*)
--    · Admin: puede leer todos los archivos

-- Subir (INSERT): el asociado solo puede subir en su propia carpeta
CREATE POLICY "asociado_upload_creditos_docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'creditos-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leer (SELECT): el asociado lee sus archivos; admin lee todos
CREATE POLICY "asociado_read_creditos_docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'creditos-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin'
      )
    )
  );

-- Eliminar (DELETE): solo el propietario o admin
CREATE POLICY "asociado_delete_creditos_docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'creditos-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin'
      )
    )
  );
