-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN: liquidaciones.detalle JSONB → columnas reales
-- UFCA — Ejecutar UNA SOLA VEZ en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════
-- Antes: todos los datos escalares vivían en detalle (jsonb)
-- Después: columnas tipadas; solo conceptos y documentos siguen en jsonb

-- ──────────────────────────────────────────────────────────────
-- PASO 1: Agregar columnas reales
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.liquidaciones
  ADD COLUMN IF NOT EXISTS estado                  text         NOT NULL DEFAULT 'En proceso',
  ADD COLUMN IF NOT EXISTS fecha_corte             date,
  ADD COLUMN IF NOT EXISTS fecha_liquidacion       date,
  ADD COLUMN IF NOT EXISTS motivo                  text,
  ADD COLUMN IF NOT EXISTS observaciones           text,
  ADD COLUMN IF NOT EXISTS anulado                 boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS justificacion_anulacion text,
  ADD COLUMN IF NOT EXISTS anulado_por             text,        -- nombre del admin (cadena, no FK: el admin puede eliminarse)
  ADD COLUMN IF NOT EXISTS anulado_en              timestamptz,
  ADD COLUMN IF NOT EXISTS conceptos               jsonb        NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS documentos              jsonb        NOT NULL DEFAULT '[]';

-- ──────────────────────────────────────────────────────────────
-- PASO 2: Backfill desde detalle JSONB existente
-- ──────────────────────────────────────────────────────────────
UPDATE public.liquidaciones SET
  estado                  = COALESCE(NULLIF(detalle->>'estado',                 ''), 'En proceso'),
  fecha_corte             = NULLIF(detalle->>'fechaCorte',         '')::date,
  fecha_liquidacion       = NULLIF(detalle->>'fechaLiquidacion',   '')::date,
  motivo                  = NULLIF(detalle->>'motivo',             ''),
  observaciones           = NULLIF(detalle->>'observaciones',      ''),
  anulado                 = COALESCE((detalle->>'anulado')::boolean, false),
  justificacion_anulacion = NULLIF(detalle->>'justificacionAnulacion', ''),
  anulado_por             = NULLIF(detalle->>'anuladoPor',         ''),
  anulado_en              = CASE
                              WHEN NULLIF(detalle->>'anuladoEn', '') IS NOT NULL
                              THEN (detalle->>'anuladoEn')::timestamptz
                              ELSE NULL
                            END,
  conceptos               = COALESCE(detalle->'conceptos',  '[]'::jsonb),
  documentos              = COALESCE(detalle->'documentos', '[]'::jsonb)
WHERE detalle IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- PASO 3: Índices para consultas frecuentes
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_liq_estado    ON public.liquidaciones (estado);
CREATE INDEX IF NOT EXISTS idx_liq_anulado   ON public.liquidaciones (anulado);
CREATE INDEX IF NOT EXISTS idx_liq_tipo      ON public.liquidaciones (tipo);
CREATE INDEX IF NOT EXISTS idx_liq_asociado  ON public.liquidaciones (asociado_id);

-- ──────────────────────────────────────────────────────────────
-- PASO 4: Actualizar insertar_liquidacion
-- Ahora escribe en columnas reales; mantiene detalle residual
-- solo para calculo y metadata histórica.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.insertar_liquidacion(
  p_asociado_id  uuid,
  p_fecha        date,
  p_monto_total  numeric,
  p_tipo         text,
  p_detalle      jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.liquidaciones (
    asociado_id,
    tipo,
    monto_total,
    estado,
    fecha_corte,
    fecha_liquidacion,
    motivo,
    observaciones,
    anulado,
    conceptos,
    documentos,
    detalle   -- solo guarda lo residual (calculo, etc.)
  ) VALUES (
    p_asociado_id,
    p_tipo,
    p_monto_total,
    COALESCE(NULLIF(p_detalle->>'estado',           ''), 'En proceso'),
    NULLIF(p_detalle->>'fechaCorte',     '')::date,
    NULLIF(p_detalle->>'fechaLiquidacion','')::date,
    NULLIF(p_detalle->>'motivo',         ''),
    NULLIF(p_detalle->>'observaciones',  ''),
    false,
    COALESCE(p_detalle->'conceptos',  '[]'::jsonb),
    COALESCE(p_detalle->'documentos', '[]'::jsonb),
    -- detalle residual: solo campos no migrados
    jsonb_strip_nulls(jsonb_build_object('calculo', p_detalle->'calculo'))
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- PASO 5: Reemplazar actualizar_detalle_liquidacion
-- Ahora delega a columnas reales en lugar de reemplazar el JSONB completo.
-- Mantiene la firma idéntica para no romper código legacy durante la transición.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_detalle_liquidacion(
  p_id      uuid,
  p_detalle jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.liquidaciones SET
    estado                  = COALESCE(NULLIF(p_detalle->>'estado',                 ''), estado),
    anulado                 = COALESCE((p_detalle->>'anulado')::boolean,               anulado),
    justificacion_anulacion = COALESCE(NULLIF(p_detalle->>'justificacionAnulacion', ''), justificacion_anulacion),
    anulado_por             = COALESCE(NULLIF(p_detalle->>'anuladoPor',              ''), anulado_por),
    anulado_en              = CASE
                                WHEN NULLIF(p_detalle->>'anuladoEn', '') IS NOT NULL
                                THEN (p_detalle->>'anuladoEn')::timestamptz
                                ELSE anulado_en
                              END,
    documentos              = COALESCE(p_detalle->'documentos', documentos),
    updated_at              = now()
  WHERE id = p_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- PASO 6: Nueva RPC liviana para cambios puntuales
-- Usada por el nuevo código TypeScript (no carga el JSONB completo)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_liquidacion(
  p_id                    uuid,
  p_estado                text        DEFAULT NULL,
  p_anulado               boolean     DEFAULT NULL,
  p_justificacion_anulacion text      DEFAULT NULL,
  p_anulado_por           text        DEFAULT NULL,
  p_anulado_en            timestamptz DEFAULT NULL,
  p_documentos            jsonb       DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.liquidaciones SET
    estado                  = COALESCE(p_estado,                  estado),
    anulado                 = COALESCE(p_anulado,                 anulado),
    justificacion_anulacion = COALESCE(p_justificacion_anulacion, justificacion_anulacion),
    anulado_por             = COALESCE(p_anulado_por,             anulado_por),
    anulado_en              = COALESCE(p_anulado_en,              anulado_en),
    documentos              = COALESCE(p_documentos,              documentos),
    updated_at              = now()
  WHERE id = p_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- PASO 7: Verificación — debe retornar 0 filas si backfill OK
-- ──────────────────────────────────────────────────────────────
SELECT id, estado, fecha_corte, anulado, conceptos, documentos
FROM public.liquidaciones
WHERE estado = 'En proceso'
  AND fecha_corte IS NULL
  AND detalle->>'fechaCorte' IS NOT NULL
LIMIT 5;
-- Si retorna filas, el backfill falló en esas filas. Revísalas manualmente.
