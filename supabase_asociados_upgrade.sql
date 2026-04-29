-- ============================================================
-- UFCA - Upgrade tabla asociados
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ── 1. Columnas de trazabilidad ────────────────────────────
ALTER TABLE asociados ADD COLUMN IF NOT EXISTS modificado_por    TEXT;
ALTER TABLE asociados ADD COLUMN IF NOT EXISTS fecha_modificacion TIMESTAMPTZ;
ALTER TABLE asociados ADD COLUMN IF NOT EXISTS fecha_cambio_estado TIMESTAMPTZ;

-- ── 2. Función para verificar que el asociado esté activo ───
-- Usada como CHECK en inserts de créditos y ahorros
CREATE OR REPLACE FUNCTION asociado_esta_activo(p_asociado_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activo BOOLEAN;
BEGIN
  SELECT estado INTO v_activo FROM asociados WHERE id = p_asociado_id;
  RETURN COALESCE(v_activo, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION asociado_esta_activo(UUID) TO authenticated;

-- ── 3. Trigger: bloquear créditos para asociados inactivos ──
CREATE OR REPLACE FUNCTION check_asociado_activo_para_credito()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT asociado_esta_activo(NEW.asociado_id) THEN
    RAISE EXCEPTION 'No se puede crear un crédito para un asociado inactivo.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_asociado_credito ON creditos;
CREATE TRIGGER trg_check_asociado_credito
  BEFORE INSERT ON creditos
  FOR EACH ROW EXECUTE FUNCTION check_asociado_activo_para_credito();

-- ── 4. Trigger: bloquear ahorro permanente para inactivos ───
CREATE OR REPLACE FUNCTION check_asociado_activo_para_ahorro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT asociado_esta_activo(NEW.asociado_id) THEN
    RAISE EXCEPTION 'No se puede crear ahorro para un asociado inactivo.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_asociado_ahorro_perm ON ahorro_permanente;
CREATE TRIGGER trg_check_asociado_ahorro_perm
  BEFORE INSERT ON ahorro_permanente
  FOR EACH ROW EXECUTE FUNCTION check_asociado_activo_para_ahorro();

DROP TRIGGER IF EXISTS trg_check_asociado_ahorro_vol ON ahorro_voluntario;
CREATE TRIGGER trg_check_asociado_ahorro_vol
  BEFORE INSERT ON ahorro_voluntario
  FOR EACH ROW EXECUTE FUNCTION check_asociado_activo_para_ahorro();

-- ── 5. Verificar resultado ──────────────────────────────────
SELECT id, nombre, cedula, estado, modificado_por, fecha_modificacion
FROM asociados ORDER BY nombre;
