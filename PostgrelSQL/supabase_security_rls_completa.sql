-- =============================================================================
-- SEGURIDAD RLS COMPLETA - UFCA
-- Usa fn_tiene_permiso() para soporte automático de roles dinámicos.
-- Cualquier rol nuevo que se cree en la app y se le asignen permisos
-- en rol_permisos tendrá acceso automático a las tablas correspondientes.
--
-- PREREQUISITO: Ejecutar supabase_security_admin_permisos.sql primero.
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

-- ─── FUNCIÓN CENTRAL ─────────────────────────────────────────────────────────
-- Verifica si el usuario autenticado tiene un permiso específico
-- consultando directamente rol_permisos por permiso_clave
CREATE OR REPLACE FUNCTION fn_tiene_permiso(permiso_clave text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN rol_permisos rp ON rp.rol_id = u.rol_id
    WHERE u.id = auth.uid()
      AND rp.permiso_clave = permiso_clave
      AND rp.activo = true
      AND u.activo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── AHORROS PERMANENTES ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_ahorro_perm_select"       ON public.ahorros_permanentes;
DROP POLICY IF EXISTS "rls_ahorro_perm_insert_admin" ON public.ahorros_permanentes;
DROP POLICY IF EXISTS "rls_ahorro_perm_update_admin" ON public.ahorros_permanentes;
DROP POLICY IF EXISTS "rls_ahorro_perm_delete_admin" ON public.ahorros_permanentes;

CREATE POLICY "rls_ahorro_perm_select" ON public.ahorros_permanentes FOR SELECT TO authenticated
USING (fn_tiene_permiso('ahorros') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_ahorro_perm_insert" ON public.ahorros_permanentes FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('ahorros'));

CREATE POLICY "rls_ahorro_perm_update" ON public.ahorros_permanentes FOR UPDATE TO authenticated
USING (fn_tiene_permiso('ahorros')) WITH CHECK (fn_tiene_permiso('ahorros'));

CREATE POLICY "rls_ahorro_perm_delete" ON public.ahorros_permanentes FOR DELETE TO authenticated
USING (fn_tiene_permiso('ahorros'));

-- ─── AHORROS VOLUNTARIOS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_ahorro_vol_select"       ON public.ahorros_voluntarios;
DROP POLICY IF EXISTS "rls_ahorro_vol_insert_admin" ON public.ahorros_voluntarios;
DROP POLICY IF EXISTS "rls_ahorro_vol_update_admin" ON public.ahorros_voluntarios;
DROP POLICY IF EXISTS "rls_ahorro_vol_delete_admin" ON public.ahorros_voluntarios;

CREATE POLICY "rls_ahorro_vol_select" ON public.ahorros_voluntarios FOR SELECT TO authenticated
USING (fn_tiene_permiso('ahorros') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_ahorro_vol_insert" ON public.ahorros_voluntarios FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('ahorros'));

CREATE POLICY "rls_ahorro_vol_update" ON public.ahorros_voluntarios FOR UPDATE TO authenticated
USING (fn_tiene_permiso('ahorros')) WITH CHECK (fn_tiene_permiso('ahorros'));

CREATE POLICY "rls_ahorro_vol_delete" ON public.ahorros_voluntarios FOR DELETE TO authenticated
USING (fn_tiene_permiso('ahorros'));

-- ─── ASOCIADOS ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_asociados_select"       ON public.asociados;
DROP POLICY IF EXISTS "rls_asociados_insert_admin" ON public.asociados;
DROP POLICY IF EXISTS "rls_asociados_update_admin" ON public.asociados;
DROP POLICY IF EXISTS "rls_asociados_delete_admin" ON public.asociados;

CREATE POLICY "rls_asociados_select" ON public.asociados FOR SELECT TO authenticated
USING (fn_tiene_permiso('gestion_asociados') OR fn_tiene_permiso('asociados') OR id = fn_mi_asociado_id());

CREATE POLICY "rls_asociados_insert" ON public.asociados FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('crear_asociado') OR fn_tiene_permiso('gestion_asociados'));

CREATE POLICY "rls_asociados_update" ON public.asociados FOR UPDATE TO authenticated
USING (fn_tiene_permiso('editar_asociado') OR fn_tiene_permiso('gestion_asociados'))
WITH CHECK (fn_tiene_permiso('editar_asociado') OR fn_tiene_permiso('gestion_asociados'));

CREATE POLICY "rls_asociados_delete" ON public.asociados FOR DELETE TO authenticated
USING (fn_tiene_permiso('eliminar_asociado') OR fn_tiene_permiso('gestion_asociados'));

-- ─── AUDITORÍA ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_auditoria_select_admin"   ON public.auditoria;
DROP POLICY IF EXISTS "rls_auditoria_insert_admin"   ON public.auditoria;
DROP POLICY IF EXISTS "rls_auditoria_insert_service" ON public.auditoria;

CREATE POLICY "rls_auditoria_select" ON public.auditoria FOR SELECT TO authenticated
USING (fn_tiene_permiso('auditoria') OR fn_tiene_permiso('ver_auditoria'));

CREATE POLICY "rls_auditoria_insert" ON public.auditoria FOR INSERT TO authenticated
WITH CHECK (true);

-- ─── COMITÉ EVALUADOR ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_comite_select_admin"     ON public.comite_evaluador;
DROP POLICY IF EXISTS "rls_comite_insert_admin"     ON public.comite_evaluador;
DROP POLICY IF EXISTS "rls_comite_update_admin"     ON public.comite_evaluador;
DROP POLICY IF EXISTS "rls_comite_delete_admin"     ON public.comite_evaluador;
DROP POLICY IF EXISTS "comite_select_authenticated" ON public.comite_evaluador;
DROP POLICY IF EXISTS "comite_update_authenticated" ON public.comite_evaluador;
DROP POLICY IF EXISTS "comite_insert_authenticated" ON public.comite_evaluador;

CREATE POLICY "rls_comite_select" ON public.comite_evaluador FOR SELECT TO authenticated
USING (fn_tiene_permiso('solicitudes'));

CREATE POLICY "rls_comite_insert" ON public.comite_evaluador FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('solicitudes'));

CREATE POLICY "rls_comite_update" ON public.comite_evaluador FOR UPDATE TO authenticated
USING (fn_tiene_permiso('solicitudes')) WITH CHECK (fn_tiene_permiso('solicitudes'));

CREATE POLICY "rls_comite_delete" ON public.comite_evaluador FOR DELETE TO authenticated
USING (fn_tiene_permiso('solicitudes'));

-- ─── CONFIGURACIÓN ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_configuracion_select_admin" ON public.configuracion;
DROP POLICY IF EXISTS "rls_configuracion_insert_admin" ON public.configuracion;
DROP POLICY IF EXISTS "rls_configuracion_update_admin" ON public.configuracion;
DROP POLICY IF EXISTS "rls_configuracion_delete_admin" ON public.configuracion;

CREATE POLICY "rls_configuracion_select" ON public.configuracion FOR SELECT TO authenticated
USING (fn_tiene_permiso('configuracion'));

CREATE POLICY "rls_configuracion_insert" ON public.configuracion FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('configuracion'));

CREATE POLICY "rls_configuracion_update" ON public.configuracion FOR UPDATE TO authenticated
USING (fn_tiene_permiso('configuracion')) WITH CHECK (fn_tiene_permiso('configuracion'));

CREATE POLICY "rls_configuracion_delete" ON public.configuracion FOR DELETE TO authenticated
USING (fn_tiene_permiso('configuracion'));

-- ─── CRÉDITOS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_creditos_select"           ON public.creditos;
DROP POLICY IF EXISTS "rls_creditos_insert_admin"     ON public.creditos;
DROP POLICY IF EXISTS "rls_creditos_insert_asociado"  ON public.creditos;
DROP POLICY IF EXISTS "rls_creditos_update_admin"     ON public.creditos;
DROP POLICY IF EXISTS "rls_creditos_delete_admin"     ON public.creditos;
DROP POLICY IF EXISTS "rls_creditos_delete_asociado"  ON public.creditos;
DROP POLICY IF EXISTS "creditos_select_authenticated" ON public.creditos;
DROP POLICY IF EXISTS "creditos_update_authenticated" ON public.creditos;
DROP POLICY IF EXISTS "creditos_insert_authenticated" ON public.creditos;

CREATE POLICY "rls_creditos_select" ON public.creditos FOR SELECT TO authenticated
USING (fn_tiene_permiso('creditos') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_creditos_insert" ON public.creditos FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('creditos') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_creditos_update" ON public.creditos FOR UPDATE TO authenticated
USING (fn_tiene_permiso('creditos') OR (asociado_id = fn_mi_asociado_id() AND estado = 'simulacion'))
WITH CHECK (fn_tiene_permiso('creditos') OR (asociado_id = fn_mi_asociado_id() AND estado = 'simulacion'));

CREATE POLICY "rls_creditos_delete" ON public.creditos FOR DELETE TO authenticated
USING (fn_tiene_permiso('creditos') OR (asociado_id = fn_mi_asociado_id() AND estado = 'simulacion'));

-- ─── CUOTAS CRÉDITO ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_cuotas_credito_select"       ON public.cuotas_credito;
DROP POLICY IF EXISTS "rls_cuotas_credito_insert_admin" ON public.cuotas_credito;
DROP POLICY IF EXISTS "rls_cuotas_credito_update_admin" ON public.cuotas_credito;
DROP POLICY IF EXISTS "rls_cuotas_credito_delete_admin" ON public.cuotas_credito;

CREATE POLICY "rls_cuotas_credito_select" ON public.cuotas_credito FOR SELECT TO authenticated
USING (
  fn_tiene_permiso('creditos')
  OR credito_id IN (SELECT id FROM creditos WHERE asociado_id = fn_mi_asociado_id())
);

CREATE POLICY "rls_cuotas_credito_insert" ON public.cuotas_credito FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('creditos'));

CREATE POLICY "rls_cuotas_credito_update" ON public.cuotas_credito FOR UPDATE TO authenticated
USING (fn_tiene_permiso('creditos')) WITH CHECK (fn_tiene_permiso('creditos'));

CREATE POLICY "rls_cuotas_credito_delete" ON public.cuotas_credito FOR DELETE TO authenticated
USING (fn_tiene_permiso('creditos'));

-- ─── DISTRIBUCIONES UTILIDADES ───────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_distribuciones_select"       ON public.distribuciones_utilidades;
DROP POLICY IF EXISTS "rls_distribuciones_insert_admin" ON public.distribuciones_utilidades;
DROP POLICY IF EXISTS "rls_distribuciones_update_admin" ON public.distribuciones_utilidades;
DROP POLICY IF EXISTS "rls_distribuciones_delete_admin" ON public.distribuciones_utilidades;

CREATE POLICY "rls_distribuciones_select" ON public.distribuciones_utilidades FOR SELECT TO authenticated
USING (fn_tiene_permiso('ahorros') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_distribuciones_insert" ON public.distribuciones_utilidades FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('ahorros'));

CREATE POLICY "rls_distribuciones_update" ON public.distribuciones_utilidades FOR UPDATE TO authenticated
USING (fn_tiene_permiso('ahorros')) WITH CHECK (fn_tiene_permiso('ahorros'));

CREATE POLICY "rls_distribuciones_delete" ON public.distribuciones_utilidades FOR DELETE TO authenticated
USING (fn_tiene_permiso('ahorros'));

-- ─── EXCEPCIONES ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_excepciones_select"       ON public.excepciones;
DROP POLICY IF EXISTS "rls_excepciones_insert_admin" ON public.excepciones;
DROP POLICY IF EXISTS "rls_excepciones_update_admin" ON public.excepciones;
DROP POLICY IF EXISTS "rls_excepciones_delete_admin" ON public.excepciones;

CREATE POLICY "rls_excepciones_select" ON public.excepciones FOR SELECT TO authenticated
USING (fn_tiene_permiso('excepciones') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_excepciones_insert" ON public.excepciones FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('excepciones'));

CREATE POLICY "rls_excepciones_update" ON public.excepciones FOR UPDATE TO authenticated
USING (fn_tiene_permiso('excepciones')) WITH CHECK (fn_tiene_permiso('excepciones'));

CREATE POLICY "rls_excepciones_delete" ON public.excepciones FOR DELETE TO authenticated
USING (fn_tiene_permiso('excepciones'));

-- ─── LIQUIDACIONES ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_liquidaciones_select"         ON public.liquidaciones;
DROP POLICY IF EXISTS "rls_liquidaciones_insert_admin"   ON public.liquidaciones;
DROP POLICY IF EXISTS "rls_liquidaciones_update_admin"   ON public.liquidaciones;
DROP POLICY IF EXISTS "rls_liquidaciones_delete_admin"   ON public.liquidaciones;
DROP POLICY IF EXISTS "Admin acceso total liquidaciones" ON public.liquidaciones;

CREATE POLICY "rls_liquidaciones_select" ON public.liquidaciones FOR SELECT TO authenticated
USING (fn_tiene_permiso('liquidacion') OR fn_tiene_permiso('liquidaciones') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_liquidaciones_insert" ON public.liquidaciones FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('liquidacion') OR fn_tiene_permiso('liquidaciones'));

CREATE POLICY "rls_liquidaciones_update" ON public.liquidaciones FOR UPDATE TO authenticated
USING (fn_tiene_permiso('liquidacion') OR fn_tiene_permiso('liquidaciones'))
WITH CHECK (fn_tiene_permiso('liquidacion') OR fn_tiene_permiso('liquidaciones'));

CREATE POLICY "rls_liquidaciones_delete" ON public.liquidaciones FOR DELETE TO authenticated
USING (fn_tiene_permiso('liquidacion') OR fn_tiene_permiso('liquidaciones'));

-- ─── NOTIFICACIONES ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_notificaciones_select"       ON public.notificaciones;
DROP POLICY IF EXISTS "rls_notificaciones_insert_admin" ON public.notificaciones;
DROP POLICY IF EXISTS "rls_notificaciones_update"       ON public.notificaciones;
DROP POLICY IF EXISTS "rls_notificaciones_delete_admin" ON public.notificaciones;

CREATE POLICY "rls_notificaciones_select" ON public.notificaciones FOR SELECT TO authenticated
USING (fn_tiene_permiso('notificaciones') OR usuario_id = auth.uid() OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_notificaciones_insert" ON public.notificaciones FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('notificaciones'));

CREATE POLICY "rls_notificaciones_update" ON public.notificaciones FOR UPDATE TO authenticated
USING (fn_tiene_permiso('notificaciones') OR usuario_id = auth.uid())
WITH CHECK (fn_tiene_permiso('notificaciones') OR usuario_id = auth.uid());

CREATE POLICY "rls_notificaciones_delete" ON public.notificaciones FOR DELETE TO authenticated
USING (fn_tiene_permiso('notificaciones'));

-- ─── PAGOS AHORRO PERMANENTE ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_pago_ahorro_perm_select"       ON public.pagos_ahorro_permanente;
DROP POLICY IF EXISTS "rls_pago_ahorro_perm_insert_admin" ON public.pagos_ahorro_permanente;
DROP POLICY IF EXISTS "rls_pago_ahorro_perm_update_admin" ON public.pagos_ahorro_permanente;
DROP POLICY IF EXISTS "rls_pago_ahorro_perm_delete_admin" ON public.pagos_ahorro_permanente;

CREATE POLICY "rls_pago_ahorro_perm_select" ON public.pagos_ahorro_permanente FOR SELECT TO authenticated
USING (fn_tiene_permiso('ahorros') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_pago_ahorro_perm_insert" ON public.pagos_ahorro_permanente FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('ahorros'));

CREATE POLICY "rls_pago_ahorro_perm_update" ON public.pagos_ahorro_permanente FOR UPDATE TO authenticated
USING (fn_tiene_permiso('ahorros')) WITH CHECK (fn_tiene_permiso('ahorros'));

CREATE POLICY "rls_pago_ahorro_perm_delete" ON public.pagos_ahorro_permanente FOR DELETE TO authenticated
USING (fn_tiene_permiso('ahorros'));

-- ─── PAGOS AHORRO VOLUNTARIO ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_pago_ahorro_vol_select"       ON public.pagos_ahorro_voluntario;
DROP POLICY IF EXISTS "rls_pago_ahorro_vol_insert_admin" ON public.pagos_ahorro_voluntario;
DROP POLICY IF EXISTS "rls_pago_ahorro_vol_update_admin" ON public.pagos_ahorro_voluntario;
DROP POLICY IF EXISTS "rls_pago_ahorro_vol_delete_admin" ON public.pagos_ahorro_voluntario;

CREATE POLICY "rls_pago_ahorro_vol_select" ON public.pagos_ahorro_voluntario FOR SELECT TO authenticated
USING (fn_tiene_permiso('ahorros') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_pago_ahorro_vol_insert" ON public.pagos_ahorro_voluntario FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('ahorros'));

CREATE POLICY "rls_pago_ahorro_vol_update" ON public.pagos_ahorro_voluntario FOR UPDATE TO authenticated
USING (fn_tiene_permiso('ahorros')) WITH CHECK (fn_tiene_permiso('ahorros'));

CREATE POLICY "rls_pago_ahorro_vol_delete" ON public.pagos_ahorro_voluntario FOR DELETE TO authenticated
USING (fn_tiene_permiso('ahorros'));

-- ─── PAGOS CRÉDITO ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_pagos_credito_select"       ON public.pagos_credito;
DROP POLICY IF EXISTS "rls_pagos_credito_insert_admin" ON public.pagos_credito;
DROP POLICY IF EXISTS "rls_pagos_credito_update_admin" ON public.pagos_credito;
DROP POLICY IF EXISTS "rls_pagos_credito_delete_admin" ON public.pagos_credito;

CREATE POLICY "rls_pagos_credito_select" ON public.pagos_credito FOR SELECT TO authenticated
USING (
  fn_tiene_permiso('creditos')
  OR credito_id IN (SELECT id FROM creditos WHERE asociado_id = fn_mi_asociado_id())
);

CREATE POLICY "rls_pagos_credito_insert" ON public.pagos_credito FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('creditos'));

CREATE POLICY "rls_pagos_credito_update" ON public.pagos_credito FOR UPDATE TO authenticated
USING (fn_tiene_permiso('creditos')) WITH CHECK (fn_tiene_permiso('creditos'));

CREATE POLICY "rls_pagos_credito_delete" ON public.pagos_credito FOR DELETE TO authenticated
USING (fn_tiene_permiso('creditos'));

-- ─── PERIODOS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_periodos_select_auth"  ON public.periodos;
DROP POLICY IF EXISTS "rls_periodos_insert_admin" ON public.periodos;
DROP POLICY IF EXISTS "rls_periodos_update_admin" ON public.periodos;
DROP POLICY IF EXISTS "rls_periodos_delete_admin" ON public.periodos;

CREATE POLICY "rls_periodos_select" ON public.periodos FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "rls_periodos_insert" ON public.periodos FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('configuracion'));

CREATE POLICY "rls_periodos_update" ON public.periodos FOR UPDATE TO authenticated
USING (fn_tiene_permiso('configuracion')) WITH CHECK (fn_tiene_permiso('configuracion'));

CREATE POLICY "rls_periodos_delete" ON public.periodos FOR DELETE TO authenticated
USING (fn_tiene_permiso('configuracion'));

-- ─── PERMISOS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_permisos_select_auth"  ON public.permisos;
DROP POLICY IF EXISTS "rls_permisos_insert_admin" ON public.permisos;
DROP POLICY IF EXISTS "rls_permisos_update_admin" ON public.permisos;
DROP POLICY IF EXISTS "rls_permisos_delete_admin" ON public.permisos;

CREATE POLICY "rls_permisos_select" ON public.permisos FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "rls_permisos_insert" ON public.permisos FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'));

CREATE POLICY "rls_permisos_update" ON public.permisos FOR UPDATE TO authenticated
USING (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'))
WITH CHECK (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'));

CREATE POLICY "rls_permisos_delete" ON public.permisos FOR DELETE TO authenticated
USING (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'));

-- ─── REFERIDOS ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_referidos_select"           ON public.referidos;
DROP POLICY IF EXISTS "rls_referidos_insert"           ON public.referidos;
DROP POLICY IF EXISTS "rls_referidos_update"           ON public.referidos;
DROP POLICY IF EXISTS "rls_referidos_delete"           ON public.referidos;
DROP POLICY IF EXISTS "referidos_select_authenticated" ON public.referidos;
DROP POLICY IF EXISTS "referidos_insert_authenticated" ON public.referidos;
DROP POLICY IF EXISTS "referidos_update_authenticated" ON public.referidos;
DROP POLICY IF EXISTS "referidos_delete_authenticated" ON public.referidos;

CREATE POLICY "rls_referidos_select" ON public.referidos FOR SELECT TO authenticated
USING (fn_tiene_permiso('solicitudes') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_referidos_insert" ON public.referidos FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('solicitudes') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_referidos_update" ON public.referidos FOR UPDATE TO authenticated
USING (fn_tiene_permiso('solicitudes') OR asociado_id = fn_mi_asociado_id())
WITH CHECK (fn_tiene_permiso('solicitudes') OR asociado_id = fn_mi_asociado_id());

CREATE POLICY "rls_referidos_delete" ON public.referidos FOR DELETE TO authenticated
USING (fn_tiene_permiso('solicitudes'));

-- ─── ROL PERMISOS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_rol_permisos_select_auth"  ON public.rol_permisos;
DROP POLICY IF EXISTS "rls_rol_permisos_insert_admin" ON public.rol_permisos;
DROP POLICY IF EXISTS "rls_rol_permisos_update_admin" ON public.rol_permisos;
DROP POLICY IF EXISTS "rls_rol_permisos_delete_admin" ON public.rol_permisos;

CREATE POLICY "rls_rol_permisos_select" ON public.rol_permisos FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "rls_rol_permisos_insert" ON public.rol_permisos FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'));

CREATE POLICY "rls_rol_permisos_update" ON public.rol_permisos FOR UPDATE TO authenticated
USING (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'))
WITH CHECK (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'));

CREATE POLICY "rls_rol_permisos_delete" ON public.rol_permisos FOR DELETE TO authenticated
USING (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'));

-- ─── ROLES ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_roles_select_auth"  ON public.roles;
DROP POLICY IF EXISTS "rls_roles_insert_admin" ON public.roles;
DROP POLICY IF EXISTS "rls_roles_update_admin" ON public.roles;
DROP POLICY IF EXISTS "rls_roles_delete_admin" ON public.roles;

CREATE POLICY "rls_roles_select" ON public.roles FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "rls_roles_insert" ON public.roles FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'));

CREATE POLICY "rls_roles_update" ON public.roles FOR UPDATE TO authenticated
USING (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'))
WITH CHECK (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'));

CREATE POLICY "rls_roles_delete" ON public.roles FOR DELETE TO authenticated
USING (fn_tiene_permiso('gestion_roles') OR fn_tiene_permiso('roles'));

-- ─── SOLICITUDES ASOCIADOS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_solicitudes_select"           ON public.solicitudes_asociados;
DROP POLICY IF EXISTS "rls_solicitudes_insert_public"    ON public.solicitudes_asociados;
DROP POLICY IF EXISTS "rls_solicitudes_update_admin"     ON public.solicitudes_asociados;
DROP POLICY IF EXISTS "rls_solicitudes_delete_admin"     ON public.solicitudes_asociados;
DROP POLICY IF EXISTS "solicitudes_select_authenticated" ON public.solicitudes_asociados;
DROP POLICY IF EXISTS "solicitudes_update_authenticated" ON public.solicitudes_asociados;
DROP POLICY IF EXISTS "solicitudes_delete_authenticated" ON public.solicitudes_asociados;
DROP POLICY IF EXISTS "solicitudes_insert_authenticated" ON public.solicitudes_asociados;
DROP POLICY IF EXISTS "Admin ve todas las solicitudes"   ON public.solicitudes_asociados;
DROP POLICY IF EXISTS "Usuario ve su propia solicitud"   ON public.solicitudes_asociados;

CREATE POLICY "rls_solicitudes_select" ON public.solicitudes_asociados FOR SELECT TO authenticated
USING (fn_tiene_permiso('solicitudes') OR usuario_id = auth.uid());

CREATE POLICY "rls_solicitudes_insert_anon" ON public.solicitudes_asociados FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "rls_solicitudes_insert_auth" ON public.solicitudes_asociados FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "rls_solicitudes_update" ON public.solicitudes_asociados FOR UPDATE TO authenticated
USING (fn_tiene_permiso('solicitudes'))
WITH CHECK (fn_tiene_permiso('solicitudes'));

CREATE POLICY "rls_solicitudes_delete" ON public.solicitudes_asociados FOR DELETE TO authenticated
USING (fn_tiene_permiso('solicitudes'));

-- ─── USUARIOS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rls_usuarios_select"       ON public.usuarios;
DROP POLICY IF EXISTS "rls_usuarios_insert_admin" ON public.usuarios;
DROP POLICY IF EXISTS "rls_usuarios_update"       ON public.usuarios;
DROP POLICY IF EXISTS "rls_usuarios_delete_admin" ON public.usuarios;

CREATE POLICY "rls_usuarios_select" ON public.usuarios FOR SELECT TO authenticated
USING (fn_tiene_permiso('gestion_usuarios') OR fn_tiene_permiso('usuarios') OR id = auth.uid());

CREATE POLICY "rls_usuarios_insert" ON public.usuarios FOR INSERT TO authenticated
WITH CHECK (fn_tiene_permiso('crear_usuario') OR fn_tiene_permiso('gestion_usuarios'));

CREATE POLICY "rls_usuarios_update" ON public.usuarios FOR UPDATE TO authenticated
USING (fn_tiene_permiso('editar_usuario') OR fn_tiene_permiso('gestion_usuarios') OR id = auth.uid())
WITH CHECK (fn_tiene_permiso('editar_usuario') OR fn_tiene_permiso('gestion_usuarios') OR id = auth.uid());

CREATE POLICY "rls_usuarios_delete" ON public.usuarios FOR DELETE TO authenticated
USING (fn_tiene_permiso('eliminar_usuario') OR fn_tiene_permiso('gestion_usuarios'));

-- ─── VERIFICACIÓN FINAL ───────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- Debe devolver 0 filas si todo quedó bien
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'
ORDER BY tablename;
