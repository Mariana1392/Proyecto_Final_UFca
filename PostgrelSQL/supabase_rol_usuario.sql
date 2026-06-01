-- ─────────────────────────────────────────────────────────────────────────────
-- UFCA: Rol "usuario" y columna usuario_id en solicitudes_asociados
-- Ejecutar en el SQL Editor de Supabase
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Crear rol "usuario" (usuario registrado que aún no es asociado)
INSERT INTO roles (nombre, label, descripcion, permisos, activo)
VALUES (
  'usuario',
  'Usuario',
  'Usuario registrado pendiente de afiliación como asociado',
  '["solicitud_asociacion"]',
  true
)
ON CONFLICT (nombre) DO NOTHING;

-- 2. Agregar columna usuario_id a la tabla existente solicitudes_asociados
--    (la tabla ya existe con: nombres, apellidos, cedula, telefono, email,
--     direccion, ocupacion, ingreso_mensual, motivacion, fecha_solicitud,
--     estado, fecha_resolucion, observaciones, evaluacion, url_documento)
ALTER TABLE solicitudes_asociados
  ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Política RLS: el propio usuario puede ver su solicitud por usuario_id
CREATE POLICY IF NOT EXISTS "usuario_ver_propia_solicitud"
  ON solicitudes_asociados FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY IF NOT EXISTS "usuario_insertar_solicitud"
  ON solicitudes_asociados FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);
