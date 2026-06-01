-- ── Ejecutar en el SQL Editor de Supabase ────────────────────────────────────
-- Funciones RPC para confirmar y rechazar simulaciones de crédito desde el portal
-- del asociado. Corren con SECURITY DEFINER (privilegios de postgres), bypasean RLS.

-- ── 1. Confirmar simulación → pasa a ACTIVO ──────────────────────────────────
CREATE OR REPLACE FUNCTION confirmar_simulacion_credito(p_credito_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE creditos SET
    estado               = 'activo',
    saldo                = monto,
    fecha_desembolso     = CURRENT_DATE,
    fecha_estado_cambio  = NOW(),
    motivo_estado_cambio = 'Crédito confirmado y activado por el asociado',
    anulado              = false
  WHERE id = p_credito_id
    AND estado = 'simulacion';
END;
$$;

-- ── 2. Rechazar simulación → elimina el registro ──────────────────────────────
CREATE OR REPLACE FUNCTION rechazar_simulacion_credito(p_credito_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM creditos
  WHERE id = p_credito_id
    AND estado = 'simulacion';
END;
$$;

-- Permisos para usuarios autenticados
GRANT EXECUTE ON FUNCTION confirmar_simulacion_credito(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rechazar_simulacion_credito(UUID)  TO authenticated;

-- Notificar a PostgREST que recargue el schema
NOTIFY pgrst, 'reload schema';
