-- ============================================================
-- UFCA - Sistema de Gestión
-- Script completo para Supabase / PostgreSQL
-- EJECUTAR EN: Supabase → SQL Editor → Run
-- (Para bases de datos ya existentes usar supabase_migration_fusion.sql)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- LIMPIEZA COMPLETA (elimina todo lo anterior si existe)
-- ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS eventos_inscritos        CASCADE;
DROP TABLE IF EXISTS pedidos_detalle          CASCADE;
DROP TABLE IF EXISTS ventas_detalle           CASCADE;
DROP TABLE IF EXISTS compras_detalle          CASCADE;
DROP TABLE IF EXISTS pagos_premios            CASCADE;
DROP TABLE IF EXISTS liquidaciones            CASCADE;
DROP TABLE IF EXISTS excepciones              CASCADE;
DROP TABLE IF EXISTS pagos_credito            CASCADE;
DROP TABLE IF EXISTS creditos                 CASCADE;
DROP TABLE IF EXISTS movimientos_ahorro       CASCADE;
DROP TABLE IF EXISTS ahorros                  CASCADE;
DROP TABLE IF EXISTS pedidos                  CASCADE;
DROP TABLE IF EXISTS ventas                   CASCADE;
DROP TABLE IF EXISTS compras                  CASCADE;
DROP TABLE IF EXISTS productos                CASCADE;
DROP TABLE IF EXISTS proveedores              CASCADE;
DROP TABLE IF EXISTS categorias               CASCADE;
DROP TABLE IF EXISTS eventos                  CASCADE;
DROP TABLE IF EXISTS usuarios                 CASCADE;
DROP TABLE IF EXISTS asociados                CASCADE;
DROP TABLE IF EXISTS roles                    CASCADE;

DROP FUNCTION IF EXISTS set_updated_at()              CASCADE;
DROP FUNCTION IF EXISTS get_user_role()               CASCADE;
DROP FUNCTION IF EXISTS get_asociado_id()             CASCADE;
DROP FUNCTION IF EXISTS actualizar_stock_compra()     CASCADE;
DROP FUNCTION IF EXISTS reducir_stock_venta()         CASCADE;
DROP FUNCTION IF EXISTS actualizar_saldo_ahorro()     CASCADE;
DROP FUNCTION IF EXISTS actualizar_saldo_credito()    CASCADE;


-- ──────────────────────────────────────────────────────────
-- EXTENSIONES
-- ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ──────────────────────────────────────────────────────────
-- FUNCIÓN PARA updated_at AUTOMÁTICO
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- TABLAS
-- Orden: roles → asociados → usuarios → resto
-- ============================================================

-- ── ROLES ──────────────────────────────────────────────────
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(100) UNIQUE NOT NULL,
  descripcion TEXT,
  permisos    JSONB DEFAULT '[]',
  activo      BOOLEAN DEFAULT TRUE,
  es_sistema  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── ASOCIADOS ──────────────────────────────────────────────
CREATE TABLE asociados (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referido_por_id UUID REFERENCES asociados(id) ON DELETE SET NULL,
  nombre          VARCHAR(255) NOT NULL,
  cedula          VARCHAR(20) UNIQUE NOT NULL,
  telefono        VARCHAR(20),
  email           VARCHAR(255),
  direccion       TEXT,
  fecha_ingreso   DATE NOT NULL DEFAULT CURRENT_DATE,
  estado          VARCHAR(20) DEFAULT 'activo'
                  CHECK (estado IN ('activo','inactivo','suspendido')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_asociados_updated_at
  BEFORE UPDATE ON asociados
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_asociados_cedula   ON asociados(cedula);
CREATE INDEX idx_asociados_estado   ON asociados(estado);
CREATE INDEX idx_asociados_referido ON asociados(referido_por_id);


-- ── USUARIOS ───────────────────────────────────────────────
CREATE TABLE usuarios (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  asociado_id  UUID REFERENCES asociados(id) ON DELETE SET NULL,
  rol_id       UUID REFERENCES roles(id),
  nombre       VARCHAR(255) NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  activo       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_usuarios_rol_id      ON usuarios(rol_id);
CREATE INDEX idx_usuarios_asociado_id ON usuarios(asociado_id);
CREATE INDEX idx_usuarios_email       ON usuarios(email);


-- ── AHORROS (unificado: permanente + voluntario) ───────────
-- Discriminador: tipo = 'permanente' | 'voluntario'
CREATE TABLE ahorros (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id      UUID NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  tipo             VARCHAR(20) NOT NULL CHECK (tipo IN ('permanente', 'voluntario')),
  cuota_mensual    DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto_ahorrado   DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha_inicio     DATE NOT NULL DEFAULT CURRENT_DATE,
  estado           BOOLEAN DEFAULT TRUE,
  anulado          BOOLEAN DEFAULT FALSE,
  motivo_anulacion TEXT,
  -- Campos extra del ahorro voluntario (NULL para permanente)
  frecuencia       VARCHAR(20),
  monto_objetivo   DECIMAL(12,2),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_ahorros_updated_at
  BEFORE UPDATE ON ahorros
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_ahorros_asociado ON ahorros(asociado_id);
CREATE INDEX idx_ahorros_tipo     ON ahorros(tipo);
CREATE INDEX idx_ahorros_estado   ON ahorros(estado);


-- ── MOVIMIENTOS AHORRO (unificado) ─────────────────────────
-- Discriminador: tipo_ahorro = 'permanente' | 'voluntario'
CREATE TABLE movimientos_ahorro (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ahorro_id        UUID NOT NULL REFERENCES ahorros(id) ON DELETE CASCADE,
  asociado_id      UUID NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  tipo_ahorro      VARCHAR(20) NOT NULL CHECK (tipo_ahorro IN ('permanente', 'voluntario')),
  tipo_movimiento  VARCHAR(20) NOT NULL
                   CHECK (tipo_movimiento IN ('Aporte','Depósito','Retiro','Interés','Ajuste')),
  monto            DECIMAL(12,2) NOT NULL,
  saldo_anterior   DECIMAL(12,2) NOT NULL,
  saldo_nuevo      DECIMAL(12,2) NOT NULL,
  fecha_movimiento DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion      TEXT,
  metodo_pago      VARCHAR(50),
  registrado_por   UUID REFERENCES usuarios(id),
  anulado          BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mov_ahorro_ahorro_id    ON movimientos_ahorro(ahorro_id);
CREATE INDEX idx_mov_ahorro_asociado     ON movimientos_ahorro(asociado_id);
CREATE INDEX idx_mov_ahorro_tipo_ahorro  ON movimientos_ahorro(tipo_ahorro);
CREATE INDEX idx_mov_ahorro_fecha        ON movimientos_ahorro(fecha_movimiento);


-- ── CRÉDITOS ───────────────────────────────────────────────
CREATE TABLE creditos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id      UUID NOT NULL REFERENCES asociados(id) ON DELETE RESTRICT,
  monto            DECIMAL(12,2) NOT NULL,
  plazo_meses      INT NOT NULL,
  tasa_interes     DECIMAL(5,2) NOT NULL,
  cuota_mensual    DECIMAL(12,2),
  saldo            DECIMAL(12,2),
  fecha_solicitud  DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_aprobacion DATE,
  fecha_desembolso DATE,
  estado           VARCHAR(30) DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','aprobado','rechazado','desembolsado','activo','pagado','en_mora','vencido')),
  tipo_credito     VARCHAR(50),
  destino          TEXT,
  garantia         TEXT,
  observaciones    TEXT,
  aprobado_por     UUID REFERENCES usuarios(id),
  anulado          BOOLEAN DEFAULT FALSE,
  motivo_anulacion TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_creditos_updated_at
  BEFORE UPDATE ON creditos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_creditos_asociado ON creditos(asociado_id);
CREATE INDEX idx_creditos_estado   ON creditos(estado);
CREATE INDEX idx_creditos_anulado  ON creditos(anulado);


-- ── PAGOS DE CRÉDITO ──────────────────────────────────────
CREATE TABLE pagos_credito (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id       UUID NOT NULL REFERENCES creditos(id) ON DELETE RESTRICT,
  asociado_id      UUID NOT NULL REFERENCES asociados(id),
  monto            DECIMAL(12,2) NOT NULL,
  aplicado_capital DECIMAL(12,2) NOT NULL DEFAULT 0,
  aplicado_interes DECIMAL(12,2) NOT NULL DEFAULT 0,
  saldo_anterior   DECIMAL(12,2) NOT NULL,
  saldo_pendiente  DECIMAL(12,2) NOT NULL,
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago      VARCHAR(50),
  referencia       VARCHAR(100),
  observaciones    TEXT,
  registrado_por   UUID REFERENCES usuarios(id),
  anulado          BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pagos_credito_id  ON pagos_credito(credito_id);
CREATE INDEX idx_pagos_asociado_id ON pagos_credito(asociado_id);
CREATE INDEX idx_pagos_fecha       ON pagos_credito(fecha);


-- ── CATEGORÍAS ────────────────────────────────────────────
CREATE TABLE categorias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(100) UNIQUE NOT NULL,
  descripcion TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_categorias_updated_at
  BEFORE UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── PROVEEDORES ───────────────────────────────────────────
CREATE TABLE proveedores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(255) NOT NULL,
  nit         VARCHAR(20) UNIQUE,
  contacto    VARCHAR(255),
  telefono    VARCHAR(20),
  email       VARCHAR(255),
  direccion   TEXT,
  ciudad      VARCHAR(100),
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_proveedores_updated_at
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_proveedores_activo ON proveedores(activo);


-- ── PRODUCTOS ─────────────────────────────────────────────
CREATE TABLE productos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        VARCHAR(50) UNIQUE NOT NULL,
  nombre        VARCHAR(255) NOT NULL,
  descripcion   TEXT,
  categoria_id  UUID REFERENCES categorias(id) ON DELETE SET NULL,
  proveedor_id  UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  precio_compra DECIMAL(12,2) NOT NULL DEFAULT 0,
  precio_venta  DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock         INT DEFAULT 0,
  stock_minimo  INT DEFAULT 0,
  estado        VARCHAR(20) DEFAULT 'Disponible'
                CHECK (estado IN ('Disponible','Stock bajo','Agotado')),
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_activo    ON productos(activo);
CREATE INDEX idx_productos_codigo    ON productos(codigo);


-- ── COMPRAS ───────────────────────────────────────────────
CREATE TABLE compras (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_factura VARCHAR(50) UNIQUE NOT NULL,
  proveedor_id   UUID REFERENCES proveedores(id) ON DELETE RESTRICT,
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal       DECIMAL(12,2) NOT NULL DEFAULT 0,
  iva            DECIMAL(12,2) DEFAULT 0,
  descuento      DECIMAL(12,2) DEFAULT 0,
  total          DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado         VARCHAR(20) DEFAULT 'Pendiente'
                 CHECK (estado IN ('Pendiente','En tránsito','Recibida','Cancelada')),
  metodo_pago    VARCHAR(50),
  observaciones  TEXT,
  registrado_por UUID REFERENCES usuarios(id),
  anulado        BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_compras_updated_at
  BEFORE UPDATE ON compras
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_compras_proveedor ON compras(proveedor_id);
CREATE INDEX idx_compras_estado    ON compras(estado);


-- ── DETALLE COMPRAS ───────────────────────────────────────
CREATE TABLE compras_detalle (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id       UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(12,2) NOT NULL,
  subtotal        DECIMAL(12,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compras_det_compra   ON compras_detalle(compra_id);
CREATE INDEX idx_compras_det_producto ON compras_detalle(producto_id);


-- ── VENTAS ────────────────────────────────────────────────
CREATE TABLE ventas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id UUID REFERENCES asociados(id) ON DELETE SET NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal    DECIMAL(12,2) NOT NULL DEFAULT 0,
  descuento   DECIMAL(12,2) DEFAULT 0,
  total       DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado      VARCHAR(20) DEFAULT 'pendiente'
              CHECK (estado IN ('pendiente','completada','anulada')),
  metodo_pago VARCHAR(50),
  notas       TEXT,
  created_by  UUID REFERENCES usuarios(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_ventas_updated_at
  BEFORE UPDATE ON ventas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_ventas_asociado ON ventas(asociado_id);
CREATE INDEX idx_ventas_estado   ON ventas(estado);
CREATE INDEX idx_ventas_fecha    ON ventas(fecha);


-- ── DETALLE VENTAS ────────────────────────────────────────
CREATE TABLE ventas_detalle (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id        UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(12,2) NOT NULL,
  subtotal        DECIMAL(12,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ventas_det_venta    ON ventas_detalle(venta_id);
CREATE INDEX idx_ventas_det_producto ON ventas_detalle(producto_id);


-- ── PEDIDOS ───────────────────────────────────────────────
CREATE TABLE pedidos (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id            UUID NOT NULL REFERENCES asociados(id) ON DELETE RESTRICT,
  fecha                  DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega_estimada DATE,
  subtotal               DECIMAL(12,2) NOT NULL DEFAULT 0,
  total                  DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado                 VARCHAR(20) DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente','aprobado','entregado','anulado')),
  notas                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_pedidos_asociado ON pedidos(asociado_id);
CREATE INDEX idx_pedidos_estado   ON pedidos(estado);


-- ── DETALLE PEDIDOS ───────────────────────────────────────
CREATE TABLE pedidos_detalle (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(12,2) NOT NULL,
  subtotal        DECIMAL(12,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pedidos_det_pedido   ON pedidos_detalle(pedido_id);
CREATE INDEX idx_pedidos_det_producto ON pedidos_detalle(producto_id);


-- ── EVENTOS ───────────────────────────────────────────────
CREATE TABLE eventos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      VARCHAR(255) NOT NULL,
  descripcion TEXT,
  fecha       DATE NOT NULL,
  hora        TIME,
  lugar       VARCHAR(255),
  capacidad   INT,
  presupuesto DECIMAL(12,2) DEFAULT 0,
  responsable VARCHAR(255),
  estado      VARCHAR(20) DEFAULT 'programado'
              CHECK (estado IN ('programado','en_curso','finalizado','cancelado')),
  created_by  UUID REFERENCES usuarios(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_eventos_updated_at
  BEFORE UPDATE ON eventos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_eventos_fecha  ON eventos(fecha);
CREATE INDEX idx_eventos_estado ON eventos(estado);


-- ── EVENTOS INSCRITOS ─────────────────────────────────────
CREATE TABLE eventos_inscritos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id         UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  asociado_id       UUID NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  fecha_inscripcion TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (evento_id, asociado_id)
);

CREATE INDEX idx_ev_inscritos_evento   ON eventos_inscritos(evento_id);
CREATE INDEX idx_ev_inscritos_asociado ON eventos_inscritos(asociado_id);


-- ── PAGOS PREMIOS ─────────────────────────────────────────
CREATE TABLE pagos_premios (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id    UUID NOT NULL REFERENCES asociados(id) ON DELETE RESTRICT,
  tipo_premio    VARCHAR(50) NOT NULL
                 CHECK (tipo_premio IN ('Cumpleaños','Navidad','Día del padre','Día de la madre','Otro')),
  monto          DECIMAL(12,2) NOT NULL,
  fecha_pago     DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago    VARCHAR(50),
  estado         VARCHAR(20) DEFAULT 'Pendiente'
                 CHECK (estado IN ('Pendiente','Programado','Pagado','Cancelado')),
  observaciones  TEXT,
  registrado_por UUID REFERENCES usuarios(id),
  anulado        BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_pagos_premios_updated_at
  BEFORE UPDATE ON pagos_premios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_premios_asociado ON pagos_premios(asociado_id);
CREATE INDEX idx_premios_estado   ON pagos_premios(estado);


-- ── LIQUIDACIONES ─────────────────────────────────────────
CREATE TABLE liquidaciones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo             VARCHAR(50) NOT NULL,
  fecha_inicio        DATE NOT NULL,
  fecha_fin           DATE NOT NULL,
  total_ahorros       DECIMAL(12,2) DEFAULT 0,
  total_creditos      DECIMAL(12,2) DEFAULT 0,
  total_intereses     DECIMAL(12,2) DEFAULT 0,
  utilidades          DECIMAL(12,2) DEFAULT 0,
  estado              VARCHAR(20) DEFAULT 'Pendiente'
                      CHECK (estado IN ('Pendiente','En proceso','Completada','Anulada')),
  procesado_por       UUID REFERENCES usuarios(id),
  fecha_procesamiento TIMESTAMPTZ,
  observaciones       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_liquidaciones_updated_at
  BEFORE UPDATE ON liquidaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── EXCEPCIONES ───────────────────────────────────────────
CREATE TABLE excepciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asociado_id   UUID NOT NULL REFERENCES asociados(id) ON DELETE RESTRICT,
  tipo          VARCHAR(100) NOT NULL,
  descripcion   TEXT NOT NULL,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  estado        VARCHAR(20) DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','aprobada','rechazada')),
  resuelto_por  UUID REFERENCES usuarios(id),
  observaciones TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_excepciones_updated_at
  BEFORE UPDATE ON excepciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_excepciones_asociado ON excepciones(asociado_id);
CREATE INDEX idx_excepciones_estado   ON excepciones(estado);


-- ============================================================
-- FUNCIONES Y TRIGGERS DE NEGOCIO
-- ============================================================

-- Actualizar stock al recibir una compra
CREATE OR REPLACE FUNCTION actualizar_stock_compra()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'Recibida' AND OLD.estado <> 'Recibida' THEN
    UPDATE productos p
    SET stock = p.stock + cd.cantidad,
        estado = CASE
          WHEN (p.stock + cd.cantidad) <= 0 THEN 'Agotado'
          WHEN (p.stock + cd.cantidad) <= p.stock_minimo THEN 'Stock bajo'
          ELSE 'Disponible'
        END,
        updated_at = NOW()
    FROM compras_detalle cd
    WHERE cd.compra_id = NEW.id AND cd.producto_id = p.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_stock_compra
  AFTER UPDATE ON compras
  FOR EACH ROW EXECUTE FUNCTION actualizar_stock_compra();


-- Reducir stock al completar una venta
CREATE OR REPLACE FUNCTION reducir_stock_venta()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'completada' AND OLD.estado <> 'completada' THEN
    UPDATE productos p
    SET stock = p.stock - vd.cantidad,
        estado = CASE
          WHEN (p.stock - vd.cantidad) <= 0 THEN 'Agotado'
          WHEN (p.stock - vd.cantidad) <= p.stock_minimo THEN 'Stock bajo'
          ELSE 'Disponible'
        END,
        updated_at = NOW()
    FROM ventas_detalle vd
    WHERE vd.venta_id = NEW.id AND vd.producto_id = p.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_stock_venta
  AFTER UPDATE ON ventas
  FOR EACH ROW EXECUTE FUNCTION reducir_stock_venta();


-- Actualizar monto_ahorrado en ahorros tras cada movimiento
CREATE OR REPLACE FUNCTION actualizar_saldo_ahorro()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ahorros
  SET monto_ahorrado = NEW.saldo_nuevo, updated_at = NOW()
  WHERE id = NEW.ahorro_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_saldo_ahorro
  AFTER INSERT ON movimientos_ahorro
  FOR EACH ROW EXECUTE FUNCTION actualizar_saldo_ahorro();


-- Actualizar saldo del crédito tras cada pago
CREATE OR REPLACE FUNCTION actualizar_saldo_credito()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE creditos
  SET saldo      = NEW.saldo_pendiente,
      estado     = CASE WHEN NEW.saldo_pendiente <= 0 THEN 'pagado' ELSE estado END,
      updated_at = NOW()
  WHERE id = NEW.credito_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_saldo_credito
  AFTER INSERT ON pagos_credito
  FOR EACH ROW EXECUTE FUNCTION actualizar_saldo_credito();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE asociados          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahorros            ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_ahorro ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_credito      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras            ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_detalle    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_detalle     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_detalle    ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_inscritos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_premios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE excepciones        ENABLE ROW LEVEL SECURITY;

-- Función: obtener rol del usuario autenticado
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT r.nombre
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  WHERE u.id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Función: obtener asociado_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_asociado_id()
RETURNS UUID AS $$
  SELECT asociado_id FROM usuarios WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── ROLES: lectura para todos ──────────────────────────────
CREATE POLICY "roles_select" ON roles
  FOR SELECT TO authenticated USING (true);

-- ── USUARIOS ───────────────────────────────────────────────
CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR id = auth.uid());

CREATE POLICY "usuarios_insert" ON usuarios
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin' OR id = auth.uid());

CREATE POLICY "usuarios_delete" ON usuarios
  FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

-- ── ASOCIADOS ──────────────────────────────────────────────
CREATE POLICY "asociados_select" ON asociados
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR id = get_asociado_id());

CREATE POLICY "asociados_insert" ON asociados
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "asociados_update" ON asociados
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin' OR id = get_asociado_id());

CREATE POLICY "asociados_delete" ON asociados
  FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

-- ── AHORROS ────────────────────────────────────────────────
CREATE POLICY "ahorros_select" ON ahorros
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "ahorros_write" ON ahorros
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ── MOVIMIENTOS AHORRO ─────────────────────────────────────
CREATE POLICY "movimientos_ahorro_select" ON movimientos_ahorro
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "movimientos_ahorro_write" ON movimientos_ahorro
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ── CRÉDITOS ───────────────────────────────────────────────
CREATE POLICY "creditos_select" ON creditos
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "creditos_insert" ON creditos
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "creditos_update" ON creditos
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');

-- ── TABLAS SOLO ADMIN ──────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categorias','proveedores','productos',
    'compras','compras_detalle',
    'ventas','ventas_detalle',
    'liquidaciones','pagos_premios',
    'pagos_credito'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "%s_admin_all" ON %I FOR ALL TO authenticated
       USING (get_user_role() = ''admin'')
       WITH CHECK (get_user_role() = ''admin'');',
      t, t
    );
  END LOOP;
END;
$$;

-- ── PEDIDOS ────────────────────────────────────────────────
CREATE POLICY "pedidos_select" ON pedidos
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "pedidos_insert" ON pedidos
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "pedidos_update" ON pedidos
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "pedidos_detalle_select" ON pedidos_detalle
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'admin'
    OR pedido_id IN (SELECT id FROM pedidos WHERE asociado_id = get_asociado_id())
  );

CREATE POLICY "pedidos_detalle_insert" ON pedidos_detalle
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'admin'
    OR pedido_id IN (SELECT id FROM pedidos WHERE asociado_id = get_asociado_id())
  );

-- ── EVENTOS ────────────────────────────────────────────────
CREATE POLICY "eventos_select" ON eventos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "eventos_write" ON eventos
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "ev_inscritos_select" ON eventos_inscritos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ev_inscritos_insert" ON eventos_inscritos
  FOR INSERT TO authenticated
  WITH CHECK (asociado_id = get_asociado_id() OR get_user_role() = 'admin');

CREATE POLICY "ev_inscritos_delete" ON eventos_inscritos
  FOR DELETE TO authenticated
  USING (asociado_id = get_asociado_id() OR get_user_role() = 'admin');

-- ── EXCEPCIONES ────────────────────────────────────────────
CREATE POLICY "excepciones_select" ON excepciones
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR asociado_id = get_asociado_id());

CREATE POLICY "excepciones_insert" ON excepciones
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "excepciones_update" ON excepciones
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');


-- ============================================================
-- DATOS INICIALES
-- ============================================================
INSERT INTO roles (nombre, descripcion, permisos, activo, es_sistema)
VALUES
  (
    'admin',
    'Acceso completo al sistema',
    '["dashboard","configuracion","roles","usuarios","asociados","ahorros","creditos","eventos","compras","ventas","reportes"]',
    TRUE, TRUE
  ),
  (
    'asociado',
    'Acceso limitado a consultas personales',
    '["dashboard","mis_ahorros","mis_creditos"]',
    TRUE, TRUE
  ),
  (
    'usuario',
    'Acceso básico al sistema',
    '["dashboard","mi_solicitud"]',
    TRUE, TRUE
  )
ON CONFLICT (nombre) DO NOTHING;
