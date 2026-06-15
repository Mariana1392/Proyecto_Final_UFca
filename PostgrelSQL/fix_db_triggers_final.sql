-- =============================================================================
-- SCRIPT FINAL DE CORRECCIÓN DE TRIGGERS Y LIMPIEZA - UFCA
--
-- Ejecutar en: Supabase → SQL Editor → Run
--
-- Corrige los siguientes bugs:
--  1. trg_activar_asociado_por_pago:
--     - Corrige la validación de tipo ('aporte_permanente' en vez de 'aporte').
--     - Corrige la columna inexsistente 'cuenta_id' a 'ahorro_id'.
--     - Activa automáticamente la cuenta del usuario ('activo' y activo=true).
--  2. tg_activar_cuenta_primer_pago:
--     - Corrige la verificación de estado 'suspendido' para que lea usuarios.estado_cuenta
--       en lugar de cuentas_ahorro.estado (que solo permite activo/inactivo).
--  3. Limpieza de triggers actualizadores updated_at redundantes.
-- =============================================================================

BEGIN;

-- ── 1. CORRECCIÓN: Trigger trg_activar_asociado_por_pago ──────────────────────

CREATE OR REPLACE FUNCTION public.fn_activar_asociado_por_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asociado_id UUID;
  v_tipo_cuenta TEXT;
BEGIN
  -- Solo nos interesan los aportes permanentes
  IF NEW.tipo != 'aporte_permanente' THEN
    RETURN NEW;
  END IF;

  -- Obtener a qué asociado pertenece la cuenta (ahorro_id) y qué tipo de cuenta es
  SELECT asociado_id, tipo INTO v_asociado_id, v_tipo_cuenta
  FROM cuentas_ahorro
  WHERE id = NEW.ahorro_id;

  -- Si es un aporte a la cuenta de ahorro permanente y el monto es mayor a 0
  IF v_tipo_cuenta = 'permanente' AND NEW.monto > 0 THEN
    -- Cambiar la solicitud de pendiente_activacion a aprobada
    UPDATE solicitudes_asociados
    SET estado = 'aprobada', 
        fecha_activacion = CURRENT_DATE
    WHERE usuario_id = v_asociado_id
      AND estado = 'pendiente_activacion';

    -- Activar la cuenta del usuario en la tabla usuarios para permitir su login
    UPDATE usuarios
    SET estado_cuenta = 'activo',
        activo = true,
        updated_at = NOW()
    WHERE id = v_asociado_id
      AND estado_cuenta = 'pendiente_activacion';
  END IF;

  RETURN NEW;
END;
$$;

-- Recrear el trigger para asegurar que se use la nueva función
DROP TRIGGER IF EXISTS trg_activar_asociado_por_pago ON transacciones;

CREATE TRIGGER trg_activar_asociado_por_pago
  AFTER INSERT ON transacciones
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_activar_asociado_por_pago();


-- ── 2. CORRECCIÓN: Trigger tg_activar_cuenta_primer_pago ─────────────────────

CREATE OR REPLACE FUNCTION public.fn_activar_cuenta_primer_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cuenta_id     uuid;
  v_user_estado   text;
BEGIN
  -- Solo actuar en aportes permanentes
  IF NEW.tipo != 'aporte_permanente' THEN
    RETURN NEW;
  END IF;

  -- Buscar la cuenta permanente del asociado
  SELECT id INTO v_cuenta_id
  FROM cuentas_ahorro
  WHERE asociado_id = NEW.asociado_id
    AND tipo        = 'permanente'
    AND anulado     = false
  ORDER BY created_at DESC
  LIMIT 1;

  -- Buscar el estado del usuario asociado
  SELECT estado_cuenta INTO v_user_estado
  FROM usuarios
  WHERE id = NEW.asociado_id;

  -- Si el usuario estaba suspendido → Reactivar a activo
  IF v_cuenta_id IS NOT NULL AND v_user_estado = 'suspendido' THEN
    -- Reactivar usuario
    UPDATE usuarios SET
      estado_cuenta = 'activo',
      activo        = true,
      updated_at    = NOW()
    WHERE id = NEW.asociado_id;

    -- Reactivar cuenta de ahorro
    UPDATE cuentas_ahorro SET
      estado     = 'activo',
      updated_at = NOW()
    WHERE id = v_cuenta_id;

    -- Notificar al asociado que su cuenta quedó activa
    INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leida, para_admin)
    VALUES (
      NEW.asociado_id,
      'pago_registrado',
      '🎉 ¡Tu cuenta UFCA está activa!',
      'Tu primer aporte de ahorro permanente fue registrado. Ya tienes acceso a todos los módulos: ahorro voluntario, créditos y más.',
      false,
      false
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recrear el trigger
DROP TRIGGER IF EXISTS tg_activar_cuenta_primer_pago ON transacciones;

CREATE TRIGGER tg_activar_cuenta_primer_pago
  AFTER INSERT ON transacciones
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_activar_cuenta_primer_pago();


-- ── 3. LIMPIEZA: Eliminar triggers updated_at redundantes ────────────────────

DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON usuarios;
DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
DROP TRIGGER IF EXISTS set_updated_at_configuracion ON configuracion;

COMMIT;

SELECT 'Triggers de base de datos corregidos y actualizadores redundantes eliminados con éxito.' AS resultado;
