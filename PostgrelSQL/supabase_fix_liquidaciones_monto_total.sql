-- =============================================================================
-- FIX: column l.monto_total does not exist
-- Causa: supabase_liquidaciones_upgrade.sql no se había ejecutado antes
--        de crear las RPCs, por lo que la columna monto_total no existe.
-- Ejecutar en Supabase → SQL Editor → Run
-- Es IDEMPOTENTE: seguro de correr aunque ya se haya ejecutado parcialmente.
-- =============================================================================

-- ── 1. Agregar columnas que requiere el módulo (ADD IF NOT EXISTS) ──────────
ALTER TABLE liquidaciones
  ADD COLUMN IF NOT EXISTS asociado_id  UUID        REFERENCES asociados(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS tipo         TEXT        NOT NULL DEFAULT 'retiro'
                                                    CHECK (tipo IN ('retiro','cesantias','expulsion','fallecimiento','otro')),
  ADD COLUMN IF NOT EXISTS monto_total  DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha        DATE,
  ADD COLUMN IF NOT EXISTS detalle      JSONB       NOT NULL DEFAULT '{}'::jsonb;

-- ── 2. Índices para rendimiento ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_liq_asociado_id        ON liquidaciones (asociado_id);
CREATE INDEX IF NOT EXISTS idx_liq_tipo               ON liquidaciones (tipo);
CREATE INDEX IF NOT EXISTS idx_liq_fecha              ON liquidaciones (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_liq_created_at         ON liquidaciones (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liq_tipo_created_at    ON liquidaciones (tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liq_detalle_estado     ON liquidaciones ((detalle->>'estado'));
CREATE INDEX IF NOT EXISTS idx_liq_detalle_anulado    ON liquidaciones ((detalle->>'anulado'));

-- Índice trigrama para búsqueda ILIKE rápida por nombre de asociado
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_asociados_nombre_trgm
  ON asociados USING gin (nombre gin_trgm_ops);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
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

-- ── 4. Recrear RPCs (CREATE OR REPLACE = idempotente) ────────────────────────

-- 4a. listar_liquidaciones
CREATE OR REPLACE FUNCTION public.listar_liquidaciones(p_limite INTEGER DEFAULT 500)
RETURNS TABLE (
  id           UUID,
  asociado_id  UUID,
  tipo         TEXT,
  monto_total  NUMERIC,
  fecha        DATE,
  detalle      JSONB,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.asociado_id,
    l.tipo,
    COALESCE(l.monto_total, 0)::numeric AS monto_total,
    l.fecha,
    l.detalle,
    l.created_at
  FROM liquidaciones l
  WHERE l.asociado_id IS NOT NULL
  ORDER BY l.created_at DESC
  LIMIT p_limite;
$$;

-- 4b. buscar_liquidaciones
CREATE OR REPLACE FUNCTION public.buscar_liquidaciones(
  p_asociado_ids UUID[]      DEFAULT NULL,
  p_tipo         TEXT        DEFAULT NULL,
  p_reg_desde    TIMESTAMPTZ DEFAULT NULL,
  p_reg_hasta    TIMESTAMPTZ DEFAULT NULL,
  p_limite       INTEGER     DEFAULT 500
)
RETURNS TABLE (
  id           UUID,
  asociado_id  UUID,
  tipo         TEXT,
  monto_total  NUMERIC,
  fecha        DATE,
  detalle      JSONB,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.asociado_id,
    l.tipo,
    COALESCE(l.monto_total, 0)::numeric AS monto_total,
    l.fecha,
    l.detalle,
    l.created_at
  FROM liquidaciones l
  WHERE
    l.asociado_id IS NOT NULL
    AND (p_asociado_ids IS NULL OR l.asociado_id = ANY(p_asociado_ids))
    AND (p_tipo       IS NULL OR l.tipo = p_tipo)
    AND (p_reg_desde  IS NULL OR l.created_at >= p_reg_desde)
    AND (p_reg_hasta  IS NULL OR l.created_at <= p_reg_hasta)
  ORDER BY l.created_at DESC
  LIMIT p_limite;
$$;

-- 4c. insertar_liquidacion
CREATE OR REPLACE FUNCTION public.insertar_liquidacion(
  p_asociado_id UUID,
  p_fecha       DATE,
  p_monto_total NUMERIC,
  p_tipo        TEXT,
  p_detalle     JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO liquidaciones (
    asociado_id, tipo, monto_total, fecha, detalle,
    periodo, fecha_inicio, fecha_fin
  ) VALUES (
    p_asociado_id, p_tipo, p_monto_total, p_fecha, p_detalle,
    TO_CHAR(p_fecha, 'YYYY-MM'), p_fecha, p_fecha
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 4d. actualizar_detalle_liquidacion
CREATE OR REPLACE FUNCTION public.actualizar_detalle_liquidacion(
  p_id      UUID,
  p_detalle JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE liquidaciones
  SET detalle    = p_detalle,
      updated_at = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidación % no encontrada', p_id;
  END IF;
END;
$$;

-- ── 5. Permisos ───────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.listar_liquidaciones(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buscar_liquidaciones(UUID[],TEXT,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insertar_liquidacion(UUID,DATE,NUMERIC,TEXT,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_detalle_liquidacion(UUID,JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.listar_liquidaciones(INTEGER)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_liquidaciones(UUID[],TEXT,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insertar_liquidacion(UUID,DATE,NUMERIC,TEXT,JSONB)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_detalle_liquidacion(UUID,JSONB)                 TO authenticated;

-- ── 6. Recargar caché de PostgREST ───────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- Verificación rápida
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'liquidaciones'
  AND column_name IN ('monto_total','asociado_id','tipo','detalle','fecha')
ORDER BY column_name;
