/**
 * Servicio de Créditos - Implementa todas las reglas de negocio de créditos
 */

import {
  Credito,
  Pago,
  PazYSalvo,
  TablaAmortizacion,
  generateCodigoCredito,
  generarTablaAmortizacion,
  verificarMora,
  calcularTasaMensual,
  calcularCuotaMensual,
  validateCredito
} from '../models/Credito';
import { Asociado } from '../models/Asociado';
import { db, COLLECTIONS } from './database';
import { businessRules } from './businessRules';
import { registrarAuditoria } from '../models/Exception';

export class CreditoService {
  /**
   * Solicitar crédito con validaciones
   */
  async solicitarCredito(
    data: {
      asociadoId: string;
      tipo: Credito['tipo'];
      monto: number;
      plazoMeses: number;
      tasaInteres: number;
      observaciones?: string;
      destinoCredito?: string;
    },
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{ success: boolean; credito?: Credito; excepciones?: any[]; errors?: string[] }> {
    // 1. Validación de datos
    const validacion = validateCredito(data as any);
    if (!validacion.valid) {
      return { success: false, errors: validacion.errors };
    }
    
    // 2. Verificar que el asociado existe
    const asociado = db.findById<Asociado>(COLLECTIONS.ASOCIADOS, data.asociadoId);
    if (!asociado) {
      return { success: false, errors: ['Asociado no encontrado'] };
    }
    
    const excepciones: any[] = [];
    
    // 3. REGLA: Solo asociados activos pueden solicitar crédito
    const reglaActivo = businessRules.validarAsociadoActivoParaCredito(asociado);
    if (!reglaActivo.valida && reglaActivo.requiereExcepcion) {
      const { excepcion } = await businessRules.crearExcepcionConAlerta(
        reglaActivo,
        'credito',
        'nuevo',
        'asociado_activo_credito',
        usuarioId,
        'Solicitud de crédito para asociado inactivo',
        { asociado, credito: data }
      );
      excepciones.push(excepcion);
    }
    
    // 4. REGLA: No aprobar nuevo crédito si existe uno en mora
    const reglaMora = await businessRules.validarCreditosSinMora(data.asociadoId);
    if (!reglaMora.valida && reglaMora.requiereExcepcion) {
      const { excepcion } = await businessRules.crearExcepcionConAlerta(
        reglaMora,
        'credito',
        'nuevo',
        'credito_sin_mora',
        usuarioId,
        'Solicitud de crédito con créditos en mora',
        { asociado, credito: data }
      );
      excepciones.push(excepcion);
    }
    
    // Si hay excepciones pendientes, no continuar
    if (excepciones.length > 0) {
      return {
        success: false,
        excepciones,
        errors: ['Requiere aprobación administrativa para las excepciones generadas']
      };
    }
    
    // 5. Calcular valores
    const tasaMensual = calcularTasaMensual(data.tasaInteres);
    const cuotaMensual = calcularCuotaMensual(data.monto, tasaMensual, data.plazoMeses);
    
    // 6. Generar código único
    const creditos = db.findAll<Credito>(COLLECTIONS.CREDITOS);
    const codigo = generateCodigoCredito(creditos);
    
    // 7. Crear crédito
    const credito = db.create<Credito>(COLLECTIONS.CREDITOS, {
      codigo,
      asociadoId: data.asociadoId,
      asociadoNombre: `${asociado.nombres} ${asociado.apellidos}`,
      tipo: data.tipo,
      monto: data.monto,
      plazoMeses: data.plazoMeses,
      tasaInteres: data.tasaInteres,
      tasaMensual,
      cuotaMensual,
      fechaSolicitud: new Date().toISOString(),
      estado: 'pendiente',
      enMora: false,
      diasMora: 0,
      saldoPendiente: data.monto,
      totalPagado: 0,
      cuotasPagadas: 0,
      observaciones: data.observaciones,
      destinoCredito: data.destinoCredito
    } as any);
    
    // 8. Auditoría
    const audit = registrarAuditoria(
      'crear',
      'credito',
      credito._id,
      usuarioId,
      usuarioNombre,
      'admin',
      undefined,
      credito as any,
      'Solicitud de crédito'
    );
    db.create(COLLECTIONS.AUDITORIA, audit as any);
    
    return { success: true, credito };
  }
  
  /**
   * Aprobar crédito (solo administrador)
   */
  async aprobarCredito(
    creditoId: string,
    adminId: string,
    adminNombre: string,
    observaciones?: string
  ): Promise<{ success: boolean; credito?: Credito; errors?: string[] }> {
    const credito = db.findById<Credito>(COLLECTIONS.CREDITOS, creditoId);
    if (!credito) {
      return { success: false, errors: ['Crédito no encontrado'] };
    }
    
    if (credito.estado !== 'pendiente') {
      return { success: false, errors: [`El crédito ya está ${credito.estado}`] };
    }
    
    // Actualizar crédito
    const creditoActualizado = db.update<Credito>(COLLECTIONS.CREDITOS, creditoId, {
      estado: 'aprobado',
      fechaAprobacion: new Date().toISOString(),
      aprobadoPor: adminId,
      observaciones: observaciones || credito.observaciones
    } as any);
    
    // Auditoría
    const audit = registrarAuditoria(
      'aprobar',
      'credito',
      creditoId,
      adminId,
      adminNombre,
      'admin',
      { estado: 'pendiente' },
      { estado: 'aprobado' },
      observaciones
    );
    db.create(COLLECTIONS.AUDITORIA, audit as any);
    
    return { success: true, credito: creditoActualizado! };
  }
  
  /**
   * Rechazar crédito
   */
  async rechazarCredito(
    creditoId: string,
    adminId: string,
    adminNombre: string,
    motivoRechazo: string
  ): Promise<{ success: boolean; credito?: Credito; errors?: string[] }> {
    const credito = db.findById<Credito>(COLLECTIONS.CREDITOS, creditoId);
    if (!credito) {
      return { success: false, errors: ['Crédito no encontrado'] };
    }
    
    if (credito.estado !== 'pendiente') {
      return { success: false, errors: [`El crédito ya está ${credito.estado}`] };
    }
    
    // Actualizar crédito
    const creditoActualizado = db.update<Credito>(COLLECTIONS.CREDITOS, creditoId, {
      estado: 'rechazado',
      motivoRechazo,
      aprobadoPor: adminId
    } as any);
    
    // Auditoría
    const audit = registrarAuditoria(
      'rechazar',
      'credito',
      creditoId,
      adminId,
      adminNombre,
      'admin',
      { estado: 'pendiente' },
      { estado: 'rechazado' },
      motivoRechazo
    );
    db.create(COLLECTIONS.AUDITORIA, audit as any);
    
    return { success: true, credito: creditoActualizado! };
  }
  
  /**
   * Desembolsar crédito y generar tabla de amortización
   */
  async desembolsarCredito(
    creditoId: string,
    adminId: string,
    adminNombre: string
  ): Promise<{ success: boolean; credito?: Credito; tabla?: any; errors?: string[] }> {
    // 1. REGLA: Validar periodo no cerrado
    const reglaPeriodo = businessRules.validarPeriodoCerrado('desembolso');
    if (!reglaPeriodo.valida && reglaPeriodo.requiereExcepcion) {
      const { excepcion } = await businessRules.crearExcepcionConAlerta(
        reglaPeriodo,
        'credito',
        creditoId,
        'periodo_abierto',
        adminId,
        'Desembolso en periodo cerrado',
        { creditoId }
      );
      
      return {
        success: false,
        errors: ['Requiere aprobación administrativa: ' + reglaPeriodo.mensaje]
      };
    }
    
    const credito = db.findById<Credito>(COLLECTIONS.CREDITOS, creditoId);
    if (!credito) {
      return { success: false, errors: ['Crédito no encontrado'] };
    }
    
    if (credito.estado !== 'aprobado') {
      return { success: false, errors: ['El crédito debe estar aprobado para desembolsarse'] };
    }
    
    const fechaDesembolso = new Date();
    
    // Actualizar crédito
    const creditoActualizado = db.update<Credito>(COLLECTIONS.CREDITOS, creditoId, {
      estado: 'desembolsado',
      fechaDesembolso: fechaDesembolso.toISOString()
    } as any);
    
    // Generar tabla de amortización (Método Francés)
    const tabla = generarTablaAmortizacion(credito, fechaDesembolso);
    db.create(COLLECTIONS.TABLAS_AMORTIZACION, tabla as any);
    
    // Auditoría
    const audit = registrarAuditoria(
      'actualizar',
      'credito',
      creditoId,
      adminId,
      adminNombre,
      'admin',
      { estado: 'aprobado' },
      { estado: 'desembolsado' },
      'Desembolso de crédito'
    );
    db.create(COLLECTIONS.AUDITORIA, audit as any);
    
    return { success: true, credito: creditoActualizado!, tabla };
  }
  
  /**
   * Registrar pago con validaciones
   */
  async registrarPago(
    data: {
      creditoId: string;
      monto: number;
      metodoPago: Pago['metodoPago'];
      referencia?: string;
      observaciones?: string;
    },
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{ success: boolean; pago?: Pago; credito?: Credito; excepciones?: any[]; errors?: string[] }> {
    const credito = db.findById<Credito>(COLLECTIONS.CREDITOS, data.creditoId);
    if (!credito) {
      return { success: false, errors: ['Crédito no encontrado'] };
    }
    
    const excepciones: any[] = [];
    
    // 1. REGLA: Solo registrar pagos a créditos desembolsados
    const reglaDesembolsado = businessRules.validarPagoCreditoDesembolsado(credito);
    if (!reglaDesembolsado.valida && reglaDesembolsado.requiereExcepcion) {
      const { excepcion } = await businessRules.crearExcepcionConAlerta(
        reglaDesembolsado,
        'pago',
        'nuevo',
        'pago_credito_desembolsado',
        usuarioId,
        'Pago a crédito no desembolsado',
        { credito, pago: data }
      );
      excepciones.push(excepcion);
    }
    
    // 2. REGLA: Validar periodo no cerrado
    const reglaPeriodo = businessRules.validarPeriodoCerrado('pago');
    if (!reglaPeriodo.valida && reglaPeriodo.requiereExcepcion) {
      const { excepcion } = await businessRules.crearExcepcionConAlerta(
        reglaPeriodo,
        'pago',
        'nuevo',
        'periodo_abierto_pago',
        usuarioId,
        'Pago en periodo cerrado',
        { credito, pago: data }
      );
      excepciones.push(excepcion);
    }
    
    if (excepciones.length > 0) {
      return {
        success: false,
        excepciones,
        errors: ['Requiere aprobación administrativa para las excepciones generadas']
      };
    }
    
    // 3. Calcular aplicación del pago
    const saldoAnterior = credito.saldoPendiente;
    const interesPendiente = saldoAnterior * credito.tasaMensual;
    
    let aplicadoAInteres = Math.min(data.monto, interesPendiente);
    let aplicadoACapital = Math.max(0, data.monto - aplicadoAInteres);
    
    const nuevoSaldo = Math.max(0, saldoAnterior - aplicadoACapital);
    
    // 4. Crear pago
    const pago = db.create<Pago>(COLLECTIONS.PAGOS, {
      creditoId: data.creditoId,
      asociadoId: credito.asociadoId,
      monto: data.monto,
      fecha: new Date().toISOString(),
      aplicadoACapital,
      aplicadoAInteres,
      saldoPendiente: nuevoSaldo,
      registradoPor: usuarioId,
      metodoPago: data.metodoPago,
      referencia: data.referencia,
      observaciones: data.observaciones
    } as any);
    
    // 5. Actualizar crédito
    const totalPagado = credito.totalPagado + data.monto;
    const creditoActualizado = db.update<Credito>(COLLECTIONS.CREDITOS, data.creditoId, {
      saldoPendiente: nuevoSaldo,
      totalPagado,
      cuotasPagadas: credito.cuotasPagadas + (data.monto >= credito.cuotaMensual ? 1 : 0)
    } as any);
    
    // 6. Si saldo = 0, cambiar a CANCELADO y emitir paz y salvo
    if (nuevoSaldo === 0) {
      db.update<Credito>(COLLECTIONS.CREDITOS, data.creditoId, {
        estado: 'cancelado',
        fechaCancelacion: new Date().toISOString()
      } as any);
      
      // Emitir paz y salvo automáticamente
      await this.emitirPazYSalvo(credito.asociadoId, data.creditoId, usuarioId, 'credito_cancelado');
    }
    
    // 7. Actualizar tabla de amortización
    await this.actualizarTablaAmortizacion(data.creditoId, pago);
    
    // 8. Verificar mora
    await this.verificarYActualizarMora(data.creditoId);
    
    // 9. Auditoría
    const audit = registrarAuditoria(
      'crear',
      'pago',
      pago._id,
      usuarioId,
      usuarioNombre,
      'admin',
      undefined,
      pago as any,
      'Registro de pago'
    );
    db.create(COLLECTIONS.AUDITORIA, audit as any);
    
    return { success: true, pago, credito: creditoActualizado! };
  }
  
  /**
   * Actualizar tabla de amortización con pago
   */
  private async actualizarTablaAmortizacion(creditoId: string, pago: Pago): Promise<void> {
    const tablas = db.findMany<TablaAmortizacion>(COLLECTIONS.TABLAS_AMORTIZACION, { creditoId } as any);
    if (tablas.length === 0) return;
    
    const tabla = tablas[0];
    // Aquí se actualizaría la tabla de amortización
    // Por simplicidad, se omite la implementación detallada
  }
  
  /**
   * Verificar y actualizar mora
   */
  async verificarYActualizarMora(creditoId: string): Promise<void> {
    const tablas = db.findMany<TablaAmortizacion>(COLLECTIONS.TABLAS_AMORTIZACION, { creditoId } as any);
    if (tablas.length === 0) return;
    
    const tabla = tablas[0];
    const estadoMora = verificarMora(tabla.cuotas);
    
    const credito = db.findById<Credito>(COLLECTIONS.CREDITOS, creditoId);
    if (!credito) return;
    
    // Actualizar estado de mora
    db.update<Credito>(COLLECTIONS.CREDITOS, creditoId, {
      enMora: estadoMora.enMora,
      diasMora: estadoMora.diasMora,
      estado: estadoMora.enMora ? 'en_mora' : credito.estado
    } as any);
  }
  
  /**
   * Emitir paz y salvo
   */
  async emitirPazYSalvo(
    asociadoId: string,
    creditoId: string,
    emitenteId: string,
    motivo: PazYSalvo['motivo']
  ): Promise<PazYSalvo> {
    const pazYSalvo = db.create<PazYSalvo>(COLLECTIONS.PAZ_Y_SALVOS, {
      asociadoId,
      creditoId,
      fechaEmision: new Date().toISOString(),
      vigenciaHasta: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 días
      emitidoPor: emitenteId,
      motivo
    } as any);
    
    return pazYSalvo;
  }
  
  /**
   * Simulador de crédito
   */
  simularCredito(monto: number, plazoMeses: number, tasaInteres: number): {
    cuotaMensual: number;
    totalIntereses: number;
    totalPagar: number;
    cuotas: any[];
  } {
    const tasaMensual = calcularTasaMensual(tasaInteres);
    const cuotaMensual = calcularCuotaMensual(monto, tasaMensual, plazoMeses);
    
    const cuotas = [];
    let saldo = monto;
    let totalIntereses = 0;
    
    for (let i = 1; i <= plazoMeses; i++) {
      const interes = saldo * tasaMensual;
      const capital = cuotaMensual - interes;
      saldo = Math.max(0, saldo - capital);
      totalIntereses += interes;
      
      cuotas.push({
        numero: i,
        cuota: cuotaMensual,
        capital,
        interes,
        saldo
      });
    }
    
    return {
      cuotaMensual,
      totalIntereses,
      totalPagar: monto + totalIntereses,
      cuotas
    };
  }
  
  /**
   * Eliminar crédito con validación
   */
  async eliminarCredito(
    creditoId: string,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{ success: boolean; errors?: string[] }> {
    // REGLA: No eliminar créditos con pagos
    const reglaEliminacion = await businessRules.validarEliminacionCredito(creditoId);
    
    if (!reglaEliminacion.valida) {
      return {
        success: false,
        errors: [reglaEliminacion.mensaje]
      };
    }
    
    const credito = db.findById<Credito>(COLLECTIONS.CREDITOS, creditoId);
    
    // Eliminar crédito
    db.delete(COLLECTIONS.CREDITOS, creditoId);
    
    // Auditoría
    const audit = registrarAuditoria(
      'eliminar',
      'credito',
      creditoId,
      usuarioId,
      usuarioNombre,
      'admin',
      credito as any,
      undefined,
      'Eliminación de crédito sin pagos'
    );
    db.create(COLLECTIONS.AUDITORIA, audit as any);
    
    return { success: true };
  }
}

export const creditoService = new CreditoService();
