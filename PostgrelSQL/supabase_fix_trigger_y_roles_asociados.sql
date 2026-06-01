-- =============================================================================
-- FIX: Trigger handle_new_user + Reparación de asociados sin cuenta Auth
--
-- Problemas que resuelve:
--   1. El trigger asignaba siempre rol='usuario' aunque el invitado fuera un asociado
--   2. El trigger no vinculaba usuarios.asociado_id automáticamente
--   3. Asociados aprobados que no tienen cuenta en auth.users (invite falló)
--
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 1: Actualizar trigger handle_new_user
--   • Lee el rol del metadata de invitación (campo 'rol')
--   • Si no hay metadata de rol → asigna 'usuario' (comportamiento anterior)
--   • Busca automáticamente si hay un asociado con el mismo email y lo vincula
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_id     UUID;
  v_rol_nombre TEXT;
  v_asoc_id    UUID;
BEGIN
  -- Leer el rol del metadata de la invitación (lo pasa el frontend al invitar)
  -- Si no existe (registro normal), usar 'usuario' como predeterminado
  v_rol_nombre := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'rol'), ''),
    'usuario'
  );

  SELECT id INTO v_rol_id
  FROM public.roles
  WHERE nombre = v_rol_nombre
  LIMIT 1;

  -- Fallback: si el rol del metadata no existe en la tabla, usar 'usuario'
  IF v_rol_id IS NULL THEN
    SELECT id INTO v_rol_id FROM public.roles WHERE nombre = 'usuario' LIMIT 1;
  END IF;

  -- Buscar si ya existe un asociado con ese email para vincular automáticamente
  SELECT id INTO v_asoc_id
  FROM public.asociados
  WHERE email = NEW.email
  LIMIT 1;

  -- Insertar en usuarios. Si ya existe (por race condition), actualizar solo el
  -- asociado_id si estaba vacío y ahora lo podemos resolver.
  INSERT INTO public.usuarios (id, nombre, email, rol_id, activo, asociado_id)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'nombre'), ''),
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    v_rol_id,
    true,
    v_asoc_id
  )
  ON CONFLICT (id) DO UPDATE
    SET
      -- Solo actualizar asociado_id si aún no estaba vinculado
      asociado_id = COALESCE(usuarios.asociado_id, EXCLUDED.asociado_id),
      -- Actualizar rol si el registro previo tenía el rol genérico 'usuario'
      -- y ahora viene con un rol más específico
      rol_id = CASE
        WHEN usuarios.rol_id = (SELECT id FROM public.roles WHERE nombre = 'usuario' LIMIT 1)
             AND EXCLUDED.rol_id != usuarios.rol_id
        THEN EXCLUDED.rol_id
        ELSE usuarios.rol_id
      END;

  RETURN NEW;
END;
$$;

-- Recrear el trigger (por si acaso)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

SELECT 'Trigger handle_new_user actualizado correctamente.' AS resultado;


-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 2: Reparar usuarios existentes con rol incorrecto
--   Corrige usuarios que fueron invitados como asociados pero quedaron con
--   rol='usuario' porque el trigger antiguo no leía el metadata.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.usuarios u
SET rol_id = (SELECT id FROM public.roles WHERE nombre = 'asociado' LIMIT 1)
WHERE u.asociado_id IS NOT NULL
  AND u.rol_id = (SELECT id FROM public.roles WHERE nombre = 'usuario' LIMIT 1);

SELECT 'Parte 2 completada: roles de asociados corregidos.' AS resultado;


-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 3: Vincular usuarios.asociado_id para los que faltan (por email)
--   Para usuarios que tienen rol='asociado' pero no tienen asociado_id vinculado
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.usuarios u
SET asociado_id = a.id
FROM public.asociados a
WHERE u.asociado_id IS NULL
  AND u.email = a.email
  AND u.rol_id = (SELECT id FROM public.roles WHERE nombre = 'asociado' LIMIT 1);

SELECT 'Parte 3 completada: vínculos usuario↔asociado creados.' AS resultado;


-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 4: Diagnóstico — Ver asociados aprobados sin cuenta en auth.users
--   Estos son los que necesitan recibir una nueva invitación manual.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sa.nombres || ' ' || sa.apellidos  AS nombre_completo,
  sa.email,
  sa.cedula,
  sa.estado                          AS estado_solicitud,
  a.id                               AS asociado_id,
  u.id                               AS usuario_id,
  CASE
    WHEN u.id IS NULL THEN '❌ SIN CUENTA AUTH — necesita nueva invitación'
    ELSE '✅ Tiene cuenta'
  END AS estado_auth
FROM public.solicitudes_asociados sa
LEFT JOIN public.asociados a   ON a.cedula = sa.cedula
LEFT JOIN public.usuarios  u   ON u.email  = sa.email
WHERE sa.estado IN ('aprobada', 'pendiente_activacion')
ORDER BY sa.created_at DESC;
