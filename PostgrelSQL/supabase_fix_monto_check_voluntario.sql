-- =============================================================================
-- FIX: new row for relation "pagos_ahorro_voluntario" violates check constraint
--      "pagos_ahorro_voluntario_monto_check"
-- Causa: la tabla tiene CHECK (monto >= 50000) hardcodeado, pero el mínimo
--        configurable vive en la tabla `configuracion` y puede ser distinto.
--        Además bloquea registros de saldo inicial legítimos < $50.000.
-- Solución: reemplazar por CHECK (monto > 0) — la validación del mínimo
--           se aplica en la UI con el valor real de configuración.
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

ALTER TABLE pagos_ahorro_voluntario
  DROP CONSTRAINT IF EXISTS pagos_ahorro_voluntario_monto_check;

ALTER TABLE pagos_ahorro_voluntario
  ADD CONSTRAINT pagos_ahorro_voluntario_monto_check
  CHECK (monto > 0);

-- Verificación
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'pagos_ahorro_voluntario_monto_check';
-- Debe devolver: monto > 0
