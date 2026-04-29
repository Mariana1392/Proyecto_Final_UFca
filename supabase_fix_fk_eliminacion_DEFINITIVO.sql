-- ============================================================
-- MIGRACIÓN DEFINITIVA: Permitir eliminación de usuarios/asociados
-- Cambia TODAS las FK con ON DELETE RESTRICT → ON DELETE SET NULL
--
-- INSTRUCCIONES: Pegar TODO en Supabase → SQL Editor → Run
-- Es seguro correr varias veces (usa IF EXISTS / DROP IF EXISTS)
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- BLOQUE 1: FK que apuntan a asociados(id)
-- ═══════════════════════════════════════════════════════════════

-- CREDITOS → asociados
ALTER TABLE creditos ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE creditos DROP CONSTRAINT IF EXISTS creditos_asociado_id_fkey;
ALTER TABLE creditos ADD CONSTRAINT creditos_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- PAGOS_CREDITO → asociados
ALTER TABLE pagos_credito ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE pagos_credito DROP CONSTRAINT IF EXISTS pagos_credito_asociado_id_fkey;
ALTER TABLE pagos_credito ADD CONSTRAINT pagos_credito_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- SOLICITUDES_CREDITO → asociados
ALTER TABLE solicitudes_credito ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE solicitudes_credito DROP CONSTRAINT IF EXISTS solicitudes_credito_asociado_id_fkey;
ALTER TABLE solicitudes_credito ADD CONSTRAINT solicitudes_credito_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- PEDIDOS → asociados
ALTER TABLE pedidos ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_asociado_id_fkey;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- PAGOS_PREMIOS → asociados
ALTER TABLE pagos_premios ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE pagos_premios DROP CONSTRAINT IF EXISTS pagos_premios_asociado_id_fkey;
ALTER TABLE pagos_premios ADD CONSTRAINT pagos_premios_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- EXCEPCIONES → asociados
ALTER TABLE excepciones ALTER COLUMN asociado_id DROP NOT NULL;
ALTER TABLE excepciones DROP CONSTRAINT IF EXISTS excepciones_asociado_id_fkey;
ALTER TABLE excepciones ADD CONSTRAINT excepciones_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- LIQUIDACIONES → asociados (añadida por supabase_liquidaciones_upgrade.sql)
ALTER TABLE liquidaciones DROP CONSTRAINT IF EXISTS liquidaciones_asociado_id_fkey;
ALTER TABLE liquidaciones ADD CONSTRAINT liquidaciones_asociado_id_fkey
  FOREIGN KEY (asociado_id) REFERENCES asociados(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════
-- BLOQUE 2: FK que apuntan a usuarios(id)
-- (todas las columnas "registrado_por", "created_by", "usuario_id", etc.)
-- ═══════════════════════════════════════════════════════════════

-- MOVIMIENTOS_AHORRO_PERMANENTE → usuarios
ALTER TABLE movimientos_ahorro_permanente DROP CONSTRAINT IF EXISTS movimientos_ahorro_permanente_registrado_por_fkey;
ALTER TABLE movimientos_ahorro_permanente ADD CONSTRAINT movimientos_ahorro_permanente_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- MOVIMIENTOS_AHORRO_VOLUNTARIO → usuarios
ALTER TABLE movimientos_ahorro_voluntario DROP CONSTRAINT IF EXISTS movimientos_ahorro_voluntario_registrado_por_fkey;
ALTER TABLE movimientos_ahorro_voluntario ADD CONSTRAINT movimientos_ahorro_voluntario_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- CREDITOS → usuarios (aprobado_por)
ALTER TABLE creditos DROP CONSTRAINT IF EXISTS creditos_aprobado_por_fkey;
ALTER TABLE creditos ADD CONSTRAINT creditos_aprobado_por_fkey
  FOREIGN KEY (aprobado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- PAGOS_CREDITO → usuarios (registrado_por)
-- OMITIDO: registrado_por es tipo TEXT, no UUID — tipos incompatibles, no se puede crear FK

-- SOLICITUDES_CREDITO → usuarios (evaluado_por)
ALTER TABLE solicitudes_credito DROP CONSTRAINT IF EXISTS solicitudes_credito_evaluado_por_fkey;
ALTER TABLE solicitudes_credito ADD CONSTRAINT solicitudes_credito_evaluado_por_fkey
  FOREIGN KEY (evaluado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- COMPRAS → usuarios (registrado_por)
ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_registrado_por_fkey;
ALTER TABLE compras ADD CONSTRAINT compras_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- VENTAS → usuarios (created_by)
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_created_by_fkey;
ALTER TABLE ventas ADD CONSTRAINT ventas_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL;

-- VENTAS → usuarios (usuario_id — columna añadida directamente en Supabase)
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_usuario_id_fkey;
ALTER TABLE ventas ADD CONSTRAINT ventas_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- EVENTOS → usuarios (created_by)
ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_created_by_fkey;
ALTER TABLE eventos ADD CONSTRAINT eventos_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL;

-- PAGOS_PREMIOS → usuarios (registrado_por)
ALTER TABLE pagos_premios DROP CONSTRAINT IF EXISTS pagos_premios_registrado_por_fkey;
ALTER TABLE pagos_premios ADD CONSTRAINT pagos_premios_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- LIQUIDACIONES → usuarios (procesado_por)
ALTER TABLE liquidaciones DROP CONSTRAINT IF EXISTS liquidaciones_procesado_por_fkey;
ALTER TABLE liquidaciones ADD CONSTRAINT liquidaciones_procesado_por_fkey
  FOREIGN KEY (procesado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- EXCEPCIONES → usuarios (resuelto_por)
ALTER TABLE excepciones DROP CONSTRAINT IF EXISTS excepciones_resuelto_por_fkey;
ALTER TABLE excepciones ADD CONSTRAINT excepciones_resuelto_por_fkey
  FOREIGN KEY (resuelto_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- Notificar a PostgREST que recargue el schema
NOTIFY pgrst, 'reload schema';
