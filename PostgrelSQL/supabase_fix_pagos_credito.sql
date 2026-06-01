-- ─────────────────────────────────────────────────────────────────────────────
-- FIX DEFINITIVO: tabla pagos_credito
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Eliminar la tabla si existe (con todo lo que depende de ella)
DROP TABLE IF EXISTS pagos_credito CASCADE;

-- 2. Recrear con asociado_id nullable (sin FK que causa conflicto de tipos)
CREATE TABLE pagos_credito (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id    UUID          NOT NULL REFERENCES creditos(id) ON DELETE CASCADE,
  asociado_id   UUID,                          -- nullable, sin FK forzada
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

-- 3. Índices
CREATE INDEX idx_pagos_credito_credito_id  ON pagos_credito(credito_id);
CREATE INDEX idx_pagos_credito_fecha       ON pagos_credito(fecha_pago DESC);

-- 4. RLS
ALTER TABLE pagos_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados ven pagos"
  ON pagos_credito FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Autenticados insertan pagos"
  ON pagos_credito FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Autenticados actualizan pagos"
  ON pagos_credito FOR UPDATE
  TO authenticated
  USING (true);

-- 5. Forzar recarga del schema cache
NOTIFY pgrst, 'reload schema';

-- 6. Verificar columnas resultantes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pagos_credito'
ORDER BY ordinal_position;
