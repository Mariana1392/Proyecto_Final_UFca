-- =============================================================================
-- UFCA — Mejoras v4
--
-- Contenido:
--   1. Agregar cuota_ahorro_propuesta a solicitudes_asociados
--   2. Actualizar RPC aprobar_afiliacion para usar ese monto
--
-- FLUJO COMPLETO:
--   Aspirante llena formulario → declara cuánto quiere ahorrar mensualmente
--   Admin revisa en comité evaluador → ve el monto propuesto + advertencias
--   Admin decide el monto final (criterio propio, sin restricciones automáticas)
--   Admin aprueba → RPC crea asociado + ahorro con el monto que el admin apruebe
--
-- FILOSOFÍA:
--   El sistema INFORMA, el admin DECIDE.
--   Las advertencias son solo visuales en el frontend, nunca bloquean.
--
-- ✅ Seguro de ejecutar múltiples veces.
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================

-- DROP previo necesario: PostgreSQL no permite cambiar nombres de parámetros
-- con CREATE OR REPLACE. Se elimina y recrea limpio.
DROP FUNCTION IF EXISTS aprobar_afiliacion(uuid, uuid, numeric);


-- =============================================================================
-- PASO 1 — Agregar campo a solicitudes_asociados
-- =============================================================================

ALTER TABLE solicitudes_asociados
  ADD COLUMN IF NOT EXISTS cuota_ahorro_propuesta NUMERIC(15,2);

-- Comentario descriptivo
COMMENT ON COLUMN solicitudes_asociados.cuota_ahorro_propuesta IS
  'Monto mensual que el aspirante propone ahorrar. '
  'El comité lo evalúa. Al aprobar, se usa como cuota del ahorro permanente. '
  'Si es NULL o 0, se toma el mínimo de configuracion.cuota_ahorro_permanente.';


-- =============================================================================
-- PASO 2 — Actualizar RPC aprobar_afiliacion
--
-- PRIORIDAD del monto:
--   1. p_cuota_override (admin puede corregir el monto al aprobar)
--   2. solicitud.cuota_ahorro_propuesta (lo que pidió el asociado)
--   3. configuracion.cuota_ahorro_permanente (mínimo del sistema)
-- =============================================================================

CREATE OR REPLACE FUNCTION aprobar_afiliacion(
  p_solicitud_id UUID,
  p_admin_id     UUID,
  p_cuota_final  NUMERIC(15,2) DEFAULT NULL
  -- El admin envía el monto que decidió aprobar.
  -- Si no lo envía, se usa la propuesta del asociado.
  -- Si tampoco hay propuesta, se usa el mínimo del sistema como fallback.
  -- El sistema NUNCA bloquea por el monto — solo informa en auditoría.
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

  -- ── PASO 1: Validar solicitud ─────────────────────────────────────────────
  SELECT * INTO v_solicitud
  FROM   solicitudes_asociados
  WHERE  id     = p_solicitud_id
    AND  estado IN ('pendiente', 'pendiente_activacion');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud % no existe o ya fue procesada.', p_solicitud_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ── PASO 2: Validar período activo ────────────────────────────────────────
  SELECT id INTO v_periodo_id
  FROM   periodos
  WHERE  estado = 'activo'
  ORDER  BY fecha_inicio DESC
  LIMIT  1;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'No hay un período contable activo. Abra un período primero.'
      USING ERRCODE = 'P0002';
  END IF;

  -- ── PASO 3: Determinar cuota final — criterio del administrador ───────────
  -- Leer referencia mínima del sistema (solo para advertencias, no para bloquear)
  SELECT valor::numeric INTO v_cuota_minima
  FROM   configuracion
  WHERE  clave = 'cuota_ahorro_permanente';

  v_cuota_minima := COALESCE(v_cuota_minima, 100000);

  -- Determinar cuota: lo que el admin decidió → propuesta del asociado → mínimo
  v_cuota := COALESCE(
    p_cuota_final,                        -- 1. Decisión del admin
    v_solicitud.cuota_ahorro_propuesta,   -- 2. Propuesta del asociado
    v_cuota_minima                        -- 3. Fallback: mínimo del sistema
  );

  -- Registrar advertencias informativas (NO bloquean, solo quedan en auditoría)
  IF v_cuota < v_cuota_minima THEN
    v_advertencias := v_advertencias || jsonb_build_object(
      'tipo',    'CUOTA_BAJO_MINIMO',
      'mensaje', 'La cuota aprobada (' || v_cuota || ') es menor al mínimo del sistema (' || v_cuota_minima || '). El administrador asumió la responsabilidad.'
    );
  END IF;

  IF v_solicitud.cuota_ahorro_propuesta IS NULL THEN
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
      'mensaje', 'La cuota representa más del 30% del ingreso mensual declarado (' || v_solicitud.ingreso_mensual || ').'
    );
  END IF;

  -- ── PASO 4: Crear el asociado ─────────────────────────────────────────────
  INSERT INTO asociados (
    nombre,
    cedula,
    telefono,
    email,
    direccion,
    ocupacion,
    estado,
    fecha_ingreso,
    periodo_ingreso_id
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

  -- ── PASO 5: Crear ahorro permanente con el monto aprobado ─────────────────
  INSERT INTO ahorros_permanentes (
    asociado_id,
    periodo_id,
    cuota_mensual,
    monto_ahorrado,
    estado
  ) VALUES (
    v_asociado_id,
    v_periodo_id,
    v_cuota,
    0,
    'activo'
  )
  ON CONFLICT (asociado_id, periodo_id) DO NOTHING;

  -- ── PASO 6: Marcar solicitud como aprobada ────────────────────────────────
  UPDATE solicitudes_asociados SET
    estado           = 'aprobada',
    aprobado_por     = p_admin_id,
    fecha_resolucion = NOW(),
    fecha_activacion = CURRENT_DATE
  WHERE id = p_solicitud_id;

  -- ── PASO 7: Cerrar comité evaluador ───────────────────────────────────────
  UPDATE comite_evaluador SET
    decision   = 'aprobado',
    fecha      = NOW(),
    updated_at = NOW()
  WHERE solicitud_asociado_id = p_solicitud_id
    AND decision = 'en_evaluacion';

  -- ── PASO 8: Auditoría (incluye advertencias informativas) ────────────────
  INSERT INTO auditoria (
    usuario_id,
    asociado_id,
    tabla,
    registro_id,
    accion,
    detalle
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
      'cuota_propuesta',      v_solicitud.cuota_ahorro_propuesta,
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

-- =============================================================================
-- ADVERTENCIAS QUE VE EL ADMIN EN EL FRONTEND (ComiteEvaluador.tsx)
--
-- El frontend debe mostrar estos avisos ANTES de que el admin apruebe,
-- pero NO debe bloquear el botón de aprobación.
--
-- Lógica sugerida en TypeScript:
--
-- const advertencias = [];
--
-- if (!solicitud.cuota_ahorro_propuesta) {
--   advertencias.push({
--     tipo: 'warning',
--     mensaje: 'El aspirante no indicó cuánto desea ahorrar. Se usará el mínimo del sistema.'
--   });
-- }
--
-- if (solicitud.cuota_ahorro_propuesta < cuotaMinimaConfig) {
--   advertencias.push({
--     tipo: 'warning',
--     mensaje: `La cuota propuesta ($${cuota}) es menor al mínimo del sistema ($${cuotaMinima}).`
--   });
-- }
--
-- if (solicitud.ingreso_mensual > 0 &&
--     solicitud.cuota_ahorro_propuesta > solicitud.ingreso_mensual * 0.30) {
--   advertencias.push({
--     tipo: 'warning',
--     mensaje: `La cuota representa más del 30% del ingreso declarado. Verifique la capacidad de pago.`
--   });
-- }
--
-- // El admin ve las advertencias y decide.
-- // El campo de cuota es editable — admin puede cambiarla antes de aprobar.
-- =============================================================================


-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================

-- 1. El campo existe en la tabla
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'solicitudes_asociados'
  AND  column_name  = 'cuota_ahorro_propuesta';

-- 2. La función fue actualizada
SELECT routine_name, security_type
FROM   information_schema.routines
WHERE  routine_schema = 'public'
  AND  routine_name   = 'aprobar_afiliacion';
