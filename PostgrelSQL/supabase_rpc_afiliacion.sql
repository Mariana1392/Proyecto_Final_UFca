-- =============================================================================
-- UFCA — RPC: aprobar_afiliacion
--
-- Función atómica que ejecuta en UNA SOLA TRANSACCIÓN:
--   1. Valida que la solicitud exista y esté pendiente
--   2. Valida que haya un período contable activo
--   3. Crea el registro en asociados
--   4. Crea el ahorro permanente obligatorio (regla de negocio inquebrantable)
--   5. Actualiza la solicitud a 'aprobada'
--   6. Cierra el registro del comité evaluador
--   7. Registra en auditoría
--
-- Si CUALQUIER paso falla → TODO se revierte. Imposible dejar datos a medias.
--
-- Uso desde el frontend (Supabase JS):
--   const { data, error } = await supabase.rpc('aprobar_afiliacion', {
--     p_solicitud_id: '...',
--     p_admin_id: '...',
--     p_cuota_final: 100000   ← opcional, toma de configuracion si no se envía
--   });
--   → data = UUID del nuevo asociado
--
-- ✅ Seguro de ejecutar múltiples veces.
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================

-- DROP previo: evita error si el nombre de parámetros cambió
DROP FUNCTION IF EXISTS aprobar_afiliacion(uuid, uuid, numeric);

CREATE OR REPLACE FUNCTION aprobar_afiliacion(
  p_solicitud_id UUID,
  p_admin_id     UUID,
  p_cuota_final  NUMERIC(15,2) DEFAULT NULL  -- Si es NULL, toma de configuracion
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitud         RECORD;
  v_periodo_id        UUID;
  v_asociado_id       UUID;
  v_cuota             NUMERIC(15,2);
BEGIN

  -- ── PASO 1: Validar que la solicitud existe y está en estado correcto ────────
  SELECT * INTO v_solicitud
  FROM   solicitudes_asociados
  WHERE  id     = p_solicitud_id
    AND  estado IN ('pendiente', 'pendiente_activacion');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud % no existe o ya fue procesada.', p_solicitud_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ── PASO 2: Validar que hay período contable activo ──────────────────────────
  SELECT id INTO v_periodo_id
  FROM   periodos
  WHERE  estado = 'activo'
  ORDER  BY fecha_inicio DESC
  LIMIT  1;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'No hay un período contable activo. Debe abrir un período primero.'
      USING ERRCODE = 'P0002';
  END IF;

  -- ── PASO 3: Determinar cuota mensual ─────────────────────────────────────────
  -- Prioridad: parámetro recibido → configuracion → fallback $100.000
  IF p_cuota_final IS NOT NULL THEN
    v_cuota := p_cuota_final;
  ELSE
    SELECT valor::numeric INTO v_cuota
    FROM   configuracion
    WHERE  clave = 'cuota_ahorro_permanente';

    v_cuota := COALESCE(v_cuota, 100000);
  END IF;

  -- ── PASO 4: Crear el asociado ─────────────────────────────────────────────────
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

  -- ── PASO 5: 🚨 REGLA INQUEBRANTABLE — Crear ahorro permanente ─────────────────
  -- El trigger trg_crear_ahorro_permanente también lo intentará,
  -- pero el ON CONFLICT DO NOTHING evita duplicados.
  -- Este INSERT explícito garantiza que ocurra DENTRO de esta transacción.
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

  -- ── PASO 6: Marcar la solicitud como aprobada ─────────────────────────────────
  UPDATE solicitudes_asociados SET
    estado           = 'aprobada',
    aprobado_por     = p_admin_id,
    fecha_resolucion = NOW(),
    fecha_activacion = CURRENT_DATE
  WHERE id = p_solicitud_id;

  -- ── PASO 7: Cerrar el registro del comité evaluador ───────────────────────────
  UPDATE comite_evaluador SET
    decision   = 'aprobado',
    fecha      = NOW(),
    updated_at = NOW()
  WHERE solicitud_asociado_id = p_solicitud_id
    AND decision = 'en_evaluacion';
  -- Si no existe registro en comite o ya estaba resuelto, no falla

  -- ── PASO 8: Registrar en auditoría ───────────────────────────────────────────
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
      'asociado_id',    v_asociado_id,
      'solicitud_id',   p_solicitud_id,
      'periodo_id',     v_periodo_id,
      'cuota_mensual',  v_cuota,
      'fecha',          NOW()
    )
  );

  -- Retornar el UUID del nuevo asociado al frontend
  RETURN v_asociado_id;

END;
$$;


-- =============================================================================
-- RPC COMPLEMENTARIA: rechazar_afiliacion
--
-- Cierra la solicitud como rechazada de forma atómica.
-- Uso:
--   await supabase.rpc('rechazar_afiliacion', {
--     p_solicitud_id: '...',
--     p_admin_id: '...',
--     p_motivo: 'No cumple requisitos de ingresos'
--   });
-- =============================================================================

CREATE OR REPLACE FUNCTION rechazar_afiliacion(
  p_solicitud_id UUID,
  p_admin_id     UUID,
  p_motivo       TEXT DEFAULT 'Solicitud rechazada por el comité evaluador'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitud RECORD;
BEGIN

  -- Validar que la solicitud existe y está pendiente
  SELECT * INTO v_solicitud
  FROM   solicitudes_asociados
  WHERE  id     = p_solicitud_id
    AND  estado IN ('pendiente', 'pendiente_activacion');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud % no existe o ya fue procesada.', p_solicitud_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Marcar solicitud como rechazada
  UPDATE solicitudes_asociados SET
    estado           = 'rechazada',
    aprobado_por     = p_admin_id,
    observaciones    = p_motivo,
    fecha_resolucion = NOW()
  WHERE id = p_solicitud_id;

  -- Cerrar comité evaluador
  UPDATE comite_evaluador SET
    decision    = 'rechazado',
    observacion = p_motivo,
    fecha       = NOW(),
    updated_at  = NOW()
  WHERE solicitud_asociado_id = p_solicitud_id
    AND decision = 'en_evaluacion';

  -- Auditoría
  INSERT INTO auditoria (
    usuario_id,
    tabla,
    registro_id,
    accion,
    detalle
  ) VALUES (
    p_admin_id,
    'solicitudes_asociados',
    p_solicitud_id,
    'RECHAZAR_AFILIACION',
    jsonb_build_object(
      'solicitud_id', p_solicitud_id,
      'motivo',       p_motivo,
      'fecha',        NOW()
    )
  );

END;
$$;


-- =============================================================================
-- PERMISOS: permitir que el frontend autenticado llame estas RPCs
-- =============================================================================

GRANT EXECUTE ON FUNCTION aprobar_afiliacion(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION rechazar_afiliacion(UUID, UUID, TEXT)    TO authenticated;


-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================

SELECT
  routine_name          AS funcion,
  routine_type          AS tipo,
  security_type         AS seguridad,
  data_type             AS retorna
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('aprobar_afiliacion', 'rechazar_afiliacion')
ORDER BY routine_name;
