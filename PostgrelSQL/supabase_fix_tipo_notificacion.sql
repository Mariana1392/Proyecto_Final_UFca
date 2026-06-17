-- ============================================================
-- Corrección de Restricción de Tipo para la Tabla: notificaciones
-- Permite insertar notificaciones de tipo 'solicitud_credito'
-- Ejecutar en Supabase → SQL Editor → Run
-- ============================================================

-- 1. Buscar y eliminar dinámicamente cualquier check constraint en la columna "tipo" de "notificaciones"
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT conname 
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public' 
          AND rel.relname = 'notificaciones' 
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%tipo%'
    LOOP
        EXECUTE 'ALTER TABLE public.notificaciones DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 2. Crear la nueva restricción CHECK con todos los tipos válidos incluyendo 'solicitud_credito'
ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'credito_pendiente'::text,
    'credito_activo'::text,
    'credito_rechazado'::text,
    'ahorro_mora'::text,
    'simulacion_credito'::text,
    'afiliacion_aprobada'::text,
    'afiliacion_rechazada'::text,
    'pago_registrado'::text,
    'sistema'::text,
    'general'::text,
    'solicitud_afiliacion'::text,
    'solicitud_credito'::text
  ]));

-- 3. Recargar el esquema de PostgREST para aplicar los cambios
NOTIFY pgrst, 'reload schema';
