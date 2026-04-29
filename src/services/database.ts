/**
 * Servicio de Base de Datos - Simulación de MongoDB Atlas
 * 
 * Esta implementación usa localStorage para simular una base de datos MongoDB.
 * Está diseñada para ser fácilmente reemplazable con una conexión real a MongoDB Atlas.
 * 
 * Para migrar a MongoDB Atlas:
 * 1. Reemplazar las funciones de localStorage con llamadas a la API
 * 2. Los modelos ya están estructurados para ser compatibles con Mongoose
 * 3. La estructura de datos se mantiene idéntica
 */

import { Asociado } from '../models/Asociado';
import { Credito, Pago, TablaAmortizacion, PazYSalvo } from '../models/Credito';
import { ExcepcionAdministrativa, Alerta, AuditoriaLog, ConfiguracionReglas } from '../models/Exception';

// Constantes para las "colecciones"
const COLLECTIONS = {
  ASOCIADOS: 'db_asociados',
  AFILIACIONES: 'db_afiliaciones',
  APORTES: 'db_aportes',
  SUSPENSIONES: 'db_suspensiones',
  RETIROS: 'db_retiros',
  CREDITOS: 'db_creditos',
  PAGOS: 'db_pagos',
  TABLAS_AMORTIZACION: 'db_tablas_amortizacion',
  PAZ_Y_SALVOS: 'db_paz_y_salvos',
  EXCEPCIONES: 'db_excepciones',
  ALERTAS: 'db_alertas',
  AUDITORIA: 'db_auditoria',
  CONFIGURACION: 'db_configuracion'
};

class DatabaseService {
  // Métodos genéricos CRUD
  
  private getCollection<T>(collectionName: string): T[] {
    const data = localStorage.getItem(collectionName);
    return data ? JSON.parse(data) : [];
  }
  
  private saveCollection<T>(collectionName: string, data: T[]): void {
    localStorage.setItem(collectionName, JSON.stringify(data));
  }
  
  findAll<T>(collectionName: string): T[] {
    return this.getCollection<T>(collectionName);
  }
  
  findById<T extends { _id: string }>(collectionName: string, id: string): T | null {
    const items = this.getCollection<T>(collectionName);
    return items.find(item => item._id === id) || null;
  }
  
  findOne<T>(collectionName: string, query: Partial<T>): T | null {
    const items = this.getCollection<T>(collectionName);
    return items.find(item => {
      return Object.keys(query).every(key => 
        item[key as keyof T] === query[key as keyof T]
      );
    }) || null;
  }
  
  findMany<T>(collectionName: string, query: Partial<T>): T[] {
    const items = this.getCollection<T>(collectionName);
    return items.filter(item => {
      return Object.keys(query).every(key => 
        item[key as keyof T] === query[key as keyof T]
      );
    });
  }
  
  create<T extends { _id: string; createdAt: string; updatedAt: string }>(
    collectionName: string,
    data: Omit<T, '_id' | 'createdAt' | 'updatedAt'>
  ): T {
    const items = this.getCollection<T>(collectionName);
    const newItem = {
      ...data,
      _id: `${collectionName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as T;
    
    items.push(newItem);
    this.saveCollection(collectionName, items);
    return newItem;
  }
  
  update<T extends { _id: string; updatedAt: string }>(
    collectionName: string,
    id: string,
    data: Partial<T>
  ): T | null {
    const items = this.getCollection<T>(collectionName);
    const index = items.findIndex(item => item._id === id);
    
    if (index === -1) return null;
    
    items[index] = {
      ...items[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    this.saveCollection(collectionName, items);
    return items[index];
  }
  
  delete<T extends { _id: string }>(collectionName: string, id: string): boolean {
    const items = this.getCollection<T>(collectionName);
    const filteredItems = items.filter(item => item._id !== id);
    
    if (filteredItems.length === items.length) return false;
    
    this.saveCollection(collectionName, filteredItems);
    return true;
  }
  
  // Métodos específicos para transacciones complejas
  
  transaction<T>(callback: () => T): T {
    // En una implementación real con MongoDB, esto usaría transactions
    // Para localStorage, ejecutamos directamente
    try {
      return callback();
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }
  
  // Métodos de búsqueda avanzada
  
  aggregate<T, R>(
    collectionName: string,
    pipeline: ((items: T[]) => R)
  ): R {
    const items = this.getCollection<T>(collectionName);
    return pipeline(items);
  }
  
  count(collectionName: string, query?: Record<string, any>): number {
    if (!query) {
      return this.getCollection(collectionName).length;
    }
    return this.findMany(collectionName, query).length;
  }
  
  // Inicialización de configuración
  
  initializeConfig(): ConfiguracionReglas {
    const existingConfig = this.findOne<ConfiguracionReglas>(
      COLLECTIONS.CONFIGURACION,
      { nombre: 'configuracion_principal' }
    );
    
    if (existingConfig) return existingConfig;
    
    return this.create<ConfiguracionReglas>(COLLECTIONS.CONFIGURACION, {
      nombre: 'configuracion_principal',
      descripcion: 'Configuración principal del sistema',
      parametros: {
        aporteMinimo: 50000, // $50,000 pesos
        cuotasMaximasIncumplidas: 2,
        diasMoraMaximo: 30,
        permitirRetirosParcialesDefecto: false,
        periodoActualCerrado: false
      },
      modificadoPor: 'sistema',
      fechaModificacion: new Date().toISOString()
    } as any);
  }
  
  getConfig(): ConfiguracionReglas {
    const config = this.findOne<ConfiguracionReglas>(
      COLLECTIONS.CONFIGURACION,
      { nombre: 'configuracion_principal' }
    );
    
    if (!config) {
      return this.initializeConfig();
    }
    
    return config;
  }
  
  updateConfig(parametros: Partial<ConfiguracionReglas['parametros']>, modificadoPor: string): ConfiguracionReglas {
    const config = this.getConfig();
    
    const updated = this.update<ConfiguracionReglas>(
      COLLECTIONS.CONFIGURACION,
      config._id,
      {
        parametros: {
          ...config.parametros,
          ...parametros
        },
        modificadoPor,
        fechaModificacion: new Date().toISOString()
      } as Partial<ConfiguracionReglas>
    );
    
    return updated!;
  }
}

// Singleton
export const db = new DatabaseService();
export { COLLECTIONS };

// Funciones de utilidad para migracion a MongoDB
export const prepareForMongoDB = () => {
  console.log('=== Guía de Migración a MongoDB Atlas ===');
  console.log('1. Instalar dependencias: npm install mongodb mongoose');
  console.log('2. Crear archivo .env con MONGODB_URI');
  console.log('3. Reemplazar DatabaseService con MongoClient o Mongoose');
  console.log('4. Los modelos en /models/* son compatibles con Mongoose schemas');
  console.log('5. Mantener la misma estructura de datos');
};

/**
 * Exportar datos para migración
 */
export const exportData = () => {
  const data: Record<string, any> = {};
  
  Object.entries(COLLECTIONS).forEach(([key, collectionName]) => {
    data[key] = localStorage.getItem(collectionName);
  });
  
  return data;
};

/**
 * Importar datos desde migración
 */
export const importData = (data: Record<string, any>) => {
  Object.entries(data).forEach(([key, value]) => {
    if (value && COLLECTIONS[key as keyof typeof COLLECTIONS]) {
      localStorage.setItem(COLLECTIONS[key as keyof typeof COLLECTIONS], value);
    }
  });
};
