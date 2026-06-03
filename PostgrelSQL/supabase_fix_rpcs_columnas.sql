-- =============================================================================
-- FIX FINAL: Actualizar_liquidacion, listar_liquidaciones y buscar_liquidaciones
-- =============================================================================

-- 1. Eliminar TODAS las versiones anteriores de actualizar_liquidacion para evitar
-- conflictos de sobrecarga de funciones (Could not choose the best candidate function).
DROP FUNCTION IF EXISTS public.actualizar_liquidacion(UUID, JSONB, TEXT, BOOLEAN, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.actualizar_liquidacion(UUID, TEXT, JSONB, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.actualizar_liquidacion(UUID, TEXT, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, JSONB);
DROP FUNCTION IF EXISTS public.actualizar_liquidacion(UUID, TEXT, BOOLEAN, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.actualizar_liquidacion(
  p_id                      UUID,
  p_documentos              JSONB    DEFAULT NULL,
  p_estado                  TEXT     DEFAULT NULL,
  p_anulado                 BOOLEAN  DEFAULT NULL,
  p_justificacion_anulacion TEXT     DEFAULT NULL,
  p_anulado_por             TEXT     DEFAULT NULL,
  p_anulado_en              TEXT     DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detalle JSONB;
BEGIN
  -- Leer detalle actual
  SELECT COALESCE(detalle, '{}'::jsonb) INTO v_detalle
  FROM   liquidaciones
  WHERE  id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidación % no encontrada', p_id;
  END IF;

  -- Merge de cada campo que llegue como parámetro al JSONB (compatibilidad)
  IF p_documentos IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('documentos', p_documentos);
  END IF;

  IF p_estado IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('estado', p_estado);
  END IF;

  IF p_anulado IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('anulado', p_anulado);
  END IF;

  IF p_justificacion_anulacion IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('justificacionAnulacion', p_justificacion_anulacion);
  END IF;

  IF p_anulado_por IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('anuladoPor', p_anulado_por);
  END IF;

  IF p_anulado_en IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('anuladoEn', p_anulado_en);
  END IF;

  -- ACTUALIZAR COLUMNAS REALES Y DETALLE
  UPDATE liquidaciones
  SET    detalle    = v_detalle,
         estado     = COALESCE(p_estado, estado),
         anulado    = COALESCE(p_anulado, anulado),
         justificacion_anulacion = COALESCE(p_justificacion_anulacion, justificacion_anulacion),
         anulado_por = COALESCE(p_anulado_por, anulado_por),
         anulado_en = CASE WHEN p_anulado_en IS NOT NULL THEN p_anulado_en::timestamptz ELSE anulado_en END,
         updated_at = NOW()
  WHERE  id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_liquidacion(UUID,JSONB,TEXT,BOOLEAN,TEXT,TEXT,TEXT) TO authenticated;

-- Primero, eliminamos las funciones existentes de listar/buscar para cambiar el tipo de retorno
DROP FUNCTION IF EXISTS public.listar_liquidaciones(INTEGER);
DROP FUNCTION IF EXISTS public.buscar_liquidaciones(UUID[], TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER);

-- 2. listar_liquidaciones
CREATE OR REPLACE FUNCTION public.listar_liquidaciones(p_limite INTEGER DEFAULT 500)
RETURNS TABLE (
  id           UUID,
  asociado_id  UUID,
  tipo         TEXT,
  monto_total  NUMERIC,
  fecha        DATE,
  estado       TEXT,
  anulado      BOOLEAN,
  fecha_corte  DATE,
  fecha_liquidacion DATE,
  observaciones TEXT,
  justificacion_anulacion TEXT,
  anulado_por  TEXT,
  anulado_en   TIMESTAMPTZ,
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
    COALESCE(l.estado, 'En proceso') AS estado,
    COALESCE(l.anulado, false) AS anulado,
    l.fecha_corte,
    l.fecha_liquidacion,
    l.observaciones,
    l.justificacion_anulacion,
    l.anulado_por,
    l.anulado_en,
    l.detalle,
    l.created_at
  FROM liquidaciones l
  WHERE l.asociado_id IS NOT NULL
  ORDER BY l.created_at DESC
  LIMIT p_limite;
$$;

GRANT EXECUTE ON FUNCTION public.listar_liquidaciones(INTEGER) TO authenticated;

-- 3. buscar_liquidaciones
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
  estado       TEXT,
  anulado      BOOLEAN,
  fecha_corte  DATE,
  fecha_liquidacion DATE,
  observaciones TEXT,
  justificacion_anulacion TEXT,
  anulado_por  TEXT,
  anulado_en   TIMESTAMPTZ,
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
    COALESCE(l.estado, 'En proceso') AS estado,
    COALESCE(l.anulado, false) AS anulado,
    l.fecha_corte,
    l.fecha_liquidacion,
    l.observaciones,
    l.justificacion_anulacion,
    l.anulado_por,
    l.anulado_en,
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

GRANT EXECUTE ON FUNCTION public.buscar_liquidaciones(UUID[],TEXT,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER) TO authenticated;

-- Recargar la caché de PostgREST
NOTIFY pgrst, 'reload schema';
