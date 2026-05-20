-- =============================================================================
-- SYNC: ahorros_permanentes.monto_ahorrado ← suma real de pagos
-- Útil cuando monto_ahorrado quedó en 0 o NULL aunque ya hay pagos registrados.
--
-- REQUISITO: ejecutar PRIMERO supabase_fix_pagos_ahorro_permanente_cols.sql
--            para asegurarse que exista la columna saldo_nuevo.
--
-- Ejecutar en Supabase → SQL Editor → Run  (idempotente)
-- =============================================================================

-- Paso 1: ver el estado actual (solo consulta — sin efectos)
SELECT
  ap.id,
  ap.monto_ahorrado                      AS monto_actual_en_tabla,
  COALESCE(SUM(CASE WHEN p.anulado = false THEN p.monto_cuota ELSE 0 END), 0) AS suma_aportes,
  ap.monto_ahorrado = COALESCE(SUM(CASE WHEN p.anulado = false THEN p.monto_cuota ELSE 0 END), 0)
                                         AS ya_sincronizado
FROM ahorros_permanentes ap
LEFT JOIN pagos_ahorro_permanente p ON p.ahorro_permanente_id = ap.id
GROUP BY ap.id, ap.monto_ahorrado
ORDER BY ya_sincronizado, ap.id;

-- Paso 2: actualizar los registros desincronizados
-- Descomenta cuando estés listo para aplicar el UPDATE.

/*
UPDATE ahorros_permanentes ap
SET monto_ahorrado = sub.suma
FROM (
  SELECT
    ahorro_permanente_id,
    COALESCE(SUM(CASE WHEN anulado = false THEN monto_cuota ELSE 0 END), 0) AS suma
  FROM pagos_ahorro_permanente
  GROUP BY ahorro_permanente_id
) sub
WHERE ap.id = sub.ahorro_permanente_id
  AND ap.monto_ahorrado IS DISTINCT FROM sub.suma;

-- Verificación post-update
SELECT ap.id, ap.monto_ahorrado, sub.suma,
       ap.monto_ahorrado = sub.suma AS sincronizado
FROM ahorros_permanentes ap
LEFT JOIN (
  SELECT ahorro_permanente_id,
         COALESCE(SUM(CASE WHEN anulado = false THEN monto_cuota ELSE 0 END), 0) AS suma
  FROM pagos_ahorro_permanente
  GROUP BY ahorro_permanente_id
) sub ON ap.id = sub.ahorro_permanente_id;
*/
