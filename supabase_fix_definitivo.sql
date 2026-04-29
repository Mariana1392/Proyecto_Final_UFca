-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX DEFINITIVO UFCA  –  Ejecutar en Supabase Dashboard → SQL Editor → Run
-- Cubre: columnas faltantes en creditos + recreación de pagos_credito
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. COLUMNAS FALTANTES EN creditos
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE creditos
  ADD COLUMN IF NOT EXISTS url_documento        TEXT,
  ADD COLUMN IF NOT EXISTS editado_por          TEXT,
  ADD COLUMN IF NOT EXISTS editado_en           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_estado_cambio  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_estado_cambio TEXT;

COMMENT ON COLUMN creditos.url_documento        IS 'URL pública del documento de soporte adjunto';
COMMENT ON COLUMN creditos.editado_por          IS 'Nombre o email del admin que realizó la última edición';
COMMENT ON COLUMN creditos.editado_en           IS 'Fecha y hora de la última edición (auditoría)';
COMMENT ON COLUMN creditos.fecha_estado_cambio  IS 'Fecha efectiva del último cambio de estado';
COMMENT ON COLUMN creditos.motivo_estado_cambio IS 'Razón del cambio de estado (mora, pago, aprobación, etc.)';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RECREAR pagos_credito con las columnas que usa el frontend
--    (la tabla original del schema usa nombres distintos)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Eliminar tabla antigua (y todo lo que dependa de ella)
DROP TABLE IF EXISTS pagos_credito CASCADE;

-- 2b. Crear con los nombres de columnas exactos que usa el código
CREATE TABLE pagos_credito (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id     UUID          NOT NULL REFERENCES creditos(id) ON DELETE CASCADE,
  asociado_id    UUID,                            -- nullable, sin FK (puede ser email o uuid)
  monto_pagado   DECIMAL(14,2) NOT NULL CHECK (monto_pagado > 0),
  capital        DECIMAL(14,2) NOT NULL DEFAULT 0,
  interes        DECIMAL(14,2) NOT NULL DEFAULT 0,
  saldo_antes    DECIMAL(14,2) NOT NULL DEFAULT 0,
  saldo_despues  DECIMAL(14,2) NOT NULL DEFAULT 0,
  num_cuota      INTEGER,
  fecha_pago     DATE          NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago    VARCHAR(50)   DEFAULT 'efectivo',
  observacion    TEXT,
  registrado_por TEXT,                            -- texto libre (nombre del admin)
  created_at     TIMESTAMPTZ   DEFAULT NOW()
);

-- 2c. Índices
CREATE INDEX idx_pagos_credito_credito_id ON pagos_credito(credito_id);
CREATE INDEX idx_pagos_credito_fecha      ON pagos_credito(fecha_pago DESC);

-- 2d. RLS
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

CREATE POLICY "Autenticados eliminan pagos"
  ON pagos_credito FOR DELETE
  TO authenticated
  USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Forzar recarga del schema cache de PostgREST
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Verificación: columnas de creditos
-- ─────────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'creditos'
  AND column_name IN (
    'url_documento','editado_por','editado_en',
    'fecha_estado_cambio','motivo_estado_cambio'
  )
ORDER BY column_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Verificación: columnas de pagos_credito
-- ─────────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pagos_credito'
ORDER BY ordinal_position;
