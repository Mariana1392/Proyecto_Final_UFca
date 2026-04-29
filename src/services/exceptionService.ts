/**
 * Servicio de Gestión de Excepciones y Alertas
 */

import { ExcepcionAdministrativa, Alerta } from '../models/Exception';
import { db, COLLECTIONS } from './database';
import { businessRules } from './businessRules';

export class ExceptionService {
  /**
   * Obtener excepciones pendientes para un administrador
   */
  obtenerExcepcionesPendientes(): ExcepcionAdministrativa[] {
    return db.findMany<ExcepcionAdministrativa>(COLLECTIONS.EXCEPCIONES, {
      estado: 'pendiente'
    } as any);
  }
  
  /**
   * Obtener excepciones por estado
   */
  obtenerExcepcionesPorEstado(estado: ExcepcionAdministrativa['estado']): ExcepcionAdministrativa[] {
    return db.findMany<ExcepcionAdministrativa>(COLLECTIONS.EXCEPCIONES, {
      estado
    } as any);
  }
  
  /**
   * Obtener excepciones por entidad
   */
  obtenerExcepcionesPorEntidad(
    entidad: ExcepcionAdministrativa['entidad'],
    entidadId: string
  ): ExcepcionAdministrativa[] {
    return db.findMany<ExcepcionAdministrativa>(COLLECTIONS.EXCEPCIONES, {
      entidad,
      entidadId
    } as any);
  }
  
  /**
   * Aprobar excepción
   */
  async aprobarExcepcion(
    excepcionId: string,
    adminId: string,
    observaciones: string
  ): Promise<{ success: boolean; excepcion?: ExcepcionAdministrativa; errors?: string[] }> {
    try {
      const excepcion = await businessRules.aprobarExcepcion(excepcionId, adminId, observaciones);
      
      // Actualizar alerta relacionada
      this.marcarAlertaComoLeida(excepcionId);
      
      return { success: true, excepcion };
    } catch (error: any) {
      return { success: false, errors: [error.message] };
    }
  }
  
  /**
   * Rechazar excepción
   */
  async rechazarExcepcion(
    excepcionId: string,
    adminId: string,
    observaciones: string
  ): Promise<{ success: boolean; excepcion?: ExcepcionAdministrativa; errors?: string[] }> {
    try {
      const excepcion = await businessRules.rechazarExcepcion(excepcionId, adminId, observaciones);
      
      // Actualizar alerta relacionada
      this.marcarAlertaComoLeida(excepcionId);
      
      return { success: true, excepcion };
    } catch (error: any) {
      return { success: false, errors: [error.message] };
    }
  }
  
  /**
   * Obtener alertas para un usuario
   */
  obtenerAlertas(usuarioId?: string, soloNoLeidas: boolean = false): Alerta[] {
    let alertas = db.findAll<Alerta>(COLLECTIONS.ALERTAS);
    
    if (usuarioId) {
      alertas = alertas.filter(a => a.destinatario === usuarioId || a.destinatario === 'admin');
    }
    
    if (soloNoLeidas) {
      alertas = alertas.filter(a => !a.leida);
    }
    
    return alertas.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  
  /**
   * Obtener alertas por prioridad
   */
  obtenerAlertasPorPrioridad(prioridad: Alerta['prioridad']): Alerta[] {
    return db.findMany<Alerta>(COLLECTIONS.ALERTAS, { prioridad } as any);
  }
  
  /**
   * Marcar alerta como leída
   */
  marcarAlertaComoLeida(excepcionId?: string, alertaId?: string): void {
    if (alertaId) {
      db.update<Alerta>(COLLECTIONS.ALERTAS, alertaId, {
        leida: true,
        fechaLectura: new Date().toISOString()
      } as any);
    } else if (excepcionId) {
      const alertas = db.findMany<Alerta>(COLLECTIONS.ALERTAS, { excepcionId } as any);
      alertas.forEach(alerta => {
        db.update<Alerta>(COLLECTIONS.ALERTAS, alerta._id, {
          leida: true,
          fechaLectura: new Date().toISOString()
        } as any);
      });
    }
  }
  
  /**
   * Marcar todas las alertas como leídas
   */
  marcarTodasAlertasComoLeidas(usuarioId: string): void {
    const alertas = this.obtenerAlertas(usuarioId, true);
    alertas.forEach(alerta => {
      this.marcarAlertaComoLeida(undefined, alerta._id);
    });
  }
  
  /**
   * Contar alertas no leídas
   */
  contarAlertasNoLeidas(usuarioId?: string): number {
    return this.obtenerAlertas(usuarioId, true).length;
  }
  
  /**
   * Obtener alertas urgentes
   */
  obtenerAlertasUrgentes(usuarioId?: string): Alerta[] {
    const alertas = this.obtenerAlertas(usuarioId, true);
    return alertas.filter(a => a.prioridad === 'urgente' || a.prioridad === 'alta');
  }
  
  /**
   * Obtener estadísticas de excepciones
   */
  obtenerEstadisticasExcepciones(): {
    totalPendientes: number;
    totalAprobadas: number;
    totalRechazadas: number;
    porTipo: Record<string, number>;
    porImpacto: Record<string, number>;
  } {
    const excepciones = db.findAll<ExcepcionAdministrativa>(COLLECTIONS.EXCEPCIONES);
    
    const stats = {
      totalPendientes: excepciones.filter(e => e.estado === 'pendiente').length,
      totalAprobadas: excepciones.filter(e => e.estado === 'aprobada').length,
      totalRechazadas: excepciones.filter(e => e.estado === 'rechazada').length,
      porTipo: {} as Record<string, number>,
      porImpacto: {} as Record<string, number>
    };
    
    excepciones.forEach(e => {
      stats.porTipo[e.tipo] = (stats.porTipo[e.tipo] || 0) + 1;
      stats.porImpacto[e.impacto] = (stats.porImpacto[e.impacto] || 0) + 1;
    });
    
    return stats;
  }
  
  /**
   * Obtener historial de excepciones de una entidad
   */
  obtenerHistorialExcepciones(entidad: string, entidadId: string): ExcepcionAdministrativa[] {
    const excepciones = db.findMany<ExcepcionAdministrativa>(COLLECTIONS.EXCEPCIONES, {
      entidad,
      entidadId
    } as any);
    
    return excepciones.sort((a, b) => 
      new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime()
    );
  }
  
  /**
   * Verificar si existe una excepción pendiente para una operación
   */
  existeExcepcionPendiente(entidad: string, entidadId: string, tipo?: string): boolean {
    const excepciones = db.findMany<ExcepcionAdministrativa>(COLLECTIONS.EXCEPCIONES, {
      entidad,
      entidadId,
      estado: 'pendiente'
    } as any);
    
    if (tipo) {
      return excepciones.some(e => e.tipo === tipo);
    }
    
    return excepciones.length > 0;
  }
  
  /**
   * Limpiar alertas antiguas (más de 30 días)
   */
  limpiarAlertasAntiguas(): number {
    const alertas = db.findAll<Alerta>(COLLECTIONS.ALERTAS);
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    
    let eliminadas = 0;
    
    alertas.forEach(alerta => {
      const fechaCreacion = new Date(alerta.createdAt);
      if (fechaCreacion < hace30Dias && alerta.leida) {
        db.delete(COLLECTIONS.ALERTAS, alerta._id);
        eliminadas++;
      }
    });
    
    return eliminadas;
  }
}

export const exceptionService = new ExceptionService();
