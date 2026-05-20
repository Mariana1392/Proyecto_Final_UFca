-- =============================================================================
-- FIX: permission denied for table users
-- Causa: PostgREST intenta resolver la FK usuario_id → users (o usuarios)
--        cuando hace SELECT * en solicitudes_asociados / comite_evaluador,
--        pero el rol `authenticated` no tiene permiso de lectura en esa tabla.
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

-- 1. Otorgar permiso de SELECT en la tabla public.users (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    EXECUTE 'GRANT SELECT ON public.users TO authenticated';
    EXECUTE 'GRANT SELECT ON public.users TO anon';

    -- Habilitar RLS si no está activo
    EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY';

    -- Política de lectura (si no existe ya)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'users' AND policyname = 'users_select_authenticated'
    ) THEN
      EXECUTE $p$
        CREATE POLICY users_select_authenticated
        ON public.users FOR SELECT
        TO authenticated
        USING (true)
      $p$;
    END IF;
  END IF;
END $$;

-- 2. Otorgar permiso en public.usuarios (nombre real en este proyecto)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'usuarios'
  ) THEN
    EXECUTE 'GRANT SELECT ON public.usuarios TO authenticated';

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'usuarios' AND policyname = 'usuarios_select_authenticated'
    ) THEN
      EXECUTE $p$
        CREATE POLICY usuarios_select_authenticated
        ON public.usuarios FOR SELECT
        TO authenticated
        USING (true)
      $p$;
    END IF;
  END IF;
END $$;

-- 3. Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificación: muestra qué tablas tienen la política aplicada
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('users', 'usuarios')
ORDER BY tablename, policyname;
