-- =============================================================================
-- FIX FINAL COMPLETO v2 — Ejecutar ESTE script solamente
-- Cubre TODOS los errores pendientes en una sola ejecución.
--
-- Problemas que resuelve:
--   1. TRIGGER trg_crear_ahorro_permanente → hacía ON CONFLICT sin UNIQUE constraint
--      (causa raíz real del error "there is no unique or exclusion constraint")
--      También usaba "detalle" en auditoria (columna inexistente)
--   2. aprobar_afiliacion  → usaba tabla "ahorros_permanentes" + ON CONFLICT + "detalle"
--   3. rechazar_afiliacion → usaba "detalle" en auditoria
--   4. actualizar_liquidacion → función nunca creada (frontend la llama en 4 sitios)
--   5. columnas faltantes en liquidaciones (monto_total, asociado_id, tipo, fecha, detalle)
--   6. RPCs de liquidaciones apuntando a columnas inexistentes
--
-- Es IDEMPOTENTE — seguro de ejecutar múltiples veces.
-- Supabase → SQL Editor → pegar todo → Run
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 00: Columnas faltantes en solicitudes_asociados
-- CREATE TABLE IF NOT EXISTS no agrega columnas a una tabla ya existente.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE solicitudes_asociados
  ADD COLUMN IF NOT EXISTS aprobado_por      UUID        REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS fecha_resolucion  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_activacion  DATE,
  ADD COLUMN IF NOT EXISTS monto_ahorro_propuesto NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS observaciones     TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 0: Corregir trigger trg_crear_ahorro_permanente  ← CAUSA RAÍZ DEL ERROR
--
-- Este trigger se dispara AFTER INSERT en la tabla asociados.
-- Cuando aprobar_afiliacion crea el asociado (paso 4), el trigger
-- intenta hacer ON CONFLICT (asociado_id, periodo_id) en ahorros_permanentes
-- sin que esa tabla tenga ese UNIQUE constraint → error fatal.
--
-- Solución: reemplazar ON CONFLICT por IF NOT EXISTS, y usar cuentas_ahorro
-- (tabla actual) con fallback a ahorros_permanentes si existe.
-- También corregir auditoria: "detalle" → "datos_despues".
-- ─────────────────────────────────────────────────────────────────────────────

-- Eliminar el trigger roto (lo recreamos en seguida con la versión corregida)
DROP TRIGGER IF EXISTS trg_crear_ahorro_permanente ON asociados;

-- Reemplazar la función del trigger con versión corregida
CREATE OR REPLACE FUNCTION fn_crear_ahorro_permanente_inicial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_id    UUID;
  v_cuota_mensual NUMERIC(15,2);
BEGIN
  -- Obtener período activo
  SELECT id INTO v_periodo_id
  FROM   periodos
  WHERE  estado = 'activo'
  ORDER BY fecha_inicio DESC
  LIMIT  1;

  -- Sin período activo → registrar advertencia y continuar (no bloquear)
  IF v_periodo_id IS NULL THEN
    -- Intento silencioso de auditoría; si falla no bloqueamos el INSERT
    BEGIN
      INSERT INTO auditoria (tabla, registro_id, accion, datos_despues)
      VALUES (
        'asociados', NEW.id, 'ADVERTENCIA',
        jsonb_build_object(
          'mensaje',     'No se pudo crear ahorro permanente: no hay período activo',
          'asociado_id', NEW.id,
          'nombre',      NEW.nombre
        )
      );
    EXCEPTION WHEN others THEN NULL;
    END;
    RETURN NEW;
  END IF;

  -- Cuota desde configuración (fallback $100.000)
  SELECT valor::numeric INTO v_cuota_mensual
  FROM   configuracion
  WHERE  clave = 'cuota_ahorro_permanente';

  -- Crear ahorro permanente en cuentas_ahorro SOLO si no existe uno activo
  -- Usa IF NOT EXISTS en vez de ON CONFLICT para evitar requerir UNIQUE constraint
  IF NOT EXISTS (
    SELECT 1 FROM cuentas_ahorro
    WHERE  asociado_id = NEW.id
      AND  tipo        = 'permanente'
      AND  anulado     = false
  ) THEN
    INSERT INTO cuentas_ahorro (
      tipo, asociado_id, periodo_id, cuota_mensual, monto_ahorrado, estado, anulado
    ) VALUES (
      'permanente', NEW.id, v_periodo_id,
      COALESCE(v_cuota_mensual, 100000), 0, 'activo', false
    );
  END IF;

  RETURN NEW;

EXCEPTION WHEN others THEN
  -- El trigger NUNCA debe bloquear la inserción del asociado
  -- Si algo falla, lo ignoramos silenciosamente
  RETURN NEW;
END;
$$;

-- Recrear el trigger con la función corregida
CREATE TRIGGER trg_crear_ahorro_permanente
  AFTER INSERT ON asociados
  FOR EACH ROW
  EXECUTE FUNCTION fn_crear_ahorro_permanente_inicial();


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 1: Columnas faltantes en liquidaciones
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE liquidaciones
  ADD COLUMN IF NOT EXISTS asociado_id  UUID          REFERENCES asociados(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS tipo         TEXT          NOT NULL DEFAULT 'retiro'
                                                      CHECK (tipo IN ('retiro','cesantias','expulsion','fallecimiento','otro')),
  ADD COLUMN IF NOT EXISTS monto_total  DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha        DATE,
  ADD COLUMN IF NOT EXISTS detalle      JSONB         NOT NULL DEFAULT '{}'::jsonb;

-- Índices
CREATE INDEX IF NOT EXISTS idx_liq_asociado_id     ON liquidaciones (asociado_id);
CREATE INDEX IF NOT EXISTS idx_liq_tipo            ON liquidaciones (tipo);
CREATE INDEX IF NOT EXISTS idx_liq_fecha           ON liquidaciones (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_liq_created_at      ON liquidaciones (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liq_detalle_estado  ON liquidaciones ((detalle->>'estado'));
CREATE INDEX IF NOT EXISTS idx_liq_detalle_anulado ON liquidaciones ((detalle->>'anulado'));

-- RLS
ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'liquidaciones' AND policyname = 'Admin acceso total liquidaciones'
  ) THEN
    CREATE POLICY "Admin acceso total liquidaciones"
      ON liquidaciones FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Extensión trigrama (búsqueda rápida por nombre)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_asociados_nombre_trgm
  ON asociados USING gin (nombre gin_trgm_ops);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 2: UNIQUE constraint en cuentas_ahorro (necesario para evitar duplicados)
-- Se omite si ya existen duplicados (el IF NOT EXISTS en la función los maneja)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Solo agrega la constraint si no hay duplicados que la impidan
  IF NOT EXISTS (
    SELECT 1 FROM cuentas_ahorro
    GROUP BY asociado_id, tipo
    HAVING COUNT(*) > 1
  ) THEN
    BEGIN
      ALTER TABLE cuentas_ahorro
        DROP CONSTRAINT IF EXISTS uq_cuentas_ahorro_asociado_tipo;
      ALTER TABLE cuentas_ahorro
        ADD CONSTRAINT uq_cuentas_ahorro_asociado_tipo
        UNIQUE (asociado_id, tipo);
    EXCEPTION WHEN others THEN
      -- Si falla por cualquier razón, continuar (la función usa IF NOT EXISTS)
      RAISE NOTICE 'No se pudo agregar constraint UNIQUE en cuentas_ahorro: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Existen duplicados en cuentas_ahorro — se omite constraint UNIQUE (la función usa IF NOT EXISTS)';
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 3: aprobar_afiliacion  (versión definitiva y corregida)
-- ─────────────────────────────────────────────────────────────────────────────
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
  WHERE  id    = p_solicitud_id
    AND  estado IN ('pendiente', 'pendiente_activacion');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud % no existe o ya fue procesada.', p_solicitud_id
      USING ERRCODE = 'P0001';
  END IF;

  -- PASO 2: Validar período activo
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
      'mensaje', 'La cuota aprobada (' || v_cuota || ') es menor al mínimo (' || v_cuota_minima || ').'
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

  -- PASO 4: Crear asociado (o reutilizar si ya existe con esa cédula)
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
  -- Usa IF NOT EXISTS en lugar de ON CONFLICT (no requiere constraint UNIQUE)
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

  -- PASO 7: Cerrar comité evaluador
  UPDATE comite_evaluador SET
    decision   = 'aprobado',
    fecha      = NOW(),
    updated_at = NOW()
  WHERE solicitud_asociado_id = p_solicitud_id
    AND decision = 'en_evaluacion';

  -- PASO 8: Auditoría — usa datos_despues (columna correcta en la tabla auditoria)
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

GRANT EXECUTE ON FUNCTION aprobar_afiliacion(UUID, UUID, NUMERIC) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 4: rechazar_afiliacion  (corregida: usa datos_despues, no detalle)
-- ─────────────────────────────────────────────────────────────────────────────
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
  SELECT * INTO v_solicitud
  FROM   solicitudes_asociados
  WHERE  id    = p_solicitud_id
    AND  estado IN ('pendiente', 'pendiente_activacion');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud % no existe o ya fue procesada.', p_solicitud_id
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE solicitudes_asociados SET
    estado           = 'rechazada',
    aprobado_por     = p_admin_id,
    observaciones    = p_motivo,
    fecha_resolucion = NOW()
  WHERE id = p_solicitud_id;

  UPDATE comite_evaluador SET
    decision    = 'rechazado',
    observacion = p_motivo,
    fecha       = NOW(),
    updated_at  = NOW()
  WHERE solicitud_asociado_id = p_solicitud_id
    AND decision = 'en_evaluacion';

  -- Auditoría — columna correcta: datos_despues
  INSERT INTO auditoria (
    usuario_id, tabla, registro_id, accion, datos_despues
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

GRANT EXECUTE ON FUNCTION rechazar_afiliacion(UUID, UUID, TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 5: listar_liquidaciones  (con COALESCE para robustez)
-- ─────────────────────────────────────────────────────────────────────────────
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

GRANT EXECUTE ON FUNCTION public.listar_liquidaciones(INTEGER) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 6: buscar_liquidaciones
-- ─────────────────────────────────────────────────────────────────────────────
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

GRANT EXECUTE ON FUNCTION public.buscar_liquidaciones(UUID[],TEXT,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 7: insertar_liquidacion
-- ─────────────────────────────────────────────────────────────────────────────
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

GRANT EXECUTE ON FUNCTION public.insertar_liquidacion(UUID,DATE,NUMERIC,TEXT,JSONB) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 8: actualizar_liquidacion  ← NUEVA función que faltaba
-- El frontend la llama en 4 situaciones (documentos, estado, anulación)
-- Todos los parámetros son opcionales — solo actualiza los que se envían
-- ─────────────────────────────────────────────────────────────────────────────
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
BEGIN
  -- Leer detalle actual
  SELECT COALESCE(detalle, '{}'::jsonb) INTO v_detalle
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

  UPDATE liquidaciones
  SET    detalle    = v_detalle,
         updated_at = NOW()
  WHERE  id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_liquidacion(UUID,JSONB,TEXT,BOOLEAN,TEXT,TEXT,TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- FINAL: Recargar caché de PostgREST
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN — muestra las funciones creadas
-- ─────────────────────────────────────────────────────────────────────────────
SELECT routine_name, data_type AS retorna
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'aprobar_afiliacion',
    'rechazar_afiliacion',
    'listar_liquidaciones',
    'buscar_liquidaciones',
    'insertar_liquidacion',
    'actualizar_liquidacion'
  )
ORDER BY routine_name;
