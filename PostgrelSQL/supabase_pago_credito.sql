-- ── Ejecutar en el SQL Editor de Supabase ────────────────────────────────────
-- Función RPC para registrar un pago y actualizar el saldo del crédito.
-- Corre con SECURITY DEFINER (privilegios de postgres), bypasea RLS.

CREATE OR REPLACE FUNCTION registrar_pago_credito(
  p_credito_id      UUID,
  p_monto_pagado    NUMERIC,
  p_capital         NUMERIC,
  p_interes         NUMERIC,
  p_saldo_antes     NUMERIC,
  p_saldo_despues   NUMERIC,
  p_num_cuota       INTEGER,
  p_fecha_pago      DATE,
  p_metodo_pago     TEXT,
  p_registrado_por  TEXT,
  p_observacion     TEXT    DEFAULT NULL,
  p_url_comprobante TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pago_id UUID;
  v_result  JSON;
BEGIN
  -- 1. Insertar el pago en pagos_credito
  INSERT INTO pagos_credito (
    credito_id,
    monto_pagado,
    capital,
    interes,
    saldo_antes,
    saldo_despues,
    num_cuota,
    fecha_pago,
    metodo_pago,
    registrado_por,
    observacion,
    url_comprobante
  ) VALUES (
    p_credito_id,
    p_monto_pagado,
    p_capital,
    p_interes,
    p_saldo_antes,
    p_saldo_despues,
    p_num_cuota,
    p_fecha_pago,
    p_metodo_pago,
    p_registrado_por,
    p_observacion,
    p_url_comprobante
  )
  RETURNING id INTO v_pago_id;

  -- 2. Actualizar el saldo del crédito
  IF p_saldo_despues <= 0 THEN
    UPDATE creditos SET
      saldo                = 0,
      estado               = 'pagado',
      fecha_estado_cambio  = NOW(),
      motivo_estado_cambio = 'Crédito pagado en su totalidad'
    WHERE id = p_credito_id;
  ELSE
    UPDATE creditos SET
      saldo = p_saldo_despues
    WHERE id = p_credito_id;
  END IF;

  -- 3. Devolver el pago insertado como JSON
  SELECT row_to_json(p) INTO v_result
  FROM pagos_credito p
  WHERE p.id = v_pago_id;

  RETURN v_result;
END;
$$;

-- Permisos para usuarios autenticados
GRANT EXECUTE ON FUNCTION registrar_pago_credito(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER, DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Notificar a PostgREST que recargue el schema
NOTIFY pgrst, 'reload schema';
