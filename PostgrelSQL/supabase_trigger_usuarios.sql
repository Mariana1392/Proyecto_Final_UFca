-- =============================================================================
-- UFCA — Trigger: asignación automática de rol al registrar usuario
-- Ejecutar en Supabase → SQL Editor
-- Corrige S-02 y S-03: el cliente nunca más toca rol_id
-- =============================================================================

-- 1. Función que se dispara al crear un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER                  -- corre con permisos del propietario (postgres), no del cliente
SET search_path = public
AS $$
DECLARE
  v_rol_id uuid;
BEGIN
  -- Obtener el ID del rol "usuario" (el único rol que puede auto-asignarse)
  SELECT id INTO v_rol_id
  FROM public.roles
  WHERE nombre = 'usuario'
  LIMIT 1;

  -- Insertar en la tabla usuarios con el rol asignado por el servidor
  INSERT INTO public.usuarios (id, nombre, email, rol_id, activo)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nombre',
      split_part(NEW.email, '@', 1)   -- fallback: parte antes del @
    ),
    NEW.email,
    v_rol_id,
    true
  )
  ON CONFLICT (id) DO NOTHING;     -- seguro de correr si el usuario ya existe

  RETURN NEW;
END;
$$;

-- 2. Registrar el trigger sobre auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Verificación: listar triggers activos en auth.users
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table  = 'users';
