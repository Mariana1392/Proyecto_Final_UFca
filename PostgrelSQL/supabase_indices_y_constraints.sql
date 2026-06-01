-- =============================================================================
-- UFCA — Índices en FK críticas + constraints faltantes
-- Ejecutar en Supabase → SQL Editor
-- Corrige B-02 y B-06
-- Seguro de correr múltiples veces (IF NOT EXISTS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- B-02: Índices en columnas FK críticas (sin índice = full-scan en cada JOIN)
-- -----------------------------------------------------------------------------

-- ahorros_permanentes
CREATE INDEX IF NOT EXISTS idx_ahorros_perm_asociado
  ON ahorros_permanentes(asociado_id);

CREATE INDEX IF NOT EXISTS idx_ahorros_perm_estado
  ON ahorros_permanentes(estado) WHERE anulado = false;

-- ahorros_voluntarios
CREATE INDEX IF NOT EXISTS idx_ahorros_vol_asociado
  ON ahorros_voluntarios(asociado_id);

CREATE INDEX IF NOT EXISTS idx_ahorros_vol_estado
  ON ahorros_voluntarios(estado) WHERE anulado = false;

-- creditos
CREATE INDEX IF NOT EXISTS idx_creditos_asociado
  ON creditos(asociado_id);

CREATE INDEX IF NOT EXISTS idx_creditos_estado
  ON creditos(estado) WHERE anulado IS DISTINCT FROM true;

-- pagos_credito
CREATE INDEX IF NOT EXISTS idx_pagos_credito_credito
  ON pagos_credito(credito_id);

-- pagos_ahorro_permanente
CREATE INDEX IF NOT EXISTS idx_pagos_perm_ahorro
  ON pagos_ahorro_permanente(ahorro_permanente_id);

CREATE INDEX IF NOT EXISTS idx_pagos_perm_fecha
  ON pagos_ahorro_permanente(fecha_pago DESC);

-- pagos_ahorro_voluntario
CREATE INDEX IF NOT EXISTS idx_pagos_vol_ahorro
  ON pagos_ahorro_voluntario(ahorro_voluntario_id);

-- usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_rol
  ON usuarios(rol_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_asociado
  ON usuarios(asociado_id) WHERE asociado_id IS NOT NULL;

-- asociados
CREATE INDEX IF NOT EXISTS idx_asociados_referido_por
  ON asociados(referido_por_id) WHERE referido_por_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asociados_cedula
  ON asociados(cedula);

CREATE INDEX IF NOT EXISTS idx_asociados_estado
  ON asociados(estado);

-- rol_permisos
CREATE INDEX IF NOT EXISTS idx_rol_permisos_rol
  ON rol_permisos(rol_id);

-- solicitudes_asociados
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado
  ON solicitudes_asociados(estado);

-- auditoria
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario
  ON auditoria(usuario_id);

CREATE INDEX IF NOT EXISTS idx_auditoria_created
  ON auditoria(created_at DESC);

-- -----------------------------------------------------------------------------
-- B-06: UNIQUE en solicitudes_asociados.cedula
-- (evita que un atacante envíe múltiples solicitudes con la misma cédula)
-- -----------------------------------------------------------------------------

-- Primero eliminar duplicados si existen (mantener el más antiguo)
DELETE FROM solicitudes_asociados a
USING solicitudes_asociados b
WHERE a.cedula = b.cedula
  AND a.created_at > b.created_at;

-- Agregar restricción UNIQUE
ALTER TABLE solicitudes_asociados
  ADD CONSTRAINT uq_solicitudes_cedula UNIQUE (cedula);

-- -----------------------------------------------------------------------------
-- Verificación
-- -----------------------------------------------------------------------------

SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
