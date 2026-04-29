CREATE OR REPLACE FUNCTION asociado_esta_activo(p_asociado_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado TEXT;
BEGIN
  SELECT estado::TEXT INTO v_estado FROM asociados WHERE id = p_asociado_id;
  RETURN COALESCE(v_estado = 'activo', FALSE);
END;
$$;
