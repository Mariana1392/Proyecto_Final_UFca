-- ============================================================
-- UFCA - Fix RLS usuarios + insertar usuarios faltantes
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ── 1. Simplificar RLS de usuarios y roles ─────────────────
-- (todos los autenticados pueden leer, solo admin puede escribir)

DROP POLICY IF EXISTS "usuarios_select"  ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert"  ON usuarios;
DROP POLICY IF EXISTS "usuarios_update"  ON usuarios;
DROP POLICY IF EXISTS "usuarios_delete"  ON usuarios;
DROP POLICY IF EXISTS "roles_select"     ON roles;

-- Cualquier usuario autenticado puede leer usuarios y roles
CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "roles_select" ON roles
  FOR SELECT TO authenticated USING (true);

-- Solo admin puede crear/editar/eliminar usuarios
CREATE POLICY "usuarios_insert" ON usuarios
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin' OR id = auth.uid());

CREATE POLICY "usuarios_delete" ON usuarios
  FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

-- ── 2. Permisos de ejecución para funciones ─────────────────
GRANT EXECUTE ON FUNCTION get_user_role()   TO authenticated;
GRANT EXECUTE ON FUNCTION get_asociado_id() TO authenticated;

ALTER FUNCTION get_user_role()   SET search_path = public;
ALTER FUNCTION get_asociado_id() SET search_path = public;

-- ── 3. Insertar usuarios faltantes ─────────────────────────
INSERT INTO usuarios (id, nombre, email, rol_id, activo)
VALUES
  (
    'c5c36d6f-d81c-44ae-9786-8c0ee0c513d0',
    'Admin UFCA 2',
    'adminufca@gmail.com',
    (SELECT id FROM roles WHERE nombre = 'admin'),
    TRUE
  ),
  (
    'd25eb3c6-3fd8-4df2-a162-7a55c190907b',
    'Maria Valencia Ospina',
    'mariavalenciaospina@gmail.com',
    (SELECT id FROM roles WHERE nombre = 'admin'),
    TRUE
  )
ON CONFLICT (id) DO UPDATE
  SET nombre     = EXCLUDED.nombre,
      email      = EXCLUDED.email,
      rol_id     = EXCLUDED.rol_id,
      activo     = EXCLUDED.activo,
      updated_at = NOW();

-- ── 4. Verificar resultado ──────────────────────────────────
SELECT u.id, u.nombre, u.email, r.nombre AS rol, u.activo
FROM usuarios u
LEFT JOIN roles r ON r.id = u.rol_id
ORDER BY u.nombre;
