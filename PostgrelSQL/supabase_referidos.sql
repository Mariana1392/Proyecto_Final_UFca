-- =============================================================================
-- UFCA — Módulo de Referidos
--
-- Agrega la columna referido_por_id a asociados para rastrear quién
-- refirió a cada nuevo asociado.
--
-- ✅ Seguro de ejecutar múltiples veces (IF NOT EXISTS).
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================

-- ── 1. Agregar columna ────────────────────────────────────────────────────────
ALTER TABLE asociados
  ADD COLUMN IF NOT EXISTS referido_por_id UUID
    REFERENCES asociados(id)
    ON DELETE SET NULL;    -- Si el referente es eliminado, el referido queda sin referente

-- ── 2. Índice para búsquedas rápidas ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_asociados_referido_por_id
  ON asociados (referido_por_id)
  WHERE referido_por_id IS NOT NULL;

-- ── 3. Políticas RLS ──────────────────────────────────────────────────────────
-- El admin puede leer todos los referidos.
-- El asociado puede leer quién refirió a otros (columna no sensible).
-- Las políticas existentes en asociados ya cubren esto (SELECT es público para auth).
-- Solo necesitamos permitir UPDATE de referido_por_id al admin.

-- ── 4. Verificación ───────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'asociados'
  AND column_name  = 'referido_por_id';
