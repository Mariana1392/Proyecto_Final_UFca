-- =============================================================================
-- UFCA - RPC para verificar disponibilidad de cédula o correo en tiempo real
-- =============================================================================
-- Permite a usuarios anónimos (o autenticados) verificar si una cédula o email
-- ya está registrado como asociado activo o si tiene una solicitud en curso.
-- Usa SECURITY DEFINER para saltar RLS y consultar de forma segura sin exponer
-- datos sensibles.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.verificar_disponibilidad_solicitud(
  p_campo TEXT,
  p_valor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usr_id UUID;
  v_rol_nombre TEXT;
  v_sol_id UUID;
  v_sol_estado TEXT;
  v_result JSONB;
BEGIN
  v_result := 'null'::jsonb;

  -- 1. Verificar si ya es usuario registrado con rol asociado
  IF p_campo = 'cedula' THEN
    SELECT u.id, r.nombre INTO v_usr_id, v_rol_nombre
    FROM usuarios u
    LEFT JOIN roles r ON u.rol_id = r.id
    WHERE u.cedula = p_valor
    LIMIT 1;
  ELSIF p_campo = 'email' THEN
    SELECT u.id, r.nombre INTO v_usr_id, v_rol_nombre
    FROM usuarios u
    LEFT JOIN roles r ON u.rol_id = r.id
    WHERE u.email = p_valor
    LIMIT 1;
  END IF;

  -- Si el usuario ya existe y es asociado
  IF v_usr_id IS NOT NULL AND v_rol_nombre = 'asociado' THEN
    RETURN jsonb_build_object(
      'tipo', 'asociado',
      'mensaje', 'Ya eres asociado UFCA — inicia sesión',
      'bloquea', true
    );
  END IF;

  -- Si el usuario existe pero no es asociado, se puede bloquear también si la cédula es usada por alguien más.
  -- Para no complicar la respuesta y mantener privacidad, solo devolvemos si es asociado o no.
  IF v_usr_id IS NOT NULL AND v_rol_nombre != 'asociado' THEN
      RETURN jsonb_build_object(
      'tipo', 'usuario_registrado',
      'mensaje', 'Esta ' || p_campo || ' ya pertenece a un usuario en el sistema. Inicia sesión en tu cuenta para aplicar desde el panel principal.',
      'bloquea', true
    );
  END IF;

  -- 2. Verificar si ya tiene una solicitud
  IF p_campo = 'cedula' THEN
    SELECT id, estado INTO v_sol_id, v_sol_estado
    FROM solicitudes_asociados
    WHERE cedula = p_valor
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF p_campo = 'email' THEN
    SELECT id, estado INTO v_sol_id, v_sol_estado
    FROM solicitudes_asociados
    WHERE email = p_valor
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_sol_id IS NOT NULL THEN
    IF v_sol_estado = 'rechazada' THEN
      RETURN jsonb_build_object(
        'tipo', 'rechazada',
        'mensaje', 'Tu solicitud anterior fue rechazada — puedes reenviarla o comunicarte con administración',
        'bloquea', false
      );
    ELSE
      RETURN jsonb_build_object(
        'tipo', 'en_proceso',
        'mensaje', 'Ya tienes una solicitud en proceso (' || v_sol_estado || ')',
        'bloquea', true
      );
    END IF;
  END IF;

  -- Si no existe nada, está disponible
  RETURN jsonb_build_object(
    'tipo', 'disponible',
    'mensaje', 'Disponible',
    'bloquea', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_disponibilidad_solicitud(TEXT, TEXT) TO anon, authenticated;

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
