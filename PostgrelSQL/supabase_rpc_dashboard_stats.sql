-- =============================================================================
-- UFCA — RPC para estadísticas del Dashboard (R-01)
-- Reemplaza 9 queries paralelas + JS .reduce() por 1 sola llamada al servidor
-- Ejecutar en Supabase → SQL Editor
--
-- Tablas reales del esquema (verificadas contra el fallback en src/lib/api.ts):
--   · usuarios          — con campo estado_cuenta y campo activo
--   · creditos          — con campo anulado, estado, saldo
--   · cuentas_ahorro    — con campo tipo ('permanente'|'voluntario'), monto_ahorrado
--   · solicitudes_asociados — con campo estado
--   · liquidaciones     — con campo estado
--   · transacciones     — con campo tipo ('pago_credito'|'abono_capital') e interes
-- =============================================================================

-- DROP previo necesario si ya existe con distinto tipo de retorno
DROP FUNCTION IF EXISTS public.get_dashboard_stats();

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio_mes       date    := date_trunc('month', current_date);
  v_total_asoc       bigint;
  v_total_usuarios   bigint;
  v_total_creditos   bigint;
  v_ahorro_perm      numeric;
  v_ahorro_vol       numeric;
  v_solicitudes_pend bigint;
  v_liquidaciones    bigint;
  v_cartera          numeric;
  v_intereses_mes    numeric;
BEGIN

  -- Asociados con cuenta activa (estado_cuenta = 'activo')
  SELECT COUNT(*) INTO v_total_asoc
  FROM usuarios
  WHERE estado_cuenta = 'activo';

  -- Usuarios habilitados (activo = true)
  SELECT COUNT(*) INTO v_total_usuarios
  FROM usuarios
  WHERE activo = true;

  -- Créditos vigentes (no anulados, en estado operativo)
  SELECT COUNT(*) INTO v_total_creditos
  FROM creditos
  WHERE anulado = false
    AND estado IN ('activo', 'aprobado', 'desembolsado', 'en_mora');

  -- Total ahorros permanentes (suma en BD — evita descargar filas al JS)
  SELECT COALESCE(SUM(monto_ahorrado), 0) INTO v_ahorro_perm
  FROM cuentas_ahorro
  WHERE tipo = 'permanente'
    AND estado  = 'activo'
    AND anulado = false;

  -- Total ahorros voluntarios
  SELECT COALESCE(SUM(monto_ahorrado), 0) INTO v_ahorro_vol
  FROM cuentas_ahorro
  WHERE tipo = 'voluntario'
    AND estado  = 'activo'
    AND anulado = false;

  -- Solicitudes pendientes (incluye aprobados en espera de activar cuenta)
  SELECT COUNT(*) INTO v_solicitudes_pend
  FROM solicitudes_asociados
  WHERE estado IN ('pendiente', 'pendiente_activacion');

  -- Liquidaciones en proceso
  SELECT COUNT(*) INTO v_liquidaciones
  FROM liquidaciones
  WHERE estado NOT IN ('Pagada', 'Rechazada', 'Borrador');

  -- Cartera activa: saldo total adeudado
  SELECT COALESCE(SUM(saldo), 0) INTO v_cartera
  FROM creditos
  WHERE anulado = false
    AND estado IN ('activo', 'aprobado', 'desembolsado', 'en_mora');

  -- Intereses cobrados este mes (tabla transacciones, campo interes)
  SELECT COALESCE(SUM(interes), 0) INTO v_intereses_mes
  FROM transacciones
  WHERE tipo IN ('pago_credito', 'abono_capital')
    AND fecha_pago >= v_inicio_mes;

  RETURN jsonb_build_object(
    'totalAsociados',        v_total_asoc,
    'totalUsuarios',         v_total_usuarios,
    'totalCreditos',         v_total_creditos,
    'totalAhorrosPerm',      v_ahorro_perm,
    'totalAhorrosVol',       v_ahorro_vol,
    'totalAhorros',          v_ahorro_perm + v_ahorro_vol,
    'solicitudesPendientes', v_solicitudes_pend,
    'liquidacionesPend',     v_liquidaciones,
    'totalCarteraCreditos',  v_cartera,
    'totalInteresesMes',     v_intereses_mes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

-- Verificación — debe retornar un objeto JSON con todas las claves
SELECT public.get_dashboard_stats();
