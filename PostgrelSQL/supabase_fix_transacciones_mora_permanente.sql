-- =============================================================================
-- FIX: RESTRICCIÓN DE TIPO EN TRANSACCIONES Y TRIGGER DE SINCRONIZACIÓN DE SALDOS
--
-- Ejecutar en: Supabase → SQL Editor → Run
-- =============================================================================

BEGIN;

-- 1. Modificar la restricción CHECK en tipo de transacciones
ALTER TABLE public.transacciones DROP CONSTRAINT IF EXISTS transacciones_tipo_check;

ALTER TABLE public.transacciones
  ADD CONSTRAINT transacciones_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'aporte_permanente'::text,
    'aporte_voluntario'::text,
    'pago_credito'::text,
    'abono_capital'::text,
    'cancelacion_total'::text,
    'mora_permanente'::text
  ]));

-- 2. Recrear la función del trigger para calcular el saldo de ahorros sin incluir la mora pagada
CREATE OR REPLACE FUNCTION public.fn_sincronizar_saldo_ahorro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ahorro_id UUID;
  v_nuevo_saldo NUMERIC;
BEGIN
  -- Identificar el ahorro_id afectado
  IF TG_OP = 'DELETE' THEN
    v_ahorro_id := OLD.ahorro_id;
  ELSE
    v_ahorro_id := NEW.ahorro_id;
  END IF;

  IF v_ahorro_id IS NOT NULL THEN
    -- Calcular el nuevo saldo antes de actualizar
    SELECT COALESCE(SUM(
      CASE 
        WHEN tipo = 'aporte_voluntario' AND COALESCE(saldo_despues, 0) < COALESCE(saldo_antes, 0) THEN -monto
        WHEN tipo IN ('aporte_permanente', 'aporte_voluntario') AND COALESCE(saldo_despues, 0) > COALESCE(saldo_antes, 0) THEN monto
        ELSE 0
      END
    ), 0) INTO v_nuevo_saldo
    FROM public.transacciones
    WHERE ahorro_id = v_ahorro_id
      AND anulado = false;

    -- Solo actualizar si el saldo_ahorrado actual es diferente del calculado
    UPDATE public.cuentas_ahorro
    SET monto_ahorrado = v_nuevo_saldo,
        updated_at = NOW()
    WHERE id = v_ahorro_id
      AND monto_ahorrado IS DISTINCT FROM v_nuevo_saldo;
  END IF;

  -- Si hubo un cambio de ahorro_id en un UPDATE, actualizar también el anterior
  IF TG_OP = 'UPDATE' AND OLD.ahorro_id IS DISTINCT FROM NEW.ahorro_id AND OLD.ahorro_id IS NOT NULL THEN
    SELECT COALESCE(SUM(
      CASE 
        WHEN tipo = 'aporte_voluntario' AND COALESCE(saldo_despues, 0) < COALESCE(saldo_antes, 0) THEN -monto
        WHEN tipo IN ('aporte_permanente', 'aporte_voluntario') AND COALESCE(saldo_despues, 0) > COALESCE(saldo_antes, 0) THEN monto
        ELSE 0
      END
    ), 0) INTO v_nuevo_saldo
    FROM public.transacciones
    WHERE ahorro_id = OLD.ahorro_id
      AND anulado = false;

    UPDATE public.cuentas_ahorro
    SET monto_ahorrado = v_nuevo_saldo,
        updated_at = NOW()
    WHERE id = OLD.ahorro_id
      AND monto_ahorrado IS DISTINCT FROM v_nuevo_saldo;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Recrear el trigger en transacciones
DROP TRIGGER IF EXISTS trg_sincronizar_saldo_ahorro ON public.transacciones;

CREATE TRIGGER trg_sincronizar_saldo_ahorro
  AFTER INSERT OR UPDATE OR DELETE ON public.transacciones
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sincronizar_saldo_ahorro();

-- 4. Ejecutar una sincronización inicial para todas las cuentas de ahorro
UPDATE public.cuentas_ahorro ca
SET monto_ahorrado = COALESCE((
    SELECT SUM(
      CASE 
        WHEN tipo = 'aporte_voluntario' AND COALESCE(saldo_despues, 0) < COALESCE(saldo_antes, 0) THEN -monto
        WHEN tipo IN ('aporte_permanente', 'aporte_voluntario') AND COALESCE(saldo_despues, 0) > COALESCE(saldo_antes, 0) THEN monto
        ELSE 0
      END
    )
    FROM public.transacciones t
    WHERE t.ahorro_id = ca.id
      AND t.anulado = false
), 0);

COMMIT;

SELECT 'Cambio de constraint y trigger de sincronización creados y ejecutados correctamente.' AS resultado;
