/**
 * Servicio de Asociados - Implementa todas las reglas de negocio
 */

import { Asociado, generateCodigoAsociado, validateAsociado } from '../models/Asociado';
import { db, COLLECTIONS } from './database';
import { businessRules } from './businessRules';
import { registrarAuditoria } from '../models/Exception';

export class AsociadoService {
  /**
   * Crear nuevo asociado con validación de reglas
   */
  async crearAsociado(
    data: Omit<Asociado, '_id' | 'codigo' | 'createdAt' | 'updatedAt' | 'cuotasIncumplidas'>,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{ 
    success: boolean; 
    asociado?: Asociado; 
    excepcion?: any; 
    errors?: string[] 
  }> {
    // 1. Validación de datos básicos
    const validacion = validateAsociado(data);
    if (!validacion.valid) {
      return { success: false, errors: validacion.errors };
    }
    
    // 2. REGLA: Si es referido, no puede afiliarse
    const reglaReferido = businessRules.validarAsociadoReferido(data);
    if (!reglaReferido.valida && reglaReferido.requiereExcepcion) {
      const { excepcion } = await businessRules.crearExcepcionConAlerta(
        reglaReferido,
        'asociado',
        'nuevo',
        'asociado_no_referido',
        usuarioId,
        'Intento de afiliar persona referida',
        { asociado: data }
      );
      
      return {
        success: false,
        excepcion,
        errors: ['Requiere aprobación administrativa: ' + reglaReferido.mensaje]
      };
    }
    
    // 3. Generar código único
    const asociados = db.findAll<Asociado>(COLLECTIONS.ASOCIADOS);
    const codigo = generateCodigoAsociado(asociados);
    
    // 4. Crear asociado
    const nuevoAsociado = db.create<Asociado>(COLLECTIONS.ASOCIADOS, {
      ...data,
      codigo,
      cuotasIncumplidas: 0,
      fechaAfiliacion: new Date().toISOString()
    } as any);
    
    // 5. Auditoría
    const audit = registrarAuditoria(
      'crear',
      'asociado',
      nuevoAsociado._id,
      usuarioId,
      usuarioNombre,
      'admin',
      undefined,
      nuevoAsociado as any
    );
    db.create(COLLECTIONS.AUDITORIA, audit as any);
    
    return { success: true, asociado: nuevoAsociado };
  }
  
  /**
   * Registrar aporte con validación de mínimo
   */
  async registrarAporte(
    asociadoId: string,
    tipo: 'permanente' | 'voluntario',
    monto: number,
    periodo: string,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{ success: boolean; aporte?: any; excepcion?: any; errors?: string[] }> {
    // 1. Verificar que el asociado existe y está activo
    const asociado = db.findById<Asociado>(COLLECTIONS.ASOCIADOS, asociadoId);
    if (!asociado) {
      return { success: false, errors: ['Asociado no encontrado'] };
    }
    
    if (asociado.estado !== 'activo') {
      return { 
        success: false, 
        errors: [`El asociado está ${asociado.estado}. Solo asociados activos pueden realizar aportes.`] 
      };
    }
    
    // 2. REGLA: Validar aporte mínimo
    const reglaAporte = businessRules.validarAporteMinimo(monto);
    if (!reglaAporte.valida && reglaAporte.requiereExcepcion) {
      const { excepcion } = await businessRules.crearExcepcionConAlerta(
        reglaAporte,
        'aporte',
        'nuevo',
        'aporte_minimo',
        usuarioId,
        'Aporte menor al mínimo estatutario',
        { asociadoId, tipo, monto, periodo }
      );
      
      return {
        success: false,
        excepcion,
        errors: ['Requiere aprobación administrativa: ' + reglaAporte.mensaje]
      };
    }
    
    // 3. Crear aporte
    const aporte = db.create(COLLECTIONS.APORTES, {
      asociadoId,
      tipo,
      monto,
      fecha: new Date().toISOString(),
      periodo,
      estado: 'registrado',
      registradoPor: usuarioId
    } as any);
    
    // 4. Auditoría
    const audit = registrarAuditoria(
      'crear',
      'aporte',
      aporte._id,
      usuarioId,
      usuarioNombre,
      'admin',
      undefined,
      aporte as any
    );
    db.create(COLLECTIONS.AUDITORIA, audit as any);
    
    return { success: true, aporte };
  }
  
  /**
   * Suspender asociado por cuotas incumplidas
   */
  async verificarYSuspenderPorCuotas(
    asociadoId: string,
    usuarioId: string = 'sistema',
    usuarioNombre: string = 'Sistema Automático'
  ): Promise<{ suspendido: boolean; suspension?: any }> {
    const asociado = db.findById<Asociado>(COLLECTIONS.ASOCIADOS, asociadoId);
    if (!asociado) return { suspendido: false };
    
    // REGLA: Más de 2 cuotas incumplidas
    const reglaSuspension = businessRules.validarSuspensionPorCuotasIncumplidas(asociado);
    
    if (!reglaSuspension.valida) {
      // Crear suspensión
      const suspension = db.create(COLLECTIONS.SUSPENSIONES, {
        asociadoId,
        fechaInicio: new Date().toISOString(),
        motivo: 'cuotas_incumplidas',
        descripcion: reglaSuspension.mensaje,
        cuotasIncumplidasCount: asociado.cuotasIncumplidas,
        suspendidoPor: usuarioId,
        estado: 'activa'
      } as any);
      
      // Actualizar estado del asociado
      db.update<Asociado>(COLLECTIONS.ASOCIADOS, asociadoId, {
        estado: 'suspendido',
        motivoSuspension: reglaSuspension.mensaje,
        fechaSuspension: new Date().toISOString()
      } as any);
      
      // Auditoría
      const audit = registrarAuditoria(
        'actualizar',
        'asociado',
        asociadoId,
        usuarioId,
        usuarioNombre,
        'sistema',
        { estado: asociado.estado },
        { estado: 'suspendido' },
        'Suspensión automática por cuotas incumplidas'
      );
      db.create(COLLECTIONS.AUDITORIA, audit as any);
      
      return { suspendido: true, suspension };
    }
    
    return { suspendido: false };
  }
  
  /**
   * Procesar retiro con validaciones
   */
  async solicitarRetiro(
    asociadoId: string,
    montoSolicitado: number,
    esRetiroParcial: boolean,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{ success: boolean; retiro?: any; excepcion?: any; errors?: string[] }> {
    const asociado = db.findById<Asociado>(COLLECTIONS.ASOCIADOS, asociadoId);
    if (!asociado) {
      return { success: false, errors: ['Asociado no encontrado'] };
    }
    
    // 1. REGLA: Validar paz y salvo
    const reglaPazYSalvo = await businessRules.validarPazYSalvoParaRetiro(asociadoId);
    if (!reglaPazYSalvo.valida && reglaPazYSalvo.requiereExcepcion) {
      const { excepcion } = await businessRules.crearExcepcionConAlerta(
        reglaPazYSalvo,
        'retiro',
        'nuevo',
        'paz_y_salvo_retiro',
        usuarioId,
        'Retiro con deudas pendientes',
        { asociadoId, montoSolicitado }
      );
      
      return {
        success: false,
        excepcion,
        errors: ['Requiere aprobación administrativa: ' + reglaPazYSalvo.mensaje]
      };
    }
    
    // 2. REGLA: Validar retiro parcial
    const reglaRetiroParcial = businessRules.validarRetiroParcial(esRetiroParcial);
    if (!reglaRetiroParcial.valida && reglaRetiroParcial.requiereExcepcion) {
      const { excepcion } = await businessRules.crearExcepcionConAlerta(
        reglaRetiroParcial,
        'retiro',
        'nuevo',
        'retiro_parcial',
        usuarioId,
        'Solicitud de retiro parcial',
        { asociadoId, montoSolicitado }
      );
      
      return {
        success: false,
        excepcion,
        errors: ['Requiere aprobación administrativa: ' + reglaRetiroParcial.mensaje]
      };
    }
    
    // 3. Calcular descuentos automáticos (ejemplo)
    const descuentos = this.calcularDescuentosRetiro(asociadoId);
    const montoNeto = montoSolicitado - descuentos.reduce((sum, d) => sum + d.monto, 0);
    
    // 4. Crear solicitud de retiro
    const retiro = db.create(COLLECTIONS.RETIROS, {
      asociadoId,
      fechaSolicitud: new Date().toISOString(),
      montoTotal: montoSolicitado,
      descuentos,
      montoNeto,
      requierePazYSalvo: true,
      tienePazYSalvo: reglaPazYSalvo.valida,
      tieneDeudas: !reglaPazYSalvo.valida,
      estado: 'solicitado'
    } as any);
    
    // 5. Auditoría
    const audit = registrarAuditoria(
      'crear',
      'retiro',
      retiro._id,
      usuarioId,
      usuarioNombre,
      'admin',
      undefined,
      retiro as any
    );
    db.create(COLLECTIONS.AUDITORIA, audit as any);
    
    return { success: true, retiro };
  }
  
  /**
   * Calcular descuentos automáticos
   */
  private calcularDescuentosRetiro(asociadoId: string): { concepto: string; monto: number }[] {
    const descuentos: { concepto: string; monto: number }[] = [];
    
    // Ejemplo: Descuento por procesamiento
    descuentos.push({
      concepto: 'Procesamiento administrativo',
      monto: 10000
    });
    
    // Aquí se pueden agregar más descuentos según reglas de negocio
    
    return descuentos;
  }
  
  /**
   * Obtener asociados con filtros
   */
  obtenerAsociados(filtros?: {
    estado?: Asociado['estado'];
    busqueda?: string;
  }): Asociado[] {
    let asociados = db.findAll<Asociado>(COLLECTIONS.ASOCIADOS);
    
    if (filtros?.estado) {
      asociados = asociados.filter(a => a.estado === filtros.estado);
    }
    
    if (filtros?.busqueda) {
      const busqueda = filtros.busqueda.toLowerCase();
      asociados = asociados.filter(a => 
        a.nombres.toLowerCase().includes(busqueda) ||
        a.apellidos.toLowerCase().includes(busqueda) ||
        a.cedula.includes(busqueda) ||
        a.codigo.toLowerCase().includes(busqueda)
      );
    }
    
    return asociados;
  }
}

export const asociadoService = new AsociadoService();
