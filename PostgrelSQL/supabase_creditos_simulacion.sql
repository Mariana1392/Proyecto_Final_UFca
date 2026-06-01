-- ── Migración: soporte para simulación de crédito ──────────────────────────
-- Ejecutar en el SQL Editor de Supabase

-- 1. Ampliar el CHECK constraint de estado en creditos para incluir 'simulacion'
ALTER TABLE creditos DROP CONSTRAINT IF EXISTS creditos_estado_check;
ALTER TABLE creditos ADD CONSTRAINT creditos_estado_check
  CHECK (estado IN (
    'simulacion',
    'pendiente',
    'en_revision',
    'aprobado',
    'aprobada',
    'desembolsado',
    'activo',
    'en_mora',
    'pagado',
    'rechazado'
  ));

-- 2. Agregar columna credito_id en notificaciones (si no existe) para vincular simulación
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS credito_id UUID REFERENCES creditos(id) ON DELETE SET NULL;
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS asociado_id UUID REFERENCES asociados(id) ON DELETE SET NULL;

-- 3. Índice para buscar simulaciones rápido
CREATE INDEX IF NOT EXISTS idx_creditos_simulacion ON creditos(estado) WHERE estado = 'simulacion';

-- 4. Notificar a PostgREST que recargue el schema
NOTIFY pgrst, 'reload schema';
