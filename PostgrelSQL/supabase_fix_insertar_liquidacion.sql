-- =============================================================================
-- FIX: column "periodo" of relation "liquidaciones" does not exist
-- Causa: insertar_liquidacion intentaba escribir en columnas periodo,
--        fecha_inicio, fecha_fin que no existen en la tabla real.
-- La tabla tiene: asociado_id, tipo, monto_total, fecha, detalle, created_at
-- Solución: reescribir la función usando solo las columnas que sí existen.
-- Ejecutar en Supabase → SQL Editor → Run  (CREATE OR REPLACE = idempotente)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.insertar_liquidacion(
  p_asociado_id UUID,
  p_fecha       DATE,
  p_monto_total NUMERIC,
  p_tipo        TEXT,
  p_detalle     JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO liquidaciones (
    asociado_id,
    tipo,
    monto_total,
    fecha,
    detalle
  ) VALUES (
    p_asociado_id,
    p_tipo,
    p_monto_total,
    p_fecha,
    p_detalle
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Permisos
REVOKE ALL ON FUNCTION public.insertar_liquidacion(UUID, DATE, NUMERIC, TEXT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.insertar_liquidacion(UUID, DATE, NUMERIC, TEXT, JSONB) TO authenticated;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificación: debe devolver la definición de la función actualizada
SELECT
  p.proname                          AS funcion,
  pg_get_function_arguments(p.oid)   AS argumentos,
  pg_get_functiondef(p.oid)          AS definicion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'insertar_liquidacion';
