-- =====================================================================
-- UFCA: Limpieza de datos de prueba
-- =====================================================================
-- Borra:
--   [1] comite_evaluador           → todos los registros
--   [2] solicitudes_asociados      → todas
--   [3] transacciones              → solo tipo 'aporte_permanente'
--   [4] cuentas_ahorro             → solo tipo 'permanente'
--   [5] notificaciones             → solo de usuarios no-admin
--   [6] auditoria                  → solo de usuarios no-admin
--   [7] usuarios (public)          → solo rol != 'admin'
--   [8] auth.users                 → solo los mismos borrados en [7]
--
-- Conserva: usuario(s) con rol 'admin', periodos, configuracion, roles
--
-- REQUISITOS:
--   - Ejecutar en Supabase SQL Editor con permisos de service_role
--   - Hacer backup antes de ejecutar (irreversible)
-- =====================================================================

DO $$
DECLARE
  admin_ids UUID[];
  n         INTEGER;
BEGIN

  -- ── Identificar admins (PROTEGIDOS) ─────────────────────────────
  SELECT ARRAY_AGG(u.id)
  INTO   admin_ids
  FROM   usuarios u
  JOIN   roles    r ON r.id = u.rol_id
  WHERE  r.nombre = 'admin';

  -- Seguro de emergencia: si no hay admin, cancelar todo
  IF admin_ids IS NULL OR array_length(admin_ids, 1) = 0 THEN
    RAISE EXCEPTION
      'No se encontro ningun usuario admin. Operacion cancelada por seguridad.'
      USING ERRCODE = 'P0001';
  END IF;

  RAISE NOTICE '===============================================';
  RAISE NOTICE 'UFCA - Limpieza de datos de prueba';
  RAISE NOTICE 'Admin(s) protegidos: % cuenta(s)', array_length(admin_ids, 1);
  RAISE NOTICE '===============================================';


  -- ── [1] Comite evaluador: borrar TODO ───────────────────────────
  DELETE FROM comite_evaluador;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[1] comite_evaluador: % registro(s) borrado(s)', n;


  -- ── [2] Solicitudes de asociados: borrar TODAS ──────────────────
  DELETE FROM solicitudes_asociados;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[2] solicitudes_asociados: % registro(s) borrado(s)', n;


  -- ── [3] Transacciones de ahorro permanente ───────────────────────
  --   (antes de borrar cuentas_ahorro para evitar violacion de FK)
  DELETE FROM transacciones
  WHERE tipo = 'aporte_permanente';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[3] transacciones (aporte_permanente): % registro(s) borrado(s)', n;


  -- ── [4] Cuentas de ahorro permanente ────────────────────────────
  DELETE FROM cuentas_ahorro
  WHERE tipo = 'permanente';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[4] cuentas_ahorro (permanente): % registro(s) borrado(s)', n;


  -- ── [5] Notificaciones de no-admins ─────────────────────────────
  DELETE FROM notificaciones
  WHERE (asociado_id IS NOT NULL AND asociado_id <> ALL(admin_ids))
     OR (usuario_id  IS NOT NULL AND usuario_id  <> ALL(admin_ids));
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[5] notificaciones de asociados: % registro(s) borrado(s)', n;


  -- ── [6] Auditoria de no-admins ───────────────────────────────────
  --   Deshabilitamos el trigger de inmutabilidad solo para este paso
  ALTER TABLE auditoria DISABLE TRIGGER USER;

  DELETE FROM auditoria
  WHERE (usuario_id  IS NOT NULL AND usuario_id  <> ALL(admin_ids))
     OR (asociado_id IS NOT NULL AND asociado_id <> ALL(admin_ids));
  GET DIAGNOSTICS n = ROW_COUNT;

  ALTER TABLE auditoria ENABLE TRIGGER USER;
  RAISE NOTICE '[6] auditoria de asociados: % registro(s) borrado(s)', n;


  -- ── [7] Usuarios publicos no-admin ──────────────────────────────
  DELETE FROM usuarios
  WHERE id <> ALL(admin_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[7] usuarios (public): % registro(s) borrado(s)', n;


  -- ── [8] Cuentas de autenticacion no-admin ───────────────────────
  --   Requiere que el SQL Editor tenga permisos de service_role
  DELETE FROM auth.users
  WHERE id <> ALL(admin_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '[8] auth.users: % cuenta(s) borrada(s)', n;


  RAISE NOTICE '===============================================';
  RAISE NOTICE 'LIMPIEZA COMPLETADA. Admin intacto.';
  RAISE NOTICE '===============================================';

END;
$$;
