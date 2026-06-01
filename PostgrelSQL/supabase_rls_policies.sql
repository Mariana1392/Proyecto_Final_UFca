-- =============================================================================
-- UFCA — Row Level Security (RLS) — Políticas de Seguridad Completas
--
-- ARQUITECTURA DE ACCESO:
--   • admin     → acceso total a todas las tablas
--   • asociado  → solo ve y gestiona sus propios datos
--   • anónimo   → solo puede crear solicitud de afiliación (registro público)
--
-- FUNCIONES AUXILIARES (SECURITY DEFINER):
--   • fn_es_admin()         → true si el usuario actual tiene rol 'admin'
--   • fn_mi_asociado_id()   → UUID del asociado vinculado al usuario actual
--
-- CONVENCIÓN DE NOMBRES:
--   rls_<tabla>_<acción>_<quien>
--   Ejemplo: rls_creditos_select_admin
--
-- ✅ Seguro de ejecutar múltiples veces.
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================


-- =============================================================================
-- PASO 0 — FUNCIONES AUXILIARES
-- SECURITY DEFINER: se ejecutan con permisos del dueño de la función,
-- no del usuario que llama → evita recursión infinita en RLS.
-- =============================================================================

-- Retorna TRUE si el usuario autenticado tiene rol 'admin' y está activo
CREATE OR REPLACE FUNCTION fn_es_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   usuarios u
    JOIN   roles    r ON r.id = u.rol_id
    WHERE  u.id      = auth.uid()
      AND  r.nombre  = 'admin'
      AND  u.activo  = true
  );
$$;

-- Retorna el asociado_id del usuario autenticado (NULL si no tiene asociado)
CREATE OR REPLACE FUNCTION fn_mi_asociado_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT asociado_id
  FROM   usuarios
  WHERE  id = auth.uid();
$$;


-- =============================================================================
-- PASO 1 — HABILITAR RLS EN TODAS LAS TABLAS
-- Sin esto las políticas no tienen efecto.
-- =============================================================================

ALTER TABLE roles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE rol_permisos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion           ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios                ENABLE ROW LEVEL SECURITY;
ALTER TABLE asociados               ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_asociados   ENABLE ROW LEVEL SECURITY;
ALTER TABLE comite_evaluador        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahorros_permanentes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_ahorro_permanente ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahorros_voluntarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_ahorro_voluntario ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas_credito          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_credito           ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidaciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribuciones_utilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE excepciones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria               ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- PASO 2 — LIMPIAR POLÍTICAS ANTERIORES (para re-ejecutar limpio)
-- =============================================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM   pg_policies
    WHERE  schemaname = 'public'
      AND  policyname LIKE 'rls_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;


-- =============================================================================
-- TABLA: roles
-- Admin → CRUD completo
-- Autenticado → solo lectura (necesita leer su propio rol)
-- =============================================================================

CREATE POLICY rls_roles_select_auth
  ON roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY rls_roles_insert_admin
  ON roles FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_roles_update_admin
  ON roles FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_roles_delete_admin
  ON roles FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: permisos
-- Admin → CRUD completo
-- Autenticado → solo lectura (el frontend necesita leer permisos)
-- =============================================================================

CREATE POLICY rls_permisos_select_auth
  ON permisos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY rls_permisos_insert_admin
  ON permisos FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_permisos_update_admin
  ON permisos FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_permisos_delete_admin
  ON permisos FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: rol_permisos
-- Admin → CRUD completo
-- Autenticado → solo lectura
-- =============================================================================

CREATE POLICY rls_rol_permisos_select_auth
  ON rol_permisos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY rls_rol_permisos_insert_admin
  ON rol_permisos FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_rol_permisos_update_admin
  ON rol_permisos FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_rol_permisos_delete_admin
  ON rol_permisos FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: configuracion
-- Solo admin (contiene parámetros sensibles del negocio)
-- =============================================================================

CREATE POLICY rls_configuracion_select_admin
  ON configuracion FOR SELECT
  USING (fn_es_admin());

CREATE POLICY rls_configuracion_insert_admin
  ON configuracion FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_configuracion_update_admin
  ON configuracion FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_configuracion_delete_admin
  ON configuracion FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: usuarios
-- Admin → ve y gestiona todos
-- Usuario → ve y edita solo su propio perfil
-- =============================================================================

CREATE POLICY rls_usuarios_select
  ON usuarios FOR SELECT
  USING (
    fn_es_admin()
    OR id = auth.uid()
  );

CREATE POLICY rls_usuarios_insert_admin
  ON usuarios FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_usuarios_update
  ON usuarios FOR UPDATE
  USING (
    fn_es_admin()
    OR id = auth.uid()
  );

CREATE POLICY rls_usuarios_delete_admin
  ON usuarios FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: asociados
-- Admin → CRUD completo
-- Asociado → solo ve su propio registro
-- =============================================================================

CREATE POLICY rls_asociados_select
  ON asociados FOR SELECT
  USING (
    fn_es_admin()
    OR id = fn_mi_asociado_id()
  );

CREATE POLICY rls_asociados_insert_admin
  ON asociados FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_asociados_update_admin
  ON asociados FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_asociados_delete_admin
  ON asociados FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: periodos
-- Admin → CRUD completo
-- Autenticado → solo lectura (necesario para mostrar el período activo)
-- =============================================================================

CREATE POLICY rls_periodos_select_auth
  ON periodos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY rls_periodos_insert_admin
  ON periodos FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_periodos_update_admin
  ON periodos FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_periodos_delete_admin
  ON periodos FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: solicitudes_asociados
-- Admin      → CRUD completo
-- Anónimo    → INSERT (registro público desde el formulario de afiliación)
-- Asociado   → SELECT de su propia solicitud
-- =============================================================================

CREATE POLICY rls_solicitudes_select
  ON solicitudes_asociados FOR SELECT
  USING (
    fn_es_admin()
    OR usuario_id = auth.uid()
  );

-- Registro público: cualquiera puede crear una solicitud
CREATE POLICY rls_solicitudes_insert_public
  ON solicitudes_asociados FOR INSERT
  WITH CHECK (true);

CREATE POLICY rls_solicitudes_update_admin
  ON solicitudes_asociados FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_solicitudes_delete_admin
  ON solicitudes_asociados FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: comite_evaluador
-- Solo admin (proceso interno de evaluación)
-- =============================================================================

CREATE POLICY rls_comite_select_admin
  ON comite_evaluador FOR SELECT
  USING (fn_es_admin());

CREATE POLICY rls_comite_insert_admin
  ON comite_evaluador FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_comite_update_admin
  ON comite_evaluador FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_comite_delete_admin
  ON comite_evaluador FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: ahorros_permanentes
-- Admin    → CRUD completo
-- Asociado → solo ve sus propios ahorros
-- =============================================================================

CREATE POLICY rls_ahorro_perm_select
  ON ahorros_permanentes FOR SELECT
  USING (
    fn_es_admin()
    OR asociado_id = fn_mi_asociado_id()
  );

CREATE POLICY rls_ahorro_perm_insert_admin
  ON ahorros_permanentes FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_ahorro_perm_update_admin
  ON ahorros_permanentes FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_ahorro_perm_delete_admin
  ON ahorros_permanentes FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: pagos_ahorro_permanente
-- Admin    → CRUD completo
-- Asociado → solo ve sus propios pagos
-- =============================================================================

CREATE POLICY rls_pago_ahorro_perm_select
  ON pagos_ahorro_permanente FOR SELECT
  USING (
    fn_es_admin()
    OR asociado_id = fn_mi_asociado_id()
  );

CREATE POLICY rls_pago_ahorro_perm_insert_admin
  ON pagos_ahorro_permanente FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_pago_ahorro_perm_update_admin
  ON pagos_ahorro_permanente FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_pago_ahorro_perm_delete_admin
  ON pagos_ahorro_permanente FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: ahorros_voluntarios
-- Admin    → CRUD completo
-- Asociado → solo ve sus propios ahorros
-- =============================================================================

CREATE POLICY rls_ahorro_vol_select
  ON ahorros_voluntarios FOR SELECT
  USING (
    fn_es_admin()
    OR asociado_id = fn_mi_asociado_id()
  );

CREATE POLICY rls_ahorro_vol_insert_admin
  ON ahorros_voluntarios FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_ahorro_vol_update_admin
  ON ahorros_voluntarios FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_ahorro_vol_delete_admin
  ON ahorros_voluntarios FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: pagos_ahorro_voluntario
-- Admin    → CRUD completo
-- Asociado → solo ve sus propios pagos
-- =============================================================================

CREATE POLICY rls_pago_ahorro_vol_select
  ON pagos_ahorro_voluntario FOR SELECT
  USING (
    fn_es_admin()
    OR asociado_id IN (
        SELECT id FROM ahorros_voluntarios
        WHERE  asociado_id = fn_mi_asociado_id()
       )
  );

-- Simplificado con FK directa al asociado_id del ahorro
CREATE POLICY rls_pago_ahorro_vol_insert_admin
  ON pagos_ahorro_voluntario FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_pago_ahorro_vol_update_admin
  ON pagos_ahorro_voluntario FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_pago_ahorro_vol_delete_admin
  ON pagos_ahorro_voluntario FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: creditos
-- Admin    → CRUD completo
-- Asociado → solo ve sus propios créditos
-- =============================================================================

CREATE POLICY rls_creditos_select
  ON creditos FOR SELECT
  USING (
    fn_es_admin()
    OR asociado_id = fn_mi_asociado_id()
  );

CREATE POLICY rls_creditos_insert_admin
  ON creditos FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_creditos_update_admin
  ON creditos FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_creditos_delete_admin
  ON creditos FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: cuotas_credito
-- Admin    → CRUD completo
-- Asociado → solo ve cuotas de sus propios créditos
-- =============================================================================

CREATE POLICY rls_cuotas_credito_select
  ON cuotas_credito FOR SELECT
  USING (
    fn_es_admin()
    OR credito_id IN (
        SELECT id FROM creditos
        WHERE  asociado_id = fn_mi_asociado_id()
      )
  );

CREATE POLICY rls_cuotas_credito_insert_admin
  ON cuotas_credito FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_cuotas_credito_update_admin
  ON cuotas_credito FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_cuotas_credito_delete_admin
  ON cuotas_credito FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: pagos_credito
-- Admin    → CRUD completo
-- Asociado → solo ve pagos de sus propios créditos
-- =============================================================================

CREATE POLICY rls_pagos_credito_select
  ON pagos_credito FOR SELECT
  USING (
    fn_es_admin()
    OR credito_id IN (
        SELECT id FROM creditos
        WHERE  asociado_id = fn_mi_asociado_id()
      )
  );

CREATE POLICY rls_pagos_credito_insert_admin
  ON pagos_credito FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_pagos_credito_update_admin
  ON pagos_credito FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_pagos_credito_delete_admin
  ON pagos_credito FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: liquidaciones
-- Admin    → CRUD completo
-- Asociado → solo ve su propia liquidación
-- =============================================================================

CREATE POLICY rls_liquidaciones_select
  ON liquidaciones FOR SELECT
  USING (
    fn_es_admin()
    OR asociado_id = fn_mi_asociado_id()
  );

CREATE POLICY rls_liquidaciones_insert_admin
  ON liquidaciones FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_liquidaciones_update_admin
  ON liquidaciones FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_liquidaciones_delete_admin
  ON liquidaciones FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: distribuciones_utilidades
-- Admin    → CRUD completo
-- Asociado → solo ve su propia distribución
-- =============================================================================

CREATE POLICY rls_distribuciones_select
  ON distribuciones_utilidades FOR SELECT
  USING (
    fn_es_admin()
    OR asociado_id = fn_mi_asociado_id()
  );

CREATE POLICY rls_distribuciones_insert_admin
  ON distribuciones_utilidades FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_distribuciones_update_admin
  ON distribuciones_utilidades FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_distribuciones_delete_admin
  ON distribuciones_utilidades FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: excepciones
-- Admin    → CRUD completo
-- Asociado → ve solo las excepciones relacionadas a él
-- =============================================================================

CREATE POLICY rls_excepciones_select
  ON excepciones FOR SELECT
  USING (
    fn_es_admin()
    OR asociado_id = fn_mi_asociado_id()
  );

CREATE POLICY rls_excepciones_insert_admin
  ON excepciones FOR INSERT
  WITH CHECK (fn_es_admin());

CREATE POLICY rls_excepciones_update_admin
  ON excepciones FOR UPDATE
  USING (fn_es_admin());

CREATE POLICY rls_excepciones_delete_admin
  ON excepciones FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: notificaciones
-- Admin    → CRUD completo
-- Asociado → ve sus propias notificaciones y puede marcarlas como leídas
-- =============================================================================

CREATE POLICY rls_notificaciones_select
  ON notificaciones FOR SELECT
  USING (
    fn_es_admin()
    OR usuario_id  = auth.uid()
    OR asociado_id = fn_mi_asociado_id()
  );

CREATE POLICY rls_notificaciones_insert_admin
  ON notificaciones FOR INSERT
  WITH CHECK (fn_es_admin());

-- Asociado puede marcar como leída su propia notificación
CREATE POLICY rls_notificaciones_update
  ON notificaciones FOR UPDATE
  USING (
    fn_es_admin()
    OR usuario_id  = auth.uid()
    OR asociado_id = fn_mi_asociado_id()
  );

CREATE POLICY rls_notificaciones_delete_admin
  ON notificaciones FOR DELETE
  USING (fn_es_admin());


-- =============================================================================
-- TABLA: auditoria
-- Solo admin puede leer (log de auditoría es sensible)
-- Nadie puede modificar ni borrar (log inmutable)
-- Los registros solo se insertan via triggers SECURITY DEFINER en el backend
-- =============================================================================

CREATE POLICY rls_auditoria_select_admin
  ON auditoria FOR SELECT
  USING (fn_es_admin());

-- INSERT permitido solo a admin (o funciones SECURITY DEFINER internas)
CREATE POLICY rls_auditoria_insert_admin
  ON auditoria FOR INSERT
  WITH CHECK (fn_es_admin());

-- UPDATE y DELETE DENEGADOS: no se crean políticas → RLS bloquea por defecto


-- =============================================================================
-- VERIFICACIÓN FINAL
-- Debe listar todas las políticas creadas agrupadas por tabla
-- =============================================================================

SELECT
  tablename                                          AS tabla,
  COUNT(*)                                           AS total_politicas,
  STRING_AGG(policyname, ', ' ORDER BY policyname)  AS politicas
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'rls_%'
GROUP BY tablename
ORDER BY tablename;
