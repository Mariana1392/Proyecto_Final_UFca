-- ============================================================
-- FIX: Eliminar FK de auditoria → usuarios y asociados
-- Problema: ON DELETE SET NULL choca con el trigger de inmutabilidad
-- Solución: auditoria guarda el ID histórico sin FK activa
-- ============================================================

ALTER TABLE auditoria
  DROP CONSTRAINT IF EXISTS fk_auditoria_usuario_id;

ALTER TABLE auditoria
  DROP CONSTRAINT IF EXISTS auditoria_usuario_id_fkey;

ALTER TABLE auditoria
  DROP CONSTRAINT IF EXISTS fk_auditoria_asociado_id;

ALTER TABLE auditoria
  DROP CONSTRAINT IF EXISTS auditoria_asociado_id_fkey;
