-- ============================================================
-- Notificaciones para administradores
-- Ejecutar en Supabase → SQL Editor → Run
-- ============================================================

-- 1. Agregar columna para notificaciones dirigidas al admin
ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS para_admin BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_notificaciones_para_admin
  ON notificaciones(para_admin) WHERE para_admin = TRUE;

-- 2. Actualizar política RLS para que admins vean sus notificaciones
DROP POLICY IF EXISTS "notificaciones_select" ON notificaciones;

CREATE POLICY "notificaciones_select" ON notificaciones
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'admin'
    OR asociado_id = get_asociado_id()
    OR (para_admin = TRUE AND get_user_role() = 'admin')
  );

-- Permitir insertar notificaciones a usuarios autenticados (para el frontend)
DROP POLICY IF EXISTS "notificaciones_insert" ON notificaciones;
CREATE POLICY "notificaciones_insert" ON notificaciones
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Permitir marcar como leída
DROP POLICY IF EXISTS "notificaciones_update" ON notificaciones;
CREATE POLICY "notificaciones_update" ON notificaciones
  FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'admin'
    OR asociado_id = get_asociado_id()
  );

NOTIFY pgrst, 'reload schema';
