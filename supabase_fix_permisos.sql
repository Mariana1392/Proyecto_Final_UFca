-- ============================================================
-- UFCA - Fix permisos RLS
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Dar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_user_role()    TO authenticated;
GRANT EXECUTE ON FUNCTION get_asociado_id()  TO authenticated;
GRANT EXECUTE ON FUNCTION set_updated_at()   TO authenticated;

-- Asegurar que el rol authenticated puede leer las tablas base
GRANT SELECT ON roles    TO authenticated;
GRANT SELECT ON usuarios TO authenticated;

-- Forzar búsqueda en schema público para las funciones
ALTER FUNCTION get_user_role()   SET search_path = public;
ALTER FUNCTION get_asociado_id() SET search_path = public;
