-- 1. Agregar campos de suspensión a la tabla usuarios
-- Permite registrar cuándo y por qué se suspendió/retiró a un asociado.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_suspension DATE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS motivo_suspension TEXT;

-- 2. Agregar campo para guardar la multa diaria vigente al caer en mora (ahorro permanente)
-- Permite "congelar" la tarifa de mora para cuentas que ya entraron en mora, de modo que cambios
-- posteriores en la tarifa global no les afecten.
-- NULL significa que no está en mora o que aún no se le ha asignado una tarifa específica.
ALTER TABLE cuentas_ahorro ADD COLUMN IF NOT EXISTS multa_mora_vigente NUMERIC(15,2);

-- 3. Agregar 'multa_mora_ahorro_diaria' a la tabla configuracion si no existe
-- Inicializado en 2000 pesos por defecto.
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('multa_mora_ahorro_diaria', '2000', 'Multa por día de mora en ahorro permanente (pesos)')
ON CONFLICT (clave) DO NOTHING;
