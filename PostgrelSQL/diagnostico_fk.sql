-- ============================================================
-- Ejecuta CADA bloque por separado en Supabase SQL Editor
-- Copia el resultado de cada uno y pégamelo
-- ============================================================

-- ── QUERY 1: FOREIGN KEYS (la más importante) ─────────────
SELECT
  tc.table_name        AS tabla_origen,
  kcu.column_name      AS columna,
  tc.constraint_name   AS constraint_nombre,
  ccu.table_name       AS tabla_destino,
  ccu.column_name      AS columna_destino,
  rc.delete_rule       AS on_delete,
  rc.update_rule       AS on_update
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema   = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema    = 'public'
ORDER BY tc.table_name, kcu.column_name;


-- ── QUERY 2: TRIGGERS ──────────────────────────────────────
SELECT
  event_object_table AS tabla,
  trigger_name,
  event_manipulation AS evento,
  action_timing      AS timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;


-- ── QUERY 3: COLUMNAS de tablas clave ──────────────────────
SELECT
  table_name  AS tabla,
  column_name AS columna,
  data_type   AS tipo,
  is_nullable AS nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'usuarios', 'cuentas_ahorro', 'transacciones',
    'creditos', 'liquidaciones', 'auditoria',
    'solicitudes_asociados', 'comite_evaluador'
  )
ORDER BY table_name, ordinal_position;
