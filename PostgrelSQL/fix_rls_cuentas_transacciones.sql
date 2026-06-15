-- =============================================================================
-- SCRIPT DE SEGURIDAD RLS: CUENTAS DE AHORRO Y TRANSACCIONES - UFCA
--
-- Ejecutar en: Supabase → SQL Editor → Run
--
-- Habilita y define las políticas de RLS para las tablas `cuentas_ahorro`
-- y `transacciones` para permitir que el frontend interactúe de forma segura
-- utilizando únicamente el cliente estándar de Supabase (sin supabaseAdmin).
-- =============================================================================

BEGIN;

-- Asegurar que RLS esté habilitado
ALTER TABLE public.cuentas_ahorro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;

-- ── 1. POLÍTICAS PARA cuentas_ahorro ──────────────────────────────────────────

DROP POLICY IF EXISTS "rls_cuentas_ahorro_select" ON public.cuentas_ahorro;
DROP POLICY IF EXISTS "rls_cuentas_ahorro_insert" ON public.cuentas_ahorro;
DROP POLICY IF EXISTS "rls_cuentas_ahorro_update" ON public.cuentas_ahorro;
DROP POLICY IF EXISTS "rls_cuentas_ahorro_delete" ON public.cuentas_ahorro;

-- Lectura: Administradores con permiso 'ahorros' O el asociado dueño de la cuenta
CREATE POLICY "rls_cuentas_ahorro_select" ON public.cuentas_ahorro 
  FOR SELECT TO authenticated
  USING (fn_tiene_permiso('ahorros') OR asociado_id = fn_mi_asociado_id());

-- Escritura (Creación): Solo administradores con permiso 'ahorros'
CREATE POLICY "rls_cuentas_ahorro_insert" ON public.cuentas_ahorro 
  FOR INSERT TO authenticated
  WITH CHECK (fn_tiene_permiso('ahorros'));

-- Modificación: Solo administradores con permiso 'ahorros'
CREATE POLICY "rls_cuentas_ahorro_update" ON public.cuentas_ahorro 
  FOR UPDATE TO authenticated
  USING (fn_tiene_permiso('ahorros')) 
  WITH CHECK (fn_tiene_permiso('ahorros'));

-- Eliminación: Solo administradores con permiso 'ahorros'
CREATE POLICY "rls_cuentas_ahorro_delete" ON public.cuentas_ahorro 
  FOR DELETE TO authenticated
  USING (fn_tiene_permiso('ahorros'));


-- ── 2. POLÍTICAS PARA transacciones ───────────────────────────────────────────

DROP POLICY IF EXISTS "rls_transacciones_select" ON public.transacciones;
DROP POLICY IF EXISTS "rls_transacciones_insert" ON public.transacciones;
DROP POLICY IF EXISTS "rls_transacciones_update" ON public.transacciones;
DROP POLICY IF EXISTS "rls_transacciones_delete" ON public.transacciones;

-- Lectura: Administradores con permisos ('ahorros' o 'creditos') O el asociado dueño de la transacción
CREATE POLICY "rls_transacciones_select" ON public.transacciones 
  FOR SELECT TO authenticated
  USING (fn_tiene_permiso('ahorros') OR fn_tiene_permiso('creditos') OR asociado_id = fn_mi_asociado_id());

-- Creación: Administradores con permisos O el asociado dueño para reportar sus pagos
CREATE POLICY "rls_transacciones_insert" ON public.transacciones 
  FOR INSERT TO authenticated
  WITH CHECK (fn_tiene_permiso('ahorros') OR fn_tiene_permiso('creditos') OR asociado_id = fn_mi_asociado_id());

-- Modificación: Solo administradores con permisos
CREATE POLICY "rls_transacciones_update" ON public.transacciones 
  FOR UPDATE TO authenticated
  USING (fn_tiene_permiso('ahorros') OR fn_tiene_permiso('creditos'))
  WITH CHECK (fn_tiene_permiso('ahorros') OR fn_tiene_permiso('creditos'));

-- Eliminación: Solo administradores con permisos
CREATE POLICY "rls_transacciones_delete" ON public.transacciones 
  FOR DELETE TO authenticated
  USING (fn_tiene_permiso('ahorros') OR fn_tiene_permiso('creditos'));

COMMIT;

SELECT 'Políticas RLS para cuentas_ahorro y transacciones aplicadas correctamente.' AS resultado;
