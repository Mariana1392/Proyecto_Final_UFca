-- ============================================================
-- UFCA - Setup Ahorro Permanente
-- Criterios de aceptación:
--   1. Monto obligatorio persistido en BD
--   2. Registro asociado a miembro existente con fecha inicio
--   3. Saldo inicial cargado como movimiento de apertura
-- ============================================================

-- ── 1. Tabla configuracion (monto obligatorio y otros parámetros globales) ──
CREATE TABLE IF NOT EXISTS configuracion (
  id           VARCHAR(50)    PRIMARY KEY,
  valor        TEXT           NOT NULL,
  descripcion  TEXT,
  updated_at   TIMESTAMPTZ    DEFAULT NOW()
);

-- Insertar monto obligatorio por defecto si no existe
INSERT INTO configuracion (id, valor, descripcion)
VALUES ('monto_obligatorio_ahorro_permanente', '50000', 'Monto obligatorio mensual para el plan de ahorro permanente')
ON CONFLICT (id) DO NOTHING;

-- ── 2. Tabla movimientos_ahorro_permanente ───────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_ahorro_permanente (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  ahorro_id        UUID           NOT NULL REFERENCES ahorro_permanente(id) ON DELETE CASCADE,
  tipo_movimiento  VARCHAR(30)    NOT NULL CHECK (tipo_movimiento IN ('Aporte', 'Retiro', 'Ajuste', 'Apertura')),
  monto            NUMERIC(14,2)  NOT NULL CHECK (monto >= 0),
  saldo_anterior   NUMERIC(14,2)  NOT NULL DEFAULT 0,
  saldo_nuevo      NUMERIC(14,2)  NOT NULL DEFAULT 0,
  fecha_movimiento DATE           NOT NULL DEFAULT CURRENT_DATE,
  descripcion      TEXT,
  registrado_por   TEXT,
  anulado          BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ    DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_mov_ahorro_perm_ahorro_id ON movimientos_ahorro_permanente(ahorro_id);
CREATE INDEX IF NOT EXISTS idx_mov_ahorro_perm_fecha     ON movimientos_ahorro_permanente(fecha_movimiento);

-- ── 3. RLS Policies ──────────────────────────────────────────────────────────

-- configuracion
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "config_select_all"  ON configuracion;
DROP POLICY IF EXISTS "config_update_all"  ON configuracion;
CREATE POLICY "config_select_all" ON configuracion FOR SELECT USING (true);
CREATE POLICY "config_update_all" ON configuracion FOR ALL   USING (true) WITH CHECK (true);

-- movimientos_ahorro_permanente
ALTER TABLE movimientos_ahorro_permanente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mov_perm_select" ON movimientos_ahorro_permanente;
DROP POLICY IF EXISTS "mov_perm_insert" ON movimientos_ahorro_permanente;
DROP POLICY IF EXISTS "mov_perm_update" ON movimientos_ahorro_permanente;
CREATE POLICY "mov_perm_select" ON movimientos_ahorro_permanente FOR SELECT USING (true);
CREATE POLICY "mov_perm_insert" ON movimientos_ahorro_permanente FOR INSERT WITH CHECK (true);
CREATE POLICY "mov_perm_update" ON movimientos_ahorro_permanente FOR UPDATE USING (true) WITH CHECK (true);

-- ── 4. Verificar estructura de ahorro_permanente ─────────────────────────────
-- Asegura que la tabla principal tenga todos los campos necesarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ahorro_permanente' AND column_name = 'monto_obligatorio'
  ) THEN
    ALTER TABLE ahorro_permanente ADD COLUMN monto_obligatorio NUMERIC(14,2) DEFAULT 0;
  END IF;
END $$;

-- ── 5. Migrar saldos iniciales existentes como movimiento "Apertura" ─────────
-- Solo para registros que tienen monto_ahorrado > 0 y no tienen ningún movimiento
INSERT INTO movimientos_ahorro_permanente
  (ahorro_id, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, fecha_movimiento, descripcion)
SELECT
  ap.id,
  'Apertura',
  ap.monto_ahorrado,
  0,
  ap.monto_ahorrado,
  ap.fecha_inicio,
  'Saldo inicial cargado al crear el plan'
FROM ahorro_permanente ap
WHERE ap.monto_ahorrado > 0
  AND NOT EXISTS (
    SELECT 1 FROM movimientos_ahorro_permanente m WHERE m.ahorro_id = ap.id
  );

-- ── Verificar resultado ───────────────────────────────────────────────────────
SELECT 'configuracion' AS tabla, count(*)::text AS registros FROM configuracion
UNION ALL
SELECT 'movimientos_ahorro_permanente', count(*)::text FROM movimientos_ahorro_permanente;
