-- =============================================================================
-- SEGURIDAD: Proteger rol_id y activo de auto-modificación
-- Un usuario no puede cambiar su propio rol ni su estado activo
-- aunque la policy RLS le permita actualizar su propio perfil.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_proteger_rol_usuario()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el que actualiza es el dueño del perfil y no tiene permiso de gestión
  IF NEW.id = auth.uid() AND NOT fn_tiene_permiso('gestion_usuarios') THEN
    NEW.rol_id := OLD.rol_id;
    NEW.activo := OLD.activo;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_proteger_rol_usuario
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION fn_proteger_rol_usuario();

-- Verificar que el trigger quedó activo
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'usuarios'
  AND trigger_schema = 'public';
