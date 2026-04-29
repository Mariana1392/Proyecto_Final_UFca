-- ============================================================
-- UFCA - Vincular usuarios con rol 'asociado' a tabla asociados
-- IMPORTANTE: Ejecutar PRIMERO supabase_add_telefono_direccion_usuarios.sql
-- ============================================================

-- Paso 1: Crear registros en 'asociados' solo para usuarios que tienen identificacion
INSERT INTO asociados (nombre, cedula, email, telefono, direccion, fecha_ingreso, estado)
SELECT
  u.nombre,
  u.identificacion,
  u.email,
  CASE WHEN u.telefono = '' OR u.telefono IS NULL THEN 'Sin registro' ELSE u.telefono END,
  CASE WHEN u.direccion = '' OR u.direccion IS NULL THEN 'Sin registro' ELSE u.direccion END,
  NOW()::DATE,
  'activo'
FROM usuarios u
JOIN roles r ON u.rol_id = r.id
WHERE r.nombre = 'asociado'
  AND u.asociado_id IS NULL
  AND u.activo = true
  AND u.identificacion IS NOT NULL
  AND u.identificacion <> ''
ON CONFLICT DO NOTHING;

-- Paso 2: Vincular usuarios.asociado_id (sin alias en UPDATE para PostgreSQL)
UPDATE usuarios
SET asociado_id = a.id
FROM asociados a
WHERE usuarios.asociado_id IS NULL
  AND usuarios.identificacion IS NOT NULL
  AND usuarios.identificacion <> ''
  AND a.cedula = usuarios.identificacion
  AND a.email  = usuarios.email
  AND usuarios.rol_id IN (SELECT id FROM roles WHERE nombre = 'asociado');

-- Verificar resultado
SELECT
  u.nombre AS usuario,
  u.email,
  u.identificacion AS cedula,
  u.telefono,
  u.direccion,
  u.asociado_id,
  a.nombre AS asociado_nombre
FROM usuarios u
JOIN roles r ON u.rol_id = r.id
LEFT JOIN asociados a ON u.asociado_id = a.id
WHERE r.nombre = 'asociado'
ORDER BY u.nombre;
