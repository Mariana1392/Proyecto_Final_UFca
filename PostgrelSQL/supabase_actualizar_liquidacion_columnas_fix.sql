-- =============================================================================
-- FIX: ACTUALIZAR LIQUIDACION CON COLUMNAS REALES Y EFECTOS (CORREGIDO)
-- =============================================================================

-- Borrar cualquier versión anterior (todas las sobrecargas) de forma dinámica
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'actualizar_liquidacion'
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.func_signature || ' CASCADE';
    END LOOP;
END;
$$;

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
  v_tipo TEXT;
  v_asoc_id UUID;
  v_estado_actual TEXT;
  v_anulado_actual BOOLEAN;
  v_detalle JSONB;
BEGIN
  -- 1. Leer información actual de la liquidación
  SELECT tipo, asociado_id, estado, anulado, COALESCE(detalle, '{}'::jsonb)
  INTO v_tipo, v_asoc_id, v_estado_actual, v_anulado_actual, v_detalle
  FROM liquidaciones
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidación % no encontrada', p_id;
  END IF;

  -- 2. Modificar el JSONB detalle con los campos que correspondan para mantener la compatibilidad con el frontend
  IF p_documentos IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('documentos', p_documentos);
  END IF;

  IF p_estado IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('estado', p_estado);
    v_estado_actual := p_estado; -- Actualizar para la lógica de negocio
  END IF;

  IF p_anulado IS NOT NULL THEN
    v_detalle := v_detalle || jsonb_build_object('anulado', p_anulado);
    v_anulado_actual := p_anulado; -- Actualizar para la lógica de negocio
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

  -- 3. Actualizar las COLUMNAS REALES y el campo JSONB detalle (y mantener los valores anteriores si no se envían)
  UPDATE liquidaciones SET
    estado                  = COALESCE(p_estado, estado),
    anulado                 = COALESCE(p_anulado, anulado),
    justificacion_anulacion = COALESCE(p_justificacion_anulacion, justificacion_anulacion),
    anulado_por             = COALESCE(p_anulado_por, anulado_por),
    anulado_en              = CASE 
                                WHEN p_anulado_en IS NOT NULL THEN p_anulado_en::timestamptz 
                                ELSE anulado_en 
                              END,
    detalle                 = v_detalle,
    updated_at              = NOW()
  WHERE id = p_id;

  -- ==========================================================================
  -- LÓGICA DE NEGOCIO: Efectos colaterales al cambiar el estado a 'Pagada'
  -- ==========================================================================
  IF v_estado_actual = 'Pagada' AND NOT v_anulado_actual THEN
    
    IF v_tipo = 'anual' THEN
      -- Liquidación anual: los ahorros quedan en 0 pero activos.
      UPDATE cuentas_ahorro 
      SET monto_ahorrado = 0, 
          updated_at = NOW()
      WHERE asociado_id = v_asoc_id;
      
      -- Créditos pasan a 'pagado' y saldo a 0
      UPDATE creditos 
      SET estado = 'pagado', 
          saldo = 0, 
          fecha_estado_cambio = NOW(), 
          updated_at = NOW()
      WHERE asociado_id = v_asoc_id AND estado IN ('activo', 'desembolsado', 'en_mora');
      
    ELSE
      -- Otras liquidaciones (retiro, expulsion, fallecimiento, etc.):
      -- 1. Inactivar al usuario
      UPDATE usuarios 
      SET activo = false, 
          estado_cuenta = 'inactivo', 
          updated_at = NOW() 
      WHERE id = v_asoc_id;
      
      -- 2. Inactivar ahorros, dejarlos en 0 y registrar fecha de cierre
      UPDATE cuentas_ahorro 
      SET estado = 'inactivo', 
          monto_ahorrado = 0, 
          fecha_cierre = NOW(), 
          updated_at = NOW()
      WHERE asociado_id = v_asoc_id;
      
      -- 3. Inactivar créditos, dejarlos en 0 y registrar fecha de cambio de estado
      UPDATE creditos 
      SET estado = 'pagado', 
          saldo = 0, 
          fecha_estado_cambio = NOW(), 
          updated_at = NOW()
      WHERE asociado_id = v_asoc_id AND estado IN ('activo', 'desembolsado', 'en_mora');
    END IF;
    
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_liquidacion(UUID,JSONB,TEXT,BOOLEAN,TEXT,TEXT,TEXT) TO authenticated;

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
