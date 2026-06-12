import { setWorldConstructor, World } from '@cucumber/cucumber';

export class CustomWorld extends World {
  platform = null;
  currentUser = null;
  currentView = null;
  lastSimulation = null;
  logs = [];
  alertMessage = null;

  db = {
    usuarios: [
      { id: 'u1', email: 'admin@ufca.com', rol: 'admin', rol_nombre: 'admin', estado_cuenta: 'activo' },
      { id: 'u1m', email: 'admin_m@ufca.com', rol: 'admin', rol_nombre: 'admin', estado_cuenta: 'activo' },
      { id: 'u2', email: 'asociado@ufca.com', rol: 'asociado', rol_nombre: 'asociado', estado_cuenta: 'activo', cuentaActivada: true },
      { id: 'u2m', email: 'asociado_m@ufca.com', rol: 'asociado', rol_nombre: 'asociado', estado_cuenta: 'activo', cuentaActivada: true },
      { id: 'u3', email: 'solicitante@ufca.com', rol: 'usuario', rol_nombre: 'usuario', estado_cuenta: 'pendiente' }
    ],
    solicitudes_asociados: [],
    creditos: [],
    cuentas_ahorro: [],
    liquidaciones: [],
    configuracion: [
      { clave: 'tasa_libre_inversion', valor: '18' },
      { clave: 'tasa_interes_ahorros', valor: '4' }
    ],
    auditoria: []
  };

  reset() {
    this.platform = null;
    this.currentUser = null;
    this.currentView = null;
    this.lastSimulation = null;
    this.alertMessage = null;
  }
}

setWorldConstructor(CustomWorld);
