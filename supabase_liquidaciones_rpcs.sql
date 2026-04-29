-- ============================================================
-- UFCA — RPCs para el módulo de Liquidaciones
-- Ejecutar DESPUÉS de supabase_liquidaciones_upgrade.sql
-- Supabase → SQL Editor → Run
-- ============================================================

-- ── Extensión trigrama (búsqueda ILIKE rápida por nombre) ──
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Índice trigrama en asociados.nombre ────────────────────
CREATE INDEX IF NOT EXISTS idx_asociados_nombre_trgm
  ON asociados USING gin (nombre gin_trgm_ops);

-- ============================================================
-- 1. listar_liquidaciones
--    Uso: admin carga la página inicial (sin filtros de nombre)
-- ============================================================
CREATE OR REPLACE FUNCTION listar_liquidaciones(p_limite INTEGER DEFAULT 500)
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
    l.monto_total,
    l.fecha,
    l.detalle,
    l.created_at
  FROM liquidaciones l
  WHERE l.asociado_id IS NOT NULL          -- solo registros del módulo nuevo
  ORDER BY l.created_at DESC
  LIMIT p_limite;
$$;

-- ============================================================
-- 2. buscar_liquidaciones
--    Uso: búsqueda con filtros (nombre, tipo, rango de fechas)
--    p_asociado_ids NULL  → todos los asociados
--    p_asociado_ids [ids] → solo esos asociados
-- ============================================================
CREATE OR REPLACE FUNCTION buscar_liquidaciones(
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
    l.monto_total,
    l.fecha,
    l.detalle,
    l.created_at
  FROM liquidaciones l
  WHERE
    l.asociado_id IS NOT NULL
    -- Filtro por lista de asociados (NULL = todos)
    AND (p_asociado_ids IS NULL OR l.asociado_id = ANY(p_asociado_ids))
    -- Filtro por tipo de liquidación
    AND (p_tipo IS NULL OR l.tipo = p_tipo)
    -- Filtro por rango de fecha de registro
    AND (p_reg_desde IS NULL OR l.created_at >= p_reg_desde)
    AND (p_reg_hasta IS NULL OR l.created_at <= p_reg_hasta)
  ORDER BY l.created_at DESC
  LIMIT p_limite;
$$;

-- ============================================================
-- 3. insertar_liquidacion
--    Uso: admin registra una nueva liquidación
--    Devuelve el UUID del registro creado
-- ============================================================
CREATE OR REPLACE FUNCTION insertar_liquidacion(
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
    asociado_id,
    tipo,
    monto_total,
    fecha,
    detalle,
    -- Columnas del esquema original (requeridas por NOT NULL)
    periodo,
    fecha_inicio,
    fecha_fin
  ) VALUES (
    p_asociado_id,
    p_tipo,
    p_monto_total,
    p_fecha,
    p_detalle,
    -- Periodo derivado de la fecha de corte para compatibilidad con esquema original
    TO_CHAR(p_fecha, 'YYYY-MM'),
    p_fecha,
    p_fecha
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- 4. actualizar_detalle_liquidacion
--    Uso: cambiar estado, anular, o modificar el JSONB detalle
-- ============================================================
CREATE OR REPLACE FUNCTION actualizar_detalle_liquidacion(
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
  SET
    detalle    = p_detalle,
    -- Sincronizar monto_total si viene en el detalle (para consultas directas)
    updated_at = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidación % no encontrada', p_id;
  END IF;
END;
$$;

-- ============================================================
-- Permisos: solo roles autenticados pueden ejecutar las RPCs
-- ============================================================
REVOKE ALL ON FUNCTION listar_liquidaciones(INTEGER)             FROM PUBLIC;
REVOKE ALL ON FUNCTION buscar_liquidaciones(UUID[],TEXT,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION insertar_liquidacion(UUID,DATE,NUMERIC,TEXT,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION actualizar_detalle_liquidacion(UUID,JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION listar_liquidaciones(INTEGER)             TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_liquidaciones(UUID[],TEXT,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION insertar_liquidacion(UUID,DATE,NUMERIC,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION actualizar_detalle_liquidacion(UUID,JSONB) TO authenticated;

-- ============================================================
-- Recargar schema cache de PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
