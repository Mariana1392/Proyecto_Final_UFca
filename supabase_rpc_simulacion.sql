-- =============================================================================
-- UFCA — RPCs de Simulación de Crédito
--
-- El frontend (Creditos.tsx) llama estas dos funciones cuando el asociado
-- decide qué hacer con una simulación que el admin le envió:
--
--   confirmar_simulacion_credito → asociado acepta → estado pasa a 'pendiente'
--   rechazar_simulacion_credito  → asociado rechaza → simulación se elimina
--
-- FLUJO COMPLETO:
--   Admin crea simulación (estado='simulacion') y la envía al asociado
--   Asociado ve la tabla de amortización en su panel
--   Asociado confirma → estado='pendiente' → Admin la ve en bandeja de entrada
--   Asociado rechaza  → registro eliminado  → Admin recibe notificación
--
-- ✅ Seguro de ejecutar múltiples veces.
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================

DROP FUNCTION IF EXISTS confirmar_simulacion_credito(uuid);
DROP FUNCTION IF EXISTS rechazar_simulacion_credito(uuid);


-- =============================================================================
-- RPC 1 — confirmar_simulacion_credito
-- El asociado acepta la simulación → pasa a 'pendiente' para que el admin
-- la revise y desembolse.
-- =============================================================================

CREATE OR REPLACE FUNCTION confirmar_simulacion_credito(
  p_credito_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credito   RECORD;
  v_asociado  RECORD;
BEGIN

  -- ── Validar que el crédito existe y es una simulación ─────────────────────
  SELECT c.*, a.nombre AS nombre_asociado
  INTO   v_credito
  FROM   creditos  c
  JOIN   asociados a ON a.id = c.asociado_id
  WHERE  c.id     = p_credito_id
    AND  c.estado = 'simulacion'
    AND  c.anulado = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La simulación % no existe o ya fue procesada.', p_credito_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Cambiar estado a 'pendiente' ──────────────────────────────────────────
  UPDATE creditos SET
    estado               = 'pendiente',
    fecha_estado_cambio  = NOW(),
    motivo_estado_cambio = 'Crédito confirmado por el asociado — pendiente de revisión y desembolso',
    updated_at           = NOW()
  WHERE id = p_credito_id;

  -- ── Notificación al admin ─────────────────────────────────────────────────
  INSERT INTO notificaciones (
    titulo, mensaje, tipo, leida, para_admin
  ) VALUES (
    '✅ Nueva solicitud de crédito confirmada',
    v_credito.nombre_asociado || ' confirmó la simulación por $' ||
      TO_CHAR(v_credito.monto, 'FM999,999,999') ||
      ' a ' || v_credito.plazo_meses || ' meses. Estado: PENDIENTE de revisión.',
    'credito_pendiente',
    false,
    true
  );

  -- ── Notificación al asociado ──────────────────────────────────────────────
  INSERT INTO notificaciones (
    asociado_id, titulo, mensaje, tipo, leida, para_admin
  ) VALUES (
    v_credito.asociado_id,
    '📋 Tu solicitud de crédito fue enviada',
    'Tu solicitud de crédito por $' ||
      TO_CHAR(v_credito.monto, 'FM999,999,999') ||
      ' a ' || v_credito.plazo_meses ||
      ' meses está siendo revisada por el administrador.',
    'credito_pendiente',
    false,
    false
  );

  -- ── Auditoría ─────────────────────────────────────────────────────────────
  INSERT INTO auditoria (
    asociado_id, tabla, registro_id, accion, detalle
  ) VALUES (
    v_credito.asociado_id,
    'creditos',
    p_credito_id,
    'CONFIRMAR_SIMULACION',
    jsonb_build_object(
      'credito_id',  p_credito_id,
      'monto',       v_credito.monto,
      'plazo_meses', v_credito.plazo_meses,
      'estado_nuevo','pendiente',
      'fecha',       NOW()
    )
  );

END;
$$;


-- =============================================================================
-- RPC 2 — rechazar_simulacion_credito
-- El asociado rechaza la simulación → se elimina el registro.
-- =============================================================================

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

  -- ── Validar que el crédito existe y es una simulación ─────────────────────
  SELECT c.*, a.nombre AS nombre_asociado
  INTO   v_credito
  FROM   creditos  c
  JOIN   asociados a ON a.id = c.asociado_id
  WHERE  c.id     = p_credito_id
    AND  c.estado = 'simulacion'
    AND  c.anulado = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La simulación % no existe o ya fue procesada.', p_credito_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Notificar al admin ANTES de eliminar (necesitamos los datos) ──────────
  INSERT INTO notificaciones (
    titulo, mensaje, tipo, leida, para_admin
  ) VALUES (
    '❌ Simulación de crédito rechazada',
    v_credito.nombre_asociado || ' rechazó la simulación por $' ||
      TO_CHAR(v_credito.monto, 'FM999,999,999') ||
      ' a ' || v_credito.plazo_meses || ' meses.',
    'credito_rechazado',
    false,
    true
  );

  -- ── Auditoría ANTES de eliminar ───────────────────────────────────────────
  INSERT INTO auditoria (
    asociado_id, tabla, registro_id, accion, detalle
  ) VALUES (
    v_credito.asociado_id,
    'creditos',
    p_credito_id,
    'RECHAZAR_SIMULACION',
    jsonb_build_object(
      'credito_id',  p_credito_id,
      'monto',       v_credito.monto,
      'plazo_meses', v_credito.plazo_meses,
      'fecha',       NOW()
    )
  );

  -- ── Eliminar la simulación ────────────────────────────────────────────────
  DELETE FROM creditos
  WHERE id     = p_credito_id
    AND estado = 'simulacion';

END;
$$;


-- =============================================================================
-- PERMISOS
-- =============================================================================

GRANT EXECUTE ON FUNCTION confirmar_simulacion_credito(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rechazar_simulacion_credito(UUID)  TO authenticated;


-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================

SELECT
  routine_name  AS funcion,
  security_type AS seguridad
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'confirmar_simulacion_credito',
    'rechazar_simulacion_credito'
  )
ORDER BY routine_name;
