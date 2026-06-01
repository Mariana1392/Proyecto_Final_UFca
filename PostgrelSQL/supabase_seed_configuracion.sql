-- =============================================================================
-- UFCA — Seed de parámetros operativos en la tabla `configuracion`
-- Ejecutar en Supabase → SQL Editor
-- Seguro de correr múltiples veces (ON CONFLICT DO NOTHING)
-- =============================================================================

-- IMPORTANTE: estos valores los gestiona el administrador del sistema desde
-- el módulo Configuración. Nunca editar directamente en código.

-- Asegurar que la tabla existe con la estructura correcta
CREATE TABLE IF NOT EXISTS configuracion (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       text        UNIQUE NOT NULL,
  valor       text        NOT NULL,
  descripcion text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Función para actualizar updated_at automáticamente (si no existe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_updated_at_configuracion ON configuracion;
CREATE TRIGGER set_updated_at_configuracion
  BEFORE UPDATE ON configuracion
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Parámetros de negocio
-- =============================================================================

INSERT INTO configuracion (clave, valor, descripcion) VALUES

  -- ── Ahorros ────────────────────────────────────────────────────────────────
  ('aporte_minimo',
   '50000',
   'Monto mínimo de aporte mensual de ahorro permanente en COP. Ejemplo: 50000'),

  -- ── Créditos / Mora ────────────────────────────────────────────────────────
  ('cuotas_maximas_incumplidas',
   '2',
   'Número de cuotas sin pagar antes de suspender al asociado automáticamente'),

  ('dias_mora_maximo',
   '30',
   'Días de retraso a partir de los cuales un crédito se marca en mora'),

  -- ── Retiros ────────────────────────────────────────────────────────────────
  ('permitir_retiros_parciales',
   'false',
   'true = los retiros parciales están permitidos por defecto; false = requieren aprobación'),

  -- ── Cierre de período ──────────────────────────────────────────────────────
  ('periodo_cerrado',
   'false',
   'true = el período contable actual está cerrado (bloquea pagos y desembolsos)'),

  ('fecha_cierre_periodo',
   '',
   'Fecha de cierre del período en formato YYYY-MM-DD. Vacío si el período está abierto')

ON CONFLICT (clave) DO NOTHING;

-- =============================================================================
-- Verificación — ver qué quedó registrado
-- =============================================================================

SELECT clave, valor, descripcion
FROM configuracion
ORDER BY clave;
