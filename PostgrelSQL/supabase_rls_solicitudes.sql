-- =============================================================================
-- UFCA — RLS para solicitudes_asociados con validación anti-spam
-- Ejecutar en Supabase → SQL Editor
-- Corrige S-06: INSERT anónimo irrestricto
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Función de validación (SECURITY DEFINER — se ejecuta como postgres)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validar_solicitud_asociacion(
  p_cedula    text,
  p_nombres   text,
  p_email     text,
  p_telefono  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id          uuid;
  v_count_hora  int;
BEGIN
  -- 1. Validar campos obligatorios no vacíos
  IF trim(p_cedula)  = '' OR p_cedula  IS NULL THEN
    RAISE EXCEPTION 'La cédula es obligatoria';
  END IF;
  IF trim(p_nombres) = '' OR p_nombres IS NULL THEN
    RAISE EXCEPTION 'El nombre es obligatorio';
  END IF;
  IF trim(p_email)   = '' OR p_email   IS NULL THEN
    RAISE EXCEPTION 'El email es obligatorio';
  END IF;

  -- 2. Validar formato cédula (solo dígitos, 5-15 caracteres)
  IF p_cedula !~ '^\d{5,15}$' THEN
    RAISE EXCEPTION 'Formato de cédula inválido';
  END IF;

  -- 3. Validar formato email básico
  IF p_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'Formato de email inválido';
  END IF;

  -- 4. Anti-spam: máximo 3 solicitudes desde el mismo email en la última hora
  SELECT COUNT(*) INTO v_count_hora
  FROM solicitudes_asociados
  WHERE email = p_email
    AND created_at > now() - interval '1 hour';

  IF v_count_hora >= 3 THEN
    RAISE EXCEPTION 'Demasiadas solicitudes. Intente de nuevo en una hora.';
  END IF;

  -- 5. Verificar que no exista ya una solicitud pendiente con esa cédula
  IF EXISTS (
    SELECT 1 FROM solicitudes_asociados
    WHERE cedula = p_cedula AND estado = 'pendiente'
  ) THEN
    RAISE EXCEPTION 'Ya existe una solicitud pendiente con esta cédula';
  END IF;

  -- 6. Insertar la solicitud validada
  INSERT INTO solicitudes_asociados (cedula, nombres, email, telefono, estado)
  VALUES (p_cedula, p_nombres, p_email, p_telefono, 'pendiente')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Dar permiso de ejecución al rol anon (visitantes sin cuenta)
GRANT EXECUTE ON FUNCTION public.validar_solicitud_asociacion TO anon;
GRANT EXECUTE ON FUNCTION public.validar_solicitud_asociacion TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Restringir la política RLS de INSERT directo
--    (quitar el WITH CHECK (true) irrestricto)
-- -----------------------------------------------------------------------------

-- Revocar INSERT directo de rol anon en solicitudes_asociados
-- y exigir que pasen por la función RPC validada

DROP POLICY IF EXISTS "Cualquiera puede insertar solicitud" ON solicitudes_asociados;
DROP POLICY IF EXISTS "Anon puede insertar solicitud"       ON solicitudes_asociados;
DROP POLICY IF EXISTS "Insert solicitud publica"            ON solicitudes_asociados;

-- Nueva política: solo permite INSERT si viene a través de la función RPC
-- (La función tiene SECURITY DEFINER, por lo que el INSERT lo hace postgres)
-- En la práctica esto bloquea el INSERT directo desde el cliente

ALTER TABLE solicitudes_asociados ENABLE ROW LEVEL SECURITY;

-- Admins pueden ver todo
DROP POLICY IF EXISTS "Admin ve todas las solicitudes" ON solicitudes_asociados;
CREATE POLICY "Admin ve todas las solicitudes"
  ON solicitudes_asociados FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      WHERE u.id = auth.uid() AND r.nombre = 'admin'
    )
  );

-- El propio solicitante puede ver su solicitud (si está logueado)
DROP POLICY IF EXISTS "Usuario ve su propia solicitud" ON solicitudes_asociados;
CREATE POLICY "Usuario ve su propia solicitud"
  ON solicitudes_asociados FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- No se permite INSERT directo — solo a través de la función RPC
-- (La función usa SECURITY DEFINER, no necesita política de INSERT)

-- -----------------------------------------------------------------------------
-- 3. Verificación
-- -----------------------------------------------------------------------------

SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'validar_solicitud_asociacion';
