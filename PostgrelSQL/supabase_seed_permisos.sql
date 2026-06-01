-- =============================================================================
-- UFCA — Script de seed para permisos y roles
-- Ejecutar en Supabase → SQL Editor
-- Seguro de correr múltiples veces (ON CONFLICT DO NOTHING)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VERIFICAR / CREAR TABLAS (por si no existen)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS permisos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave      text UNIQUE NOT NULL,
  label      text NOT NULL,
  descripcion text,
  grupo      text NOT NULL DEFAULT 'admin', -- 'admin' | 'asociado' | 'usuario'
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rol_permisos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rol_id        uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_clave text NOT NULL REFERENCES permisos(clave) ON DELETE CASCADE,
  UNIQUE(rol_id, permiso_clave)
);

-- -----------------------------------------------------------------------------
-- 2. INSERTAR TODOS LOS PERMISOS DEL SISTEMA
-- -----------------------------------------------------------------------------

INSERT INTO permisos (clave, label, descripcion, grupo) VALUES
  -- Módulos de administración
  ('dashboard',           'Dashboard',              'Acceso al panel principal de estadísticas',         'admin'),
  ('roles',               'Gestión de Roles',       'Crear, editar y eliminar roles del sistema',        'admin'),
  ('usuarios',            'Gestión de Usuarios',    'Administrar cuentas de usuario',                    'admin'),
  ('asociados',           'Gestión de Asociados',   'Ver y gestionar todos los asociados',               'admin'),
  ('ahorros',             'Ahorros (Admin)',         'Ver y registrar ahorros de todos los asociados',    'admin'),
  ('creditos',            'Créditos (Admin)',        'Ver y gestionar todos los créditos',                'admin'),
  ('liquidacion',         'Liquidación (Admin)',     'Procesar retiros y liquidaciones',                  'admin'),
  ('configuracion',       'Configuración',          'Configurar parámetros globales del sistema',        'admin'),

  -- Acciones sobre usuarios
  ('crear_usuario',       'Crear Usuario',          'Crear nuevos usuarios en el sistema',               'admin'),
  ('editar_usuario',      'Editar Usuario',         'Modificar datos de usuarios existentes',            'admin'),
  ('eliminar_usuario',    'Eliminar Usuario',       'Eliminar usuarios del sistema',                     'admin'),
  ('ver_auditoria',       'Ver Auditoría',          'Consultar el historial de auditoría',               'admin'),

  -- Acciones sobre asociados
  ('crear_asociado',      'Crear Asociado',         'Registrar nuevos asociados',                        'admin'),
  ('editar_asociado',     'Editar Asociado',        'Modificar datos de asociados',                      'admin'),
  ('eliminar_asociado',   'Eliminar Asociado',      'Eliminar asociados del sistema',                    'admin'),

  -- Módulos de asociado (vista propia filtrada)
  ('mis_ahorros',         'Mis Ahorros',            'Ver los ahorros propios del asociado',              'asociado'),
  ('mis_creditos',        'Mis Créditos',           'Ver los créditos propios del asociado',             'asociado'),
  ('mi_liquidacion',      'Mi Liquidación',         'Ver el estado de liquidación propia',               'asociado'),
  ('mis_referidos',       'Mis Referidos',          'Ver los referidos registrados por el asociado',     'asociado'),

  -- Usuario registrado pendiente de ser asociado
  ('solicitud_asociacion','Solicitud de Afiliación','Enviar y consultar solicitud de ingreso al fondo',  'usuario')

ON CONFLICT (clave) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. ASEGURAR QUE LOS ROLES BASE EXISTEN
-- -----------------------------------------------------------------------------

INSERT INTO roles (nombre, label, descripcion, activo, es_sistema) VALUES
  ('admin',    'Administrador', 'Acceso completo al sistema',                        true, true),
  ('asociado', 'Asociado',      'Miembro activo del fondo — ve solo sus propios datos', true, true),
  ('usuario',  'Usuario',       'Persona registrada pendiente de ser asociado',      true, true)
ON CONFLICT (nombre) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. ASIGNAR PERMISOS A CADA ROL
-- -----------------------------------------------------------------------------

-- ── ROL: admin — todos los permisos (reactiva los desactivados) ──────────────
INSERT INTO rol_permisos (rol_id, permiso_clave, activo)
SELECT r.id, p.clave, true
FROM roles r, permisos p
WHERE r.nombre = 'admin'
ON CONFLICT (rol_id, permiso_clave) DO UPDATE SET activo = true;

-- ── ROL: asociado — solo sus módulos propios (reactiva los desactivados) ──────
INSERT INTO rol_permisos (rol_id, permiso_clave, activo)
SELECT r.id, p.clave, true
FROM roles r, permisos p
WHERE r.nombre  = 'asociado'
  AND p.clave IN ('dashboard', 'mis_ahorros', 'mis_creditos', 'mi_liquidacion', 'mis_referidos')
ON CONFLICT (rol_id, permiso_clave) DO UPDATE SET activo = true;

-- ── ROL: usuario — solo puede ver su solicitud de afiliación ──────────────────
INSERT INTO rol_permisos (rol_id, permiso_clave, activo)
SELECT r.id, p.clave, true
FROM roles r, permisos p
WHERE r.nombre  = 'usuario'
  AND p.clave IN ('solicitud_asociacion')
ON CONFLICT (rol_id, permiso_clave) DO UPDATE SET activo = true;

-- -----------------------------------------------------------------------------
-- 5. VERIFICACIÓN — ver qué quedó
-- -----------------------------------------------------------------------------

SELECT
  r.nombre        AS rol,
  r.label         AS label_rol,
  COUNT(rp.permiso_clave) AS total_permisos
FROM roles r
LEFT JOIN rol_permisos rp ON rp.rol_id = r.id
GROUP BY r.nombre, r.label
ORDER BY r.nombre;
