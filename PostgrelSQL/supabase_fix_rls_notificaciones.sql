-- ============================================================
-- Corrección de Políticas RLS para la Tabla: notificaciones
-- Permite a asociados insertar notificaciones dirigidas al admin o a sí mismos.
-- Ejecutar en Supabase → SQL Editor → Run
-- ============================================================

-- 1. Eliminar políticas de inserción y actualización obsoletas
DROP POLICY IF EXISTS "rls_notificaciones_insert" ON public.notificaciones;
DROP POLICY IF EXISTS "rls_notificaciones_insert_admin" ON public.notificaciones;
DROP POLICY IF EXISTS "notificaciones_insert" ON public.notificaciones;

DROP POLICY IF EXISTS "rls_notificaciones_update" ON public.notificaciones;
DROP POLICY IF EXISTS "notificaciones_update" ON public.notificaciones;

-- 2. Crear nueva política de inserción que permite a usuarios autenticados insertar si:
--    - Tienen permiso general de notificaciones (Administradores/Sistema)
--    - O la notificación está marcada para el administrador (para_admin = true)
--    - O la notificación es para el usuario actual (usuario_id = auth.uid() o asociado_id = fn_mi_asociado_id())
CREATE POLICY "rls_notificaciones_insert" ON public.notificaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    fn_tiene_permiso('notificaciones')
    OR para_admin = true
    OR usuario_id = auth.uid()
    OR asociado_id = fn_mi_asociado_id()
  );

-- 3. Crear nueva política de actualización que permite marcar como leídas las notificaciones
CREATE POLICY "rls_notificaciones_update" ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (
    fn_tiene_permiso('notificaciones')
    OR usuario_id = auth.uid()
    OR asociado_id = fn_mi_asociado_id()
  )
  WITH CHECK (
    fn_tiene_permiso('notificaciones')
    OR usuario_id = auth.uid()
    OR asociado_id = fn_mi_asociado_id()
  );

-- 4. Recargar el esquema de PostgREST para aplicar los cambios
NOTIFY pgrst, 'reload schema';
