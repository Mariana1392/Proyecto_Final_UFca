-- =============================================================================
-- UFCA — Triggers de auditoría server-side + soft delete
-- Ejecutar en Supabase → SQL Editor
-- Corrige S-10 (auditoría desde servidor) y B-08 (eliminación física)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AUDITORÍA AUTOMÁTICA — trigger en tablas críticas (S-10)
--    Escribe en auditoria sin importar si el cliente lo llama o no
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registrar_auditoria_automatica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO auditoria (
    tabla,
    operacion,
    registro_id,
    datos_antes,
    datos_despues,
    usuario_id,
    created_at
  )
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    auth.uid(),          -- usuario autenticado que hizo la operación
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Crear triggers en las tablas financieras críticas
-- Tablas reales del esquema verificadas contra api.ts
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- Tablas base del documento (mejora H)
    'usuarios',
    'creditos',
    'cuentas_ahorro',
    'transacciones',
    -- Tablas adicionales ya existentes
    'liquidaciones',
    'solicitudes_asociados'
  ] LOOP
    -- Verificar que la tabla existe antes de crear el trigger
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS tg_auditoria_%1$s ON %1$s;
         CREATE TRIGGER tg_auditoria_%1$s
           AFTER INSERT OR UPDATE OR DELETE ON %1$s
           FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_automatica();',
        t
      );
    END IF;
  END LOOP;
END;
$do$;

-- -----------------------------------------------------------------------------
-- 2. SOFT DELETE — proteger registros financieros de eliminación física (B-08)
--    Los créditos y pagos solo se "anulan" — nunca se borran de la BD
-- -----------------------------------------------------------------------------

-- Función que bloquea DELETE y lo convierte en anulación lógica
CREATE OR REPLACE FUNCTION public.bloquear_delete_financiero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'Eliminación física bloqueada en tabla %. Use el campo anulado=true para anular registros financieros.',
    TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

-- Aplicar en tablas donde eliminar físicamente es un riesgo de auditoría
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'creditos',
    'transacciones',
    'liquidaciones'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS tg_bloquear_delete_%1$s ON %1$s;
         CREATE TRIGGER tg_bloquear_delete_%1$s
           BEFORE DELETE ON %1$s
           FOR EACH ROW EXECUTE FUNCTION public.bloquear_delete_financiero();',
        t
      );
    END IF;
  END LOOP;
END;
$do$;

-- -----------------------------------------------------------------------------
-- 3. INMUTABILIDAD DE AUDITORÍA — bloquear UPDATE y DELETE en tabla auditoria
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bloquear_modificacion_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de auditoría son inmutables — no se permite % en la tabla auditoria.', TG_OP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tg_auditoria_inmutable_update ON auditoria;
CREATE TRIGGER tg_auditoria_inmutable_update
  BEFORE UPDATE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_modificacion_auditoria();

DROP TRIGGER IF EXISTS tg_auditoria_inmutable_delete ON auditoria;
CREATE TRIGGER tg_auditoria_inmutable_delete
  BEFORE DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_modificacion_auditoria();

-- -----------------------------------------------------------------------------
-- 4. Verificación
-- -----------------------------------------------------------------------------

SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'tg_%'
ORDER BY event_object_table, trigger_name;
