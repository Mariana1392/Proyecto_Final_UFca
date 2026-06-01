-- ─────────────────────────────────────────────────────────────────────────────
-- Historial de modificaciones y notificaciones — Ahorro Voluntario
-- Ejecutar en Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Historial de modificaciones del ahorro voluntario
CREATE TABLE IF NOT EXISTS historial_modificaciones_ahorro_voluntario (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ahorro_id        UUID REFERENCES ahorro_voluntario(id) ON DELETE CASCADE,
  asociado_id      UUID REFERENCES asociados(id) ON DELETE SET NULL,
  usuario_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nombre   VARCHAR(200),
  fecha_cambio     TIMESTAMPTZ DEFAULT NOW(),
  -- Valores anteriores
  cuota_anterior       DECIMAL(12,2),
  frecuencia_anterior  VARCHAR(20),
  objetivo_anterior    DECIMAL(12,2),
  saldo_anterior       DECIMAL(12,2),
  fecha_inicio_anterior DATE,
  -- Valores nuevos
  cuota_nueva          DECIMAL(12,2),
  frecuencia_nueva     VARCHAR(20),
  objetivo_nuevo       DECIMAL(12,2),
  saldo_nuevo          DECIMAL(12,2),
  fecha_inicio_nueva   DATE,
  -- Metadata
  campos_modificados   TEXT,   -- lista de campos que cambiaron
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_mod_av_ahorro_id   ON historial_modificaciones_ahorro_voluntario(ahorro_id);
CREATE INDEX IF NOT EXISTS idx_historial_mod_av_asociado_id ON historial_modificaciones_ahorro_voluntario(asociado_id);
CREATE INDEX IF NOT EXISTS idx_historial_mod_av_fecha       ON historial_modificaciones_ahorro_voluntario(fecha_cambio DESC);

-- RLS
ALTER TABLE historial_modificaciones_ahorro_voluntario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historial_mod_av_select" ON historial_modificaciones_ahorro_voluntario
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "historial_mod_av_insert" ON historial_modificaciones_ahorro_voluntario
  FOR INSERT TO authenticated WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────

-- 2. Tabla de notificaciones (si no existe)
CREATE TABLE IF NOT EXISTS notificaciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id  UUID REFERENCES asociados(id) ON DELETE CASCADE,
  titulo       VARCHAR(200) NOT NULL,
  mensaje      TEXT NOT NULL,
  tipo         VARCHAR(50) DEFAULT 'info',   -- 'info' | 'alerta' | 'modificacion' | 'anulacion'
  leida        BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_asociado_id ON notificaciones(asociado_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida       ON notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_created_at  ON notificaciones(created_at DESC);

-- RLS
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificaciones_select" ON notificaciones
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "notificaciones_insert" ON notificaciones
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notificaciones_update" ON notificaciones
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificar
SELECT 'historial_modificaciones_ahorro_voluntario' AS tabla, COUNT(*) FROM historial_modificaciones_ahorro_voluntario
UNION ALL
SELECT 'notificaciones', COUNT(*) FROM notificaciones;
