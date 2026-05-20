-- =============================================================================
-- PASO PREVIO: Asignar todos los permisos al rol admin
-- Necesario para que fn_tiene_permiso() funcione con el administrador
-- Ejecutar ANTES de supabase_security_rls_completa.sql
-- =============================================================================

INSERT INTO rol_permisos (rol_id, permiso_clave, activo)
SELECT r.id, p.clave, true
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'admin'
ON CONFLICT DO NOTHING;

-- Verificar (debe mostrar 25 permisos)
SELECT COUNT(*) as permisos_asignados
FROM rol_permisos rp
JOIN roles r ON r.id = rp.rol_id
WHERE r.nombre = 'admin'
  AND rp.activo = true;
