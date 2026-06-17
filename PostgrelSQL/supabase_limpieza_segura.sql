-- =============================================================================
-- UFCA — Limpieza Segura y Sincronizada de Base de Datos
--
-- Este script realiza una limpieza total de datos de prueba (auditorías, cuentas
-- de ahorro, créditos, cuotas, liquidaciones, solicitudes y comité evaluador).
--
-- Para evitar discrepancias en el sistema, también elimina a los usuarios
-- no-administradores de la tabla auth.users, lo que por cascada limpia la tabla
-- public.usuarios, asegurando consistencia total.
--
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

BEGIN;

-- 1. Desactivar triggers conflictivos y de inmutabilidad de auditoría para permitir la limpieza
ALTER TABLE public.creditos      DISABLE TRIGGER tg_bloquear_delete_creditos;
ALTER TABLE public.liquidaciones DISABLE TRIGGER tg_bloquear_delete_liquidaciones;
ALTER TABLE public.auditoria     DISABLE TRIGGER tg_auditoria_inmutable_delete;

-- 2. Limpiar auto-referencias de usuarios (evitar bloqueos de FK en borrado)
UPDATE public.usuarios SET referido_por_id = NULL;

-- 3. Limpiar historial de auditoría y notificaciones
DELETE FROM public.auditoria;
DELETE FROM public.notificaciones;

-- 4. Limpiar transacciones y libro mayor (dependencia directa de créditos y ahorros)
DELETE FROM public.transacciones;

-- 5. Limpiar excepciones, cuotas de crédito y créditos
DELETE FROM public.excepciones;
DELETE FROM public.cuotas_credito;
DELETE FROM public.creditos;

-- 6. Limpiar liquidaciones
DELETE FROM public.liquidaciones;

-- 7. Limpiar cuentas de ahorro
DELETE FROM public.cuentas_ahorro;

-- 8. Limpiar resoluciones del comité evaluador y solicitudes de asociados
DELETE FROM public.comite_evaluador;
DELETE FROM public.solicitudes_asociados;

-- 9. Eliminar usuarios no-administradores de auth.users (cascada automática a public.usuarios)
DELETE FROM auth.users
WHERE id NOT IN (
  SELECT id FROM public.usuarios
  WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'admin')
);

-- 10. Reactivar triggers de seguridad financiera e inmutabilidad de auditoría
ALTER TABLE public.creditos      ENABLE TRIGGER tg_bloquear_delete_creditos;
ALTER TABLE public.liquidaciones ENABLE TRIGGER tg_bloquear_delete_liquidaciones;
ALTER TABLE public.auditoria     ENABLE TRIGGER tg_auditoria_inmutable_delete;

COMMIT;
