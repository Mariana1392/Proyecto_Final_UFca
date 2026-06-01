-- Ver definición completa de ambas funciones
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name IN ('check_asociado_activo_para_ahorro', 'asociado_esta_activo');

-- Corregir la función asociado_esta_activo para que compare correctamente
-- (asociados.estado es TEXT: 'activo'/'inactivo')
CREATE OR REPLACE FUNCTION asociado_esta_activo(p_asociado_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado text;
  v_activo boolean;
BEGIN
  SELECT estado INTO v_estado FROM asociados WHERE id = p_asociado_id;
  -- Compatible con estado TEXT ('activo') o BOOLEAN (true)
  IF v_estado IS NULL THEN RETURN false; END IF;
  IF v_estado = 'true' OR v_estado = 'activo' OR v_estado = 't' THEN
    RETURN true;
  END IF;
  -- Si es boolean almacenado como texto
  BEGIN
    v_activo := v_estado::boolean;
    RETURN v_activo;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
END;
$$;
