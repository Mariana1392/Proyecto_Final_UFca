-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla de pagos de créditos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pagos_credito (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id    UUID          NOT NULL REFERENCES creditos(id) ON DELETE CASCADE,
  asociado_id   UUID          NOT NULL REFERENCES asociados(id),
  monto_pagado  DECIMAL(14,2) NOT NULL CHECK (monto_pagado > 0),
  capital       DECIMAL(14,2) NOT NULL DEFAULT 0,
  interes       DECIMAL(14,2) NOT NULL DEFAULT 0,
  saldo_antes   DECIMAL(14,2) NOT NULL DEFAULT 0,
  saldo_despues DECIMAL(14,2) NOT NULL DEFAULT 0,
  num_cuota     INTEGER,
  fecha_pago    DATE          NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago   VARCHAR(50)   DEFAULT 'efectivo',
  observacion   TEXT,
  registrado_por TEXT,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE  pagos_credito              IS 'Registro de pagos de cuotas de créditos';
COMMENT ON COLUMN pagos_credito.capital      IS 'Porción del pago que abona a capital';
COMMENT ON COLUMN pagos_credito.interes      IS 'Porción del pago que corresponde a intereses';
COMMENT ON COLUMN pagos_credito.saldo_antes  IS 'Saldo del crédito antes del pago';
COMMENT ON COLUMN pagos_credito.saldo_despues IS 'Saldo del crédito después del pago';
COMMENT ON COLUMN pagos_credito.num_cuota    IS 'Número de cuota que se está pagando';
COMMENT ON COLUMN pagos_credito.metodo_pago  IS 'efectivo | transferencia | cheque | otro';

-- Índices para consultas rápidas por crédito y por asociado
CREATE INDEX IF NOT EXISTS idx_pagos_credito_credito_id   ON pagos_credito(credito_id);
CREATE INDEX IF NOT EXISTS idx_pagos_credito_asociado_id  ON pagos_credito(asociado_id);
CREATE INDEX IF NOT EXISTS idx_pagos_credito_fecha        ON pagos_credito(fecha_pago DESC);

-- RLS: activar seguridad por fila
ALTER TABLE pagos_credito ENABLE ROW LEVEL SECURITY;

-- Política: asociado solo ve sus propios pagos
CREATE POLICY "Asociado ve sus pagos"
  ON pagos_credito FOR SELECT
  TO authenticated
  USING (
    asociado_id IN (
      SELECT id FROM asociados
      WHERE id = asociado_id
    )
  );

-- Política: autenticados pueden insertar pagos
CREATE POLICY "Autenticados insertan pagos"
  ON pagos_credito FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Forzar recarga del schema cache
NOTIFY pgrst, 'reload schema';

-- Verificar
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'pagos_credito'
ORDER BY ordinal_position;
