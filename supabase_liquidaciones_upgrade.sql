-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Adaptar tabla liquidaciones al módulo UFCA
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columnas que necesita el módulo (si no existen)
ALTER TABLE liquidaciones
  ADD COLUMN IF NOT EXISTS asociado_id  UUID        REFERENCES asociados(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS tipo         TEXT        NOT NULL DEFAULT 'retiro'
                                                    CHECK (tipo IN ('retiro','cesantias','expulsion','fallecimiento','otro')),
  ADD COLUMN IF NOT EXISTS monto_total  DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha        DATE,
  ADD COLUMN IF NOT EXISTS detalle      JSONB       NOT NULL DEFAULT '{}'::jsonb;

-- 2. Índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_liq_asociado_id  ON liquidaciones (asociado_id);
CREATE INDEX IF NOT EXISTS idx_liq_tipo         ON liquidaciones (tipo);
CREATE INDEX IF NOT EXISTS idx_liq_fecha        ON liquidaciones (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_liq_created_at   ON liquidaciones (created_at DESC);

-- Índice de expresión sobre detalle->>'estado' (para filtrar por estado)
CREATE INDEX IF NOT EXISTS idx_liq_detalle_estado
  ON liquidaciones ((detalle->>'estado'));

-- Índice de expresión sobre detalle->>'anulado' (para separar activas/anuladas)
CREATE INDEX IF NOT EXISTS idx_liq_detalle_anulado
  ON liquidaciones ((detalle->>'anulado'));

-- 3. Índice GIN trigrama en asociados.nombre (búsqueda ILIKE rápida)
--    Requiere extensión pg_trgm (habilitada por defecto en Supabase)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_asociados_nombre_trgm
  ON asociados USING gin (nombre gin_trgm_ops);

-- 4. RLS: asegurar que admins pueden operar sobre liquidaciones
--    (ajusta el nombre del rol si es diferente en tu proyecto)
ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'liquidaciones' AND policyname = 'Admin acceso total liquidaciones'
  ) THEN
    CREATE POLICY "Admin acceso total liquidaciones"
      ON liquidaciones FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';
