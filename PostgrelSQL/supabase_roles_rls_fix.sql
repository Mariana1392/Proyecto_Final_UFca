-- ============================================================
-- UFCA - Fix RLS para tabla roles
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Permitir a admins insertar nuevos roles
CREATE POLICY "roles_insert" ON roles
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

-- Permitir a admins actualizar roles
CREATE POLICY "roles_update" ON roles
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');

-- Permitir a admins eliminar roles (solo los que no son del sistema)
CREATE POLICY "roles_delete" ON roles
  FOR DELETE TO authenticated
  USING (get_user_role() = 'admin' AND es_sistema = FALSE);

-- Verificar políticas activas en roles
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'roles'
ORDER BY policyname;
