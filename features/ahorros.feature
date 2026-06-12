# language: es
Característica: Gestión de Ahorros Permanentes y Voluntarios
  Como asociado del fondo
  Quiero visualizar mis ahorros acumulados y solicitar aportes voluntarios
  Para llevar el control de mis finanzas desde la Web y el Móvil

  Escenario: Visualizar total de ahorros en la aplicación Móvil
    Dado que estoy autenticado como "asociado" en la versión "mobile"
    Cuando abro el módulo "Ahorros"
    Entonces el sistema muestra mi saldo de Ahorro Permanente
    Y muestra mi saldo de Ahorro Voluntario
    Y muestra la suma acumulada de ambos en "Total ahorros"

  Escenario: Registro de aporte mensual por Administrador en Web
    Dado que estoy autenticado como "admin" en la versión "web"
    Cuando accedo al módulo "Ahorro Permanente"
    Y registro un aporte de "100000" COP al asociado "Juan Pérez"
    Entonces el saldo de Ahorro Permanente de "Juan Pérez" se incrementa en "100000" COP
