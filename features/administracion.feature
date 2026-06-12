# language: es
Característica: Administración y Parámetros Operativos del Sistema
  Como administrador del fondo
  Quiero modificar las tasas de interés y límites del negocio
  Para asegurar la estabilidad del fondo de ahorro y crédito en la versión Web y Móvil

  Escenario: Modificar parámetros operativos y verificar actualización en Móvil
    Dado que estoy autenticado como "admin" en la versión "web"
    Cuando accedo al módulo "Gestión de Roles"
    Y voy a la pestaña "Parámetros"
    Y cambio la tasa de interés sobre ahorros voluntarios a "5.5"% EA
    Y presiono "Guardar cambios"
    Entonces se registra el cambio en el log de auditoría
    Y los asociados ven reflejada la nueva tasa en la versión "mobile"
