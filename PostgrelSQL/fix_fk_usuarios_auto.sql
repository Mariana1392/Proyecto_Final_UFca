-- ============================================================
-- FIX AUTOMÁTICO: encuentra y corrige TODAS las FK que apuntan
-- a usuarios(id) cambiándolas a ON DELETE SET NULL
-- No asume nombres de tablas — los descubre solo
-- ============================================================

DO $$
DECLARE
  r RECORD;
  sql_drop TEXT;
  sql_add  TEXT;
BEGIN
  -- Busca todas las FK que referencian la tabla usuarios
  FOR r IN
    SELECT
      tc.table_name        AS tabla,
      kcu.column_name      AS columna,
      tc.constraint_name   AS constraint_nombre
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema   = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema   = rc.constraint_schema
    JOIN information_schema.table_constraints tc2
      ON rc.unique_constraint_name  = tc2.constraint_name
      AND rc.unique_constraint_schema = tc2.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema    = 'public'
      AND tc2.table_name     = 'usuarios'
  LOOP
    RAISE NOTICE 'Corrigiendo: %.% (constraint: %)',
      r.tabla, r.columna, r.constraint_nombre;

    -- Eliminar FK existente
    sql_drop := format(
      'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
      r.tabla, r.constraint_nombre
    );
    EXECUTE sql_drop;

    -- Permitir NULL en la columna
    sql_add := format(
      'ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL',
      r.tabla, r.columna
    );
    BEGIN
      EXECUTE sql_add;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'No se pudo quitar NOT NULL en %.%: %',
        r.tabla, r.columna, SQLERRM;
    END;

    -- Recrear FK con ON DELETE SET NULL
    sql_add := format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES usuarios(id) ON DELETE SET NULL',
      r.tabla, r.constraint_nombre, r.columna
    );
    EXECUTE sql_add;

    RAISE NOTICE 'OK: %.% → ON DELETE SET NULL', r.tabla, r.columna;
  END LOOP;
END;
$$;

-- Recargar schema de PostgREST
NOTIFY pgrst, 'reload schema';
