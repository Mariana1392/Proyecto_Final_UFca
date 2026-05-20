-- =============================================================================
-- FIX: null value in column "periodo_id" of relation "liquidaciones"
--       violates not-null constraint
--
-- Causa: la columna periodo_id tiene NOT NULL pero la natillera no maneja
--        períodos de nómina, por lo que siempre se inserta NULL.
-- Solución: hacer la columna nullable + actualizar el RPC.
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

-- 1. Hacer periodo_id nullable (si existe la columna)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'liquidaciones'
      AND column_name  = 'periodo_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.liquidaciones ALTER COLUMN periodo_id DROP NOT NULL';
    RAISE NOTICE 'periodo_id ahora es nullable en liquidaciones';
  ELSE
    RAISE NOTICE 'La columna periodo_id no existe — no se requiere cambio';
  END IF;
END $$;

-- 2. Reescribir insertar_liquidacion sin periodo_id
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

-- 3. Permisos
REVOKE ALL ON FUNCTION public.insertar_liquidacion(UUID, DATE, NUMERIC, TEXT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.insertar_liquidacion(UUID, DATE, NUMERIC, TEXT, JSONB) TO authenticated;

-- 4. Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'liquidaciones'
  AND column_name  IN ('periodo_id', 'asociado_id', 'tipo', 'monto_total', 'fecha', 'detalle')
ORDER BY column_name;
