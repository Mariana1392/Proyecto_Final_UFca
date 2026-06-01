-- ============================================================
-- UFCA – Migración: Fusión de tablas de ahorro
-- Ejecutar en: Supabase → SQL Editor → Run
-- ⚠️  HACER BACKUP ANTES DE EJECUTAR
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. LIMPIAR ESTADO PARCIAL DE EJECUCIONES ANTERIORES
--    (Si el script falló antes, estas tablas pueden existir
--     incompletas — las borramos para recrearlas limpias)
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS movimientos_ahorro CASCADE;
DROP TABLE IF EXISTS ahorros            CASCADE;

DROP FUNCTION IF EXISTS actualizar_saldo_ahorro() CASCADE;


-- ────────────────────────────────────────────────────────────
-- 1. CREAR TABLA UNIFICADA: ahorros
--    Absorbe ahorro_permanente + ahorro_voluntario
--    Discriminador: tipo = 'permanente' | 'voluntario'
-- ────────────────────────────────────────────────────────────
CREATE TABLE ahorros (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id      UUID NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  tipo             VARCHAR(20) NOT NULL CHECK (tipo IN ('permanente', 'voluntario')),
  cuota_mensual    DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto_ahorrado   DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha_inicio     DATE NOT NULL DEFAULT CURRENT_DATE,
  estado           BOOLEAN DEFAULT TRUE,
  anulado          BOOLEAN DEFAULT FALSE,
  motivo_anulacion TEXT,
  -- Campos extra del ahorro voluntario (nulos para permanente)
  frecuencia       VARCHAR(20),
  monto_objetivo   DECIMAL(12,2),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_ahorros_updated_at
  BEFORE UPDATE ON ahorros
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_ahorros_asociado ON ahorros(asociado_id);
CREATE INDEX idx_ahorros_tipo     ON ahorros(tipo);
CREATE INDEX idx_ahorros_estado   ON ahorros(estado);


-- ────────────────────────────────────────────────────────────
-- 2. CREAR TABLA UNIFICADA: movimientos_ahorro
--    Absorbe movimientos_ahorro_permanente + movimientos_ahorro_voluntario
--    Discriminador: tipo_ahorro = 'permanente' | 'voluntario'
-- ────────────────────────────────────────────────────────────
CREATE TABLE movimientos_ahorro (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ahorro_id        UUID NOT NULL REFERENCES ahorros(id) ON DELETE CASCADE,
  asociado_id      UUID NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  tipo_ahorro      VARCHAR(20) NOT NULL CHECK (tipo_ahorro IN ('permanente', 'voluntario')),
  tipo_movimiento  VARCHAR(20) NOT NULL
                   CHECK (tipo_movimiento IN ('Aporte','Depósito','Retiro','Interés','Ajuste')),
  monto            DECIMAL(12,2) NOT NULL,
  saldo_anterior   DECIMAL(12,2) NOT NULL,
  saldo_nuevo      DECIMAL(12,2) NOT NULL,
  fecha_movimiento DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion      TEXT,
  metodo_pago      VARCHAR(50),
  registrado_por   UUID REFERENCES usuarios(id),
  anulado          BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mov_ahorro_ahorro_id    ON movimientos_ahorro(ahorro_id);
CREATE INDEX idx_mov_ahorro_asociado     ON movimientos_ahorro(asociado_id);
CREATE INDEX idx_mov_ahorro_tipo_ahorro  ON movimientos_ahorro(tipo_ahorro);
CREATE INDEX idx_mov_ahorro_fecha        ON movimientos_ahorro(fecha_movimiento);


-- ────────────────────────────────────────────────────────────
-- 3. MIGRAR DATOS: ahorro_permanente → ahorros (tipo='permanente')
-- ────────────────────────────────────────────────────────────
INSERT INTO ahorros (
  id, asociado_id, tipo, cuota_mensual, monto_ahorrado,
  fecha_inicio, estado, anulado, motivo_anulacion,
  created_at, updated_at
)
SELECT
  id, asociado_id, 'permanente', cuota_mensual, monto_ahorrado,
  fecha_inicio, estado, anulado, motivo_anulacion,
  created_at, updated_at
FROM ahorro_permanente;


-- ────────────────────────────────────────────────────────────
-- 4. MIGRAR DATOS: ahorro_voluntario → ahorros (tipo='voluntario')
-- ────────────────────────────────────────────────────────────
INSERT INTO ahorros (
  id, asociado_id, tipo, cuota_mensual, monto_ahorrado,
  fecha_inicio, estado, anulado, motivo_anulacion,
  created_at, updated_at
)
SELECT
  id, asociado_id, 'voluntario', cuota_mensual, monto_ahorrado,
  fecha_inicio, estado, anulado, motivo_anulacion,
  created_at, updated_at
FROM ahorro_voluntario;


-- ────────────────────────────────────────────────────────────
-- 5. MIGRAR DATOS: movimientos_ahorro_permanente → movimientos_ahorro
-- ────────────────────────────────────────────────────────────
INSERT INTO movimientos_ahorro (
  id, ahorro_id, asociado_id, tipo_ahorro, tipo_movimiento,
  monto, saldo_anterior, saldo_nuevo, fecha_movimiento,
  descripcion, metodo_pago, registrado_por, anulado, created_at
)
SELECT
  id, ahorro_id, asociado_id, 'permanente', tipo_movimiento,
  monto, saldo_anterior, saldo_nuevo, fecha_movimiento,
  descripcion, metodo_pago, registrado_por, anulado, created_at
FROM movimientos_ahorro_permanente;


-- ────────────────────────────────────────────────────────────
-- 6. MIGRAR DATOS: movimientos_ahorro_voluntario → movimientos_ahorro
-- ────────────────────────────────────────────────────────────
INSERT INTO movimientos_ahorro (
  id, ahorro_id, asociado_id, tipo_ahorro, tipo_movimiento,
  monto, saldo_anterior, saldo_nuevo, fecha_movimiento,
  descripcion, metodo_pago, registrado_por, anulado, created_at
)
SELECT
  id, ahorro_id, asociado_id, 'voluntario', tipo_movimiento,
  monto, saldo_anterior, saldo_nuevo, fecha_movimiento,
  descripcion, metodo_pago, registrado_por, anulado, created_at
FROM movimientos_ahorro_voluntario;


-- ────────────────────────────────────────────────────────────
-- 7. HABILITAR RLS EN NUEVAS TABLAS
-- ────────────────────────────────────────────────────────────
ALTER TABLE ahorros           ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_ahorro ENABLE ROW LEVEL SECURITY;

-- ahorros: admin ve todo; asociado ve solo los suyos
CREATE POLICY "ahorros_select" ON ahorros
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "ahorros_write" ON ahorros
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- movimientos_ahorro: admin escribe; asociado solo lee los suyos
CREATE POLICY "movimientos_ahorro_select" ON movimientos_ahorro
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "movimientos_ahorro_write" ON movimientos_ahorro
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');


-- ────────────────────────────────────────────────────────────
-- 8. TRIGGER UNIFICADO: actualiza monto_ahorrado en ahorros
--    Reemplaza los dos triggers separados de las tablas antiguas
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION actualizar_saldo_ahorro()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ahorros
  SET monto_ahorrado = NEW.saldo_nuevo, updated_at = NOW()
  WHERE id = NEW.ahorro_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_saldo_ahorro
  AFTER INSERT ON movimientos_ahorro
  FOR EACH ROW EXECUTE FUNCTION actualizar_saldo_ahorro();


-- ────────────────────────────────────────────────────────────
-- 9. ELIMINAR TRIGGERS Y FUNCIONES OBSOLETAS
-- ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_saldo_ah_permanente ON movimientos_ahorro_permanente;
DROP TRIGGER IF EXISTS trg_saldo_ah_voluntario ON movimientos_ahorro_voluntario;
DROP TRIGGER IF EXISTS trg_crear_solicitud     ON creditos;
DROP TRIGGER IF EXISTS trg_sincronizar_credito ON solicitudes_credito;

DROP FUNCTION IF EXISTS actualizar_saldo_ahorro_permanente() CASCADE;
DROP FUNCTION IF EXISTS actualizar_saldo_ahorro_voluntario() CASCADE;
DROP FUNCTION IF EXISTS crear_solicitud_credito()            CASCADE;
DROP FUNCTION IF EXISTS sincronizar_estado_credito()         CASCADE;


-- ────────────────────────────────────────────────────────────
-- 10. ELIMINAR TABLAS OBSOLETAS
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS movimientos_ahorro_permanente CASCADE;
DROP TABLE IF EXISTS movimientos_ahorro_voluntario  CASCADE;
DROP TABLE IF EXISTS ahorro_permanente               CASCADE;
DROP TABLE IF EXISTS ahorro_voluntario               CASCADE;
DROP TABLE IF EXISTS solicitudes_credito             CASCADE;


-- ────────────────────────────────────────────────────────────
-- 11. ELIMINAR COLUMNAS REDUNDANTES DE asociados
--     (saldos ya viven en ahorros.monto_ahorrado;
--      total_creditos ya vive en creditos.saldo)
-- ────────────────────────────────────────────────────────────
ALTER TABLE asociados
  DROP COLUMN IF EXISTS saldo_ahorro_permanente,
  DROP COLUMN IF EXISTS saldo_ahorro_voluntario,
  DROP COLUMN IF EXISTS total_creditos;


-- ────────────────────────────────────────────────────────────
-- 12. ACTUALIZAR DATOS INICIALES DE ROLES
--     (permisos como array de strings — fuente única de verdad)
-- ────────────────────────────────────────────────────────────
UPDATE roles SET permisos = '["dashboard","configuracion","roles","usuarios","asociados","ahorros","creditos","eventos","compras","ventas","reportes"]'
  WHERE nombre = 'admin';
UPDATE roles SET permisos = '["dashboard","mis_ahorros","mis_creditos"]'
  WHERE nombre = 'asociado';
UPDATE roles SET permisos = '["dashboard","mi_solicitud"]'
  WHERE nombre = 'usuario';

-- ============================================================
-- FIN DE MIGRACIÓN
-- Tablas resultantes: ahorros, movimientos_ahorro
-- Tablas eliminadas:  ahorro_permanente, ahorro_voluntario,
--                     movimientos_ahorro_permanente,
--                     movimientos_ahorro_voluntario,
--                     solicitudes_credito
-- Columnas eliminadas de asociados:
--                     saldo_ahorro_permanente,
--                     saldo_ahorro_voluntario,
--                     total_creditos
-- ============================================================
