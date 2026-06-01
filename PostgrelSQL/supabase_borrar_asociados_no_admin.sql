-- =============================================================================
-- UFCA — Borrar asociados, sus créditos, ahorros, procesos y usuarios
--
-- ⚠️  IMPORTANTE: Este script es IRREVERSIBLE.
--     Haz una copia de seguridad antes de ejecutar.
--
-- ✅  Protege:  usuarios con rol 'admin' y sus asociados vinculados
-- ✅  Borra:    todo lo demás (ahorros, créditos, liquidaciones, solicitudes,
--               comité, notificaciones, auditoría, referidos, usuarios y
--               cuentas auth)
--
-- Ejecutar en: Supabase → SQL Editor (como postgres/service role)
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 0: Identificar IDs a preservar (admins)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ver qué se va a proteger ANTES de borrar (solo informativo)
SELECT
  u.id         AS usuario_id,
  u.nombre     AS usuario_nombre,
  u.email,a
  r.nombre     AS rol,
  u.asociado_id
FROM usuarios u
JOIN roles r ON r.id = u.rol_id
WHERE r.nombre = 'admin';


-- =============================================================================
-- A PARTIR DE AQUÍ EMPIEZA EL BORRADO — descomentar bloque por bloque
-- o ejecutar todo junto si estás seguro
-- =============================================================================

DO $$
DECLARE
  -- IDs de usuarios admin → nunca se tocan
  admin_usuario_ids   UUID[];
  -- IDs de asociados vinculados a un admin → nunca se tocan
  admin_asociado_ids  UUID[];
  -- IDs de usuarios no-admin que se van a borrar
  borrar_usuario_ids  UUID[];
  -- IDs de asociados no-admin que se van a borrar
  borrar_asociado_ids UUID[];
BEGIN

  -- ── Recopilar IDs protegidos ────────────────────────────────────────────
  SELECT ARRAY_AGG(u.id)
  INTO   admin_usuario_ids
  FROM   usuarios u
  JOIN   roles    r ON r.id = u.rol_id
  WHERE  r.nombre = 'admin';

  -- Si no hay admins definidos, abortar para no borrar todo sin red de seguridad
  IF admin_usuario_ids IS NULL OR array_length(admin_usuario_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No se encontraron usuarios con rol admin. Operación cancelada por seguridad.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT ARRAY_AGG(u.asociado_id)
  INTO   admin_asociado_ids
  FROM   usuarios u
  JOIN   roles    r ON r.id = u.rol_id
  WHERE  r.nombre = 'admin'
    AND  u.asociado_id IS NOT NULL;

  -- ── IDs a borrar ────────────────────────────────────────────────────────
  SELECT ARRAY_AGG(id) INTO borrar_usuario_ids
  FROM   usuarios
  WHERE  id <> ALL(COALESCE(admin_usuario_ids, '{}'));

  SELECT ARRAY_AGG(id) INTO borrar_asociado_ids
  FROM   asociados
  WHERE  id <> ALL(COALESCE(admin_asociado_ids, '{}'));

  RAISE NOTICE '----------------------------------------------';
  RAISE NOTICE 'Admins protegidos:   %', array_length(admin_usuario_ids, 1);
  RAISE NOTICE 'Usuarios a borrar:   %', array_length(borrar_usuario_ids, 1);
  RAISE NOTICE 'Asociados a borrar:  %', array_length(borrar_asociado_ids, 1);
  RAISE NOTICE '----------------------------------------------';

  -- ── 1. Comité evaluador ────────────────────────────────────────────────
  DELETE FROM comite_evaluador
  WHERE solicitud_asociado_id IN (
    SELECT id FROM solicitudes_asociados
    WHERE  usuario_id = ANY(borrar_usuario_ids)
       OR  cedula IN (SELECT cedula FROM asociados WHERE id = ANY(borrar_asociado_ids))
  );
  RAISE NOTICE '[1] comite_evaluador borrado';

  -- ── 2. Solicitudes de asociados ────────────────────────────────────────
  DELETE FROM solicitudes_asociados
  WHERE  usuario_id = ANY(borrar_usuario_ids)
     OR  cedula IN (SELECT cedula FROM asociados WHERE id = ANY(borrar_asociado_ids));
  RAISE NOTICE '[2] solicitudes_asociados borradas';

  -- ── 3. Auditoría de los usuarios/asociados no-admin ────────────────────
  -- La tabla auditoria tiene un trigger que bloquea DELETE por diseño.
  -- Lo deshabilitamos solo para esta operación de limpieza y lo restauramos al final.
  ALTER TABLE auditoria DISABLE TRIGGER bloquear_modificacion_auditoria;

  DELETE FROM auditoria
  WHERE  (usuario_id   = ANY(borrar_usuario_ids)  AND usuario_id IS NOT NULL)
     OR  (asociado_id  = ANY(borrar_asociado_ids) AND asociado_id IS NOT NULL);
  RAISE NOTICE '[3] auditoria borrada';

  ALTER TABLE auditoria ENABLE TRIGGER bloquear_modificacion_auditoria;

  -- ── 4. Notificaciones ──────────────────────────────────────────────────
  DELETE FROM notificaciones
  WHERE  (usuario_id  = ANY(borrar_usuario_ids)  AND usuario_id IS NOT NULL)
     OR  (asociado_id = ANY(borrar_asociado_ids) AND asociado_id IS NOT NULL);
  RAISE NOTICE '[4] notificaciones borradas';

  -- ── 5. Excepciones ─────────────────────────────────────────────────────
  DELETE FROM excepciones
  WHERE  asociado_id = ANY(borrar_asociado_ids);
  RAISE NOTICE '[5] excepciones borradas';

  -- ── 6. Documentos de liquidaciones ────────────────────────────────────
  -- (tabla liquidacion_documentos si existe)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE  table_schema = 'public' AND table_name = 'liquidacion_documentos'
  ) THEN
    DELETE FROM liquidacion_documentos
    WHERE  liquidacion_id IN (
      SELECT id FROM liquidaciones WHERE asociado_id = ANY(borrar_asociado_ids)
    );
    RAISE NOTICE '[6a] liquidacion_documentos borrados';
  END IF;

  -- ── 7. Liquidaciones ───────────────────────────────────────────────────
  DELETE FROM liquidaciones
  WHERE  asociado_id = ANY(borrar_asociado_ids);
  RAISE NOTICE '[7] liquidaciones borradas';

  -- ── 8. Transacciones (aportes de ahorro + pagos de crédito) ───────────
  DELETE FROM transacciones
  WHERE  asociado_id = ANY(borrar_asociado_ids);
  RAISE NOTICE '[8] transacciones borradas';

  -- ── 9. Cuotas de crédito ───────────────────────────────────────────────
  DELETE FROM cuotas_credito
  WHERE  credito_id IN (
    SELECT id FROM creditos WHERE asociado_id = ANY(borrar_asociado_ids)
  );
  RAISE NOTICE '[9] cuotas_credito borradas';

  -- ── 10. Créditos ───────────────────────────────────────────────────────
  DELETE FROM creditos
  WHERE  asociado_id = ANY(borrar_asociado_ids);
  RAISE NOTICE '[10] creditos borrados';

  -- ── 11. Cuentas de ahorro (permanente y voluntario consolidados) ───────
  DELETE FROM cuentas_ahorro
  WHERE  asociado_id = ANY(borrar_asociado_ids);
  RAISE NOTICE '[11] cuentas_ahorro borradas';

  -- ── 12. Tablas legacy (si aún existen como vistas o tablas reales) ─────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ahorros_permanentes'
  ) THEN
    DELETE FROM ahorros_permanentes WHERE asociado_id = ANY(borrar_asociado_ids);
    RAISE NOTICE '[12a] ahorros_permanentes (legacy) borrados';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ahorros_voluntarios'
  ) THEN
    DELETE FROM ahorros_voluntarios WHERE asociado_id = ANY(borrar_asociado_ids);
    RAISE NOTICE '[12b] ahorros_voluntarios (legacy) borrados';
  END IF;

  -- ── 13. Referidos ──────────────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'referidos'
  ) THEN
    DELETE FROM referidos
    WHERE  referidor_id = ANY(borrar_asociado_ids)
       OR  referido_id  = ANY(borrar_asociado_ids);
    RAISE NOTICE '[13] referidos borrados';
  END IF;

  -- Limpiar self-reference de asociados (referido_por_id)
  UPDATE asociados
  SET    referido_por_id = NULL
  WHERE  referido_por_id = ANY(borrar_asociado_ids);

  -- ── 14. Usuarios (public.usuarios) no-admin ────────────────────────────
  DELETE FROM usuarios
  WHERE  id = ANY(borrar_usuario_ids);
  RAISE NOTICE '[14] usuarios (public) borrados';

  -- ── 15. Asociados no-admin ─────────────────────────────────────────────
  DELETE FROM asociados
  WHERE  id = ANY(borrar_asociado_ids);
  RAISE NOTICE '[15] asociados borrados';

  -- ── 16. Cuentas Auth (auth.users) no-admin ────────────────────────────
  -- Requiere privilegio de postgres/service role (disponible en SQL Editor de Supabase)
  DELETE FROM auth.users
  WHERE  id = ANY(borrar_usuario_ids);
  RAISE NOTICE '[16] auth.users borrados';

  RAISE NOTICE '==============================================';
  RAISE NOTICE 'BORRADO COMPLETADO — admins intactos.';
  RAISE NOTICE '==============================================';

END;
$$;


-- =============================================================================
-- VERIFICACIÓN FINAL
-- =============================================================================

-- Usuarios que quedaron (solo deben aparecer los admins)
SELECT u.id, u.nombre, u.email, r.nombre AS rol
FROM   usuarios u
LEFT   JOIN roles r ON r.id = u.rol_id
ORDER  BY r.nombre;

-- Asociados que quedaron
SELECT id, nombre, cedula, estado FROM asociados ORDER BY nombre;
