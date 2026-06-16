-- =============================================================================
-- FIX: EFECTOS SECUNDARIOS DE LIQUIDACION PAGADA (CORREGIDO)
-- =============================================================================

DROP FUNCTION IF EXISTS actualizar_liquidacion(uuid, jsonb, text, boolean, text, text, text);

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
  v_tipo TEXT;
  v_asoc_id UUID;
  v_estado_actual TEXT;
  v_anulado_actual BOOLEAN;
BEGIN
  -- Leer detalle y otra info actual
  SELECT COALESCE(detalle, '{}'::jsonb), tipo, asociado_id, COALESCE(detalle->>'estado', 'En proceso'), COALESCE((detalle->>'anulado')::boolean, false)
  INTO v_detalle, v_tipo, v_asoc_id, v_estado_actual, v_anulado_actual
  FROM   liquidaciones
  WHERE  id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidación % no encontrada', p_id;
  END IF;

  -- Merge de cada campo que llegue como parámetro
  IF p_documentos IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('documentos', p_documentos);
  END IF;

  IF p_estado IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('estado', p_estado);
    v_estado_actual := p_estado; -- Actualizar para la lógica de abajo
  END IF;

  IF p_anulado IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('anulado', p_anulado);
    v_anulado_actual := p_anulado;
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

  -- Actualizar el JSON de la liquidación
  UPDATE liquidaciones
  SET    detalle    = v_detalle,
         updated_at = NOW()
  WHERE  id = p_id;

  -- ==========================================================================
  -- LÓGICA DE NEGOCIO: Efectos colaterales al cambiar el estado a 'Pagada'
  -- ==========================================================================
  -- IMPORTANTE: Evaluamos v_estado_actual para saber si al final quedó en Pagada
  IF v_estado_actual = 'Pagada' AND NOT v_anulado_actual THEN
    
    -- El tipo es 'anual' (según constants.ts)
    IF v_tipo = 'anual' THEN
      -- Solo deja en 0 los ahorros, pero siguen activos
      UPDATE cuentas_ahorro 
      SET monto_ahorrado = 0 
      WHERE asociado_id = v_asoc_id;
      
      -- Créditos pasan a 'cancelado' (pagado) y saldo a 0 (estados reales: activo, desembolsado, en_mora)
      UPDATE creditos 
      SET estado = 'cancelado', saldo = 0 
      WHERE asociado_id = v_asoc_id AND estado IN ('activo', 'desembolsado', 'en_mora');
      
    ELSE
      -- Cualquier otra liquidación (retiro, expulsion, fallecimiento, otro, etc.):
      -- 1. Inactivar el usuario (que también hace las veces de asociado en el sistema)
      UPDATE usuarios SET activo = false WHERE id = v_asoc_id;
      
      -- 2. Inactivar ahorros y dejarlos en 0
      UPDATE cuentas_ahorro 
      SET estado = 'inactivo', monto_ahorrado = 0 
      WHERE asociado_id = v_asoc_id;
      
      -- 3. Inactivar creditos y dejarlos en 0
      UPDATE creditos 
      SET estado = 'cancelado', saldo = 0 
      WHERE asociado_id = v_asoc_id AND estado IN ('activo', 'desembolsado', 'en_mora');
    END IF;

  END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_liquidacion(UUID,JSONB,TEXT,BOOLEAN,TEXT,TEXT,TEXT) TO authenticated;

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
