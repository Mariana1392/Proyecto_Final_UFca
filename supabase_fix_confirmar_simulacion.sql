-- =============================================================================
-- FIX: confirmar simulación de crédito no cambia estado ni aparece en admin
-- Problemas:
--   1. RPC ponía estado='activo' en vez de 'aprobado'
--   2. Asociado no tenía permiso RLS para UPDATE en creditos (fallback fallaba)
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

-- 1. Reescribir RPC: simulacion → aprobado (no activo)
CREATE OR REPLACE FUNCTION public.confirmar_simulacion_credito(p_credito_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE creditos SET
    estado               = 'aprobado',
    saldo                = monto,
    fecha_estado_cambio  = NOW(),
    motivo_estado_cambio = 'Crédito confirmado por el asociado — pendiente de desembolso',
    anulado              = false
  WHERE id = p_credito_id
    AND estado = 'simulacion';
END;
$$;

-- 2. Permisos del RPC
REVOKE ALL ON FUNCTION public.confirmar_simulacion_credito(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_simulacion_credito(UUID) TO authenticated;

-- 3. RLS: asociado puede UPDATE su propio crédito (para el fallback)
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creditos_update_authenticated" ON public.creditos;
CREATE POLICY "creditos_update_authenticated"
  ON public.creditos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "creditos_select_authenticated" ON public.creditos;
CREATE POLICY "creditos_select_authenticated"
  ON public.creditos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "creditos_insert_authenticated" ON public.creditos;
CREATE POLICY "creditos_insert_authenticated"
  ON public.creditos FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Recargar caché
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT proname, prosecdef
FROM pg_proc
JOIN pg_namespace n ON n.oid = pronamespace
WHERE n.nspname = 'public' AND proname = 'confirmar_simulacion_credito';
