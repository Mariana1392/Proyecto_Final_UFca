-- =============================================================================
-- UFCA — Detección automática de mora via pg_cron                   (Mejora A)
-- Reemplaza la detección en el frontend por un job SQL diario a medianoche
--
-- Pasos para ejecutar en Supabase → SQL Editor:
--   1. Ejecutar este archivo completo
--   2. Verificar el job en: SELECT * FROM cron.job;
--   3. Para ejecución manual: SELECT public.detectar_mora_automatica();
-- =============================================================================

-- 1. Columna requerida (idempotente — no falla si ya existe)
ALTER TABLE creditos ADD COLUMN IF NOT EXISTS estado_anterior_mora TEXT;

-- =============================================================================
-- 2. Función principal de detección
--    Lógica idéntica a detectarMora() en useCreditos.ts:
--      · cuotas_pagadas = (monto - saldo) / capital_por_cuota
--      · fecha_vencimiento = fecha_desembolso + (cuotas_pagadas + 1) meses
--      · mora si fecha_vencimiento <= hoy  (sin días de gracia)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.detectar_mora_automatica()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoy date := CURRENT_DATE;
BEGIN

  -- ── ENTRAR EN MORA ─────────────────────────────────────────────────────────
  -- Créditos con cuota vencida que todavía no están marcados como 'en_mora'
  UPDATE creditos
  SET
    estado_anterior_mora = estado,
    estado               = 'en_mora',
    fecha_estado_cambio  = NOW(),
    motivo_estado_cambio = 'Mora detectada automáticamente: cuota vencida'
  WHERE anulado = false
    AND estado IN ('desembolsado', 'activo', 'aprobado', 'aprobada')
    AND fecha_desembolso IS NOT NULL
    AND (saldo   IS NULL OR saldo   > 0)
    AND (monto   IS NULL OR monto   > 0)
    AND (cuota_mensual IS NULL OR cuota_mensual > 0)
    AND (plazo_meses   IS NULL OR plazo_meses   > 0)
    AND (
      -- Número de cuotas ya pagadas (lógica por tipo de interés)
      GREATEST(0,
        CASE
          WHEN COALESCE(tipo_interes, 'compuesto') = 'simple'
            THEN ROUND(
                   (monto - COALESCE(saldo, monto))
                   / NULLIF(ROUND(monto::numeric / NULLIF(plazo_meses, 0)::numeric), 0)
                 )::int
          ELSE
            ROUND(
              (monto - COALESCE(saldo, monto))
              / NULLIF(cuota_mensual, 0)
            )::int
        END
      )
      -- Si cuotas_pagadas >= plazo, el crédito está completo — no aplica mora
      < COALESCE(plazo_meses, 1)
    )
    AND (
      -- Fecha de la próxima cuota <= hoy  →  cuota vencida
      fecha_desembolso + (
        GREATEST(0,
          CASE
            WHEN COALESCE(tipo_interes, 'compuesto') = 'simple'
              THEN ROUND(
                     (monto - COALESCE(saldo, monto))
                     / NULLIF(ROUND(monto::numeric / NULLIF(plazo_meses, 0)::numeric), 0)
                   )::int
            ELSE
              ROUND(
                (monto - COALESCE(saldo, monto))
                / NULLIF(cuota_mensual, 0)
              )::int
          END
        ) + 1
      ) * INTERVAL '1 month' <= v_hoy
    );

  -- ── SALIR DE MORA ──────────────────────────────────────────────────────────
  -- Créditos en mora cuya próxima cuota ya no está vencida (o están saldados)
  UPDATE creditos
  SET
    estado               = COALESCE(
                             NULLIF(estado_anterior_mora, ''),
                             -- Fallback inteligente: pagos registrados → 'activo'
                             CASE WHEN COALESCE(saldo, 0) < COALESCE(monto, 0)
                                  THEN 'activo'
                                  ELSE 'desembolsado'
                             END
                           ),
    estado_anterior_mora = NULL,
    fecha_estado_cambio  = NOW(),
    motivo_estado_cambio = 'Mora regularizada automáticamente'
  WHERE anulado = false
    AND estado = 'en_mora'
    AND fecha_desembolso IS NOT NULL
    AND COALESCE(cuota_mensual, 0) > 0
    AND COALESCE(monto, 0) > 0
    AND COALESCE(plazo_meses, 0) > 0
    AND (
      -- Saldo saldado
      COALESCE(saldo, 0) <= 0
      OR
      -- Próxima cuota aún no vence
      fecha_desembolso + (
        GREATEST(0,
          CASE
            WHEN COALESCE(tipo_interes, 'compuesto') = 'simple'
              THEN ROUND(
                     (monto - COALESCE(saldo, monto))
                     / NULLIF(ROUND(monto::numeric / NULLIF(plazo_meses, 0)::numeric), 0)
                   )::int
            ELSE
              ROUND(
                (monto - COALESCE(saldo, monto))
                / NULLIF(cuota_mensual, 0)
              )::int
          END
        ) + 1
      ) * INTERVAL '1 month' > v_hoy
    );

END;
$$;

GRANT EXECUTE ON FUNCTION public.detectar_mora_automatica() TO service_role;

-- =============================================================================
-- 3. Programar con pg_cron — todos los días a medianoche UTC
--    En Supabase: Database → Extensions → habilitar pg_cron primero
-- =============================================================================
DO $$
BEGIN
  -- Borrar job anterior si existe (permite re-ejecutar el script sin error)
  PERFORM cron.unschedule('ufca-detectar-mora-diaria');
EXCEPTION
  WHEN OTHERS THEN NULL; -- El job no existía — ignorar
END;
$$;

SELECT cron.schedule(
  'ufca-detectar-mora-diaria',          -- nombre único del job
  '0 0 * * *',                          -- cron: 00:00 UTC cada día
  $$SELECT public.detectar_mora_automatica()$$
);

-- Verificación: muestra el job recién creado
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'ufca-detectar-mora-diaria';
