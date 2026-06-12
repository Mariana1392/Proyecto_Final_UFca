-- =============================================================================
-- Trigger: Activación automática de asociado al realizar su primer aporte
--
-- Cuándo se ejecuta: AFTER INSERT en la tabla 'transacciones'.
-- Qué hace: Si un asociado en estado "pendiente_activacion" realiza su 
--           primer aporte a su cuenta de ahorro permanente, su solicitud
--           pasa automáticamente a estado "aprobada", desbloqueando todos
--           los módulos del sistema (créditos, liquidaciones, etc.).
-- =============================================================================

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
  -- Solo nos interesan los aportes (ingresos de dinero)
  IF NEW.tipo != 'aporte' THEN
    RETURN NEW;
  END IF;

  -- Obtener a qué asociado pertenece la cuenta y qué tipo de cuenta es
  SELECT asociado_id, tipo INTO v_asociado_id, v_tipo_cuenta
  FROM cuentas_ahorro
  WHERE id = NEW.cuenta_id;

  -- Si es un aporte a la cuenta de ahorro permanente y el monto es mayor a 0
  IF v_tipo_cuenta = 'permanente' AND NEW.monto > 0 THEN
    -- Cambiar la solicitud de pendiente_activacion a aprobada
    UPDATE solicitudes_asociados
    SET estado = 'aprobada', 
        fecha_activacion = CURRENT_DATE
    WHERE usuario_id = v_asociado_id
      AND estado = 'pendiente_activacion';
  END IF;

  RETURN NEW;
END;
$$;

-- Recrear el trigger
DROP TRIGGER IF EXISTS trg_activar_asociado_por_pago ON transacciones;

CREATE TRIGGER trg_activar_asociado_por_pago
  AFTER INSERT ON transacciones
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_activar_asociado_por_pago();

SELECT 'Trigger de activación por pago creado correctamente.' AS resultado;
