-- =============================================================================
-- UFCA — Montos mínimos de ahorro en tabla configuracion
-- Reemplaza los valores hardcodeados en el código fuente.
-- Ejecutar en Supabase → SQL Editor → Run  (idempotente: ON CONFLICT DO UPDATE)
-- =============================================================================

INSERT INTO configuracion (clave, valor, descripcion)
VALUES
  (
    'cuota_ahorro_permanente',
    '100000',
    'Monto mínimo en COP por aporte al ahorro permanente. Si un aporte es menor, el administrador ve una advertencia pero puede continuar.'
  ),
  (
    'cuota_ahorro_voluntario',
    '50000',
    'Monto mínimo en COP por depósito al ahorro voluntario. Si un depósito es menor, el administrador ve una advertencia pero puede continuar.'
  )
ON CONFLICT (clave) DO UPDATE
  SET valor       = EXCLUDED.valor,
      descripcion = EXCLUDED.descripcion;

-- Verificación
SELECT clave, valor, descripcion
FROM configuracion
WHERE clave IN ('cuota_ahorro_permanente', 'cuota_ahorro_voluntario')
ORDER BY clave;
