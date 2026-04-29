-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar evento_id a la tabla pedidos
-- Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS evento_id UUID REFERENCES eventos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_evento ON pedidos(evento_id);

NOTIFY pgrst, 'reload schema';
