-- =============================================================================
-- UFCA — RPC para estadísticas del Dashboard (R-01)
-- Reemplaza 9 queries paralelas + JS .reduce() por 1 sola llamada al servidor
-- Ejecutar en Supabase → SQL Editor
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio_mes       date := date_trunc('month', current_date);
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
  -- Asociados activos
  SELECT COUNT(*) INTO v_total_asoc
  FROM asociados WHERE estado = 'activo';

  -- Usuarios con cuenta activa
  SELECT COUNT(*) INTO v_total_usuarios
  FROM usuarios WHERE activo = true;

  -- Créditos activos (no anulados)
  SELECT COUNT(*) INTO v_total_creditos
  FROM creditos
  WHERE anulado = false
    AND estado IN ('activo','aprobado','desembolsado','en_mora');

  -- R-01: suma en BD — no descarga filas para reducirlas en JS
  SELECT COALESCE(SUM(monto_ahorrado), 0) INTO v_ahorro_perm
  FROM ahorros_permanentes WHERE estado = 'activo' AND anulado = false;

  SELECT COALESCE(SUM(monto_ahorrado), 0) INTO v_ahorro_vol
  FROM ahorros_voluntarios WHERE estado = 'activo' AND anulado = false;

  -- Solicitudes de asociación pendientes
  SELECT COUNT(*) INTO v_solicitudes_pend
  FROM solicitudes_asociados WHERE estado = 'pendiente';

  -- Liquidaciones en proceso
  SELECT COUNT(*) INTO v_liquidaciones
  FROM liquidaciones
  WHERE estado NOT IN ('pagada','rechazada','borrador');

  -- Cartera activa: saldo total adeudado
  SELECT COALESCE(SUM(saldo), 0) INTO v_cartera
  FROM creditos
  WHERE anulado = false
    AND estado IN ('activo','aprobado','desembolsado','en_mora');

  -- Intereses cobrados este mes
  SELECT COALESCE(SUM(interes), 0) INTO v_intereses_mes
  FROM pagos_credito
  WHERE fecha_pago >= v_inicio_mes;

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
    'totalInteresesMes',     v_intereses_mes,
    'pedidosPendientes',     0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

-- Verificación
SELECT public.get_dashboard_stats();
