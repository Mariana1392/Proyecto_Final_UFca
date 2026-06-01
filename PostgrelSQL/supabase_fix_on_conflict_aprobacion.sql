-- =============================================================================
-- FIX DEFINITIVO: Error "there is no unique or exclusion constraint
--                 matching the ON CONFLICT specification"
--
-- Causa: la funcion aprobar_afiliacion usaba ON CONFLICT DO NOTHING en
--        cuentas_ahorro, pero esa tabla no tiene UNIQUE constraint.
--
-- Solucion: reemplazar ON CONFLICT con IF NOT EXISTS explícito
--           + agregar UNIQUE constraint para que futuros upserts funcionen.
--
-- Ejecutar en: Supabase -> SQL Editor -> Run
-- =============================================================================

-- ── 1. Agregar constraint unica en cuentas_ahorro (permanente por asociado) ──
--    Necesaria para evitar duplicados y para que ON CONFLICT funcione en el futuro.
ALTER TABLE cuentas_ahorro
  DROP CONSTRAINT IF EXISTS uq_cuentas_ahorro_asociado_permanente;

ALTER TABLE cuentas_ahorro
  ADD CONSTRAINT uq_cuentas_ahorro_asociado_permanente
  UNIQUE (asociado_id, tipo);

-- ── 2. Recrear aprobar_afiliacion sin ON CONFLICT ─────────────────────────────
DROP FUNCTION IF EXISTS aprobar_afiliacion(uuid, uuid, numeric);

CREATE OR REPLACE FUNCTION aprobar_afiliacion(
  p_solicitud_id UUID,
  p_admin_id     UUID,
  p_cuota_final  NUMERIC(15,2) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitud    RECORD;
  v_periodo_id   UUID;
  v_asociado_id  UUID;
  v_cuota        NUMERIC(15,2);
  v_cuota_minima NUMERIC(15,2);
  v_advertencias JSONB := '[]'::jsonb;
BEGIN

  -- PASO 1: Validar solicitud
  SELECT * INTO v_solicitud
  FROM   solicitudes_asociados
  WHERE  id     = p_solicitud_id
    AND  estado IN ('pendiente', 'pendiente_activacion');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud % no existe o ya fue procesada.', p_solicitud_id
      USING ERRCODE = 'P0001';
  END IF;

  -- PASO 2: Validar periodo activo
  SELECT id INTO v_periodo_id
  FROM   periodos
  WHERE  estado = 'activo'
  ORDER  BY fecha_inicio DESC
  LIMIT  1;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'No hay un período contable activo. Abra un período primero.'
      USING ERRCODE = 'P0002';
  END IF;

  -- PASO 3: Determinar cuota final
  SELECT valor::numeric INTO v_cuota_minima
  FROM   configuracion
  WHERE  clave = 'cuota_ahorro_permanente';

  v_cuota_minima := COALESCE(v_cuota_minima, 100000);

  v_cuota := COALESCE(
    p_cuota_final,
    v_solicitud.monto_ahorro_propuesto,
    v_cuota_minima
  );

  IF v_cuota < v_cuota_minima THEN
    v_advertencias := v_advertencias || jsonb_build_object(
      'tipo',    'CUOTA_BAJO_MINIMO',
      'mensaje', 'La cuota aprobada (' || v_cuota || ') es menor al mínimo del sistema (' || v_cuota_minima || ').'
    );
  END IF;

  IF v_solicitud.monto_ahorro_propuesto IS NULL THEN
    v_advertencias := v_advertencias || jsonb_build_object(
      'tipo',    'CUOTA_NO_PROPUESTA',
      'mensaje', 'El aspirante no especificó cuota. Se usó el valor por defecto.'
    );
  END IF;

  IF v_solicitud.ingreso_mensual IS NOT NULL
     AND v_solicitud.ingreso_mensual > 0
     AND v_cuota > (v_solicitud.ingreso_mensual * 0.30) THEN
    v_advertencias := v_advertencias || jsonb_build_object(
      'tipo',    'CUOTA_ALTO_VS_INGRESO',
      'mensaje', 'La cuota representa más del 30% del ingreso mensual declarado.'
    );
  END IF;

  -- PASO 4: Crear asociado o reutilizar si ya existe con esa cedula
  SELECT id INTO v_asociado_id
  FROM   asociados
  WHERE  cedula = v_solicitud.cedula
  LIMIT  1;

  IF v_asociado_id IS NULL THEN
    INSERT INTO asociados (
      nombre, cedula, telefono, email, direccion, ocupacion,
      estado, fecha_ingreso, periodo_ingreso_id
    ) VALUES (
      TRIM(v_solicitud.nombres || ' ' || v_solicitud.apellidos),
      v_solicitud.cedula,
      v_solicitud.telefono,
      v_solicitud.email,
      v_solicitud.direccion,
      v_solicitud.ocupacion,
      'activo',
      CURRENT_DATE,
      v_periodo_id
    )
    RETURNING id INTO v_asociado_id;
  END IF;

  -- PASO 5: Crear ahorro permanente SOLO si no existe uno activo
  --         (IF NOT EXISTS evita el error de ON CONFLICT sin constraint)
  IF NOT EXISTS (
    SELECT 1 FROM cuentas_ahorro
    WHERE  asociado_id = v_asociado_id
      AND  tipo        = 'permanente'
      AND  anulado     = false
  ) THEN
    INSERT INTO cuentas_ahorro (
      tipo, asociado_id, periodo_id,
      cuota_mensual, monto_ahorrado, estado, anulado
    ) VALUES (
      'permanente', v_asociado_id, v_periodo_id,
      v_cuota, 0, 'activo', false
    );
  END IF;

  -- PASO 6: Marcar solicitud como aprobada
  UPDATE solicitudes_asociados SET
    estado           = 'aprobada',
    aprobado_por     = p_admin_id,
    fecha_resolucion = NOW(),
    fecha_activacion = CURRENT_DATE
  WHERE id = p_solicitud_id;

  -- PASO 7: Cerrar comite evaluador
  UPDATE comite_evaluador SET
    decision   = 'aprobado',
    fecha      = NOW(),
    updated_at = NOW()
  WHERE solicitud_asociado_id = p_solicitud_id
    AND decision = 'en_evaluacion';

  -- PASO 8: Auditoria
  INSERT INTO auditoria (
    usuario_id, asociado_id, tabla, registro_id, accion, datos_despues
  ) VALUES (
    p_admin_id,
    v_asociado_id,
    'solicitudes_asociados',
    p_solicitud_id,
    'APROBAR_AFILIACION',
    jsonb_build_object(
      'asociado_id',          v_asociado_id,
      'solicitud_id',         p_solicitud_id,
      'periodo_id',           v_periodo_id,
      'cuota_propuesta',      v_solicitud.monto_ahorro_propuesto,
      'cuota_aprobada',       v_cuota,
      'cuota_minima_sistema', v_cuota_minima,
      'ingreso_declarado',    v_solicitud.ingreso_mensual,
      'advertencias',         v_advertencias,
      'fecha',                NOW()
    )
  );

  RETURN v_asociado_id;

END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION aprobar_afiliacion(UUID, UUID, NUMERIC) TO authenticated;

-- Verificacion
SELECT routine_name, data_type AS retorna
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'aprobar_afiliacion';
