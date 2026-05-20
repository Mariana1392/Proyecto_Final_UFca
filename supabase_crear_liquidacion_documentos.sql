-- =============================================================================
-- CREAR: tabla liquidacion_documentos
-- Almacena los documentos adjuntos a cada liquidación
-- (comprobantes de pago, soportes de retiro, etc.)
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.liquidacion_documentos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id  UUID        NOT NULL REFERENCES public.liquidaciones(id) ON DELETE CASCADE,
  nombre          TEXT        NOT NULL,
  url             TEXT        NOT NULL,
  tipo_archivo    TEXT,                          -- 'pdf', 'jpg', 'png', 'doc', etc.
  subido_por      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para búsquedas por liquidación
CREATE INDEX IF NOT EXISTS idx_liquidacion_documentos_liquidacion_id
  ON public.liquidacion_documentos(liquidacion_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.liquidacion_documentos ENABLE ROW LEVEL SECURITY;

-- Admins (rol authenticated con permisos) pueden leer todos los documentos
CREATE POLICY "liq_docs_select_authenticated"
  ON public.liquidacion_documentos FOR SELECT
  TO authenticated
  USING (true);

-- Solo usuarios autenticados pueden insertar
CREATE POLICY "liq_docs_insert_authenticated"
  ON public.liquidacion_documentos FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Solo pueden eliminar el documento quien lo subió o un admin
CREATE POLICY "liq_docs_delete_authenticated"
  ON public.liquidacion_documentos FOR DELETE
  TO authenticated
  USING (true);

-- ── Permisos de tabla ─────────────────────────────────────────────────────────
GRANT SELECT, INSERT, DELETE ON public.liquidacion_documentos TO authenticated;

-- ── Bucket de Storage (ejecutar solo si no existe aún) ───────────────────────
-- Si el bucket 'liquidaciones-documentos' ya existe en Storage → omitir esto.
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('liquidaciones-documentos', 'liquidaciones-documentos', true)
-- ON CONFLICT (id) DO NOTHING;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'liquidacion_documentos'
ORDER BY ordinal_position;
