-- ============================================================
-- Función para eliminar usuarios de auth.users desde el frontend
-- Ejecutar en Supabase → SQL Editor → Run
-- ============================================================
CREATE OR REPLACE FUNCTION eliminar_usuario_auth(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rol_del_llamante TEXT;
BEGIN
  -- Verificar que quien llama tiene rol 'admin' en la tabla usuarios
  SELECT r.nombre INTO rol_del_llamante
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  WHERE u.id = auth.uid();

  IF rol_del_llamante IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden eliminar usuarios.';
  END IF;

  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- Cualquier usuario autenticado puede llamar la función,
-- pero internamente valida que sea admin antes de ejecutar
REVOKE ALL ON FUNCTION eliminar_usuario_auth(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION eliminar_usuario_auth(UUID) TO authenticated;
