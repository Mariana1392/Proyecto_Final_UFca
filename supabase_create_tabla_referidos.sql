-- =============================================================================
-- UFCA — Tabla referidos (personas externas que son aval de un asociado)
-- El asociado actúa como garante: si el referido no paga, el asociado responde.
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.referidos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id     UUID NOT NULL REFERENCES public.asociados(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  cedula          TEXT NOT NULL,
  telefono        TEXT,
  estado          VARCHAR(20) NOT NULL DEFAULT 'activo'
                  CHECK (estado IN ('activo', 'inactivo')),
  observaciones   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referidos_asociado ON public.referidos(asociado_id);

-- RLS
ALTER TABLE public.referidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referidos_select_authenticated" ON public.referidos;
CREATE POLICY "referidos_select_authenticated"
  ON public.referidos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "referidos_insert_authenticated" ON public.referidos;
CREATE POLICY "referidos_insert_authenticated"
  ON public.referidos FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "referidos_update_authenticated" ON public.referidos;
CREATE POLICY "referidos_update_authenticated"
  ON public.referidos FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "referidos_delete_authenticated" ON public.referidos;
CREATE POLICY "referidos_delete_authenticated"
  ON public.referidos FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referidos TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'referidos'
ORDER BY ordinal_position;
