-- ── Ejecutar en el SQL Editor de Supabase ────────────────────────────────────
-- Función RPC para crear un evento e inscribir automáticamente
-- a todos los asociados activos. Usa SECURITY DEFINER para saltarse RLS.

CREATE OR REPLACE FUNCTION crear_evento_con_inscritos(
  p_titulo       TEXT,
  p_descripcion  TEXT,
  p_fecha        DATE,
  p_lugar        TEXT,
  p_capacidad    INTEGER,
  p_estado       TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_evento_id UUID;
  v_resultado JSON;
BEGIN
  -- 1. Insertar el evento
  INSERT INTO eventos (titulo, descripcion, fecha, lugar, capacidad, estado)
  VALUES (p_titulo, p_descripcion, p_fecha, p_lugar, p_capacidad, p_estado)
  RETURNING id INTO v_evento_id;

  -- 2. Inscribir automáticamente a todos los asociados activos (no anulados)
  INSERT INTO eventos_inscritos (evento_id, asociado_id)
  SELECT v_evento_id, id
  FROM asociados
  WHERE estado = true
    AND (anulado = false OR anulado IS NULL);

  -- 3. Retornar el evento recién creado como JSON
  SELECT row_to_json(e) INTO v_resultado
  FROM eventos e
  WHERE e.id = v_evento_id;

  RETURN v_resultado;
END;
$$;

-- Permisos para usuarios autenticados
GRANT EXECUTE ON FUNCTION crear_evento_con_inscritos(TEXT, TEXT, DATE, TEXT, INTEGER, TEXT) TO authenticated;

-- Notificar a PostgREST que recargue el schema
NOTIFY pgrst, 'reload schema';
