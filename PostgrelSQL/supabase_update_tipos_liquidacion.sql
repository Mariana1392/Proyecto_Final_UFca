-- Actualización de la restricción de los tipos de liquidación
-- Se elimina 'cesantias' y se agregan 'calamidad' y 'anual'

ALTER TABLE liquidaciones 
DROP CONSTRAINT IF EXISTS liquidaciones_tipo_check;

ALTER TABLE liquidaciones 
ADD CONSTRAINT liquidaciones_tipo_check 
CHECK (tipo IN ('retiro', 'expulsion', 'fallecimiento', 'anual', 'otro'));
