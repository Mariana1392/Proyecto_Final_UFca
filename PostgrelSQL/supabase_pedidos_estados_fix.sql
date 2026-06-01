-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Unificar estados de pedidos a 'pendiente' | 'pagado' | 'anulado'
-- Ejecutar en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- 1. Eliminar el constraint antiguo
ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS pedidos_estado_check;

-- 2. Migrar registros con estados anteriores al nuevo esquema
--    aprobado  → pendiente  (aún no entregado, sigue en curso)
--    entregado → pagado     (ya completado)
UPDATE pedidos SET estado = 'pendiente' WHERE estado = 'aprobado';
UPDATE pedidos SET estado = 'pagado'    WHERE estado = 'entregado';

-- 3. Crear el nuevo constraint con los estados correctos
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('pendiente', 'pagado', 'anulado'));

-- 4. Confirmar resultado
SELECT estado, COUNT(*) FROM pedidos GROUP BY estado ORDER BY estado;
