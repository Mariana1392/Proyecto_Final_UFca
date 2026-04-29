-- ═══════════════════════════════════════════════════════════════
-- Índices optimizados para búsqueda de liquidaciones
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Índice sobre created_at (fecha de registro) — para filtros por rango de fecha
CREATE INDEX IF NOT EXISTS idx_liq_created_at
  ON liquidaciones (created_at DESC);

-- 2. Índice compuesto tipo + created_at — para filtrar por tipo en rango de fechas
CREATE INDEX IF NOT EXISTS idx_liq_tipo_created_at
  ON liquidaciones (tipo, created_at DESC);

-- 3. Índice sobre asociado_id — para JOINs con la tabla asociados
CREATE INDEX IF NOT EXISTS idx_liq_asociado_id
  ON liquidaciones (asociado_id);

-- 4. Índice de expresión sobre detalle->>'estado' — para filtrar por estado del JSONB
CREATE INDEX IF NOT EXISTS idx_liq_detalle_estado
  ON liquidaciones ((detalle->>'estado'));

-- 5. Índice de expresión sobre detalle->>'anulado' — para separar activas / anuladas
CREATE INDEX IF NOT EXISTS idx_liq_detalle_anulado
  ON liquidaciones ((detalle->>'anulado'));

-- 6. Índice sobre nombre del asociado (en la tabla asociados) — para búsqueda por nombre
CREATE INDEX IF NOT EXISTS idx_asociados_nombre_trgm
  ON asociados USING gin (nombre gin_trgm_ops);
-- Requiere la extensión pg_trgm (viene habilitada en Supabase por defecto)

-- ═══════════════════════════════════════════════════════════════
-- CONSULTA SQL OPTIMIZADA — Búsqueda de liquidaciones
-- Parámetros sustituibles:
--   :nombre    → texto parcial del nombre del asociado (vacío = todos)
--   :reg_desde → fecha de registro inicio (YYYY-MM-DD, vacío = sin límite)
--   :reg_hasta → fecha de registro fin    (YYYY-MM-DD, vacío = sin límite)
--   :tipo      → tipo de liquidación ('retiro','cesantias',... vacío = todos)
--   :solo_anuladas → TRUE/FALSE
--   :limit     → registros por página (ej. 10)
--   :offset    → (página - 1) * limit
-- ═══════════════════════════════════════════════════════════════
SELECT
  l.id,
  l.tipo,
  l.monto_total,
  l.fecha,
  l.created_at,
  l.detalle,
  a.nombre  AS asociado_nombre,
  a.cedula  AS asociado_cedula
FROM liquidaciones l
INNER JOIN asociados a ON a.id = l.asociado_id
WHERE
  -- Búsqueda por nombre del asociado (insensible a mayúsculas/tildes con pg_trgm)
  (:nombre = '' OR a.nombre ILIKE '%' || :nombre || '%')

  -- Filtro por rango de fecha de registro
  AND (:reg_desde = '' OR l.created_at >= (:reg_desde || 'T00:00:00')::timestamptz)
  AND (:reg_hasta = '' OR l.created_at <= (:reg_hasta || 'T23:59:59')::timestamptz)

  -- Filtro por tipo de liquidación
  AND (:tipo = '' OR l.tipo = :tipo)

  -- Separar activas / anuladas (valor guardado en JSONB detalle->>'anulado')
  AND (
    CASE WHEN :solo_anuladas THEN (l.detalle->>'anulado')::boolean IS TRUE
         ELSE COALESCE((l.detalle->>'anulado')::boolean, FALSE) IS FALSE
    END
  )
ORDER BY l.created_at DESC
LIMIT  :limit
OFFSET :offset;

-- ═══════════════════════════════════════════════════════════════
-- CONSULTA DE CONTEO (para paginación) — mismos filtros sin LIMIT/OFFSET
-- ═══════════════════════════════════════════════════════════════
SELECT COUNT(*) AS total
FROM liquidaciones l
INNER JOIN asociados a ON a.id = l.asociado_id
WHERE
  (:nombre = '' OR a.nombre ILIKE '%' || :nombre || '%')
  AND (:reg_desde = '' OR l.created_at >= (:reg_desde || 'T00:00:00')::timestamptz)
  AND (:reg_hasta = '' OR l.created_at <= (:reg_hasta || 'T23:59:59')::timestamptz)
  AND (:tipo = '' OR l.tipo = :tipo)
  AND (
    CASE WHEN :solo_anuladas THEN (l.detalle->>'anulado')::boolean IS TRUE
         ELSE COALESCE((l.detalle->>'anulado')::boolean, FALSE) IS FALSE
    END
  );

-- Reload schema
NOTIFY pgrst, 'reload schema';
