-- ============================================================
-- UFCA - Sistema de Gestión
-- Script completo de base de datos (Esquema Unificado de Usuarios)
-- Sincronizado con la base de datos real del servidor.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- LIMPIEZA COMPLETA (Elimina todo lo anterior si existe)
-- ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.transacciones              CASCADE;
DROP TABLE IF EXISTS public.cuentas_ahorro             CASCADE;
DROP TABLE IF EXISTS public.auditoria                  CASCADE;
DROP TABLE IF EXISTS public.notificaciones             CASCADE;
DROP TABLE IF EXISTS public.excepciones                CASCADE;
DROP TABLE IF EXISTS public.liquidaciones              CASCADE;
DROP TABLE IF EXISTS public.cuotas_credito             CASCADE;
DROP TABLE IF EXISTS public.creditos                   CASCADE;
DROP TABLE IF EXISTS public.comite_evaluador           CASCADE;
DROP TABLE IF EXISTS public.solicitudes_asociados      CASCADE;
DROP TABLE IF EXISTS public.periodos                   CASCADE;
DROP TABLE IF EXISTS public.configuracion              CASCADE;
DROP TABLE IF EXISTS public.rol_permisos               CASCADE;
DROP TABLE IF EXISTS public.permisos                   CASCADE;
DROP TABLE IF EXISTS public.usuarios                   CASCADE;
DROP TABLE IF EXISTS public.roles                      CASCADE;

-- ──────────────────────────────────────────────────────────
-- EXTENSIONES
-- ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ──────────────────────────────────────────────────────────
-- FUNCIÓN GLOBAL PARA updated_at AUTOMÁTICO
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLAS
-- ============================================================

-- ── ROLES ──────────────────────────────────────────────────
CREATE TABLE public.roles (
  id          UUID NOT NULL DEFAULT gen_random_uuid(),
  nombre      CHARACTER VARYING NOT NULL UNIQUE,
  descripcion TEXT,
  activo      BOOLEAN DEFAULT true,
  es_sistema  BOOLEAN DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  label       TEXT,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE OR REPLACE TRIGGER trg_updated_at_roles
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── USUARIOS (Consolida usuarios y asociados) ───────────────
CREATE TABLE public.usuarios (
  id                UUID NOT NULL,
  rol_id            UUID,
  nombre            CHARACTER VARYING NOT NULL,
  email             CHARACTER VARYING NOT NULL UNIQUE,
  activo            BOOLEAN DEFAULT true,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT now(),
  username          TEXT,
  ultimo_acceso     TIMESTAMP WITH TIME ZONE,
  telefono          CHARACTER VARYING DEFAULT ''::character varying,
  direccion         CHARACTER VARYING DEFAULT ''::character varying,
  cedula            TEXT,
  fecha_ingreso     DATE,
  referido_por_id   UUID,
  estado_cuenta     TEXT NOT NULL DEFAULT 'activo'::text 
                    CHECK (estado_cuenta = ANY (ARRAY['activo'::text, 'inactivo'::text, 'suspendido'::text])),
  fecha_suspension  DATE,
  motivo_suspension TEXT,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON DELETE SET NULL,
  CONSTRAINT usuarios_referido_por_id_fkey FOREIGN KEY (referido_por_id) REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE OR REPLACE TRIGGER trg_updated_at_usuarios
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX idx_usuarios_rol_id ON public.usuarios(rol_id);
CREATE INDEX idx_usuarios_cedula ON public.usuarios(cedula);

-- ── PERMISOS ───────────────────────────────────────────────
CREATE TABLE public.permisos (
  id          UUID NOT NULL DEFAULT gen_random_uuid(),
  clave       TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  descripcion TEXT,
  grupo       TEXT NOT NULL CHECK (grupo = ANY (ARRAY['admin'::text, 'asociado'::text, 'usuario'::text])),
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT permisos_pkey PRIMARY KEY (id)
);

CREATE OR REPLACE TRIGGER trg_updated_at_permisos
  BEFORE UPDATE ON public.permisos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── ROL PERMISOS ───────────────────────────────────────────
CREATE TABLE public.rol_permisos (
  rol_id       UUID NOT NULL,
  permiso_clave TEXT NOT NULL,
  asignado_en  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  activo       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT rol_permisos_pkey PRIMARY KEY (rol_id, permiso_clave),
  CONSTRAINT rol_permisos_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON DELETE CASCADE,
  CONSTRAINT rol_permisos_permiso_clave_fkey FOREIGN KEY (permiso_clave) REFERENCES public.permisos(clave) ON DELETE CASCADE
);

CREATE OR REPLACE TRIGGER trg_updated_at_rol_permisos
  BEFORE UPDATE ON public.rol_permisos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── CONFIGURACION ──────────────────────────────────────────
CREATE TABLE public.configuracion (
  id          UUID NOT NULL DEFAULT gen_random_uuid(),
  clave       TEXT NOT NULL UNIQUE,
  valor       TEXT NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT configuracion_pkey PRIMARY KEY (id)
);

CREATE OR REPLACE TRIGGER trg_updated_at_configuracion
  BEFORE UPDATE ON public.configuracion
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── PERIODOS ───────────────────────────────────────────────
CREATE TABLE public.periodos (
  id                    UUID NOT NULL DEFAULT gen_random_uuid(),
  fecha_inicio          DATE NOT NULL UNIQUE,
  fecha_fin             DATE NOT NULL,
  estado                TEXT NOT NULL DEFAULT 'activo'::text CHECK (estado = ANY (ARRAY['activo'::text, 'cerrado'::text])),
  fecha_cierre          TIMESTAMP WITH TIME ZONE,
  cerrado_por           UUID,
  utilidad_total        NUMERIC NOT NULL DEFAULT 0,
  utilidad_por_asociado NUMERIC,
  num_asociados_activos INTEGER,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  nombre                TEXT DEFAULT ((('Período '::text || ((EXTRACT(year FROM fecha_inicio))::integer)::text) || '/'::text) || ((EXTRACT(year FROM fecha_fin))::integer)::text),
  CONSTRAINT periodos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_periodos_cerrado_por FOREIGN KEY (cerrado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE OR REPLACE TRIGGER trg_updated_at_periodos
  BEFORE UPDATE ON public.periodos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── SOLICITUDES ASOCIADOS ──────────────────────────────────
CREATE TABLE public.solicitudes_asociados (
  id                      UUID NOT NULL DEFAULT gen_random_uuid(),
  nombres                 TEXT NOT NULL,
  apellidos               TEXT NOT NULL,
  cedula                  TEXT NOT NULL UNIQUE,
  tipo_identificacion     TEXT,
  telefono                TEXT,
  email                   TEXT,
  direccion               TEXT,
  ocupacion               TEXT,
  ingreso_mensual         NUMERIC,
  motivacion              TEXT,
  estado                  TEXT NOT NULL DEFAULT 'pendiente'::text 
                          CHECK (estado = ANY (ARRAY['pendiente'::text, 'aprobada'::text, 'rechazada'::text, 'pendiente_activacion'::text])),
  documentos              TEXT[],
  observaciones           TEXT,
  fecha_solicitud         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fecha_resolucion        TIMESTAMP WITH TIME ZONE,
  fecha_activacion        DATE,
  usuario_id              UUID,
  created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resuelto_por            UUID,
  monto_ahorro_propuesto  NUMERIC,
  aprobado_por            UUID,
  recordatorio_enviado_at TIMESTAMP WITH TIME ZONE,
  ultima_invitacion       TIMESTAMP WITH TIME ZONE,
  CONSTRAINT solicitudes_asociados_pkey PRIMARY KEY (id),
  CONSTRAINT solicitudes_asociados_resuelto_por_fkey FOREIGN KEY (resuelto_por) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_solicitudes_usuario_id FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT solicitudes_asociados_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE OR REPLACE TRIGGER trg_updated_at_solicitudes_asociados
  BEFORE UPDATE ON public.solicitudes_asociados
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── COMITE EVALUADOR ───────────────────────────────────────
CREATE TABLE public.comite_evaluador (
  id                     UUID NOT NULL DEFAULT gen_random_uuid(),
  solicitud_asociado_id  UUID NOT NULL UNIQUE,
  evaluador_id           UUID,
  verificaciones         JSONB NOT NULL DEFAULT '{"ingresos": false, "referencias": false, "documentacion": false}'::jsonb,
  score_credito          INTEGER NOT NULL DEFAULT 70 CHECK (score_credito >= 0 AND score_credito <= 100),
  comentarios            TEXT,
  decision               TEXT NOT NULL DEFAULT 'en_evaluacion'::text CHECK (decision = ANY (ARRAY['en_evaluacion'::text, 'aprobado'::text, 'rechazado'::text])),
  observacion            TEXT,
  fecha                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT comite_evaluador_pkey PRIMARY KEY (id),
  CONSTRAINT fk_comite_evaluador_id FOREIGN KEY (evaluador_id) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT comite_evaluador_solicitud_asociado_id_fkey FOREIGN KEY (solicitud_asociado_id) REFERENCES public.solicitudes_asociados(id) ON DELETE CASCADE
);

CREATE OR REPLACE TRIGGER trg_updated_at_comite_evaluador
  BEFORE UPDATE ON public.comite_evaluador
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── CREDITOS ───────────────────────────────────────────────
CREATE TABLE public.creditos (
  id                        UUID NOT NULL DEFAULT gen_random_uuid(),
  asociado_id               UUID,
  periodo_id                UUID,
  tipo                      TEXT NOT NULL CHECK (tipo = ANY (ARRAY['libre_inversion'::text, 'educacion'::text, 'vivienda'::text, 'calamidad'::text])),
  monto                     NUMERIC NOT NULL CHECK (monto > 0::numeric),
  plazo_meses               INTEGER NOT NULL CHECK (plazo_meses >= 1 AND plazo_meses <= 12),
  tasa_interes              NUMERIC NOT NULL,
  tasa_mora                 NUMERIC,
  cuota_mensual             NUMERIC NOT NULL,
  saldo                     NUMERIC NOT NULL,
  estado                    TEXT NOT NULL DEFAULT 'pendiente'::text CHECK (estado = ANY (ARRAY['pendiente'::text, 'en_revision'::text, 'aprobado'::text, 'desembolsado'::text, 'activo'::text, 'en_mora'::text, 'pagado'::text, 'rechazado'::text, 'cancelado'::text, 'simulacion'::text])),
  fecha_desembolso          DATE,
  fecha_primera_cuota       DATE,
  fecha_ultima_cuota        DATE,
  fecha_estado_cambio       TIMESTAMP WITH TIME ZONE,
  motivo_estado_cambio      TEXT,
  url_comprobante_solicitud TEXT,
  anulado                   BOOLEAN NOT NULL DEFAULT false,
  motivo_anulacion          TEXT,
  created_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observaciones             TEXT,
  tipo_interes              TEXT DEFAULT 'compuesto'::text,
  anulado_por               UUID,
  anulado_en                TIMESTAMP WITH TIME ZONE,
  updated_at                TIMESTAMP WITH TIME ZONE DEFAULT now(),
  estado_anterior_mora      TEXT,
  referido_nombre           TEXT,
  CONSTRAINT creditos_pkey PRIMARY KEY (id),
  CONSTRAINT creditos_asociado_id_fkey FOREIGN KEY (asociado_id) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT creditos_anulado_por_fkey FOREIGN KEY (anulado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT creditos_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.periodos(id) ON DELETE SET NULL
);

CREATE OR REPLACE TRIGGER trg_updated_at_creditos
  BEFORE UPDATE ON public.creditos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── CUOTAS CREDITO ─────────────────────────────────────────
CREATE TABLE public.cuotas_credito (
  id            UUID NOT NULL DEFAULT gen_random_uuid(),
  credito_id    UUID NOT NULL,
  num_cuota     INTEGER NOT NULL CHECK (num_cuota >= 1),
  fecha_vencimiento DATE NOT NULL,
  capital       NUMERIC NOT NULL CHECK (capital >= 0::numeric),
  interes       NUMERIC NOT NULL CHECK (interes >= 0::numeric),
  cuota_total   NUMERIC NOT NULL,
  saldo_inicial NUMERIC NOT NULL,
  saldo_final   NUMERIC NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'pendiente'::text CHECK (estado = ANY (ARRAY['pendiente'::text, 'pagada'::text, 'mora'::text, 'abono_aplicado'::text])),
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT cuotas_credito_pkey PRIMARY KEY (id),
  CONSTRAINT cuotas_credito_credito_id_fkey FOREIGN KEY (credito_id) REFERENCES public.creditos(id) ON DELETE CASCADE
);

CREATE OR REPLACE TRIGGER trg_updated_at_cuotas_credito
  BEFORE UPDATE ON public.cuotas_credito
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── LIQUIDACIONES ──────────────────────────────────────────
CREATE TABLE public.liquidaciones (
  id                      UUID NOT NULL DEFAULT gen_random_uuid(),
  asociado_id             UUID,
  periodo_id              UUID,
  usuario_id              UUID,
  tipo                    TEXT NOT NULL CHECK (tipo = ANY (ARRAY['retiro'::text, 'expulsion'::text, 'fallecimiento'::text, 'anual'::text, 'otro'::text])),
  total_ahorro_permanente  NUMERIC NOT NULL DEFAULT 0,
  total_ahorro_voluntario   NUMERIC NOT NULL DEFAULT 0,
  total_deudas_credito    NUMERIC NOT NULL DEFAULT 0,
  utilidades              NUMERIC NOT NULL DEFAULT 0,
  monto_neto              NUMERIC NOT NULL DEFAULT 0,
  detalle                 JSONB,
  observaciones           TEXT,
  created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fecha                   DATE,
  estado                  TEXT DEFAULT 'En proceso'::text,
  fecha_corte             DATE,
  fecha_liquidacion       DATE,
  anulado                 BOOLEAN DEFAULT false,
  justificacion_anulacion TEXT,
  anulado_por             TEXT,
  anulado_en              TIMESTAMP WITH TIME ZONE,
  monto_total             NUMERIC NOT NULL DEFAULT 0,
  CONSTRAINT liquidaciones_pkey PRIMARY KEY (id),
  CONSTRAINT fk_liquidaciones_usuario_id FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT liquidaciones_asociado_id_fkey FOREIGN KEY (asociado_id) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT liquidaciones_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.periodos(id) ON DELETE SET NULL
);

CREATE OR REPLACE TRIGGER trg_updated_at_liquidaciones
  BEFORE UPDATE ON public.liquidaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── EXCEPCIONES ────────────────────────────────────────────
CREATE TABLE public.excepciones (
  id               UUID NOT NULL DEFAULT gen_random_uuid(),
  asociado_id      UUID,
  credito_id       UUID,
  tipo             TEXT NOT NULL,
  descripcion      TEXT NOT NULL,
  estado           TEXT NOT NULL DEFAULT 'pendiente'::text CHECK (estado = ANY (ARRAY['pendiente'::text, 'aprobada'::text, 'rechazada'::text])),
  resuelto_por     UUID,
  fecha_resolucion TIMESTAMP WITH TIME ZONE,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT excepciones_pkey PRIMARY KEY (id),
  CONSTRAINT excepciones_credito_id_fkey FOREIGN KEY (credito_id) REFERENCES public.creditos(id) ON DELETE CASCADE,
  CONSTRAINT fk_excepciones_resuelto_por FOREIGN KEY (resuelto_por) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT excepciones_asociado_id_fkey FOREIGN KEY (asociado_id) REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE OR REPLACE TRIGGER trg_updated_at_excepciones
  BEFORE UPDATE ON public.excepciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── NOTIFICACIONES ─────────────────────────────────────────
CREATE TABLE public.notificaciones (
  id          UUID NOT NULL DEFAULT gen_random_uuid(),
  usuario_id  UUID,
  asociado_id UUID,
  tipo        TEXT NOT NULL CHECK (tipo = ANY (ARRAY['credito_pendiente'::text, 'credito_activo'::text, 'credito_rechazado'::text, 'ahorro_mora'::text, 'simulacion_credito'::text, 'afiliacion_aprobada'::text, 'afiliacion_rechazada'::text, 'pago_registrado'::text, 'sistema'::text, 'general'::text, 'solicitud_afiliacion'::text])),
  titulo      TEXT NOT NULL,
  mensaje     TEXT NOT NULL,
  leida       BOOLEAN NOT NULL DEFAULT false,
  para_admin  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT notificaciones_pkey PRIMARY KEY (id),
  CONSTRAINT fk_notificaciones_usuario_id FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_notificaciones_asociado_id FOREIGN KEY (asociado_id) REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE OR REPLACE TRIGGER trg_updated_at_notificaciones
  BEFORE UPDATE ON public.notificaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── AUDITORIA ──────────────────────────────────────────────
CREATE TABLE public.auditoria (
  id            UUID NOT NULL DEFAULT gen_random_uuid(),
  usuario_id    UUID,
  asociado_id   UUID,
  tabla         TEXT NOT NULL,
  registro_id   UUID,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  operacion     CHARACTER VARYING,
  datos_antes   JSONB,
  datos_despues JSONB,
  accion        CHARACTER VARYING,
  CONSTRAINT auditoria_pkey PRIMARY KEY (id)
);

-- ── CUENTAS AHORRO ─────────────────────────────────────────
CREATE TABLE public.cuentas_ahorro (
  id                 UUID NOT NULL DEFAULT gen_random_uuid(),
  tipo               TEXT NOT NULL CHECK (tipo = ANY (ARRAY['permanente'::text, 'voluntario'::text])),
  asociado_id        UUID,
  periodo_id         UUID NOT NULL,
  monto_ahorrado     NUMERIC NOT NULL DEFAULT 0,
  cuota_mensual      NUMERIC,
  fecha_retiro       TIMESTAMP WITH TIME ZONE,
  monto_al_cierre    NUMERIC,
  estado             TEXT NOT NULL DEFAULT 'activo'::text CHECK (estado = ANY (ARRAY['activo'::text, 'inactivo'::text])),
  fecha_cierre       TIMESTAMP WITH TIME ZONE,
  anulado            BOOLEAN NOT NULL DEFAULT false,
  anulado_por        UUID,
  anulado_en         TIMESTAMP WITH TIME ZONE,
  motivo_anulacion   TEXT,
  created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observaciones      TEXT,
  cedula             TEXT,
  multa_mora_vigente NUMERIC,
  CONSTRAINT cuentas_ahorro_pkey PRIMARY KEY (id),
  CONSTRAINT cuentas_ahorro_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.periodos(id) ON DELETE CASCADE,
  CONSTRAINT cuentas_ahorro_asociado_id_fkey FOREIGN KEY (asociado_id) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT cuentas_ahorro_anulado_por_fkey FOREIGN KEY (anulado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE OR REPLACE TRIGGER trg_updated_at_cuentas_ahorro
  BEFORE UPDATE ON public.cuentas_ahorro
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── TRANSACCIONES ──────────────────────────────────────────
CREATE TABLE public.transacciones (
  id                   UUID NOT NULL DEFAULT gen_random_uuid(),
  tipo                 TEXT NOT NULL CHECK (tipo = ANY (ARRAY['aporte_permanente'::text, 'aporte_voluntario'::text, 'pago_credito'::text, 'abono_capital'::text, 'cancelacion_total'::text])),
  asociado_id          UUID,
  registrado_por       UUID,
  ahorro_id            UUID,
  credito_id           UUID,
  cuota_id             UUID,
  periodo_id           UUID,
  monto                NUMERIC NOT NULL CHECK (monto > 0::numeric),
  capital              NUMERIC NOT NULL DEFAULT 0,
  interes              NUMERIC NOT NULL DEFAULT 0,
  monto_mora           NUMERIC NOT NULL DEFAULT 0,
  dias_mora            INTEGER NOT NULL DEFAULT 0,
  saldo_antes          NUMERIC,
  saldo_despues        NUMERIC,
  mes_correspondiente  DATE,
  fecha_pago           DATE NOT NULL,
  metodo_pago          TEXT,
  url_comprobante      TEXT,
  observacion          TEXT,
  anulado              BOOLEAN NOT NULL DEFAULT false,
  anulado_por          UUID,
  anulado_en           TIMESTAMP WITH TIME ZONE,
  motivo_anulacion     TEXT,
  created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT transacciones_pkey PRIMARY KEY (id),
  CONSTRAINT transacciones_ahorro_id_fkey FOREIGN KEY (ahorro_id) REFERENCES public.cuentas_ahorro(id) ON DELETE CASCADE,
  CONSTRAINT transacciones_credito_id_fkey FOREIGN KEY (credito_id) REFERENCES public.creditos(id) ON DELETE CASCADE,
  CONSTRAINT transacciones_cuota_id_fkey FOREIGN KEY (cuota_id) REFERENCES public.cuotas_credito(id) ON DELETE SET NULL,
  CONSTRAINT transacciones_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES public.periodos(id) ON DELETE SET NULL,
  CONSTRAINT transacciones_asociado_id_fkey FOREIGN KEY (asociado_id) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT transacciones_anulado_por_fkey FOREIGN KEY (anulado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT transacciones_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE OR REPLACE TRIGGER trg_updated_at_transacciones
  BEFORE UPDATE ON public.transacciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


-- ============================================================
-- FUNCIONES Y TRIGGERS DE NEGOCIO
-- ============================================================

-- ── 1. AUDITORÍA INMUTABLE ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.bloquear_modificacion_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de auditoría son inmutables — no se permite % en la tabla auditoria.', TG_OP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tg_auditoria_inmutable_delete
  BEFORE DELETE ON public.auditoria
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_modificacion_auditoria();

CREATE TRIGGER tg_auditoria_inmutable_update
  BEFORE UPDATE ON public.auditoria
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_modificacion_auditoria();


-- ── 2. AUDITORÍA AUTOMÁTICA ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_auditoria_automatica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO auditoria (
    tabla,
    operacion,
    registro_id,
    datos_antes,
    datos_despues,
    usuario_id,
    created_at
  )
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
    auth.uid(),
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers de auditoría
CREATE TRIGGER tg_auditoria_creditos
  AFTER INSERT OR UPDATE OR DELETE ON public.creditos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_automatica();

CREATE TRIGGER tg_auditoria_cuentas_ahorro
  AFTER INSERT OR UPDATE OR DELETE ON public.cuentas_ahorro
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_automatica();

CREATE TRIGGER tg_auditoria_liquidaciones
  AFTER INSERT OR UPDATE OR DELETE ON public.liquidaciones
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_automatica();

CREATE TRIGGER tg_auditoria_transacciones
  AFTER INSERT OR UPDATE OR DELETE ON public.transacciones
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_automatica();


-- ── 3. SEGURIDAD FINANCIERA (BLOQUEO FÍSICO) ─────────────────
CREATE OR REPLACE FUNCTION public.bloquear_delete_financiero()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Eliminación física bloqueada en tabla %. Use el campo anulado=true para anular registros financieros.',
    TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tg_bloquear_delete_creditos
  BEFORE DELETE ON public.creditos
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_delete_financiero();

CREATE TRIGGER tg_bloquear_delete_liquidaciones
  BEFORE DELETE ON public.liquidaciones
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_delete_financiero();


-- ── 4. COMPLETAR TASA MORA AL INSERTAR CRÉDITO ───────────────
CREATE OR REPLACE FUNCTION public.fn_completar_tasa_mora()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tasa_mora IS NULL THEN
    SELECT valor::numeric
    INTO NEW.tasa_mora
    FROM configuracion
    WHERE clave = 'tasa_mora_credito'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_completar_tasa_mora
  BEFORE INSERT ON public.creditos
  FOR EACH ROW EXECUTE FUNCTION public.fn_completar_tasa_mora();


-- ── 5. NOTIFICACIÓN DE NUEVA SOLICITUD DE AFILIACIÓN ────────
CREATE OR REPLACE FUNCTION public.notificar_nueva_solicitud_afiliacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'pendiente' THEN
    INSERT INTO notificaciones (titulo, mensaje, tipo, leida, para_admin, created_at)
    VALUES (
      'Nueva solicitud de afiliación',
      NEW.nombres || ' ' || NEW.apellidos ||
        ' ha enviado una solicitud de membresía y está pendiente de revisión.',
      'solicitud_afiliacion',
      false,
      true,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_notif_nueva_solicitud_afiliacion
  AFTER INSERT ON public.solicitudes_asociados
  FOR EACH ROW EXECUTE FUNCTION public.notificar_nueva_solicitud_afiliacion();


-- ── 6. ACTIVAR ASOCIADO POR PAGO (CORREGIDO) ──────────────────
CREATE OR REPLACE FUNCTION public.fn_activar_asociado_por_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asociado_id UUID;
  v_tipo_cuenta TEXT;
BEGIN
  -- Solo nos interesan los aportes permanentes
  IF NEW.tipo != 'aporte_permanente' THEN
    RETURN NEW;
  END IF;

  -- Obtener a qué asociado pertenece la cuenta (ahorro_id) y qué tipo de cuenta es
  SELECT asociado_id, tipo INTO v_asociado_id, v_tipo_cuenta
  FROM cuentas_ahorro
  WHERE id = NEW.ahorro_id;

  -- Si es un aporte a la cuenta de ahorro permanente y el monto es mayor a 0
  IF v_tipo_cuenta = 'permanente' AND NEW.monto > 0 THEN
    -- Cambiar la solicitud de pendiente_activacion a aprobada
    UPDATE solicitudes_asociados
    SET estado = 'aprobada', 
        fecha_activacion = CURRENT_DATE
    WHERE usuario_id = v_asociado_id
      AND estado = 'pendiente_activacion';

    -- Activar la cuenta del usuario en la tabla usuarios para permitir su login
    UPDATE usuarios
    SET estado_cuenta = 'activo',
        activo = true,
        updated_at = NOW()
    WHERE id = v_asociado_id
      AND estado_cuenta = 'pendiente_activacion';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activar_asociado_por_pago
  AFTER INSERT ON public.transacciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_activar_asociado_por_pago();


-- ── 7. ACTIVAR CUENTA PRIMER PAGO (CORREGIDO) ──────────────────
CREATE OR REPLACE FUNCTION public.fn_activar_cuenta_primer_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cuenta_id     uuid;
  v_user_estado   text;
BEGIN
  -- Solo actuar en aportes permanentes
  IF NEW.tipo != 'aporte_permanente' THEN
    RETURN NEW;
  END IF;

  -- Buscar la cuenta permanente del asociado
  SELECT id INTO v_cuenta_id
  FROM cuentas_ahorro
  WHERE asociado_id = NEW.asociado_id
    AND tipo        = 'permanente'
    AND anulado     = false
  ORDER BY created_at DESC
  LIMIT 1;

  -- Buscar el estado del usuario asociado
  SELECT estado_cuenta INTO v_user_estado
  FROM usuarios
  WHERE id = NEW.asociado_id;

  -- Si el usuario estaba suspendido → Reactivar a activo
  IF v_cuenta_id IS NOT NULL AND v_user_estado = 'suspendido' THEN
    -- Reactivar usuario
    UPDATE usuarios SET
      estado_cuenta = 'activo',
      activo        = true,
      updated_at    = NOW()
    WHERE id = NEW.asociado_id;

    -- Reactivar cuenta de ahorro
    UPDATE cuentas_ahorro SET
      estado     = 'activo',
      updated_at = NOW()
    WHERE id = v_cuenta_id;

    -- Notificar al asociado que su cuenta quedó activa
    INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leida, para_admin)
    VALUES (
      NEW.asociado_id,
      'pago_registrado',
      '🎉 ¡Tu cuenta UFCA está activa!',
      'Tu primer aporte de ahorro permanente fue registrado. Ya tienes acceso a todos los módulos: ahorro voluntario, créditos y más.',
      false,
      false
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_activar_cuenta_primer_pago
  AFTER INSERT ON public.transacciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_activar_cuenta_primer_pago();


-- ── 8. PROTEGER ROL DEL PROPIO USUARIO ────────────────────────
CREATE OR REPLACE FUNCTION public.fn_proteger_rol_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- No permitir que el propio usuario se degrade su rol o se desactive a sí mismo sin permisos
  IF NEW.id = auth.uid() THEN
    -- Aquí podrías incluir un check de permisos dinámico si es necesario
    NEW.rol_id := OLD.rol_id;
    NEW.activo := OLD.activo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proteger_rol_usuario
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_proteger_rol_usuario();


-- ============================================================
-- SEGURIDAD ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol_permisos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_asociados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comite_evaluador   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creditos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuotas_credito      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excepciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_ahorro     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacciones      ENABLE ROW LEVEL SECURITY;

-- Nota: Las políticas RLS dinámicas están definidas en el script
-- supabase_security_rls_completa.sql, usando fn_tiene_permiso().
