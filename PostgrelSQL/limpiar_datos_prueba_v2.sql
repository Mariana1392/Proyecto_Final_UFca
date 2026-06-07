-- ============================================================
-- LIMPIEZA DE DATOS DE PRUEBA — UFCA
-- Elimina: créditos, ahorros (permanente y voluntario),
--          liquidaciones, comité evaluador, usuarios no-admin
-- Protege: usuarios con rol 'admin'
-- ============================================================

BEGIN;

-- ── PASO 1: Desactivar triggers que bloquean DELETE físico ───
ALTER TABLE creditos     DISABLE TRIGGER tg_bloquear_delete_creditos;
ALTER TABLE liquidaciones DISABLE TRIGGER tg_bloquear_delete_liquidaciones;

-- ── PASO 2: Transacciones ────────────────────────────────────
-- (referencia creditos, cuentas_ahorro, cuotas_credito → va primero)
DELETE FROM transacciones;

-- ── PASO 3: Excepciones ──────────────────────────────────────
-- (referencia creditos → va antes que creditos)
DELETE FROM excepciones;

-- ── PASO 4: Créditos y sus hijos ────────────────────────────
DELETE FROM credito_historial_estados;
DELETE FROM cuotas_credito;
DELETE FROM creditos;

-- ── PASO 5: Distribuciones de utilidades ────────────────────
DELETE FROM distribuciones_utilidades;

-- ── PASO 6: Liquidaciones ────────────────────────────────────
DELETE FROM liquidaciones;

-- ── PASO 7: Ahorros (permanente y voluntario) ────────────────
DELETE FROM cuentas_ahorro;

-- ── PASO 8: Comité evaluador y solicitudes ───────────────────
DELETE FROM comite_evaluador;
DELETE FROM solicitudes_asociados;

-- ── PASO 9: Referidos ────────────────────────────────────────
DELETE FROM referidos;

-- ── PASO 10: Notificaciones de usuarios no-admin ─────────────
DELETE FROM notificaciones
WHERE usuario_id NOT IN (
  SELECT id FROM usuarios
  WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'admin')
);

-- ── PASO 11: Usuarios no-admin ───────────────────────────────
DELETE FROM usuarios
WHERE rol_id NOT IN (SELECT id FROM roles WHERE nombre = 'admin');

-- ── PASO 12: Reactivar triggers ──────────────────────────────
ALTER TABLE creditos      ENABLE TRIGGER tg_bloquear_delete_creditos;
ALTER TABLE liquidaciones ENABLE TRIGGER tg_bloquear_delete_liquidaciones;

COMMIT;

-- ── VERIFICACIÓN (ejecutar aparte para confirmar) ────────────
/*
SELECT 'usuarios no-admin'          AS tabla, COUNT(*) FROM usuarios WHERE rol_id NOT IN (SELECT id FROM roles WHERE nombre = 'admin')
UNION ALL SELECT 'cuentas_ahorro',             COUNT(*) FROM cuentas_ahorro
UNION ALL SELECT 'creditos',                   COUNT(*) FROM creditos
UNION ALL SELECT 'cuotas_credito',             COUNT(*) FROM cuotas_credito
UNION ALL SELECT 'credito_historial_estados',  COUNT(*) FROM credito_historial_estados
UNION ALL SELECT 'liquidaciones',              COUNT(*) FROM liquidaciones
UNION ALL SELECT 'distribuciones_utilidades',  COUNT(*) FROM distribuciones_utilidades
UNION ALL SELECT 'solicitudes_asociados',      COUNT(*) FROM solicitudes_asociados
UNION ALL SELECT 'comite_evaluador',           COUNT(*) FROM comite_evaluador
UNION ALL SELECT 'transacciones',              COUNT(*) FROM transacciones
UNION ALL SELECT 'excepciones',               COUNT(*) FROM excepciones
UNION ALL SELECT 'referidos',                  COUNT(*) FROM referidos;
*/
