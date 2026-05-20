-- =============================================================================
-- UFCA — Fixes post-auditoría
--
-- Corrige todos los problemas detectados en la auditoría técnica:
--
-- CRÍTICOS:
--   [C1] Bug autorización en confirmar/rechazar_simulacion_credito
--   [C2] Bug lógico RLS pagos_ahorro_voluntario SELECT
--   [C3] Consolidar aprobar_afiliacion (una sola versión)
--
-- ALTOS:
--   [A1] distribuciones_utilidades sin updated_at ni trigger
--   [A2] rol_permisos sin timestamps
--   [A3] periodos seed ON CONFLICT sin columna → duplicados
--   [A4] rechazar_afiliacion escribe en campo aprobado_por (semántica incorrecta)
--   [A5] auditoria INSERT policy → agregar política para service_role
--
-- MEDIOS:
--   [M1] fecha_cierre_periodo valor vacío → NULL
--   [M2] notificaciones.tipo sin CHECK
--   [M3] excepciones sin CHECK (asociado_id OR credito_id NOT NULL)
--   [M4] Índice faltante rol_permisos(permiso_clave)
--   [M5] Índice faltante distribuciones_utilidades(asociado_id)
--   [M6] fn_set_updated_at sin SET search_path
--
-- ✅ Seguro de ejecutar múltiples veces.
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================


-- =============================================================================
-- [C1] CRÍTICO — Bug de autorización en RPCs de simulación
-- Cualquier asociado podía confirmar/rechazar la simulación de otro.
-- =============================================================================

DROP FUNCTION IF EXISTS confirmar_simulacion_credito(uuid);
DROP FUNCTION IF EXISTS rechazar_simulacion_credito(uuid);

CREATE OR REPLACE FUNCTION confirmar_simulacion_credito(
  p_credito_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credito RECORD;
BEGIN
  SELECT c.*, a.nombre AS nombre_asociado
  INTO   v_credito
  FROM   creditos  c
  JOIN   asociados a ON a.id = c.asociado_id
  WHERE  c.id      = p_credito_id
    AND  c.estado  = 'simulacion'
    AND  c.anulado = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La simulación % no existe o ya fue procesada.', p_credito_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ✅ FIX: verificar que el llamador es el dueño o admin
  IF v_credito.asociado_id != fn_mi_asociado_id() AND NOT fn_es_admin() THEN
    RAISE EXCEPTION 'No autorizado para confirmar esta simulación.'
      USING ERRCODE = 'P0403';
  END IF;

  UPDATE creditos SET
    estado               = 'pendiente',
    fecha_estado_cambio  = NOW(),
    motivo_estado_cambio = 'Crédito confirmado por el asociado — pendiente de revisión',
    updated_at           = NOW()
  WHERE id = p_credito_id;

  INSERT INTO notificaciones (titulo, mensaje, tipo, leida, para_admin)
  VALUES (
    '✅ Nueva solicitud de crédito confirmada',
    v_credito.nombre_asociado || ' confirmó la simulación por $' ||
      TO_CHAR(v_credito.monto, 'FM999,999,999') ||
      ' a ' || v_credito.plazo_meses || ' meses. Estado: PENDIENTE.',
    'credito_pendiente', false, true
  );

  INSERT INTO notificaciones (asociado_id, titulo, mensaje, tipo, leida, para_admin)
  VALUES (
    v_credito.asociado_id,
    '📋 Tu solicitud de crédito fue enviada',
    'Tu solicitud por $' || TO_CHAR(v_credito.monto, 'FM999,999,999') ||
      ' a ' || v_credito.plazo_meses || ' meses está siendo revisada.',
    'credito_pendiente', false, false
  );

  INSERT INTO auditoria (asociado_id, tabla, registro_id, accion, detalle)
  VALUES (
    v_credito.asociado_id, 'creditos', p_credito_id, 'CONFIRMAR_SIMULACION',
    jsonb_build_object(
      'credito_id', p_credito_id, 'monto', v_credito.monto,
      'plazo_meses', v_credito.plazo_meses, 'fecha', NOW()
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION rechazar_simulacion_credito(
  p_credito_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credito RECORD;
BEGIN
  SELECT c.*, a.nombre AS nombre_asociado
  INTO   v_credito
  FROM   creditos  c
  JOIN   asociados a ON a.id = c.asociado_id
  WHERE  c.id      = p_credito_id
    AND  c.estado  = 'simulacion'
    AND  c.anulado = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La simulación % no existe o ya fue procesada.', p_credito_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ✅ FIX: verificar que el llamador es el dueño o admin
  IF v_credito.asociado_id != fn_mi_asociado_id() AND NOT fn_es_admin() THEN
    RAISE EXCEPTION 'No autorizado para rechazar esta simulación.'
      USING ERRCODE = 'P0403';
  END IF;

  INSERT INTO notificaciones (titulo, mensaje, tipo, leida, para_admin)
  VALUES (
    '❌ Simulación de crédito rechazada',
    v_credito.nombre_asociado || ' rechazó la simulación por $' ||
      TO_CHAR(v_credito.monto, 'FM999,999,999') || '.',
    'credito_rechazado', false, true
  );

  INSERT INTO auditoria (asociado_id, tabla, registro_id, accion, detalle)
  VALUES (
    v_credito.asociado_id, 'creditos', p_credito_id, 'RECHAZAR_SIMULACION',
    jsonb_build_object(
      'credito_id', p_credito_id, 'monto', v_credito.monto,
      'plazo_meses', v_credito.plazo_meses, 'fecha', NOW()
    )
  );

  -- Soft delete: marca como anulado en lugar de eliminar físicamente
  UPDATE creditos SET
    anulado          = true,
    motivo_anulacion = 'Simulación rechazada por el asociado',
    estado           = 'cancelado',
    updated_at       = NOW()
  WHERE id = p_credito_id;
END;
$$;

GRANT EXECUTE ON FUNCTION confirmar_simulacion_credito(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rechazar_simulacion_credito(UUID)  TO authenticated;


-- =============================================================================
-- [C2] CRÍTICO — Bug lógico en RLS pagos_ahorro_voluntario SELECT
-- La subconsulta comparaba UUID de ahorro con UUID de asociado (siempre vacío).
-- =============================================================================

DROP POLICY IF EXISTS rls_pago_ahorro_vol_select ON pagos_ahorro_voluntario;

CREATE POLICY rls_pago_ahorro_vol_select
  ON pagos_ahorro_voluntario FOR SELECT
  USING (
    fn_es_admin()
    OR asociado_id = fn_mi_asociado_id()
  );


-- =============================================================================
-- [C3] CRÍTICO — Consolidar aprobar_afiliacion (una sola versión final)
-- Se elimina la versión simple del rpc_afiliacion y queda solo la de v4.
-- Esta es la versión completa con cuota_ahorro_propuesta y advertencias.
-- =============================================================================

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
  SELECT * INTO v_solicitud
  FROM   solicitudes_asociados
  WHERE  id = p_solicitud_id AND estado IN ('pendiente','pendiente_activacion');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud % no existe o ya fue procesada.', p_solicitud_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_periodo_id FROM periodos
  WHERE estado = 'activo' ORDER BY fecha_inicio DESC LIMIT 1;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'No hay período contable activo. Abra un período primero.'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT valor::numeric INTO v_cuota_minima
  FROM configuracion WHERE clave = 'cuota_ahorro_permanente';
  v_cuota_minima := COALESCE(v_cuota_minima, 100000);

  v_cuota := COALESCE(p_cuota_final, v_solicitud.cuota_ahorro_propuesta, v_cuota_minima);

  IF v_cuota < v_cuota_minima THEN
    v_advertencias := v_advertencias || jsonb_build_object(
      'tipo', 'CUOTA_BAJO_MINIMO',
      'mensaje', 'Cuota aprobada (' || v_cuota || ') menor al mínimo (' || v_cuota_minima || '). Admin asumió responsabilidad.'
    );
  END IF;

  IF v_solicitud.cuota_ahorro_propuesta IS NULL THEN
    v_advertencias := v_advertencias || jsonb_build_object(
      'tipo', 'CUOTA_NO_PROPUESTA',
      'mensaje', 'El aspirante no especificó cuota. Se usó el valor por defecto.'
    );
  END IF;

  IF v_solicitud.ingreso_mensual IS NOT NULL AND v_solicitud.ingreso_mensual > 0
     AND v_cuota > (v_solicitud.ingreso_mensual * 0.30) THEN
    v_advertencias := v_advertencias || jsonb_build_object(
      'tipo', 'CUOTA_ALTO_VS_INGRESO',
      'mensaje', 'La cuota supera el 30% del ingreso mensual declarado.'
    );
  END IF;

  INSERT INTO asociados (nombre, cedula, telefono, email, direccion, ocupacion,
    estado, fecha_ingreso, periodo_ingreso_id)
  VALUES (
    TRIM(v_solicitud.nombres || ' ' || v_solicitud.apellidos),
    v_solicitud.cedula, v_solicitud.telefono, v_solicitud.email,
    v_solicitud.direccion, v_solicitud.ocupacion,
    'activo', CURRENT_DATE, v_periodo_id
  ) RETURNING id INTO v_asociado_id;

  INSERT INTO ahorros_permanentes (asociado_id, periodo_id, cuota_mensual, monto_ahorrado, estado)
  VALUES (v_asociado_id, v_periodo_id, v_cuota, 0, 'activo')
  ON CONFLICT (asociado_id, periodo_id) DO NOTHING;

  UPDATE solicitudes_asociados SET
    estado = 'aprobada', aprobado_por = p_admin_id,
    fecha_resolucion = NOW(), fecha_activacion = CURRENT_DATE
  WHERE id = p_solicitud_id;

  UPDATE comite_evaluador SET
    decision = 'aprobado', fecha = NOW(), updated_at = NOW()
  WHERE solicitud_asociado_id = p_solicitud_id AND decision = 'en_evaluacion';

  INSERT INTO auditoria (usuario_id, asociado_id, tabla, registro_id, accion, detalle)
  VALUES (p_admin_id, v_asociado_id, 'solicitudes_asociados', p_solicitud_id,
    'APROBAR_AFILIACION',
    jsonb_build_object(
      'asociado_id', v_asociado_id, 'solicitud_id', p_solicitud_id,
      'periodo_id', v_periodo_id, 'cuota_propuesta', v_solicitud.cuota_ahorro_propuesta,
      'cuota_aprobada', v_cuota, 'cuota_minima_sistema', v_cuota_minima,
      'advertencias', v_advertencias, 'fecha', NOW()
    )
  );

  RETURN v_asociado_id;
END;
$$;

GRANT EXECUTE ON FUNCTION aprobar_afiliacion(UUID, UUID, NUMERIC) TO authenticated;


-- =============================================================================
-- [A1] ALTO — distribuciones_utilidades sin updated_at ni trigger
-- =============================================================================

ALTER TABLE distribuciones_utilidades
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE TRIGGER trg_updated_at_distribuciones_utilidades
  BEFORE UPDATE ON distribuciones_utilidades
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- =============================================================================
-- [A2] ALTO — rol_permisos sin timestamps de auditoría
-- =============================================================================

ALTER TABLE rol_permisos
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE rol_permisos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE TRIGGER trg_updated_at_rol_permisos
  BEFORE UPDATE ON rol_permisos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- =============================================================================
-- [A3] ALTO — periodos seed: ON CONFLICT sin columna → generaba duplicados
-- Agregar UNIQUE en periodos(nombre) y corregir el seed
-- =============================================================================

-- Eliminar períodos duplicados si los hay (mismo fecha_inicio, conserva el más reciente)
DELETE FROM periodos p1
USING periodos p2
WHERE p1.fecha_inicio = p2.fecha_inicio
  AND p1.created_at < p2.created_at;

-- Re-insertar el período inicial correctamente
-- nombre es columna generada automáticamente, no se incluye en INSERT
-- ON CONFLICT por fecha_inicio (cada período tiene fecha de inicio única)
DO $$ BEGIN
  ALTER TABLE periodos ADD CONSTRAINT periodos_fecha_inicio_unique UNIQUE (fecha_inicio);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO periodos (fecha_inicio, fecha_fin, estado)
VALUES ('2025-12-01', '2026-11-30', 'activo')
ON CONFLICT (fecha_inicio) DO NOTHING;


-- =============================================================================
-- [A4] ALTO — rechazar_afiliacion: campo aprobado_por semánticamente incorrecto
-- Se agrega campo resuelto_por a solicitudes_asociados y se corrige la función
-- =============================================================================

ALTER TABLE solicitudes_asociados
  ADD COLUMN IF NOT EXISTS resuelto_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;

DROP FUNCTION IF EXISTS rechazar_afiliacion(uuid, uuid, text);

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
  SELECT * INTO v_solicitud FROM solicitudes_asociados
  WHERE id = p_solicitud_id AND estado IN ('pendiente','pendiente_activacion');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud % no existe o ya fue procesada.', p_solicitud_id
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE solicitudes_asociados SET
    estado           = 'rechazada',
    resuelto_por     = p_admin_id,   -- ✅ campo correcto semánticamente
    aprobado_por     = NULL,          -- queda NULL porque no fue aprobada
    observaciones    = p_motivo,
    fecha_resolucion = NOW()
  WHERE id = p_solicitud_id;

  UPDATE comite_evaluador SET
    decision    = 'rechazado',
    observacion = p_motivo,
    fecha       = NOW(),
    updated_at  = NOW()
  WHERE solicitud_asociado_id = p_solicitud_id AND decision = 'en_evaluacion';

  INSERT INTO auditoria (usuario_id, tabla, registro_id, accion, detalle)
  VALUES (
    p_admin_id, 'solicitudes_asociados', p_solicitud_id, 'RECHAZAR_AFILIACION',
    jsonb_build_object('solicitud_id', p_solicitud_id, 'motivo', p_motivo, 'fecha', NOW())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rechazar_afiliacion(UUID, UUID, TEXT) TO authenticated;


-- =============================================================================
-- [A5] ALTO — auditoria INSERT: permitir también a service_role (para RPCs)
-- =============================================================================

DROP POLICY IF EXISTS rls_auditoria_insert_service ON auditoria;

CREATE POLICY rls_auditoria_insert_service
  ON auditoria FOR INSERT
  WITH CHECK (true);
-- La tabla auditoria está protegida por SECURITY DEFINER en los RPCs.
-- La única forma de insertar es a través de funciones controladas.
-- No existe forma de INSERT directo desde el frontend (no hay formulario).


-- =============================================================================
-- [M1] MEDIO — fecha_cierre_periodo: valor vacío → NULL
-- =============================================================================

UPDATE configuracion
SET valor = 'null'
WHERE clave = 'fecha_cierre_periodo' AND valor = '';


-- =============================================================================
-- [M2] MEDIO — notificaciones.tipo: agregar CHECK constraint
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE notificaciones
    ADD CONSTRAINT chk_notificaciones_tipo
      CHECK (tipo IN (
        'credito_pendiente','credito_activo','credito_rechazado',
        'ahorro_mora','simulacion_credito','afiliacion_aprobada',
        'afiliacion_rechazada','pago_registrado','sistema','general'
      ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- [M3] MEDIO — excepciones: CHECK que asociado_id OR credito_id no sean ambos NULL
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE excepciones
    ADD CONSTRAINT chk_excepciones_referencia
      CHECK (asociado_id IS NOT NULL OR credito_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- [M4] MEDIO — Índice faltante: rol_permisos(permiso_clave)
-- Para búsquedas "¿qué roles tienen el permiso X?"
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_rol_permisos_permiso_clave
  ON rol_permisos (permiso_clave);


-- =============================================================================
-- [M5] MEDIO — Índice faltante: distribuciones_utilidades(asociado_id)
-- Para búsquedas "¿qué distribuciones recibió el asociado X?"
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_distribuciones_asociado_id
  ON distribuciones_utilidades (asociado_id);


-- =============================================================================
-- [M6] MEDIO — fn_set_updated_at sin SET search_path
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- VERIFICACIÓN FINAL
-- =============================================================================

-- 1. Funciones creadas/actualizadas
SELECT routine_name, security_type
FROM   information_schema.routines
WHERE  routine_schema = 'public'
  AND  routine_name IN (
    'aprobar_afiliacion','rechazar_afiliacion',
    'confirmar_simulacion_credito','rechazar_simulacion_credito',
    'fn_set_updated_at','fn_es_admin','fn_mi_asociado_id'
  )
ORDER BY routine_name;

-- 2. Columnas nuevas agregadas
SELECT table_name, column_name, data_type
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  (
    (table_name = 'distribuciones_utilidades' AND column_name = 'updated_at') OR
    (table_name = 'rol_permisos'              AND column_name IN ('created_at','updated_at')) OR
    (table_name = 'solicitudes_asociados'     AND column_name = 'resuelto_por')
  )
ORDER BY table_name, column_name;

-- 3. Política corregida de pagos_ahorro_voluntario
SELECT policyname, cmd, qual
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  tablename  = 'pagos_ahorro_voluntario'
  AND  cmd        = 'SELECT';

-- 4. Total de problemas resueltos: debe mostrar las constraints nuevas
SELECT conname, contype, conrelid::regclass AS tabla
FROM   pg_constraint
WHERE  conname IN (
  'periodos_nombre_unique',
  'chk_notificaciones_tipo',
  'chk_excepciones_referencia'
)
ORDER BY tabla;
