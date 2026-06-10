-- =============================================================================
-- UFCA — Trigger: notificación automática al admin cuando llega solicitud
-- =============================================================================
-- Problema: el formulario de afiliación (Hero) lo llena un usuario NO autenticado.
-- La política RLS de `notificaciones` solo permite INSERT a usuarios autenticados,
-- así que el insert desde el cliente falla silenciosamente.
--
-- Solución: trigger SECURITY DEFINER en `solicitudes_asociados`.
-- Cuando se inserta una nueva solicitud con estado='pendiente', el trigger
-- crea la notificación server-side (sin importar si el cliente está autenticado).
-- =============================================================================

-- 1. Función trigger para solicitudes de afiliación
CREATE OR REPLACE FUNCTION public.notificar_nueva_solicitud_afiliacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'pendiente' THEN
    INSERT INTO notificaciones (titulo, mensaje, tipo, leida, para_admin, created_at)
    VALUES (
      'Nueva solicitud de afiliación',
      NEW.nombres || ' ' || NEW.apellidos ||
        ' ha enviado una solicitud de membresía y está pendiente de revisión.',
      'solicitud_afiliacion',
      false,
      true,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_notif_nueva_solicitud_afiliacion ON solicitudes_asociados;
CREATE TRIGGER tg_notif_nueva_solicitud_afiliacion
  AFTER INSERT ON solicitudes_asociados
  FOR EACH ROW
  EXECUTE FUNCTION public.notificar_nueva_solicitud_afiliacion();

-- 2. Verificar que el trigger quedó activo
SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'tg_notif_nueva_solicitud_afiliacion';
