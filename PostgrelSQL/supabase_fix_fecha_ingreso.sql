-- =============================================================================
-- FIX: Automatización y Corrección de Fecha de Ingreso para Asociados
--
-- Ejecutar en: Supabase → SQL Editor
--
-- Qué hace:
--   1. Realiza un backfill para asignar la fecha de ingreso a los asociados
--      que ya están en el sistema pero la tienen en NULL.
--   2. Actualiza el trigger fn_activar_asociado_por_pago() para guardar la 
--      fecha de ingreso en la tabla usuarios al procesar el primer pago.
--   3. Actualiza el trigger handle_new_user() para guardar la fecha de ingreso
--      en la tabla usuarios cuando se vincula una solicitud aprobada.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ACTUALIZACIÓN RETROACTIVA (BACKFILL)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.usuarios u
SET fecha_ingreso = COALESCE(s.fecha_activacion, s.fecha_resolucion::date, s.created_at::date)
FROM public.solicitudes_asociados s
WHERE s.usuario_id = u.id
  AND u.fecha_ingreso IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TRIGGER DE ACTIVACIÓN POR PRIMER PAGO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_activar_asociado_por_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asociado_id UUID;
  v_tipo_cuenta TEXT;
BEGIN
  -- Solo nos interesan los aportes permanentes
  IF NEW.tipo != 'aporte_permanente' THEN
    RETURN NEW;
  END IF;

  -- Obtener a qué asociado pertenece la cuenta (ahorro_id) y qué tipo de cuenta es
  SELECT asociado_id, tipo INTO v_asociado_id, v_tipo_cuenta
  FROM cuentas_ahorro
  WHERE id = NEW.ahorro_id;

  -- Si es un aporte a la cuenta de ahorro permanente y el monto es mayor a 0
  IF v_tipo_cuenta = 'permanente' AND NEW.monto > 0 THEN
    -- Cambiar la solicitud de pendiente_activacion a aprobada
    UPDATE solicitudes_asociados
    SET estado = 'aprobada', 
        fecha_activacion = CURRENT_DATE
    WHERE usuario_id = v_asociado_id
      AND estado = 'pendiente_activacion';

    -- Activar la cuenta del usuario en la tabla usuarios para permitir su login
    UPDATE usuarios
    SET estado_cuenta = 'activo',
        activo = true,
        fecha_ingreso = COALESCE(fecha_ingreso, CURRENT_DATE), -- Asigna fecha de ingreso
        updated_at = NOW()
    WHERE id = v_asociado_id
      AND estado_cuenta = 'pendiente_activacion';
  END IF;

  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TRIGGER DE REGISTRO DE NUEVO USUARIO (INVITACIÓN ACEPTADA)
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
  v_solicitud  RECORD;
  v_periodo_id UUID;
  v_cuota_minima NUMERIC;
BEGIN
  -- Leer el rol del metadata de la invitación
  v_rol_nombre := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'rol'), ''), 'usuario');
  
  -- Buscar el ID del rol en la BD
  SELECT id INTO v_rol_id FROM public.roles WHERE nombre = v_rol_nombre LIMIT 1;
  IF v_rol_id IS NULL THEN 
    SELECT id INTO v_rol_id FROM public.roles WHERE nombre = 'usuario' LIMIT 1; 
  END IF;

  -- Insertar en la tabla usuarios con el rol asignado
  INSERT INTO public.usuarios (id, nombre, email, rol_id, activo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    v_rol_id,
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- Si fue invitado como asociado, vincular solicitud y crear ahorro automáticamente
  IF v_rol_nombre = 'asociado' THEN
    -- Buscar la solicitud aprobada correspondiente a este correo
    SELECT * INTO v_solicitud 
    FROM solicitudes_asociados 
    WHERE email = NEW.email 
      AND estado IN ('aprobada', 'pendiente_activacion') 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF FOUND THEN
      -- Vincular la solicitud al nuevo usuario
      UPDATE solicitudes_asociados SET usuario_id = NEW.id WHERE id = v_solicitud.id;
      
      -- Asignar la fecha de ingreso en la tabla usuarios
      UPDATE usuarios 
      SET fecha_ingreso = COALESCE(v_solicitud.fecha_activacion, CURRENT_DATE)
      WHERE id = NEW.id;
      
      -- Buscar periodo activo para crear la cuenta de ahorro
      SELECT id INTO v_periodo_id FROM periodos WHERE estado = 'activo' ORDER BY fecha_inicio DESC LIMIT 1;
      
      IF v_periodo_id IS NOT NULL THEN
        SELECT COALESCE(valor::numeric, 100000) INTO v_cuota_minima FROM configuracion WHERE clave = 'cuota_ahorro_permanente';
        
        -- Crear ahorro permanente si no existe
        IF NOT EXISTS (SELECT 1 FROM cuentas_ahorro WHERE asociado_id = NEW.id AND tipo = 'permanente' AND anulado = false) THEN
          INSERT INTO cuentas_ahorro (tipo, asociado_id, periodo_id, cuota_mensual, monto_ahorrado, estado, anulado)
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
  END IF;

  RETURN NEW;
END;
$$;
