-- ============================================================
-- UFCA - Sincronizar usuarios de Auth → tabla usuarios
-- Ejecutar DESPUÉS de haber corrido supabase_schema.sql
-- ============================================================

INSERT INTO usuarios (id, nombre, email, rol_id, activo)
VALUES
  (
    '1540cd3e-682e-494d-8395-bac7f8d2befe',
    'Admin UFCA',
    'admin@ufca.com',
    (SELECT id FROM roles WHERE nombre = 'admin'),
    TRUE
  ),
  (
    'c5c36d6f-d81c-44ae-9786-8c0ee0c513d0',
    'Admin UFCA 2',
    'adminufca@gmail.com',
    (SELECT id FROM roles WHERE nombre = 'admin'),
    TRUE
  ),
  (
    '16f2d680-026a-4ecd-8614-ddfc938ddc1c',
    'Arjona',
    'arjona@gmail.com',
    (SELECT id FROM roles WHERE nombre = 'asociado'),
    TRUE
  ),
  (
    'd35cd8f7-b9d0-4550-94d4-7c2565544a01',
    'Arjone',
    'arjone@gmail.com',
    (SELECT id FROM roles WHERE nombre = 'asociado'),
    TRUE
  ),
  (
    'bf306f8e-cfdc-4b92-8623-891e93e57750',
    'Dairo Montiel',
    'dairomontiel20@gmail.com',
    (SELECT id FROM roles WHERE nombre = 'asociado'),
    TRUE
  ),
  (
    'd25eb3c6-3fd8-4df2-a162-7a55c190907b',
    'Maria Valencia Ospina',
    'mariavalenciaospina@gmail.com',
    (SELECT id FROM roles WHERE nombre = 'admin'),
    TRUE
  )
ON CONFLICT (id) DO UPDATE
  SET nombre     = EXCLUDED.nombre,
      email      = EXCLUDED.email,
      rol_id     = EXCLUDED.rol_id,
      activo     = EXCLUDED.activo,
      updated_at = NOW();
