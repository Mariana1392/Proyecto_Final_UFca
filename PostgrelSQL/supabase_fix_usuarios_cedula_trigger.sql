-- =============================================================================
-- FIX: Sincronización de Identificación (Cédula) al Registrarse
--
-- Causa del problema:
--   Cuando un administrador aprueba una afiliación, los datos (cédula, teléfono,
--   dirección, email) quedan en la tabla `public.solicitudes_asociados`.
--   Al registrarse el usuario usando el link de invitación por correo, se dispara
--   el trigger handle_new_user() en la inserción de `auth.users` que crea el
--   registro en `public.usuarios`.
--   Sin embargo, el trigger anterior no copiaba la cédula, teléfono ni dirección
--   de la solicitud de afiliación a `public.usuarios`, dejándolos como NULL.
--
-- Solución:
--   1. Actualizar el trigger handle_new_user() para que busque la solicitud de
--      afiliación (`solicitudes_asociados`) asociada al email del nuevo usuario y
--      copie su cédula, teléfono y dirección al crear su cuenta en `public.usuarios`.
--   2. Reparar registros existentes que quedaron en NULL buscando en la tabla
--      de solicitudes de asociados. (Este paso ya se ejecutó automáticamente
--      para limpiar tu base de datos actual, pero se incluye aquí por seguridad).
-- =============================================================================

-- 1. Actualizar la función del trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_id       UUID;
  v_rol_nombre   TEXT;
  v_solicitud    RECORD;
  v_periodo_id   UUID;
  v_cuota_minima NUMERIC;
BEGIN
  -- Leer el rol del metadata de la invitación (pasa desde el frontend al invitar)
  v_rol_nombre := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'rol'), ''), 'usuario');
  
  -- Buscar el ID del rol en la base de datos
  SELECT id INTO v_rol_id FROM public.roles WHERE nombre = v_rol_nombre LIMIT 1;
  IF v_rol_id IS NULL THEN 
    SELECT id INTO v_rol_id FROM public.roles WHERE nombre = 'usuario' LIMIT 1; 
  END IF;

  -- Buscar si existe una solicitud de afiliación aprobada o pendiente para este email
  SELECT * INTO v_solicitud 
  FROM public.solicitudes_asociados 
  WHERE LOWER(email) = LOWER(NEW.email) 
    AND estado IN ('aprobada', 'pendiente_activacion') 
  ORDER BY created_at DESC 
  LIMIT 1;

  -- Insertar en la tabla usuarios con el rol asignado, copiando la identificación (cédula) y perfil
  INSERT INTO public.usuarios (
    id, 
    nombre, 
    email, 
    rol_id, 
    activo, 
    cedula, 
    telefono, 
    direccion,
    fecha_ingreso
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    v_rol_id,
    true,
    CASE WHEN v_solicitud.cedula IS NOT NULL THEN v_solicitud.cedula ELSE null END,
    CASE WHEN v_solicitud.telefono IS NOT NULL THEN v_solicitud.telefono ELSE null END,
    CASE WHEN v_solicitud.direccion IS NOT NULL THEN v_solicitud.direccion ELSE null END,
    CASE WHEN v_solicitud.id IS NOT NULL THEN COALESCE(v_solicitud.fecha_activacion, CURRENT_DATE) ELSE null END
  )
  ON CONFLICT (id) DO UPDATE
    SET
      cedula = COALESCE(NULLIF(TRIM(usuarios.cedula), ''), EXCLUDED.cedula),
      telefono = COALESCE(NULLIF(TRIM(usuarios.telefono), ''), EXCLUDED.telefono),
      direccion = COALESCE(NULLIF(TRIM(usuarios.direccion), ''), EXCLUDED.direccion),
      fecha_ingreso = COALESCE(usuarios.fecha_ingreso, EXCLUDED.fecha_ingreso);

  -- Si fue registrado como asociado, vincular solicitud y crear cuenta de ahorro permanentemente
  IF v_rol_nombre = 'asociado' AND v_solicitud.id IS NOT NULL THEN
    -- Vincular la solicitud al nuevo usuario
    UPDATE public.solicitudes_asociados SET usuario_id = NEW.id WHERE id = v_solicitud.id;
    
    -- Buscar periodo activo para crear la cuenta de ahorro
    SELECT id INTO v_periodo_id FROM public.periodos WHERE estado = 'activo' ORDER BY fecha_inicio DESC LIMIT 1;
    
    IF v_periodo_id IS NOT NULL THEN
      SELECT COALESCE(valor::numeric, 100000) INTO v_cuota_minima FROM public.configuracion WHERE clave = 'cuota_ahorro_permanente';
      
      -- Crear ahorro permanente si no existe
      IF NOT EXISTS (SELECT 1 FROM public.cuentas_ahorro WHERE asociado_id = NEW.id AND tipo = 'permanente' AND anulado = false) THEN
        INSERT INTO public.cuentas_ahorro (tipo, asociado_id, periodo_id, cuota_mensual, monto_ahorrado, estado, anulado)
        VALUES (
          'permanente', 
          NEW.id, 
          v_periodo_id, 
          COALESCE(v_solicitud.monto_ahorro_propuesto, v_cuota_minima), 
          0, 
          'activo', 
          false
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Reparar registros existentes que quedaron en public.usuarios sin identificación (cédula) o fecha de ingreso
UPDATE public.usuarios u
SET 
  cedula = COALESCE(NULLIF(TRIM(u.cedula), ''), s.cedula),
  telefono = COALESCE(NULLIF(TRIM(u.telefono), ''), s.telefono),
  direccion = COALESCE(NULLIF(TRIM(u.direccion), ''), s.direccion),
  fecha_ingreso = COALESCE(u.fecha_ingreso, s.fecha_activacion, s.fecha_resolucion::date, s.created_at::date)
FROM public.solicitudes_asociados s
WHERE LOWER(u.email) = LOWER(s.email)
  AND (u.cedula IS NULL OR u.cedula = '' OR u.fecha_ingreso IS NULL);

-- 3. Vincular solicitudes_asociados a usuarios existentes
UPDATE public.solicitudes_asociados s
SET usuario_id = u.id
FROM public.usuarios u
WHERE LOWER(s.email) = LOWER(u.email)
  AND s.usuario_id IS NULL;
