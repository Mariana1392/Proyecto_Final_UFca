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
import { Asociado } from '../models/Asociado';
import { Credito, calcularDiasMora, verificarMora } from '../models/Credito';

// ── Tipo de resultado de validación ──────────────────────────────────────────

export interface ReglaValidacion {
  valida: boolean;
  mensaje: string;
  tipoExcepcion?: string;
  impacto?: 'bajo' | 'medio' | 'alto' | 'critico';
  requiereExcepcion: boolean;
}

// ── Configuración interna (parámetros operativos de la cooperativa) ───────────
// Estos valores pueden moverse a una tabla de configuración en el futuro.

interface ConfigParametros {
  aporteMinimo: number;
  cuotasMaximasIncumplidas: number;
  diasMoraMaximo: number;
  permitirRetirosParcialesDefecto: boolean;
  periodoActualCerrado: boolean;
  fechaCierrePeriodo?: string;
}

class BusinessRulesEngine {
  private config: ConfigParametros = {
    aporteMinimo: 50_000,
    cuotasMaximasIncumplidas: 2,
    diasMoraMaximo: 30,
    permitirRetirosParcialesDefecto: false,
    periodoActualCerrado: false,
  };

  /** Actualiza la configuración en tiempo de ejecución sin recargar la app */
  updateConfig(parcial: Partial<ConfigParametros>) {
    this.config = { ...this.config, ...parcial };
  }

  // ── REGLAS DE ASOCIADOS ───────────────────────────────────────────────────

  /** REGLA: Personas referidas no pueden afiliarse directamente */
  validarAsociadoReferido(asociado: Partial<Asociado>): ReglaValidacion {
    if ((asociado as any).esReferido) {
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
   * REGLA: Un asociado no puede tener más de una cuenta activa (Supabase).
   * Comprueba si ya existe un registro activo con ese `asociado_id`.
   */
  async validarAfiliacionUnica(asociadoId: string): Promise<ReglaValidacion> {
    const { data, error } = await supabase
      .from('asociados')
      .select('id')
      .eq('id', asociadoId)
      .eq('estado', 'activo')
      .limit(1);

    if (error) {
      console.error('[businessRules] validarAfiliacionUnica:', error.message);
      return { valida: true, mensaje: 'No se pudo verificar afiliaciones (se permite continuar)', requiereExcepcion: false };
    }

    if (data && data.length > 0) {
      return {
        valida: false,
        mensaje: 'El asociado ya tiene una afiliación activa. No se permite múltiples afiliaciones.',
        tipoExcepcion: 'multiple_afiliacion',
        impacto: 'alto',
        requiereExcepcion: true,
      };
    }
    return { valida: true, mensaje: 'No hay afiliaciones activas previas', requiereExcepcion: false };
  }

  /** REGLA: Más de N cuotas incumplidas genera suspensión automática */
  validarSuspensionPorCuotasIncumplidas(asociado: Asociado): ReglaValidacion {
    const max = this.config.cuotasMaximasIncumplidas;
    if ((asociado as any).cuotasIncumplidas >= max) {
      return {
        valida: false,
        mensaje: `El asociado tiene ${(asociado as any).cuotasIncumplidas} cuotas incumplidas (máximo: ${max}). Debe ser suspendido.`,
        tipoExcepcion: 'suspension_menos_dos_cuotas',
        impacto: 'alto',
        requiereExcepcion: false, // Suspensión automática — no se puede eximir
      };
    }
    return { valida: true, mensaje: 'Cuotas incumplidas dentro del límite', requiereExcepcion: false };
  }

  /** REGLA: Solo asociados activos pueden solicitar crédito */
  validarAsociadoActivoParaCredito(asociado: Asociado): ReglaValidacion {
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
      .from('pagos_credito')
      .select('*', { count: 'exact', head: true })
      .eq('credito_id', creditoId);

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
  validarPagoCreditoDesembolsado(credito: Credito): ReglaValidacion {
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
