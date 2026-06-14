-- =============================================================================
-- UFCA — Migración Completa de Base de Datos
-- Union Familiar de Crédito y Ahorro
--
-- ✅ Seguro de ejecutar aunque roles / permisos / rol_permisos / usuarios
--    ya existan (usa IF NOT EXISTS y bloques DO para todo).
--
-- Orden de ejecución:
--   1. Completar columnas faltantes en tablas existentes
--   2. Crear tablas nuevas
--   3. Agregar FK entre tablas
--   4. Índices
--   5. Seeds (datos iniciales)
--   6. Verificación final
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- PASO 1 — COMPLETAR COLUMNAS FALTANTES EN TABLAS EXISTENTES
-- Agrega solo las columnas que el código necesita y que pueden no estar.
-- ADD COLUMN IF NOT EXISTS nunca falla aunque la columna ya exista.
-- =============================================================================

-- ── roles ─────────────────────────────────────────────────────────────────────
ALTER TABLE roles ADD COLUMN IF NOT EXISTS label       TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS activo      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS es_sistema  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Asegurar que label tenga valor (no puede ser NULL si el código la usa)
UPDATE roles SET label = nombre WHERE label IS NULL OR label = '';

-- ── permisos ──────────────────────────────────────────────────────────────────
ALTER TABLE permisos ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE permisos ADD COLUMN IF NOT EXISTS grupo      TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE permisos ADD COLUMN IF NOT EXISTS activo     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE permisos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE permisos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── rol_permisos ──────────────────────────────────────────────────────────────
ALTER TABLE rol_permisos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- ── usuarios ──────────────────────────────────────────────────────────────────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre         TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username       TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS identificacion TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo         BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol_id         UUID;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS asociado_id    UUID;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso  TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- =============================================================================
-- PASO 2 — CONFIGURACIÓN GLOBAL
-- =============================================================================

CREATE TABLE IF NOT EXISTS configuracion (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       TEXT        NOT NULL UNIQUE,
  valor       TEXT        NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PASO 3 — PERÍODOS DEL FONDO (diciembre → noviembre)
-- =============================================================================

CREATE TABLE IF NOT EXISTS periodos (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                TEXT        NOT NULL,
  año_inicio            INTEGER     NOT NULL,
  año_fin               INTEGER     NOT NULL,
  fecha_inicio          DATE        NOT NULL,
  fecha_fin             DATE        NOT NULL,
  estado                TEXT        NOT NULL DEFAULT 'activo'
                          CHECK (estado IN ('activo', 'cerrado')),
  fecha_cierre          TIMESTAMPTZ,
  cerrado_por           UUID,
  utilidad_total        NUMERIC(15,2) NOT NULL DEFAULT 0,
  utilidad_por_asociado NUMERIC(15,2),
  num_asociados_activos INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT periodo_fechas_validas CHECK (fecha_fin > fecha_inicio),
  CONSTRAINT periodo_año_valido     CHECK (año_fin = año_inicio + 1)
);

-- =============================================================================
-- PASO 4 — ASOCIADOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS asociados (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             TEXT        NOT NULL,
  cedula             TEXT        NOT NULL UNIQUE,
  telefono           TEXT,
  email              TEXT,
  direccion          TEXT,
  ocupacion          TEXT,
  estado             TEXT        NOT NULL DEFAULT 'activo'
                       CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
  fecha_ingreso      DATE,
  periodo_ingreso_id UUID        REFERENCES periodos(id),
  anulado            BOOLEAN     NOT NULL DEFAULT false,
  motivo_anulacion   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PASO 5 — FK ENTRE TABLAS EXISTENTES
-- Usa bloques DO para no fallar si la FK ya existe.
-- Limpia huérfanos antes de crear cada FK.
-- =============================================================================

-- usuarios.asociado_id → asociados.id
UPDATE usuarios SET asociado_id = NULL
WHERE asociado_id IS NOT NULL
  AND asociado_id NOT IN (SELECT id FROM asociados);

DO $$ BEGIN
  ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_asociado
    FOREIGN KEY (asociado_id) REFERENCES asociados(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- usuarios.rol_id → roles.id
UPDATE usuarios SET rol_id = NULL
WHERE rol_id IS NOT NULL
  AND rol_id NOT IN (SELECT id FROM roles);

DO $$ BEGIN
  ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_rol
    FOREIGN KEY (rol_id) REFERENCES roles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- periodos.cerrado_por → usuarios.id
DO $$ BEGIN
  ALTER TABLE periodos
    ADD CONSTRAINT fk_periodos_cerrado_por
    FOREIGN KEY (cerrado_por) REFERENCES usuarios(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PASO 6 — SOLICITUDES DE AFILIACIÓN
-- =============================================================================

CREATE TABLE IF NOT EXISTS solicitudes_asociados (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres              TEXT        NOT NULL,
  apellidos            TEXT        NOT NULL,
  cedula               TEXT        NOT NULL,
  tipo_identificacion  TEXT,
  telefono             TEXT,
  email                TEXT,
  direccion            TEXT,
  ocupacion            TEXT,
  ingreso_mensual      NUMERIC(15,2),
  motivacion           TEXT,
  estado               TEXT        NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN (
                           'pendiente', 'aprobada', 'rechazada', 'pendiente_activacion'
                         )),
  evaluacion           JSONB,
  documentos           TEXT[],
  observaciones        TEXT,
  aprobado_por         UUID        REFERENCES usuarios(id),
  fecha_solicitud      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_resolucion     TIMESTAMPTZ,
  fecha_activacion     DATE,
  usuario_id           UUID        REFERENCES usuarios(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PASO 7 — COMITÉ EVALUADOR
-- =============================================================================

CREATE TABLE IF NOT EXISTS comite_evaluador (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_asociado_id UUID        NOT NULL UNIQUE
                          REFERENCES solicitudes_asociados(id) ON DELETE CASCADE,
  evaluador_id          UUID        REFERENCES usuarios(id),
  verificaciones        JSONB       NOT NULL DEFAULT '{
    "documentacion": false,
    "ingresos":      false,
    "referencias":   false,
    "antecedentes":  false
  }'::jsonb,
  score_credito         INTEGER     NOT NULL DEFAULT 70
                          CHECK (score_credito BETWEEN 0 AND 100),
  comentarios           TEXT,
  decision              TEXT        NOT NULL DEFAULT 'en_evaluacion'
                          CHECK (decision IN ('en_evaluacion', 'aprobado', 'rechazado')),
  observacion           TEXT,
  fecha                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PASO 8 — AHORROS PERMANENTES
-- =============================================================================

CREATE TABLE IF NOT EXISTS ahorros_permanentes (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id      UUID          NOT NULL REFERENCES asociados(id),
  periodo_id       UUID          NOT NULL REFERENCES periodos(id),
  cuota_mensual    NUMERIC(15,2) NOT NULL,
  monto_ahorrado   NUMERIC(15,2) NOT NULL DEFAULT 0,
  estado           TEXT          NOT NULL DEFAULT 'activo'
                     CHECK (estado IN ('activo', 'cerrado', 'suspendido')),
  fecha_cierre     TIMESTAMPTZ,
  anulado          BOOLEAN       NOT NULL DEFAULT false,
  motivo_anulacion TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (asociado_id, periodo_id)
);

-- =============================================================================
-- PASO 9 — PAGOS DE AHORRO PERMANENTE
-- =============================================================================

CREATE TABLE IF NOT EXISTS pagos_ahorro_permanente (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ahorro_permanente_id UUID          NOT NULL REFERENCES ahorros_permanentes(id),
  asociado_id          UUID          NOT NULL REFERENCES asociados(id),
  periodo_id           UUID          NOT NULL REFERENCES periodos(id),
  mes_correspondiente  DATE          NOT NULL,
  fecha_pago           DATE          NOT NULL,
  monto_cuota          NUMERIC(15,2) NOT NULL,
  pago_mora            BOOLEAN       NOT NULL DEFAULT false,
  monto_mora           NUMERIC(15,2) NOT NULL DEFAULT 0,
  dias_mora            INTEGER       NOT NULL DEFAULT 0,
  monto_total_pagado   NUMERIC(15,2) NOT NULL,
  url_comprobante      TEXT,
  registrado_por       UUID          REFERENCES usuarios(id),
  observacion          TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PASO 10 — AHORROS VOLUNTARIOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS ahorros_voluntarios (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id      UUID          NOT NULL REFERENCES asociados(id),
  periodo_id       UUID          NOT NULL REFERENCES periodos(id),
  monto_ahorrado   NUMERIC(15,2) NOT NULL DEFAULT 0,
  estado           TEXT          NOT NULL DEFAULT 'activo'
                     CHECK (estado IN ('activo', 'retirado', 'cerrado')),
  fecha_retiro     TIMESTAMPTZ,
  fecha_cierre     TIMESTAMPTZ,
  monto_al_cierre  NUMERIC(15,2),
  anulado          BOOLEAN       NOT NULL DEFAULT false,
  motivo_anulacion TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (asociado_id, periodo_id)
);

-- =============================================================================
-- PASO 11 — PAGOS DE AHORRO VOLUNTARIO
-- =============================================================================

CREATE TABLE IF NOT EXISTS pagos_ahorro_voluntario (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ahorro_voluntario_id UUID          NOT NULL REFERENCES ahorros_voluntarios(id),
  asociado_id          UUID          NOT NULL REFERENCES asociados(id),
  fecha_pago           DATE          NOT NULL,
  monto                NUMERIC(15,2) NOT NULL CHECK (monto >= 50000),
  url_comprobante      TEXT,
  registrado_por       UUID          REFERENCES usuarios(id),
  observacion          TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PASO 12 — CRÉDITOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS creditos (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id               UUID          NOT NULL REFERENCES asociados(id),
  periodo_id                UUID          NOT NULL REFERENCES periodos(id),
  tipo                      TEXT          NOT NULL
                              CHECK (tipo IN ('libre_inversion','educacion','vivienda','calamidad')),
  monto                     NUMERIC(15,2) NOT NULL CHECK (monto > 0),
  plazo_meses               INTEGER       NOT NULL CHECK (plazo_meses BETWEEN 1 AND 12),
  tasa_interes              NUMERIC(6,4)  NOT NULL,
  tasa_mora                 NUMERIC(6,4),
  cuota_mensual             NUMERIC(15,2) NOT NULL,
  saldo                     NUMERIC(15,2) NOT NULL,
  estado                    TEXT          NOT NULL DEFAULT 'pendiente'
                              CHECK (estado IN (
                                'pendiente','en_revision','aprobado','desembolsado',
                                'activo','en_mora','pagado','rechazado','cancelado','simulacion'
                              )),
  referido_nombre           TEXT,
  referido_cedula           TEXT,
  referido_telefono         TEXT,
  fecha_desembolso          DATE,
  fecha_primera_cuota       DATE,
  fecha_ultima_cuota        DATE,
  fecha_estado_cambio       TIMESTAMPTZ,
  motivo_estado_cambio      TEXT,
  url_comprobante_solicitud TEXT,
  aprobado_por              UUID          REFERENCES usuarios(id),
  anulado                   BOOLEAN       NOT NULL DEFAULT false,
  motivo_anulacion          TEXT,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Un asociado no puede tener más de 1 crédito activo (excluyendo créditos para referidos)
DO $$ BEGIN
  CREATE UNIQUE INDEX idx_credito_activo_unico
    ON creditos (asociado_id)
    WHERE estado IN ('pendiente','en_revision','aprobado','desembolsado','activo','en_mora')
      AND referido_nombre IS NULL;
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- =============================================================================
-- PASO 13 — TABLA DE AMORTIZACIÓN
-- =============================================================================

CREATE TABLE IF NOT EXISTS cuotas_credito (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id        UUID          NOT NULL REFERENCES creditos(id) ON DELETE CASCADE,
  num_cuota         INTEGER       NOT NULL CHECK (num_cuota >= 1),
  fecha_vencimiento DATE          NOT NULL,
  capital           NUMERIC(15,2) NOT NULL CHECK (capital >= 0),
  interes           NUMERIC(15,2) NOT NULL CHECK (interes >= 0),
  cuota_total       NUMERIC(15,2) NOT NULL,
  saldo_inicial     NUMERIC(15,2) NOT NULL,
  saldo_final       NUMERIC(15,2) NOT NULL,
  estado            TEXT          NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','pagada','mora','abono_aplicado')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (credito_id, num_cuota)
);

-- =============================================================================
-- PASO 14 — PAGOS DE CRÉDITO
-- =============================================================================

CREATE TABLE IF NOT EXISTS pagos_credito (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id    UUID          NOT NULL REFERENCES creditos(id),
  cuota_id      UUID          REFERENCES cuotas_credito(id),
  tipo_pago     TEXT          NOT NULL
                  CHECK (tipo_pago IN ('cuota_regular','abono_capital','cancelacion_total')),
  monto_pagado  NUMERIC(15,2) NOT NULL CHECK (monto_pagado > 0),
  capital       NUMERIC(15,2) NOT NULL DEFAULT 0,
  interes       NUMERIC(15,2) NOT NULL DEFAULT 0,
  pago_mora     BOOLEAN       NOT NULL DEFAULT false,
  monto_mora    NUMERIC(15,2) NOT NULL DEFAULT 0,
  dias_mora     INTEGER       NOT NULL DEFAULT 0,
  saldo_antes   NUMERIC(15,2) NOT NULL,
  saldo_despues NUMERIC(15,2) NOT NULL,
  fecha_pago    DATE          NOT NULL,
  periodo_desde DATE,
  periodo_hasta DATE,
  metodo_pago   TEXT,
  url_comprobante TEXT,
  registrado_por  UUID        REFERENCES usuarios(id),
  observacion     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PASO 15 — LIQUIDACIONES
-- =============================================================================

CREATE TABLE IF NOT EXISTS liquidaciones (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id             UUID          NOT NULL REFERENCES asociados(id),
  periodo_id              UUID          NOT NULL REFERENCES periodos(id),
  usuario_id              UUID          REFERENCES usuarios(id),
  tipo                    TEXT          NOT NULL
                            CHECK (tipo IN ('retiro','cierre_anual','fallecimiento','expulsion','otro')),
  total_ahorro_permanente NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_ahorro_voluntario NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_deudas_credito    NUMERIC(15,2) NOT NULL DEFAULT 0,
  utilidades              NUMERIC(15,2) NOT NULL DEFAULT 0,
  monto_neto              NUMERIC(15,2) NOT NULL DEFAULT 0,
  detalle                 JSONB,
  observaciones           TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PASO 16 — DISTRIBUCIÓN DE UTILIDADES
-- =============================================================================

CREATE TABLE IF NOT EXISTS distribuciones_utilidades (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id             UUID          NOT NULL REFERENCES periodos(id),
  asociado_id            UUID          NOT NULL REFERENCES asociados(id),
  utilidad_total_periodo NUMERIC(15,2) NOT NULL,
  num_asociados          INTEGER       NOT NULL,
  valor_por_asociado     NUMERIC(15,2) NOT NULL,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (periodo_id, asociado_id)
);

-- =============================================================================
-- PASO 17 — EXCEPCIONES
-- =============================================================================

CREATE TABLE IF NOT EXISTS excepciones (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id      UUID        REFERENCES asociados(id),
  credito_id       UUID        REFERENCES creditos(id),
  tipo             TEXT        NOT NULL,
  descripcion      TEXT        NOT NULL,
  estado           TEXT        NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','aprobada','rechazada')),
  resuelto_por     UUID        REFERENCES usuarios(id),
  fecha_resolucion TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PASO 18 — NOTIFICACIONES
-- =============================================================================

CREATE TABLE IF NOT EXISTS notificaciones (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        REFERENCES usuarios(id),
  asociado_id UUID        REFERENCES asociados(id),
  tipo        TEXT        NOT NULL,
  titulo      TEXT        NOT NULL,
  mensaje     TEXT        NOT NULL,
  leida       BOOLEAN     NOT NULL DEFAULT false,
  para_admin  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PASO 19 — AUDITORÍA
-- =============================================================================

CREATE TABLE IF NOT EXISTS auditoria (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        REFERENCES usuarios(id),
  asociado_id UUID        REFERENCES asociados(id),
  tabla       TEXT        NOT NULL,
  registro_id UUID,
  accion      TEXT        NOT NULL,
  detalle     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PASO 20 — ÍNDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_asociados_cedula          ON asociados             (cedula);
CREATE INDEX IF NOT EXISTS idx_asociados_estado          ON asociados             (estado);
CREATE INDEX IF NOT EXISTS idx_ahorro_perm_asociado      ON ahorros_permanentes   (asociado_id);
CREATE INDEX IF NOT EXISTS idx_ahorro_perm_periodo       ON ahorros_permanentes   (periodo_id);
CREATE INDEX IF NOT EXISTS idx_pago_ahorro_perm_asociado ON pagos_ahorro_permanente (asociado_id);
CREATE INDEX IF NOT EXISTS idx_pago_ahorro_perm_mes      ON pagos_ahorro_permanente (mes_correspondiente);
CREATE INDEX IF NOT EXISTS idx_ahorro_vol_asociado       ON ahorros_voluntarios   (asociado_id);
CREATE INDEX IF NOT EXISTS idx_ahorro_vol_periodo        ON ahorros_voluntarios   (periodo_id);
CREATE INDEX IF NOT EXISTS idx_creditos_asociado         ON creditos              (asociado_id);
CREATE INDEX IF NOT EXISTS idx_creditos_estado           ON creditos              (estado);
CREATE INDEX IF NOT EXISTS idx_creditos_periodo          ON creditos              (periodo_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_credito            ON cuotas_credito        (credito_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_vencimiento        ON cuotas_credito        (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado             ON cuotas_credito        (estado);
CREATE INDEX IF NOT EXISTS idx_pagos_credito_credito     ON pagos_credito         (credito_id);
CREATE INDEX IF NOT EXISTS idx_pagos_credito_fecha       ON pagos_credito         (fecha_pago);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla           ON auditoria             (tabla);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at      ON auditoria             (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_usuario             ON notificaciones        (usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_leida               ON notificaciones        (leida);
CREATE INDEX IF NOT EXISTS idx_comite_evaluador_id       ON comite_evaluador      (evaluador_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado        ON solicitudes_asociados (estado);

-- =============================================================================
-- PASO 21 — SEEDS: CONFIGURACIÓN
-- =============================================================================

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('cuota_ahorro_permanente',        '100000', 'Cuota mensual fija de ahorro permanente en pesos'),
  ('dia_vencimiento_ahorro',         '16',     'Día del mes límite para pagar el ahorro permanente'),
  ('multa_mora_ahorro_diaria',       '2000',   'Multa por día de mora en ahorro permanente (pesos)'),
  ('monto_minimo_ahorro_voluntario', '50000',  'Monto mínimo para depósito de ahorro voluntario'),
  ('plazo_maximo_credito_meses',     '12',     'Plazo máximo para un crédito en meses'),
  ('tasa_interes_credito',           '0.0150', 'Tasa de interés mensual por defecto (1.5%)'),
  ('tasa_mora_credito',              '0.0200', 'Tasa de mora mensual sobre cuota vencida (2%)'),
  ('monto_minimo_credito',           '0',      'Monto mínimo para otorgar un crédito (0 = admin decide)'),
  ('meses_suspension',               '1',      'Meses de incumplimiento para suspender un asociado'),
  ('periodo_cerrado',                'false',  'Indica si el período actual está cerrado'),
  ('fecha_cierre_periodo',           '',       'Fecha en que se cerró el período actual'),
  ('aporte_minimo',                  '100000', 'Aporte mínimo al ingresar al fondo'),
  ('permitir_retiros_parciales',     'false',  'Si se permiten retiros parciales de ahorro voluntario'),
  ('criterios_evaluacion_solicitud',
   '["documentacion","ingresos","referencias","antecedentes"]',
   'Criterios del comité evaluador para solicitudes de afiliación')
ON CONFLICT (clave) DO UPDATE
  SET valor       = EXCLUDED.valor,
      descripcion = EXCLUDED.descripcion,
      updated_at  = NOW();

-- =============================================================================
-- PASO 22 — SEEDS: ROLES
-- =============================================================================

INSERT INTO roles (nombre, label, descripcion, activo, es_sistema) VALUES
  ('admin',    'Administrador', 'Acceso total. Solo puede haber uno.',     true, true),
  ('asociado', 'Asociado',      'Asociado del fondo. Ve su información.',  true, true),
  ('usuario',  'Usuario',       'Usuario con acceso limitado.',            true, false)
ON CONFLICT (nombre) DO UPDATE
  SET label       = EXCLUDED.label,
      descripcion = EXCLUDED.descripcion,
      es_sistema  = EXCLUDED.es_sistema;

-- =============================================================================
-- PASO 23 — SEEDS: PERMISOS
-- =============================================================================

INSERT INTO permisos (clave, label, descripcion, grupo, activo) VALUES
  ('dashboard',          'Dashboard',                 'Ver panel principal con métricas',             'admin',    true),
  ('gestion_asociados',  'Gestión de Asociados',      'CRUD completo de asociados',                   'admin',    true),
  ('gestion_usuarios',   'Gestión de Usuarios',       'CRUD completo de usuarios del sistema',        'admin',    true),
  ('gestion_roles',      'Gestión de Roles',          'Administrar roles y permisos',                 'admin',    true),
  ('creditos',           'Créditos',                  'Ver, aprobar y gestionar créditos',            'admin',    true),
  ('ahorros',            'Ahorros',                   'Ver y registrar pagos de ahorros',             'admin',    true),
  ('liquidaciones',      'Liquidaciones',             'Procesar liquidaciones y cierre de período',   'admin',    true),
  ('solicitudes',        'Comité Evaluador',          'Ver y resolver solicitudes de afiliación',     'admin',    true),
  ('excepciones',        'Excepciones',               'Ver y aprobar excepciones del sistema',        'admin',    true),
  ('auditoria',          'Auditoría',                 'Ver log de auditoría del sistema',             'admin',    true),
  ('configuracion',      'Configuración',             'Cambiar parámetros del sistema',               'admin',    true),
  ('notificaciones',     'Notificaciones',            'Ver notificaciones del sistema',               'admin',    true),
  ('reportes',           'Reportes PDF',              'Generar reportes y documentos PDF',            'admin',    true),
  ('mis_ahorros',        'Mis Ahorros',               'Ver propio historial de ahorros',              'asociado', true),
  ('mis_creditos',       'Mis Créditos',              'Ver propios créditos y amortización',          'asociado', true),
  ('mi_solicitud',       'Mi Solicitud',              'Ver estado de solicitud de afiliación',        'asociado', true),
  ('mis_notificaciones', 'Mis Notificaciones',        'Ver notificaciones propias',                   'asociado', true)
ON CONFLICT (clave) DO UPDATE
  SET label       = EXCLUDED.label,
      descripcion = EXCLUDED.descripcion,
      grupo       = EXCLUDED.grupo,
      activo      = EXCLUDED.activo;

-- =============================================================================
-- PASO 24 — SEEDS: ASIGNAR PERMISOS A ROLES
-- =============================================================================

INSERT INTO rol_permisos (rol_id, permiso_clave, activo)
SELECT r.id, p.clave, true
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'admin' AND p.grupo = 'admin'
ON CONFLICT (rol_id, permiso_clave) DO UPDATE SET activo = true;

INSERT INTO rol_permisos (rol_id, permiso_clave, activo)
SELECT r.id, p.clave, true
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'asociado' AND p.grupo = 'asociado'
ON CONFLICT (rol_id, permiso_clave) DO UPDATE SET activo = true;

-- =============================================================================
-- PASO 25 — SEED: PERÍODO ACTIVO 2025-2026
-- =============================================================================

INSERT INTO periodos (fecha_inicio, fecha_fin, estado)
VALUES ('2025-12-01', '2026-11-30', 'activo')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- VERIFICACIÓN FINAL
-- =============================================================================

SELECT table_name AS tabla,
       (xpath('/row/cnt/text()',
         query_to_xml('SELECT COUNT(*) AS cnt FROM ' || quote_ident(table_name), false, true, ''))
       )[1]::text::int AS registros
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type   = 'BASE TABLE'
ORDER BY table_name;
