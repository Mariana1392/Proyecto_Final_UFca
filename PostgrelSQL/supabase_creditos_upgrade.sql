-- ─────────────────────────────────────────────────────────────────────────────
-- Actualización tabla creditos: todas las columnas necesarias
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE creditos
  ADD COLUMN IF NOT EXISTS tasa_interes          DECIMAL(6,4)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estado_aprobacion     VARCHAR(30)    DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS descripcion_soporte   TEXT,
  ADD COLUMN IF NOT EXISTS url_documento         TEXT,
  ADD COLUMN IF NOT EXISTS motivo_anulacion      TEXT,
  ADD COLUMN IF NOT EXISTS editado_por           TEXT,
  ADD COLUMN IF NOT EXISTS editado_en            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_estado_cambio   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_estado_cambio  TEXT;

-- Comentarios
COMMENT ON COLUMN creditos.tasa_interes          IS 'Tasa de interés anual en porcentaje (ej. 12.5 = 12.5% EA)';
COMMENT ON COLUMN creditos.estado_aprobacion     IS 'pendiente | en_revision | aprobado | desembolsado | en_mora | pagado | rechazado';
COMMENT ON COLUMN creditos.descripcion_soporte   IS 'Descripción de los documentos de soporte entregados';
COMMENT ON COLUMN creditos.url_documento         IS 'URL o referencia al archivo de soporte adjunto';
COMMENT ON COLUMN creditos.motivo_anulacion      IS 'Razón por la que se anuló el crédito';
COMMENT ON COLUMN creditos.editado_por           IS 'Nombre o email del administrador que realizó la última edición';
COMMENT ON COLUMN creditos.editado_en            IS 'Fecha y hora de la última edición';
COMMENT ON COLUMN creditos.fecha_estado_cambio   IS 'Fecha efectiva del último cambio de estado de aprobación';
COMMENT ON COLUMN creditos.motivo_estado_cambio  IS 'Razón del cambio de estado (ej: pago vencido, aprobación de comité)';

-- Forzar recarga del schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificar
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'creditos'
  AND column_name IN (
    'tasa_interes','estado_aprobacion','descripcion_soporte',
    'url_documento','motivo_anulacion','editado_por','editado_en',
    'fecha_estado_cambio','motivo_estado_cambio'
  )
ORDER BY column_name;
