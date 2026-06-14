-- =============================================================================
-- UFCA — Corrección de Índice Único de Créditos Activos para Referidos
--
-- ✅ Modifica el índice idx_credito_activo_unico para que ignore los créditos
--    destinados a referidos (referido_nombre IS NOT NULL).
--    De esta forma, un asociado puede recomendar/referir múltiples créditos,
--    pero sigue estando limitado a máximo 1 crédito personal activo.
-- =============================================================================

-- 1. Eliminar el índice único anterior
DROP INDEX IF EXISTS idx_credito_activo_unico;

-- 2. Recrear el índice único con la condición de referido_nombre IS NULL
CREATE UNIQUE INDEX idx_credito_activo_unico
  ON creditos (asociado_id)
  WHERE estado IN ('pendiente', 'en_revision', 'aprobado', 'desembolsado', 'activo', 'en_mora')
    AND referido_nombre IS NULL;
