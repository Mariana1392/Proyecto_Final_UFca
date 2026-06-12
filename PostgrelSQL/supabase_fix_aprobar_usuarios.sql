-- =============================================================================
-- FIX: aprobar_afiliacion SIN tabla 'asociados'
-- Este script corrige el RPC para que trabaje correctamente con la tabla 'usuarios'
-- y vincula correctamente la cuenta de ahorros y los roles.
-- =============================================================================


-- 1. Actualizar el trigger de creacion de usuarios en Auth
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


-- 2. Corregir aprobar_afiliacion para que use 'usuarios' en vez de 'asociados'
DROP FUNCTION IF EXISTS aprobar_afiliacion(uuid, uuid, numeric);

CREATE OR REPLACE FUNCTION aprobar_afiliacion(
  p_solicitud_id UUID,
  p_admin_id     UUID,
  p_cuota_final  NUMERIC(15,2) DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitud    RECORD;
  v_periodo_id   UUID;
  v_cuota        NUMERIC(15,2);
  v_cuota_minima NUMERIC(15,2);
  v_rol_asociado UUID;
BEGIN
  -- PASO 1: Validar solicitud
  SELECT * INTO v_solicitud FROM solicitudes_asociados WHERE id = p_solicitud_id AND estado IN ('pendiente', 'pendiente_activacion');
  IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud % no existe o ya fue procesada.', p_solicitud_id USING ERRCODE = 'P0001'; END IF;

  -- PASO 2: Validar periodo activo
  SELECT id INTO v_periodo_id FROM periodos WHERE estado = 'activo' ORDER BY fecha_inicio DESC LIMIT 1;
  IF v_periodo_id IS NULL THEN RAISE EXCEPTION 'No hay un período contable activo. Abra un período primero.' USING ERRCODE = 'P0002'; END IF;

  -- PASO 3: Determinar cuota
  SELECT COALESCE(valor::numeric, 100000) INTO v_cuota_minima FROM configuracion WHERE clave = 'cuota_ahorro_permanente';
  v_cuota := COALESCE(p_cuota_final, v_solicitud.monto_ahorro_propuesto, v_cuota_minima);

  -- PASO 4: Si el solicitante ya es usuario (inició sesión para pedirla), le damos rol y cuenta
  IF v_solicitud.usuario_id IS NOT NULL THEN
    -- Actualizar rol a asociado
    SELECT id INTO v_rol_asociado FROM roles WHERE nombre = 'asociado' LIMIT 1;
    IF v_rol_asociado IS NOT NULL THEN
      UPDATE usuarios SET rol_id = v_rol_asociado WHERE id = v_solicitud.usuario_id;
    END IF;

    -- Crear cuenta de ahorro permanente
    IF NOT EXISTS (SELECT 1 FROM cuentas_ahorro WHERE asociado_id = v_solicitud.usuario_id AND tipo = 'permanente' AND anulado = false) THEN
      INSERT INTO cuentas_ahorro (tipo, asociado_id, periodo_id, cuota_mensual, monto_ahorrado, estado, anulado)
      VALUES ('permanente', v_solicitud.usuario_id, v_periodo_id, v_cuota, 0, 'activo', false);
    END IF;
  END IF;

  -- PASO 5: Marcar solicitud como aprobada
  UPDATE solicitudes_asociados SET
    estado = 'aprobada',
    aprobado_por = p_admin_id,
    fecha_resolucion = NOW(),
    fecha_activacion = CURRENT_DATE,
    monto_ahorro_propuesto = v_cuota
  WHERE id = p_solicitud_id;

  -- PASO 6: Cerrar comité evaluador
  UPDATE comite_evaluador SET decision = 'aprobado', fecha = NOW(), updated_at = NOW()
  WHERE solicitud_asociado_id = p_solicitud_id AND decision = 'en_evaluacion';

  -- PASO 7: Auditoría
  INSERT INTO auditoria (usuario_id, asociado_id, tabla, registro_id, accion)
  VALUES (p_admin_id, v_solicitud.usuario_id, 'solicitudes_asociados', p_solicitud_id, 'APROBAR_AFILIACION');

  RETURN v_solicitud.usuario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION aprobar_afiliacion(UUID, UUID, NUMERIC) TO authenticated;
