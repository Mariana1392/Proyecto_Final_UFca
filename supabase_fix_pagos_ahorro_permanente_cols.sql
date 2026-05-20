-- =============================================================================
-- FIX: pagos_ahorro_permanente — columnas que usa la UI pero no existen en BD
-- La tabla fue creada con columnas de estilo "cuota" (monto_cuota, fecha_pago)
-- pero el historial de la UI usa nombres de estilo "movimiento":
--   monto, fecha_movimiento, tipo_movimiento, saldo_anterior, saldo_nuevo, anulado
--
-- Este script:
--   1. Agrega las columnas faltantes (idempotente: ADD COLUMN IF NOT EXISTS)
--   2. Backfill de datos existentes
--   3. Recalcula saldo_nuevo acumulado por ahorro
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

-- 1. Agregar columnas faltantes
ALTER TABLE pagos_ahorro_permanente
  ADD COLUMN IF NOT EXISTS monto            NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS saldo_anterior   NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_nuevo      NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_movimiento  VARCHAR(30)   NOT NULL DEFAULT 'Aporte',
  ADD COLUMN IF NOT EXISTS fecha_movimiento DATE,
  ADD COLUMN IF NOT EXISTS anulado          BOOLEAN       NOT NULL DEFAULT false;

-- 2. Backfill básico para registros existentes
UPDATE pagos_ahorro_permanente
SET
  monto            = COALESCE(monto, monto_cuota),
  fecha_movimiento = COALESCE(fecha_movimiento, fecha_pago)
WHERE monto IS NULL OR fecha_movimiento IS NULL;

-- 3. Recalcular saldo_nuevo y saldo_anterior acumulados por ahorro
--    Solo actualiza filas donde saldo_nuevo = 0 (es decir, aún sin calcular)
WITH ranked AS (
  SELECT
    id,
    ahorro_permanente_id,
    COALESCE(monto, monto_cuota) AS monto_real,
    fecha_pago,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY ahorro_permanente_id
      ORDER BY fecha_pago, created_at
    ) AS rn
  FROM pagos_ahorro_permanente
  WHERE anulado = false
),
cumulative AS (
  SELECT
    r.id,
    SUM(r2.monto_real) AS saldo_acum,
    SUM(r2.monto_real) - r.monto_real AS saldo_ant
  FROM ranked r
  JOIN ranked r2
    ON r2.ahorro_permanente_id = r.ahorro_permanente_id
    AND r2.rn <= r.rn
  GROUP BY r.id, r.monto_real
)
UPDATE pagos_ahorro_permanente p
SET
  saldo_nuevo    = c.saldo_acum,
  saldo_anterior = GREATEST(c.saldo_ant, 0)
FROM cumulative c
WHERE p.id = c.id
  AND p.saldo_nuevo = 0;

-- 4. Verificación
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'pagos_ahorro_permanente'
  AND column_name IN (
    'monto', 'saldo_anterior', 'saldo_nuevo',
    'tipo_movimiento', 'fecha_movimiento', 'anulado'
  )
ORDER BY column_name;

-- Vista previa de los movimientos con saldos calculados
SELECT
  id,
  ahorro_permanente_id,
  tipo_movimiento,
  monto,
  saldo_anterior,
  saldo_nuevo,
  fecha_movimiento,
  anulado
FROM pagos_ahorro_permanente
ORDER BY ahorro_permanente_id, fecha_pago, created_at
LIMIT 20;
