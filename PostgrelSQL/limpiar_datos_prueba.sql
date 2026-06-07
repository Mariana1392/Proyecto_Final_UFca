-- ============================================================
-- UFCA - Limpieza de datos de prueba
-- Elimina: creditos, ahorros permanentes, solicitudes de
--          comité evaluador, liquidaciones y usuarios no-admin.
-- PROTEGE: todos los usuarios con rol 'admin'
-- ============================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────
-- 1. PAGOS DE CRÉDITO (hijo de cuotas_credito)
-- ─────────────────────────────────────────────
DELETE FROM pagos_credito;

-- ─────────────────────────────────────────────
-- 2. CUOTAS DE CRÉDITO (hijo de creditos)
-- ─────────────────────────────────────────────
DELETE FROM cuotas_credito;

-- ─────────────────────────────────────────────
-- 3. CRÉDITOS
-- ─────────────────────────────────────────────
DELETE FROM creditos;

-- ─────────────────────────────────────────────
-- 4. PAGOS DE AHORRO PERMANENTE (hijo de ahorros_permanentes)
-- ─────────────────────────────────────────────
DELETE FROM pagos_ahorro_permanente;

-- ─────────────────────────────────────────────
-- 5. AHORROS PERMANENTES
-- ─────────────────────────────────────────────
DELETE FROM ahorros_permanentes;

-- ─────────────────────────────────────────────
-- 6. DISTRIBUCIONES DE UTILIDADES (relacionado con liquidaciones)
-- ─────────────────────────────────────────────
DELETE FROM distribuciones_utilidades;

-- ─────────────────────────────────────────────
-- 7. LIQUIDACIONES
-- ─────────────────────────────────────────────
DELETE FROM liquidaciones;

-- ─────────────────────────────────────────────
-- 8. COMITÉ EVALUADOR (hijo de solicitudes_asociados)
-- ─────────────────────────────────────────────
DELETE FROM comite_evaluador;

-- ─────────────────────────────────────────────
-- 9. SOLICITUDES DE ASOCIADOS (solicitudes de comité evaluador)
-- ─────────────────────────────────────────────
DELETE FROM solicitudes_asociados;

-- ─────────────────────────────────────────────
-- 10. USUARIOS — elimina TODOS excepto los admin
--     Protege a: admin@ufca.com, adminufca@gmail.com,
--                mariavalenciaospina@gmail.com
-- ─────────────────────────────────────────────
DELETE FROM usuarios
WHERE rol_id NOT IN (
    SELECT id FROM roles WHERE nombre = 'admin'
);

COMMIT;

-- ============================================================
-- Verificación: ejecuta esto después para confirmar
-- ============================================================
/*
SELECT 'usuarios no-admin restantes' AS tabla, COUNT(*) FROM usuarios WHERE rol_id NOT IN (SELECT id FROM roles WHERE nombre = 'admin')
UNION ALL
SELECT 'ahorros_permanentes',     COUNT(*) FROM ahorros_permanentes
UNION ALL
SELECT 'pagos_ahorro_permanente', COUNT(*) FROM pagos_ahorro_permanente
UNION ALL
SELECT 'creditos',                COUNT(*) FROM creditos
UNION ALL
SELECT 'cuotas_credito',          COUNT(*) FROM cuotas_credito
UNION ALL
SELECT 'pagos_credito',           COUNT(*) FROM pagos_credito
UNION ALL
SELECT 'solicitudes_asociados',   COUNT(*) FROM solicitudes_asociados
UNION ALL
SELECT 'comite_evaluador',        COUNT(*) FROM comite_evaluador
UNION ALL
SELECT 'liquidaciones',           COUNT(*) FROM liquidaciones
UNION ALL
SELECT 'distribuciones_utilidades', COUNT(*) FROM distribuciones_utilidades;
*/
