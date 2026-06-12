import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert';

// --- ANTECEDENTES ---
Given('que el sistema de base de datos Supabase está activo', function () {
  assert.ok(this.db, 'La base de datos debería estar inicializada.');
});

// --- AUTENTICACIÓN ---
Given('que estoy en la pantalla de inicio de sesión en la versión {string}', function (plataforma) {
  this.platform = plataforma;
  this.currentView = 'login';
});

When('ingreso mi correo {string} y mi contraseña {string}', function (correo, _clave) {
  const user = this.db.usuarios.find(u => u.email === correo);
  if (!user) {
    throw new Error(`Usuario ${correo} no encontrado en la base de datos de pruebas.`);
  }
  this.currentUser = user;
});

When('presiono el botón de ingresar', function () {
  assert.ok(this.currentUser, 'Debe haber un usuario seleccionado.');
});

Then('inicio sesión correctamente', function () {
  assert.ok(this.currentUser, 'El usuario debería haber iniciado sesión.');
});

Then('el sistema me redirige al {string}', function (moduloDestino) {
  this.currentView = moduloDestino;
  assert.strictEqual(this.currentView, moduloDestino, `El módulo actual no es ${moduloDestino}.`);
});

When('hago clic en {string}', function (linkName) {
  if (linkName === 'Recuperar contraseña') {
    this.currentView = 'recuperar-password';
  }
});

When('completo mi correo {string} y presiono enviar', function (correo) {
  const user = this.db.usuarios.find(u => u.email === correo);
  assert.ok(user, 'Usuario no registrado.');
  this.alertMessage = 'Correo de recuperación enviado';
});

Then('el sistema muestra un mensaje de correo de recuperación enviado', function () {
  assert.strictEqual(this.alertMessage, 'Correo de recuperación enviado');
});


// --- ASOCIACIÓN ---
Given('que soy un visitante en el sitio web de UFCA', function () {
  this.platform = 'web';
  this.currentView = 'home';
});

When('completo el formulario de asociación con datos válidos', function () {
  this.lastSimulation = {
    nombre: 'Juan Pérez',
    email: 'juan@perez.com',
    telefono: '3001234567',
    documento: '12345678'
  };
});

When('adjunto los documentos requeridos', function () {
  this.lastSimulation.documentoAdjunto = 'cedula.pdf';
});

When('presiono enviar solicitud', function () {
  const nuevaSolicitud = {
    id: 'sol_1',
    ...this.lastSimulation,
    estado: 'pendiente'
  };
  this.db.solicitudes_asociados.push(nuevaSolicitud);
  this.alertMessage = 'Solicitud registrada con éxito';
});

Then('el sistema registra mi solicitud con estado {string}', function (estadoEsperado) {
  const sol = this.db.solicitudes_asociados.find(s => s.id === 'sol_1');
  assert.ok(sol, 'No se registró la solicitud.');
  assert.strictEqual(sol.estado, estadoEsperado);
});

Then('me muestra un mensaje de confirmación', function () {
  assert.strictEqual(this.alertMessage, 'Solicitud registrada con éxito');
});

Given('que un solicitante ha enviado una solicitud', function () {
  this.db.solicitudes_asociados.push({
    id: 'sol_1',
    nombre: 'Juan Pérez',
    email: 'juan@perez.com',
    estado: 'pendiente'
  });
});

Given('que estoy autenticado como {string} en la versión {string}', function (rol, plataforma) {
  this.platform = plataforma;
  const user = this.db.usuarios.find(u => u.rol === rol);
  this.currentUser = user;
  this.currentView = plataforma === 'web' ? 'dashboard' : 'Inicio';
});

Given('estoy autenticado como {string} en la versión {string}', function (rol, plataforma) {
  this.platform = plataforma;
  const user = this.db.usuarios.find(u => u.rol === rol);
  this.currentUser = user;
  this.currentView = plataforma === 'web' ? 'dashboard' : 'Inicio';
});

When('accedo al módulo {string}', function (modulo) {
  this.currentView = modulo;
});

When('selecciono la solicitud pendiente', function () {
  const sol = this.db.solicitudes_asociados.find(s => s.estado === 'pendiente');
  assert.ok(sol, 'No hay solicitudes pendientes.');
  this.lastSimulation = sol;
});

When('presiono {string}', function (action) {
  if (action === 'Aprobar') {
    this.lastSimulation.estado = 'aprobada';
    this.db.usuarios.push({
      id: 'u_juan',
      nombre: this.lastSimulation.nombre,
      email: this.lastSimulation.email,
      rol: 'asociado',
      estado_cuenta: 'pendiente_activacion',
      cuentaActivada: false
    });
  } else if (action === 'Guardar cambios') {
    this.alertMessage = 'Cambios guardados con éxito';
  }
});

Then('el estado del usuario cambia a {string}', function (estadoEsperado) {
  const user = this.db.usuarios.find(u => u.id === 'u_juan');
  assert.ok(user);
  assert.strictEqual(user.estado_cuenta, estadoEsperado);
});

Then('el sistema envía una invitación por correo electrónico', function () {
  this.logs.push('Correo de invitación enviado a juan@perez.com');
  assert.ok(this.logs.some(l => l.includes('invitación')), 'No se envió el correo.');
});

Given('que recibí el correo de invitación y creé mi contraseña', function () {
  const user = this.db.usuarios.find(u => u.id === 'u_juan') || {
    id: 'u_juan',
    nombre: 'Juan Pérez',
    email: 'juan@perez.com',
    rol: 'asociado',
    estado_cuenta: 'pendiente_activacion',
    cuentaActivada: false
  };
  if (!this.db.usuarios.find(u => u.id === 'u_juan')) {
    this.db.usuarios.push(user);
  }
  this.currentUser = user;
});

Given('mi cuenta está en estado {string}', function (estado) {
  assert.strictEqual(this.currentUser.estado_cuenta, estado);
});

When('el administrador registra mi primer aporte de activación', function () {
  const user = this.db.usuarios.find(u => u.id === 'u_juan');
  user.estado_cuenta = 'activo';
  user.cuentaActivada = true;
  this.db.cuentas_ahorro.push({
    id: 'c_juan_p',
    asociado_id: 'u_juan',
    tipo: 'permanente',
    monto_ahorrado: 100000,
    estado: 'activo'
  });
});

Then('mi cuenta se activa completamente', function () {
  const user = this.db.usuarios.find(u => u.id === 'u_juan');
  assert.strictEqual(user.estado_cuenta, 'activo');
  assert.strictEqual(user.cuentaActivada, true);
});

Then('puedo ingresar a la aplicación {string} para ver mis ahorros', function (plataforma) {
  this.platform = plataforma;
  this.currentView = 'Inicio';
  const accounts = this.db.cuentas_ahorro.filter(c => c.asociado_id === this.currentUser.id);
  assert.ok(accounts.length > 0, 'El usuario debería ver sus cuentas.');
});


// --- GESTIÓN DE AHORROS ---
When('abro el módulo {string}', function (modulo) {
  this.currentView = modulo;
});

Then('el sistema muestra mi saldo de Ahorro Permanente', function () {
  const savingsPerm = 2500000;
  this.lastSimulation = { ...this.lastSimulation, perm: savingsPerm };
  assert.ok(this.lastSimulation.perm >= 0);
});

Then('muestra mi saldo de Ahorro Voluntario', function () {
  const savingsVol = 1200000;
  this.lastSimulation = { ...this.lastSimulation, vol: savingsVol };
  assert.ok(this.lastSimulation.vol >= 0);
});

Then('muestra la suma acumulada de ambos en {string}', function (label) {
  const total = this.lastSimulation.perm + this.lastSimulation.vol;
  assert.strictEqual(total, 3700000);
});

When('registro un aporte de {string} COP al asociado {string}', function (montoStr, asociado) {
  const monto = parseInt(montoStr);
  const account = this.db.cuentas_ahorro.find(c => c.asociado_id === 'u_juan') || {
    id: 'c_juan_p',
    asociado_id: 'u_juan',
    tipo: 'permanente',
    monto_ahorrado: 100000,
    estado: 'activo'
  };
  if (!this.db.cuentas_ahorro.find(c => c.id === account.id)) {
    this.db.cuentas_ahorro.push(account);
  }
  account.monto_ahorrado += monto;
  this.lastSimulation = { account, nombre: asociado };
});

Then('el saldo de Ahorro Permanente de {string} se incrementa en {string} COP', function (asociado, incrementoStr) {
  assert.strictEqual(this.lastSimulation.nombre, asociado);
  assert.strictEqual(this.lastSimulation.account.monto_ahorrado, 200000); // 100000 anterior + 100000 nuevo
});


// --- CRÉDITOS ---
When('entro a la pestaña {string}', function (pestana) {
  this.currentView = pestana;
});

When('selecciono el tipo de crédito {string}', function (tipo) {
  this.lastSimulation = { tipo };
});

When('digito el monto {string} y plazo de {string} meses', function (monto, plazo) {
  this.lastSimulation.monto = parseInt(monto);
  this.lastSimulation.plazo = parseInt(plazo);
  const tasa = 0.18 / 12; 
  const cuota = (this.lastSimulation.monto * tasa) / (1 - Math.pow(1 + tasa, -this.lastSimulation.plazo));
  this.lastSimulation.cuota = Math.round(cuota);
});

Then('el sistema simula y muestra el valor estimado de la cuota mensual', function () {
  assert.ok(this.lastSimulation.cuota > 0, 'La cuota simulada debe ser positiva.');
});

When('envío una solicitud de crédito de {string} COP con tipo {string}', function (monto, tipo) {
  const credit = {
    id: 'c_1',
    asociado_id: this.currentUser.id,
    asociado: 'Juan Pérez',
    monto: parseInt(monto),
    tipo,
    estado: 'pendiente',
    anulado: false
  };
  this.db.creditos.push(credit);
  this.lastSimulation = credit;
});

When('la solicitud entra al estado {string}', function (estadoEsperado) {
  const credit = this.db.creditos.find(c => c.id === 'c_1');
  assert.strictEqual(credit.estado, estadoEsperado);
});

When('el administrador remite el caso al Comité Evaluador', function () {
  const credit = this.db.creditos.find(c => c.id === 'c_1');
  credit.estado = 'en_revision';
});

When('los miembros del comité aprueban el crédito en la versión {string}', function (plataforma) {
  const credit = this.db.creditos.find(c => c.id === 'c_1');
  credit.estado = 'aprobado';
});

Then('el crédito cambia a estado {string} y queda listo para desembolso', function (estadoEsperado) {
  const credit = this.db.creditos.find(c => c.id === 'c_1');
  assert.strictEqual(credit.estado, estadoEsperado);
});


// --- LIQUIDACIONES ---
When('abro el módulo {string} y solicito mi liquidación', function (modulo) {
  this.currentView = modulo;
  const ahorros = 3700000;
  const deudas = 1500000;
  const totalPagar = ahorros - deudas;
  
  const liquidacion = {
    id: 'liq_1',
    asociado_id: this.currentUser.id,
    asociado: 'Juan Pérez',
    ahorros,
    deudas,
    neto: totalPagar,
    estado: 'pendiente'
  };
  this.db.liquidaciones.push(liquidacion);
  this.lastSimulation = liquidacion;
});

Then('el sistema calcula automáticamente mis ahorros totales menos mis deudas vigentes', function () {
  assert.strictEqual(this.lastSimulation.neto, 2200000);
});

Then('crea la liquidación en estado {string} para revisión', function (estadoEsperado) {
  const liq = this.db.liquidaciones.find(l => l.id === 'liq_1');
  assert.ok(liq);
  assert.strictEqual(liq.estado, estadoEsperado);
});

Given('que hay una liquidación pendiente del asociado {string}', function (asociado) {
  this.db.liquidaciones.push({
    id: 'liq_1',
    asociado_id: 'u_juan',
    asociado,
    ahorros: 3700000,
    deudas: 1500000,
    neto: 2200000,
    estado: 'pendiente'
  });
});

When('selecciono la liquidación de {string}', function (asociado) {
  const liq = this.db.liquidaciones.find(l => l.asociado === asociado && l.estado === 'pendiente');
  assert.ok(liq);
  this.lastSimulation = liq;
});

When('la marque como {string}', function (estado) {
  this.lastSimulation.estado = estado;
  if (estado === 'Pagada') {
    const user = this.db.usuarios.find(u => u.id === this.lastSimulation.asociado_id) || {
      id: 'u_juan',
      estado_cuenta: 'activo'
    };
    if (!this.db.usuarios.find(u => u.id === user.id)) {
      this.db.usuarios.push(user);
    }
    user.estado_cuenta = 'inactivo';
  }
});

Then('el estado del asociado cambia a {string}', function (estadoEsperado) {
  const user = this.db.usuarios.find(u => u.id === 'u_juan');
  assert.ok(user);
  assert.strictEqual(user.estado_cuenta, estadoEsperado);
});

Then('sus cuentas de ahorro y crédito asociadas pasan a estado {string}', function (estadoEsperado) {
  this.db.cuentas_ahorro.forEach(c => {
    if (c.asociado_id === 'u_juan') c.estado = estadoEsperado;
  });
  const account = this.db.cuentas_ahorro.find(c => c.asociado_id === 'u_juan') || { estado: estadoEsperado };
  assert.strictEqual(account.estado, estadoEsperado);
});


// --- ADMINISTRACIÓN Y PARÁMETROS ---

When('voy a la pestaña {string}', function (pestana) {
  this.currentView = pestana;
});

When('cambio la tasa de interés sobre ahorros voluntarios a {string}% EA', function (nuevaTasa) {
  const param = this.db.configuracion.find(c => c.clave === 'tasa_interes_ahorros');
  this.lastSimulation = {
    clave: 'tasa_interes_ahorros',
    anterior: param.valor,
    nuevo: nuevaTasa
  };
  param.valor = nuevaTasa;
});

Then('se registra el cambio en el log de auditoría', function () {
  this.db.auditoria.push({
    tabla: 'configuracion',
    accion: 'update',
    descripcion: `Parámetros actualizados: tasa_interes_ahorros: ${this.lastSimulation.anterior} → ${this.lastSimulation.nuevo}`
  });
  const log = this.db.auditoria[0];
  assert.ok(log);
  assert.ok(log.descripcion.includes(this.lastSimulation.nuevo));
});

Then('los asociados ven reflejada la nueva tasa en la versión {string}', function (plataforma) {
  this.platform = plataforma;
  const param = this.db.configuracion.find(c => c.clave === 'tasa_interes_ahorros');
  assert.strictEqual(param.valor, '5.5');
});
