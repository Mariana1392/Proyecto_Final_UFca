/**
 * Índice de Servicios - Punto único de acceso a toda la lógica de negocio
 */

// Servicios principales
export { db, COLLECTIONS, exportData, importData } from './database';
export { businessRules } from './businessRules';
export { asociadoService } from './asociadoService';
export { creditoService } from './creditoService';
export { exceptionService } from './exceptionService';

// Modelos
export * from '../models/Asociado';
export * from '../models/Credito';
export * from '../models/Exception';

// Importar db para usar en las funciones
import { db, COLLECTIONS } from './database';

/**
 * Inicializar el sistema
 * Debe llamarse una vez al inicio de la aplicación
 */
export const initializeSystem = () => {
  // Inicializar configuración si no existe
  db.initializeConfig();
  
  console.log('✅ Sistema de reglas de negocio inicializado');
  console.log('✅ Base de datos simulada lista');
  console.log('✅ Todos los servicios disponibles');
};

/**
 * Obtener configuración del sistema
 */
export const getSystemConfig = () => {
  return db.getConfig();
};

/**
 * Actualizar configuración del sistema
 */
export const updateSystemConfig = (
  parametros: any,
  userId: string
) => {
  return db.updateConfig(parametros, userId);
};

/**
 * Estadísticas generales del sistema
 */
export const getSystemStats = () => {
  const asociados = db.findAll(COLLECTIONS.ASOCIADOS);
  const creditos = db.findAll(COLLECTIONS.CREDITOS);
  const aportes = db.findAll(COLLECTIONS.APORTES);
  const excepciones = db.findAll(COLLECTIONS.EXCEPCIONES);
  const alertas = db.findAll(COLLECTIONS.ALERTAS);
  
  return {
    totalAsociados: asociados.length,
    asociadosActivos: asociados.filter((a: any) => a.estado === 'activo').length,
    totalCreditos: creditos.length,
    creditosActivos: creditos.filter((c: any) => 
      c.estado === 'desembolsado' || c.estado === 'en_mora'
    ).length,
    totalAportes: aportes.length,
    excepcionesPendientes: excepciones.filter((e: any) => e.estado === 'pendiente').length,
    alertasNoLeidas: alertas.filter((a: any) => !a.leida).length
  };
};