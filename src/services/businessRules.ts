/**
 * Motor de Reglas de Negocio — Conectado a Supabase
 *
 * Principio:
 * 1. Validar regla consultando la BD real (Supabase)
 * 2. Si no cumple → generar EXCEPCIÓN en tabla `excepciones`
 * 3. Solicitar decisión administrativa
 * 4. Administrador aprueba/rechaza desde ExcepcionesManager
 * 5. Todas las operaciones quedan registradas en auditoría
 */

import { supabase } from '../lib/supabase';

// ── Tipos compatibles con el schema de Supabase ───────────────────────────────
interface AsociadoBasic {
  id: string;
  estado: string;
  referido_por_id?: string | null; // no null = es referido
}

interface CreditoBasic {
  id: string;
  estado: string;
}

// ── Utilidad de mora (antes en models/Credito.ts) ─────────────────────────────
const calcularDiasMora = (fechaVencimiento: string): number => {
  const hoy = new Date();
  const vencimiento = new Date(fechaVencimiento);
  const diferencia = hoy.getTime() - vencimiento.getTime();
  return Math.max(0, Math.floor(diferencia / (1000 * 60 * 60 * 24)));
};

// ── Tipo de resultado de validación ──────────────────────────────────────────

export interface ReglaValidacion {
  valida: boolean;
  mensaje: string;
  tipoExcepcion?: string;
  impacto?: 'bajo' | 'medio' | 'alto' | 'critico';
  requiereExcepcion: boolean;
}

// ── Configuración operativa de la cooperativa ────────────────────────────────
// Los valores vienen de la tabla `configuracion` en Supabase.
// Las claves en BD deben coincidir exactamente con las listadas en CLAVES_CONFIG.
//
// Para insertar los valores iniciales en BD, ejecuta supabase_seed_configuracion.sql

interface ConfigParametros {
  aporteMinimo:                    number;
  cuotasMaximasIncumplidas:        number;
  diasMoraMaximo:                  number;
  permitirRetirosParcialesDefecto: boolean;
  periodoActualCerrado:            boolean;
  fechaCierrePeriodo?:             string;
  // ── Tasas financieras ────────────────────────────────────────────────────
  tasaLibreInversion: number;  // % EA
  tasaEducacion:      number;  // % EA
  tasaVivienda:       number;  // % EA
  tasaCalamidad:      number;  // % EA
  tasaMoraCreditos:   number;  // % EA (mora = 1.5x tasa corriente por defecto Art. 884 C.Co.)
  tasaInteresAhorros: number;  // % EA que UFCA paga sobre ahorros voluntarios
}

/** Claves exactas usadas en la tabla `configuracion` */
const CLAVES_CONFIG = [
  'aporte_minimo',
  'cuotas_maximas_incumplidas',
  'dias_mora_maximo',
  'permitir_retiros_parciales',
  'periodo_cerrado',
  'fecha_cierre_periodo',
  // Tasas financieras
  'tasa_libre_inversion',
  'tasa_educacion',
  'tasa_vivienda',
  'tasa_calamidad',
  'tasa_mora_creditos',
  'tasa_interes_ahorros',
] as const;

/** Valores de emergencia — solo se usan si la BD no devuelve la clave.
 *  Si ves estos valores en producción, revisa la tabla `configuracion`. */
const CONFIG_DEFAULTS: ConfigParametros = {
  aporteMinimo:                    50_000,
  cuotasMaximasIncumplidas:        2,
  diasMoraMaximo:                  30,
  permitirRetirosParcialesDefecto: false,
  periodoActualCerrado:            false,
  // Tasas financieras por defecto
  tasaLibreInversion: 18,
  tasaEducacion:      14,
  tasaVivienda:       12,
  tasaCalamidad:      10,
  tasaMoraCreditos:   27,
  tasaInteresAhorros:  4,
};

class BusinessRulesEngine {
  private config: ConfigParametros = { ...CONFIG_DEFAULTS };
  private configCargada = false;

  /**
   * Carga los parámetros operativos desde la tabla `configuracion` en Supabase.
   * Debe llamarse una vez al iniciar la app (App.tsx useEffect).
   * Si la BD falla, se mantienen los valores por defecto y se avisa por consola.
   */
  async loadConfigFromDB(force = false): Promise<void> {
    if (this.configCargada && !force) return;

    const { data, error } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', CLAVES_CONFIG as unknown as string[]);

    if (error) {
      console.error(
        '[UFCA] businessRules: no se pudo cargar configuración desde BD.',
        'Se usarán valores por defecto. Verifica la tabla `configuracion`.',
        error.message,
      );
      return;
    }

    if (!data || data.length === 0) {
      console.warn(
        '[UFCA] businessRules: la tabla `configuracion` no tiene las claves requeridas.',
        'Ejecuta supabase_seed_configuracion.sql para insertarlas.',
        'Se usarán valores por defecto.',
      );
      return;
    }

    const get = (clave: string): string | undefined =>
      data.find(r => r.clave === clave)?.valor;

    this.config = {
      aporteMinimo:
        Number(get('aporte_minimo') ?? CONFIG_DEFAULTS.aporteMinimo),
      cuotasMaximasIncumplidas:
        Number(get('cuotas_maximas_incumplidas') ?? CONFIG_DEFAULTS.cuotasMaximasIncumplidas),
      diasMoraMaximo:
        Number(get('dias_mora_maximo') ?? CONFIG_DEFAULTS.diasMoraMaximo),
      permitirRetirosParcialesDefecto:
        get('permitir_retiros_parciales') === 'true',
      periodoActualCerrado:
        get('periodo_cerrado') === 'true',
      fechaCierrePeriodo:
        get('fecha_cierre_periodo'),
      // Tasas financieras
      tasaLibreInversion: Number(get('tasa_libre_inversion') ?? CONFIG_DEFAULTS.tasaLibreInversion),
      tasaEducacion:      Number(get('tasa_educacion')       ?? CONFIG_DEFAULTS.tasaEducacion),
      tasaVivienda:       Number(get('tasa_vivienda')        ?? CONFIG_DEFAULTS.tasaVivienda),
      tasaCalamidad:      Number(get('tasa_calamidad')       ?? CONFIG_DEFAULTS.tasaCalamidad),
      tasaMoraCreditos:   Number(get('tasa_mora_creditos')   ?? CONFIG_DEFAULTS.tasaMoraCreditos),
      tasaInteresAhorros: Number(get('tasa_interes_ahorros') ?? CONFIG_DEFAULTS.tasaInteresAhorros),
    };

    this.configCargada = true;
    console.info('[UFCA] businessRules: configuración cargada desde BD.', this.config);
  }

  /** Actualiza la configuración en tiempo de ejecución sin recargar la app */
  updateConfig(parcial: Partial<ConfigParametros>) {
    this.config = { ...this.config, ...parcial };
  }

  // ── REGLAS DE ASOCIADOS ───────────────────────────────────────────────────

  /** REGLA: Personas referidas no pueden afiliarse directamente */
  validarAsociadoReferido(asociado: Partial<AsociadoBasic>): ReglaValidacion {
    if (asociado.referido_por_id) {
      return {
        valida: false,
        mensaje: 'Las personas referidas no pueden afiliarse según estatutos. Requiere aprobación administrativa.',
        tipoExcepcion: 'asociado_referido',
        impacto: 'medio',
        requiereExcepcion: true,
      };
    }
    return { valida: true, mensaje: 'Asociado no es referido', requiereExcepcion: false };
  }

  /** REGLA: El aporte mensual mínimo debe cumplirse */
  validarAporteMinimo(montoAporte: number): ReglaValidacion {
    if (montoAporte < this.config.aporteMinimo) {
      return {
        valida: false,
        mensaje: `El aporte mínimo es de $${this.config.aporteMinimo.toLocaleString('es-CO')}. El aporte ingresado es menor.`,
        tipoExcepcion: 'aporte_menor_minimo',
        impacto: 'bajo',
        requiereExcepcion: true,
      };
    }
    return { valida: true, mensaje: 'Aporte cumple con el mínimo', requiereExcepcion: false };
  }

  /**
   * X-01: REGLA: Un asociado no puede tener más de una cuenta activa.
   * Busca por cédula O email (no por ID) para detectar duplicados de identidad,
   * excluyendo el propio registro del solicitante en caso de re-validación.
   */
  async validarAfiliacionUnica(
    cedula: string,
    email?: string,
    excluirId?: string,
  ): Promise<ReglaValidacion> {
    // Construir filtro OR: cedula coincide O email coincide
    const filtros = email
      ? `cedula.eq.${cedula},email.eq.${email}`
      : `cedula.eq.${cedula}`;

    let query = supabase
      .from('usuarios')
      .select('id, cedula, email')
      .or(filtros)
      .eq('estado_cuenta', 'activo')
      .limit(1);

    // Si se está re-validando un registro existente, excluirlo del conteo
    if (excluirId) query = query.neq('id', excluirId);

    const { data, error } = await query;

    if (error) {
      console.error('[businessRules] validarAfiliacionUnica:', error.message);
      return { valida: true, mensaje: 'No se pudo verificar afiliaciones (se permite continuar)', requiereExcepcion: false };
    }

    if (data && data.length > 0) {
      return {
        valida: false,
        mensaje: 'Ya existe un asociado activo con la misma cédula o correo electrónico.',
        tipoExcepcion: 'multiple_afiliacion',
        impacto: 'alto',
        requiereExcepcion: true,
      };
    }
    return { valida: true, mensaje: 'No hay afiliaciones activas previas', requiereExcepcion: false };
  }

  /** REGLA: Más de N cuotas incumplidas genera suspensión automática */
  validarSuspensionPorCuotasIncumplidas(cuotasIncumplidas: number): ReglaValidacion {
    const max = this.config.cuotasMaximasIncumplidas;
    if (cuotasIncumplidas >= max) {
      return {
        valida: false,
        mensaje: `El asociado tiene ${cuotasIncumplidas} cuotas incumplidas (máximo: ${max}). Debe ser suspendido.`,
        tipoExcepcion: 'suspension_menos_dos_cuotas',
        impacto: 'alto',
        requiereExcepcion: false,
      };
    }
    return { valida: true, mensaje: 'Cuotas incumplidas dentro del límite', requiereExcepcion: false };
  }

  /** REGLA: Solo asociados activos pueden solicitar crédito */
  validarAsociadoActivoParaCredito(asociado: AsociadoBasic): ReglaValidacion {
    if (asociado.estado !== 'activo') {
      return {
        valida: false,
        mensaje: `El asociado está en estado "${asociado.estado}". Solo asociados activos pueden solicitar créditos.`,
        tipoExcepcion: 'credito_asociado_inactivo',
        impacto: 'alto',
        requiereExcepcion: true,
      };
    }
    return { valida: true, mensaje: 'Asociado está activo', requiereExcepcion: false };
  }

  // ── REGLAS DE CRÉDITOS ────────────────────────────────────────────────────

  /**
   * REGLA: No aprobar nuevo crédito si el asociado ya tiene uno en mora (Supabase).
   */
  async validarCreditosSinMora(asociadoId: string): Promise<ReglaValidacion> {
    const { data, error } = await supabase
      .from('creditos')
      .select('id')
      .eq('asociado_id', asociadoId)
      .eq('estado', 'en_mora')
      .limit(1);

    if (error) {
      console.error('[businessRules] validarCreditosSinMora:', error.message);
      return { valida: true, mensaje: 'No se pudo verificar mora (se permite continuar)', requiereExcepcion: false };
    }

    if (data && data.length > 0) {
      return {
        valida: false,
        mensaje: `El asociado tiene crédito(s) en mora. No se puede aprobar nuevo crédito hasta saldarlos.`,
        tipoExcepcion: 'credito_con_mora',
        impacto: 'alto',
        requiereExcepcion: true,
      };
    }
    return { valida: true, mensaje: 'No hay créditos en mora', requiereExcepcion: false };
  }

  /** REGLA: Mora cuando el pago supera N días de vencimiento */
  calcularEstadoMora(fechaVencimiento: string): { enMora: boolean; diasMora: number } {
    const dias = calcularDiasMora(fechaVencimiento);
    return { enMora: dias > this.config.diasMoraMaximo, diasMora: dias };
  }

  /**
   * REGLA: No eliminar créditos con pagos ya registrados (Supabase).
   */
  async validarEliminacionCredito(creditoId: string): Promise<ReglaValidacion> {
    const { count, error } = await supabase
      .from('transacciones')
      .select('*', { count: 'exact', head: true })
      .eq('credito_id', creditoId)
      .in('tipo', ['pago_credito', 'abono_capital', 'cancelacion_total']);

    if (error) {
      console.error('[businessRules] validarEliminacionCredito:', error.message);
      // En caso de error de consulta, bloqueamos por seguridad
      return {
        valida: false,
        mensaje: 'No se pudo verificar los pagos del crédito. Operación bloqueada por seguridad.',
        tipoExcepcion: 'eliminacion_credito_con_pagos',
        impacto: 'critico',
        requiereExcepcion: false,
      };
    }

    if ((count ?? 0) > 0) {
      return {
        valida: false,
        mensaje: `El crédito tiene ${count} pago(s) registrado(s). No se puede eliminar.`,
        tipoExcepcion: 'eliminacion_credito_con_pagos',
        impacto: 'critico',
        requiereExcepcion: false, // No permitir bajo ninguna circunstancia
      };
    }
    return { valida: true, mensaje: 'El crédito no tiene pagos registrados', requiereExcepcion: false };
  }

  // ── REGLAS DE PAGOS ───────────────────────────────────────────────────────

  /** REGLA: Solo registrar pagos a créditos en estado desembolsado o en mora */
  validarPagoCreditoDesembolsado(credito: CreditoBasic): ReglaValidacion {
    if (credito.estado !== 'desembolsado' && credito.estado !== 'en_mora') {
      return {
        valida: false,
        mensaje: `El crédito está en estado "${credito.estado}". Solo se aceptan pagos a créditos desembolsados.`,
        tipoExcepcion: 'pago_credito_no_desembolsado',
        impacto: 'medio',
        requiereExcepcion: true,
      };
    }
    return { valida: true, mensaje: 'Crédito está desembolsado', requiereExcepcion: false };
  }

  /** REGLA: No permitir pagos ni desembolsos después del cierre del periodo */
  validarPeriodoCerrado(operacion: 'pago' | 'desembolso'): ReglaValidacion {
    if (this.config.periodoActualCerrado) {
      return {
        valida: false,
        mensaje: `El periodo actual está cerrado${this.config.fechaCierrePeriodo ? ` (${this.config.fechaCierrePeriodo})` : ''}. No se pueden realizar ${operacion}s.`,
        tipoExcepcion: 'operacion_periodo_cerrado',
        impacto: 'alto',
        requiereExcepcion: true,
      };
    }
    return { valida: true, mensaje: 'Periodo actual está abierto', requiereExcepcion: false };
  }

  // ── REGLAS DE RETIROS ─────────────────────────────────────────────────────

  /**
   * REGLA: Validar paz y salvo antes del retiro — el asociado no debe tener créditos activos (Supabase).
   */
  async validarPazYSalvoParaRetiro(asociadoId: string): Promise<ReglaValidacion> {
    const { data, error } = await supabase
      .from('creditos')
      .select('id')
      .eq('asociado_id', asociadoId)
      .in('estado', ['desembolsado', 'en_mora', 'aprobado'])
      .limit(1);

    if (error) {
      console.error('[businessRules] validarPazYSalvoParaRetiro:', error.message);
      return {
        valida: false,
        mensaje: 'No se pudo verificar créditos activos. Operación bloqueada por seguridad.',
        tipoExcepcion: 'retiro_con_deudas',
        impacto: 'critico',
        requiereExcepcion: true,
      };
    }

    if (data && data.length > 0) {
      return {
        valida: false,
        mensaje: 'El asociado tiene crédito(s) activo(s). Requiere paz y salvo antes del retiro.',
        tipoExcepcion: 'retiro_con_deudas',
        impacto: 'critico',
        requiereExcepcion: true,
      };
    }
    return { valida: true, mensaje: 'No hay créditos activos. Puede proceder.', requiereExcepcion: false };
  }

  /** REGLA: Retiros parciales requieren aprobación administrativa */
  validarRetiroParcial(esRetiroParcial: boolean): ReglaValidacion {
    if (esRetiroParcial && !this.config.permitirRetirosParcialesDefecto) {
      return {
        valida: false,
        mensaje: 'Los retiros parciales no están permitidos por defecto. Requiere aprobación administrativa.',
        tipoExcepcion: 'retiro_parcial',
        impacto: 'medio',
        requiereExcepcion: true,
      };
    }
    return { valida: true, mensaje: 'Retiro total permitido', requiereExcepcion: false };
  }

  // ── REGLAS DE AHORRO PERMANENTE ───────────────────────────────────────────

  /** REGLA: Estado de mora/vencimiento para Ahorro Permanente */
  calcularEstadoAhorroPermanente(fechaUltimoPago: string | null): {
    estado: 'al_dia' | 'en_mora' | 'plazo_vencido';
    mensaje: string;
  } {
    const hoy = new Date();
    const diaActual = hoy.getDate();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    if (!fechaUltimoPago) {
      if (diaActual <= 16) {
        return { estado: 'al_dia', mensaje: 'Dentro del plazo para su primer pago.' };
      } else {
        // Asumimos mora si pasó el 16. Si ya pasó el mes, no podemos saberlo sin fecha_ingreso, 
        // lo clasificamos como mora inicialmente.
        return { estado: 'en_mora', mensaje: 'Sin pagos registrados. Plazo inicial vencido (día 16).' };
      }
    }

    const ultimoPago = new Date(fechaUltimoPago);
    const mesPago = ultimoPago.getMonth();
    const añoPago = ultimoPago.getFullYear();
    const diferenciaMeses = (añoActual * 12 + mesActual) - (añoPago * 12 + mesPago);

    if (diferenciaMeses <= 0) {
      return { estado: 'al_dia', mensaje: 'Pago del mes al día o adelantado.' };
    } else if (diferenciaMeses === 1) {
      if (diaActual <= 16) {
        return { estado: 'al_dia', mensaje: 'Al día. Tiene hasta el día 16 para su próximo pago.' };
      } else {
        return { estado: 'en_mora', mensaje: 'En mora. Fecha límite de pago superada (día 16).' };
      }
    } else {
      return { estado: 'plazo_vencido', mensaje: 'Plazo máximo excedido (mes sin pago). Sujeto a revisión administrativa.' };
    }
  }

  // ── PROCESAMIENTO DE EXCEPCIONES ──────────────────────────────────────────

  /**
   * Crea una excepción administrativa en Supabase y opcionalmente envía notificación.
   *
   * @param regla          Resultado de la validación que falló
   * @param entidad        Tipo de entidad ('asociado' | 'credito' | 'pago' | ...)
   * @param entidadId      ID de la entidad relacionada
   * @param reglaViolada   Nombre técnico de la regla
   * @param solicitadoPor  Nombre/ID del usuario que desencadenó la excepción
   * @param motivo         Descripción del motivo de la excepción
   * @param datosRelevantes Contexto adicional en JSON
   * @param adminUserId    UUID del administrador al que notificar (opcional)
   */
  async crearExcepcionConAlerta(
    regla: ReglaValidacion,
    entidad: string,
    entidadId: string,
    reglaViolada: string,
    solicitadoPor: string,
    motivo: string,
    datosRelevantes: Record<string, any>,
    adminUserId?: string,
  ): Promise<{ excepcion: any; alerta: any }> {
    // Construir descripción completa
    const descripcion =
      `[${reglaViolada}] ${regla.mensaje}. Motivo: ${motivo}. ` +
      `Solicitado por: ${solicitadoPor}.`;

    // Insertar excepción en Supabase
    const insertPayload: Record<string, any> = {
      tipo:        regla.tipoExcepcion ?? 'otra',
      descripcion,
      estado:      'pendiente',
    };
    // Sólo añadir asociado_id si la entidad es un asociado y el ID parece un UUID
    if (entidad === 'asociado' && entidadId && entidadId !== 'nuevo') {
      insertPayload.asociado_id = entidadId;
    }

    const { data: excepcionData, error: excErr } = await supabase
      .from('excepciones')
      .insert(insertPayload)
      .select('id')
      .single();

    if (excErr) {
      console.error('[businessRules] crearExcepcionConAlerta (excepciones):', excErr.message);
      // Fallback: devolver objeto en memoria para no bloquear el flujo
      const fallback = { id: `mem_${Date.now()}`, ...insertPayload };
      return { excepcion: fallback, alerta: null };
    }

    // Enviar notificación al administrador si se proporcionó su UUID
    let alertaData: any = null;
    if (adminUserId) {
      const { data: notif } = await supabase.from('notificaciones').insert({
        usuario_id: adminUserId,
        tipo:       'excepcion',
        titulo:     `Excepción pendiente: ${reglaViolada}`,
        mensaje:    regla.mensaje,
        leida:      false,
      }).select('id').single();
      alertaData = notif;
    }

    return {
      excepcion: { id: excepcionData.id, ...insertPayload, entidad, entidadId, motivo, datosRelevantes },
      alerta:    alertaData,
    };
  }

  /**
   * Aprobar excepción administrativa en Supabase.
   */
  async aprobarExcepcion(
    excepcionId: string,
    adminId: string,
    observaciones: string,
  ): Promise<any> {
    const { data, error } = await supabase
      .from('excepciones')
      .update({ estado: 'aprobada', resuelto_por: adminId })
      .eq('id', excepcionId)
      .select()
      .single();

    if (error) throw new Error('No se pudo aprobar la excepción: ' + error.message);

    // Auditoría
    await supabase.from('auditoria').insert({
      tabla:       'excepciones',
      registro_id: excepcionId,
      accion:      'EXCEPCIÓN APROBADA',
      detalle:     `Aprobada por admin (${adminId}). Observaciones: ${observaciones}`,
    }).then(() => {});

    return data;
  }

  /**
   * Rechazar excepción administrativa en Supabase.
   */
  async rechazarExcepcion(
    excepcionId: string,
    adminId: string,
    observaciones: string,
  ): Promise<any> {
    const { data, error } = await supabase
      .from('excepciones')
      .update({ estado: 'rechazada', resuelto_por: adminId })
      .eq('id', excepcionId)
      .select()
      .single();

    if (error) throw new Error('No se pudo rechazar la excepción: ' + error.message);

    // Auditoría
    await supabase.from('auditoria').insert({
      tabla:       'excepciones',
      registro_id: excepcionId,
      accion:      'EXCEPCIÓN RECHAZADA',
      detalle:     `Rechazada por admin (${adminId}). Observaciones: ${observaciones}`,
    }).then(() => {});

    return data;
  }

  // ── GETTERS DE TASAS FINANCIERAS ─────────────────────────────────────────

  /** Tasa EA % por defecto según tipo de crédito */
  getTasaCredito(tipo: string): number {
    const map: Record<string, keyof ConfigParametros> = {
      libre_inversion: 'tasaLibreInversion',
      educacion:       'tasaEducacion',
      vivienda:        'tasaVivienda',
      calamidad:       'tasaCalamidad',
    };
    const key = map[tipo];
    return key ? (this.config[key] as number) : this.config.tasaLibreInversion;
  }

  /** Tasa EA % de mora para créditos */
  getTasaMoraCreditos(): number { return this.config.tasaMoraCreditos; }

  /** Tasa EA % de rendimiento de ahorros voluntarios */
  getTasaAhorros(): number { return this.config.tasaInteresAhorros; }

  /** Snapshot completo de la configuración (para la pantalla Configuración) */
  getConfig(): Readonly<ConfigParametros> { return { ...this.config }; }

  // ── UTILIDADES ────────────────────────────────────────────────────────────

  /**
   * Evalúa un conjunto de reglas y devuelve las que fallaron.
   * Útil para validar varias reglas de golpe antes de una operación.
   */
  validarOperacion(reglas: ReglaValidacion[]): {
    todasValidas: boolean;
    reglasVioladas: ReglaValidacion[];
    requiereExcepciones: ReglaValidacion[];
  } {
    const reglasVioladas     = reglas.filter(r => !r.valida);
    const requiereExcepciones = reglasVioladas.filter(r => r.requiereExcepcion);
    return {
      todasValidas: reglasVioladas.length === 0,
      reglasVioladas,
      requiereExcepciones,
    };
  }
}

// Singleton exportado — importar así en cualquier componente:
// import { businessRules } from '../services/businessRules';
export const businessRules = new BusinessRulesEngine();
