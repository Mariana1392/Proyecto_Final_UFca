-- =============================================================================
-- UFCA — Cierre automático de período contable via pg_cron         (Mejora G)
-- Ejecutar en Supabase → SQL Editor
--
-- Qué hace:
--   1. Valida que no haya transacciones o créditos en estado pendiente/proceso
--   2. Genera un resumen de cierre (informe mensual) en la tabla periodos
--   3. Cierra el período activo y abre el siguiente
--   4. pg_cron ejecuta el cierre el último día de cada mes a las 23:00 UTC
-- =============================================================================

-- =============================================================================
-- FUNCIÓN 1: Validar que el período se puede cerrar
-- =============================================================================
CREATE OR REPLACE FUNCTION public.validar_cierre_periodo()
RETURNS TABLE(puede_cerrar boolean, motivo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creditos_pendientes   bigint;
  v_transacciones_hoy     bigint;
  v_liquidaciones_abiertas bigint;
BEGIN
  -- Créditos en revisión / aprobados sin desembolsar (podrían quedar colgados)
  SELECT COUNT(*) INTO v_creditos_pendientes
  FROM creditos
  WHERE anulado = false
    AND estado IN ('pendiente', 'en_revision', 'aprobado');

  -- Transacciones del día sin confirmar (solo las últimas 24h como precaución)
  SELECT COUNT(*) INTO v_transacciones_hoy
  FROM transacciones
  WHERE created_at >= NOW() - INTERVAL '24 hours'
    AND tipo = 'aporte_permanente';

  -- Liquidaciones abiertas
  SELECT COUNT(*) INTO v_liquidaciones_abiertas
  FROM liquidaciones
  WHERE estado NOT IN ('Pagada', 'Rechazada', 'Borrador');

  IF v_creditos_pendientes > 0 THEN
    RETURN QUERY SELECT false, format(
      'Hay %s crédito(s) en estado pendiente, en revisión o aprobado sin desembolsar.',
      v_creditos_pendientes
    );
    RETURN;
  END IF;

  IF v_liquidaciones_abiertas > 0 THEN
    RETURN QUERY SELECT false, format(
      'Hay %s liquidación(es) sin cerrar.',
      v_liquidaciones_abiertas
    );
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'El período puede cerrarse sin inconsistencias.';
END;
$$;

-- =============================================================================
-- FUNCIÓN 2: Generar resumen de cierre y rotar el período
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cerrar_periodo_automatico()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_actual        record;
  v_nuevo_inicio          date;
  v_nuevo_fin             date;
  v_nuevo_nombre          text;
  v_nuevo_periodo_id      uuid;
  v_puede_cerrar          boolean;
  v_motivo                text;
  -- Cifras del cierre
  v_total_aportes_perm    numeric;
  v_total_aportes_vol     numeric;
  v_total_desembolsos     numeric;
  v_total_pagos_cap       numeric;
  v_total_intereses       numeric;
  v_creditos_activos      bigint;
  v_cartera               numeric;
BEGIN

  -- 1. Obtener período activo
  SELECT * INTO v_periodo_actual
  FROM periodos
  WHERE estado = 'activo'
  ORDER BY fecha_inicio DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No se encontró un período activo.');
  END IF;

  -- 2. Validar que se puede cerrar
  SELECT puede_cerrar, motivo INTO v_puede_cerrar, v_motivo
  FROM public.validar_cierre_periodo()
  LIMIT 1;

  IF NOT v_puede_cerrar THEN
    RETURN jsonb_build_object('ok', false, 'error', v_motivo, 'periodo_id', v_periodo_actual.id);
  END IF;

  -- 3. Calcular totales del período para el informe de cierre
  SELECT COALESCE(SUM(monto), 0) INTO v_total_aportes_perm
  FROM transacciones
  WHERE tipo = 'aporte_permanente'
    AND periodo_id = v_periodo_actual.id;

  SELECT COALESCE(SUM(monto), 0) INTO v_total_aportes_vol
  FROM transacciones
  WHERE tipo = 'aporte_voluntario'
    AND periodo_id = v_periodo_actual.id;

  SELECT COALESCE(SUM(monto), 0) INTO v_total_desembolsos
  FROM transacciones
  WHERE tipo = 'desembolso_credito'
    AND periodo_id = v_periodo_actual.id;

  SELECT COALESCE(SUM(monto), 0), COALESCE(SUM(interes), 0)
  INTO v_total_pagos_cap, v_total_intereses
  FROM transacciones
  WHERE tipo IN ('pago_credito', 'abono_capital')
    AND periodo_id = v_periodo_actual.id;

  SELECT COUNT(*), COALESCE(SUM(saldo), 0)
  INTO v_creditos_activos, v_cartera
  FROM creditos
  WHERE anulado = false
    AND estado IN ('activo', 'desembolsado', 'en_mora');

  -- 4. Cerrar el período actual — guardar informe en campo resumen_cierre (JSONB)
  UPDATE periodos
  SET
    estado         = 'cerrado',
    fecha_fin      = CURRENT_DATE,
    resumen_cierre = jsonb_build_object(
      'fecha_cierre',        NOW(),
      'tipo_cierre',         'automatico',
      'aportes_permanentes', v_total_aportes_perm,
      'aportes_voluntarios', v_total_aportes_vol,
      'desembolsos',         v_total_desembolsos,
      'pagos_capital',       v_total_pagos_cap,
      'intereses_cobrados',  v_total_intereses,
      'creditos_vigentes',   v_creditos_activos,
      'cartera_total',       v_cartera
    )
  WHERE id = v_periodo_actual.id;

  -- 5. Abrir el nuevo período (mes siguiente)
  v_nuevo_inicio := date_trunc('month', CURRENT_DATE + INTERVAL '1 month');
  v_nuevo_fin    := (v_nuevo_inicio + INTERVAL '1 month - 1 day')::date;
  v_nuevo_nombre := to_char(v_nuevo_inicio, 'FMMonth YYYY');  -- Ej: "Julio 2026"

  INSERT INTO periodos (nombre, fecha_inicio, fecha_fin, estado)
  VALUES (v_nuevo_nombre, v_nuevo_inicio, v_nuevo_fin, 'activo')
  RETURNING id INTO v_nuevo_periodo_id;

  RETURN jsonb_build_object(
    'ok',                   true,
    'periodo_cerrado_id',   v_periodo_actual.id,
    'periodo_cerrado_nombre', v_periodo_actual.nombre,
    'nuevo_periodo_id',     v_nuevo_periodo_id,
    'nuevo_periodo_nombre', v_nuevo_nombre,
    'resumen', jsonb_build_object(
      'aportes_permanentes', v_total_aportes_perm,
      'aportes_voluntarios', v_total_aportes_vol,
      'desembolsos',         v_total_desembolsos,
      'pagos_capital',       v_total_pagos_cap,
      'intereses_cobrados',  v_total_intereses,
      'creditos_vigentes',   v_creditos_activos,
      'cartera_total',       v_cartera
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_cierre_periodo()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_periodo_automatico()  TO service_role;

-- =============================================================================
-- COLUMNA ADICIONAL: resumen_cierre en la tabla periodos (idempotente)
-- =============================================================================
ALTER TABLE periodos ADD COLUMN IF NOT EXISTS resumen_cierre JSONB;

-- =============================================================================
-- pg_cron: ejecutar el último día del mes a las 23:00 UTC
--   Cron "0 23 28-31 * *" + verificación interna de que es el último día
-- =============================================================================
DO $$
BEGIN
  PERFORM cron.unschedule('ufca-cierre-periodo-mensual');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'ufca-cierre-periodo-mensual',
  '0 23 28-31 * *',   -- Corre los días 28-31 a las 23:00 UTC; la función verifica internamente
  $$
  DO $$
  BEGIN
    -- Solo ejecutar si HOY es el último día del mes
    IF CURRENT_DATE = date_trunc('month', CURRENT_DATE + INTERVAL '1 month')::date - 1 THEN
      PERFORM public.cerrar_periodo_automatico();
    END IF;
  END;
  $$
  $$
);

-- Verificación
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'ufca-cierre-periodo-mensual';

-- Prueba manual (NO ejecutar en producción salvo que sea el último día):
-- SELECT public.validar_cierre_periodo();
-- SELECT public.cerrar_periodo_automatico();
