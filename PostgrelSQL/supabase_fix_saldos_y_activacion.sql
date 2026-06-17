-- =============================================================================
-- SQL SCRIPT: CORRECCIÓN DE ACCESO Y ACTIVACIÓN DE ASOCIADOS - UFCA
--
-- Ejecutar en: Supabase → SQL Editor → Run
--
-- Realiza las siguientes acciones:
--  1. Crea el trigger 'trg_sincronizar_saldo_ahorro' en la tabla 'transacciones'
--     para sincronizar 'cuentas_ahorro.monto_ahorrado' automáticamente.
--  2. Sincroniza los saldos de todas las cuentas de ahorro con la suma real de
--     sus transacciones no anuladas.
--  3. Reactiva las cuentas de usuario y cuentas de ahorro de los 5 asociados
--     aprobados que tenían bloqueos o estados inactivos/anulados por error.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TRIGGER DE SINCRONIZACIÓN AUTOMÁTICA DE SALDO DE AHORRO
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_sincronizar_saldo_ahorro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ahorro_id UUID;
BEGIN
  -- Identificar el ahorro_id afectado
  IF TG_OP = 'DELETE' THEN
    v_ahorro_id := OLD.ahorro_id;
  ELSE
    v_ahorro_id := NEW.ahorro_id;
  END IF;

  IF v_ahorro_id IS NOT NULL THEN
    UPDATE public.cuentas_ahorro
    SET monto_ahorrado = COALESCE((
      SELECT SUM(monto)
      FROM public.transacciones
      WHERE ahorro_id = v_ahorro_id
        AND anulado = false
    ), 0),
    updated_at = NOW()
    WHERE id = v_ahorro_id;
  END IF;

  -- Si hubo un cambio de ahorro_id en un UPDATE, actualizar también el anterior
  IF TG_OP = 'UPDATE' AND OLD.ahorro_id IS DISTINCT FROM NEW.ahorro_id AND OLD.ahorro_id IS NOT NULL THEN
    UPDATE public.cuentas_ahorro
    SET monto_ahorrado = COALESCE((
      SELECT SUM(monto)
      FROM public.transacciones
      WHERE ahorro_id = OLD.ahorro_id
        AND anulado = false
    ), 0),
    updated_at = NOW()
    WHERE id = OLD.ahorro_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recrear el trigger en transacciones
DROP TRIGGER IF EXISTS trg_sincronizar_saldo_ahorro ON public.transacciones;

CREATE TRIGGER trg_sincronizar_saldo_ahorro
  AFTER INSERT OR UPDATE OR DELETE ON public.transacciones
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sincronizar_saldo_ahorro();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SINCRONIZACIÓN INICIAL DE SALDOS EXISTENTES
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.cuentas_ahorro ca
SET monto_ahorrado = COALESCE((
    SELECT SUM(monto)
    FROM public.transacciones t
    WHERE t.ahorro_id = ca.id
      AND t.anulado = false
), 0);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ACTIVACIÓN SELECTIVA DE ASOCIADOS Y SUS CUENTAS DE AHORRO
-- ─────────────────────────────────────────────────────────────────────────────

-- Caso 1: Mariana Valencia Ospina (mariavelenciaospina@gmail.com)
-- (Ya está activa, la sincronización inicial de arriba ya corrigió su saldo de 0 a 80,000)

-- Caso 2: Paola Minci (paolamontiel153@gmail.com)
UPDATE public.usuarios 
SET estado_cuenta = 'activo', 
    activo = true, 
    updated_at = NOW() 
WHERE email = 'paolamontiel153@gmail.com';

UPDATE public.cuentas_ahorro 
SET estado = 'activo', 
    anulado = false, 
    updated_at = NOW() 
WHERE asociado_id = (SELECT id FROM public.usuarios WHERE email = 'paolamontiel153@gmail.com');

-- Caso 3: Mrta celida (marianavalenciaospina511@gmail.com)
UPDATE public.usuarios 
SET estado_cuenta = 'activo', 
    activo = true, 
    updated_at = NOW() 
WHERE email = 'marianavalenciaospina511@gmail.com';

UPDATE public.cuentas_ahorro 
SET estado = 'activo', 
    anulado = false, 
    updated_at = NOW() 
WHERE asociado_id = (SELECT id FROM public.usuarios WHERE email = 'marianavalenciaospina511@gmail.com');

-- Caso 4: Dairo Montiel (dairomontiel20@gmail.com)
UPDATE public.usuarios 
SET estado_cuenta = 'activo', 
    activo = true, 
    updated_at = NOW() 
WHERE email = 'dairomontiel20@gmail.com';

UPDATE public.cuentas_ahorro 
SET estado = 'activo', 
    anulado = false, 
    updated_at = NOW() 
WHERE asociado_id = (SELECT id FROM public.usuarios WHERE email = 'dairomontiel20@gmail.com');

-- Caso 5: Celida Tobar (dairoslos123@gmail.com)
UPDATE public.usuarios 
SET estado_cuenta = 'activo', 
    activo = true, 
    updated_at = NOW() 
WHERE email = 'dairoslos123@gmail.com';

UPDATE public.cuentas_ahorro 
SET estado = 'activo', 
    anulado = false, 
    updated_at = NOW() 
WHERE asociado_id = (SELECT id FROM public.usuarios WHERE email = 'dairoslos123@gmail.com');

COMMIT;

SELECT 'Saldos sincronizados, trigger instalado y asociados reactivados correctamente.' AS resultado;
