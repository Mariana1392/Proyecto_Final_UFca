-- ============================================================
-- DIAGNÓSTICO COMPLETO DE LA BASE DE DATOS UFCA
-- Ejecutar en Supabase → SQL Editor
-- Copia y pégame el resultado completo
-- ============================================================

-- 1. TABLAS existentes
SELECT '=== TABLAS ===' AS seccion, '' AS tabla, '' AS detalle
UNION ALL
SELECT '', table_name, ''
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY 2;

-- 2. COLUMNAS de cada tabla
SELECT '=== COLUMNAS ===' AS seccion, '' AS tabla, '' AS columna, '' AS tipo, '' AS nullable, '' AS default_val
UNION ALL
SELECT '', table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. FOREIGN KEYS (constraints FK)
SELECT '=== FOREIGN KEYS ===' AS seccion,
       '' AS tabla_origen, '' AS columna, '' AS constraint_nombre,
       '' AS tabla_destino, '' AS on_delete
UNION ALL
SELECT '',
  tc.table_name,
  kcu.column_name,
  tc.constraint_name,
  ccu.table_name AS tabla_destino,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 4. ÍNDICES
SELECT '=== INDICES ===' AS seccion, '' AS tabla, '' AS indice, '' AS definicion
UNION ALL
SELECT '', tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. TRIGGERS
SELECT '=== TRIGGERS ===' AS seccion,
       '' AS tabla, '' AS trigger_nombre, '' AS evento, '' AS timing, '' AS funcion
UNION ALL
SELECT '',
  event_object_table,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 6. FUNCIONES / RPCs
SELECT '=== FUNCIONES ===' AS seccion, '' AS nombre, '' AS retorno
UNION ALL
SELECT '', routine_name, data_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 7. POLÍTICAS RLS
SELECT '=== RLS POLICIES ===' AS seccion,
       '' AS tabla, '' AS politica, '' AS comando, '' AS roles
UNION ALL
SELECT '',
  tablename, policyname, cmd,
  array_to_string(roles, ', ')
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
