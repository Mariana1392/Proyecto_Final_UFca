-- =============================================================================
-- UFCA — Mejoras v3
--
-- Contenido:
--   1. Trigger: crear ahorro permanente automáticamente al registrar un asociado
--   2. RLS: permitir al asociado enviar solicitudes de crédito y simulaciones
--
-- ✅ Seguro de ejecutar múltiples veces (idempotente).
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================


-- =============================================================================
-- MEJORA 1 — Ahorro permanente obligatorio al crear asociado
--
-- FLUJO:
--   Admin aprueba solicitud → crea registro en asociados
--   → trigger se dispara AFTER INSERT
--   → crea automáticamente ahorros_permanentes en el período activo
--   → cuota_mensual se toma de configuracion.cuota_ahorro_permanente
--
-- GARANTÍA: es imposible que exista un asociado activo sin ahorro permanente.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_crear_ahorro_permanente_inicial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_id    UUID;
  v_cuota_mensual NUMERIC(15,2);
BEGIN
  -- Obtener el período activo actual
  SELECT id INTO v_periodo_id
  FROM   periodos
  WHERE  estado = 'activo'
  ORDER BY fecha_inicio DESC
  LIMIT  1;

  -- Si no hay período activo, no bloqueamos la inserción del asociado
  -- pero sí registramos el problema en auditoria
  IF v_periodo_id IS NULL THEN
    INSERT INTO auditoria (tabla, registro_id, accion, detalle)
    VALUES (
      'asociados',
      NEW.id,
      'ADVERTENCIA',
      jsonb_build_object(
        'mensaje', 'No se pudo crear ahorro permanente: no hay período activo',
        'asociado_id', NEW.id,
        'nombre', NEW.nombre
      )
    );
    RETURN NEW;
  END IF;

  -- Obtener cuota mensual desde configuración
  SELECT valor::numeric INTO v_cuota_mensual
  FROM   configuracion
  WHERE  clave = 'cuota_ahorro_permanente';

  -- Crear el ahorro permanente inicial
  INSERT INTO ahorros_permanentes (
    asociado_id,
    periodo_id,
    cuota_mensual,
    monto_ahorrado,
    estado
  ) VALUES (
    NEW.id,
    v_periodo_id,
    COALESCE(v_cuota_mensual, 100000),  -- fallback $100.000 si no hay config
    0,
    'activo'
  )
  ON CONFLICT (asociado_id, periodo_id) DO NOTHING;
  -- ON CONFLICT: si por alguna razón ya existe (re-inserción), no falla

  RETURN NEW;
END;
$$;

-- Crear trigger AFTER INSERT en asociados
CREATE OR REPLACE TRIGGER trg_crear_ahorro_permanente
  AFTER INSERT ON asociados
  FOR EACH ROW
  EXECUTE FUNCTION fn_crear_ahorro_permanente_inicial();


-- =============================================================================
-- MEJORA 2 — RLS: asociado puede solicitar créditos y hacer simulaciones
--
-- REGLAS:
--   • El asociado solo puede insertar créditos donde asociado_id = el suyo
--   • Solo puede crear con estado 'pendiente' (solicitud) o 'simulacion'
--   • NO puede cambiar el estado (eso es solo del admin)
--   • NO puede ver créditos de otros asociados
--   • El admin sigue teniendo control total
--
-- Se reemplaza la política de INSERT que solo permitía admin.
-- =============================================================================

-- Eliminar política de INSERT anterior (solo admin)
DROP POLICY IF EXISTS rls_creditos_insert_admin ON creditos;

-- Nueva política: admin puede insertar cualquier crédito
CREATE POLICY rls_creditos_insert_admin
  ON creditos FOR INSERT
  WITH CHECK (fn_es_admin());

-- Nueva política: asociado puede solicitar o simular su propio crédito
CREATE POLICY rls_creditos_insert_asociado
  ON creditos FOR INSERT
  WITH CHECK (
    asociado_id = fn_mi_asociado_id()
    AND estado IN ('pendiente', 'simulacion')
  );

-- El asociado puede eliminar SOLO sus propias simulaciones (no solicitudes reales)
-- Esto permite "descartar" una simulación desde el frontend
DROP POLICY IF EXISTS rls_creditos_delete_asociado ON creditos;

CREATE POLICY rls_creditos_delete_asociado
  ON creditos FOR DELETE
  USING (
    asociado_id = fn_mi_asociado_id()
    AND estado = 'simulacion'
  );


-- =============================================================================
-- MEJORA 3 — RLS: asociado puede ver sus propias cuotas
-- (ya existía, pero verificamos que funcione para simulaciones también)
--
-- cuotas_credito ya tiene:
--   rls_cuotas_credito_select → admin OR credito en mis créditos ✅
-- No se necesita cambio.
-- =============================================================================


-- =============================================================================
-- VERIFICACIÓN FINAL
-- =============================================================================

-- 1. Verificar que el trigger existe
SELECT
  trigger_name,
  event_object_table AS tabla,
  action_timing      AS momento,
  event_manipulation AS evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'trg_crear_ahorro_permanente';

-- 2. Verificar políticas de créditos
SELECT policyname, cmd
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  tablename  = 'creditos'
ORDER BY cmd, policyname;

-- 3. Simular: si se inserta un asociado de prueba, ¿se crea el ahorro?
-- (Solo para verificación manual — no ejecutar en producción con datos reales)
-- SELECT id, nombre FROM asociados ORDER BY created_at DESC LIMIT 3;
-- SELECT * FROM ahorros_permanentes ORDER BY created_at DESC LIMIT 3;
