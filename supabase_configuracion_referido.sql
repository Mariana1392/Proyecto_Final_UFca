-- =============================================================================
-- UFCA — Agregar clave de bonificación de referidos a configuracion
-- Ejecutar en Supabase → SQL Editor
-- =============================================================================

INSERT INTO configuracion (clave, valor, descripcion)
VALUES (
  'bonificacion_referido',
  '50000',
  'Monto en COP de la bonificación asignada al asociado que refiere a un nuevo miembro activo'
)
ON CONFLICT (clave) DO NOTHING;

-- Verificar
SELECT clave, valor, descripcion FROM configuracion WHERE clave = 'bonificacion_referido';
