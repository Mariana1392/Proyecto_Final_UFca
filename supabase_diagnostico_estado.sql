-- Ver todas las RLS policies de ahorro_permanente
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'ahorro_permanente';

-- Ver todas las funciones que mencionan 'activo' y 'ahorro_permanente'
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_definition ILIKE '%activo%'
  AND routine_definition ILIKE '%ahorro%';
