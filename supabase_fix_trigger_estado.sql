-- ============================================================
-- DIAGNÓSTICO: ver triggers en ahorro_permanente
-- ============================================================
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'ahorro_permanente';

-- ============================================================
-- FIX: eliminar cualquier trigger que cause el error
-- ============================================================
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'ahorro_permanente'
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || t.trigger_name || ' ON ahorro_permanente CASCADE';
    RAISE NOTICE 'Trigger eliminado: %', t.trigger_name;
  END LOOP;
END $$;

-- ============================================================
-- FIX: corregir defaults de la columna estado y anulado
-- ============================================================
ALTER TABLE ahorro_permanente ALTER COLUMN estado  SET DEFAULT true;
ALTER TABLE ahorro_permanente ALTER COLUMN anulado SET DEFAULT false;

-- ============================================================
-- VERIFICAR resultado
-- ============================================================
SELECT column_name, column_default, data_type
FROM information_schema.columns
WHERE table_name = 'ahorro_permanente'
  AND column_name IN ('estado', 'anulado');
