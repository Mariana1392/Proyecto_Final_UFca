-- ============================================================
-- UFCA - Upgrade tabla usuarios (columnas + RLS + último acceso)
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ── 1. Agregar columnas faltantes ──────────────────────────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username       TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS identificacion TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso  TIMESTAMPTZ;

-- ── 2. Rellenar username desde email para usuarios existentes ─
UPDATE usuarios
SET    username = split_part(email, '@', 1)
WHERE  username IS NULL OR username = '';

-- ── 3. RLS: usuarios pueden actualizar su propio registro ───
DROP POLICY IF EXISTS "usuarios_update" ON usuarios;

CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE TO authenticated
  USING  (get_user_role() = 'admin' OR id = auth.uid())
  WITH CHECK (get_user_role() = 'admin' OR id = auth.uid());

-- ── 4. Función para registrar último acceso ─────────────────
CREATE OR REPLACE FUNCTION registrar_ultimo_acceso(p_usuario_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = p_usuario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_ultimo_acceso(UUID) TO authenticated;

-- ── 5. Verificar resultado ──────────────────────────────────
SELECT u.id, u.nombre, u.email, u.username, u.identificacion,
       u.activo, u.ultimo_acceso
FROM   usuarios u
ORDER  BY u.nombre;
