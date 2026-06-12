# language: es
Característica: Proceso de Liquidación de Asociado
  Como asociado que desea retirarse
  Quiero solicitar mi liquidación para recibir mis fondos acumulados
  Para formalizar mi retiro de la cooperativa en Web y Móvil

  Escenario: Solicitud de liquidación y cálculo de saldo
    Dado que estoy autenticado como "asociado" en la versión "mobile"
    Cuando abro el módulo "Liquidaciones" y solicito mi liquidación
    Entonces el sistema calcula automáticamente mis ahorros totales menos mis deudas vigentes
    Y crea la liquidación en estado "pendiente" para revisión

  Escenario: Aprobación y pago de liquidación por Administrador
    Dado que hay una liquidación pendiente del asociado "Juan Pérez"
    Y estoy autenticado como "admin" en la versión "web"
    Cuando accedo al módulo "Liquidaciones"
    Y selecciono la liquidación de "Juan Pérez"
    Y la marque como "Pagada"
    Entonces el estado del asociado cambia a "inactivo"
    Y sus cuentas de ahorro y crédito asociadas pasan a estado "liquidado"
