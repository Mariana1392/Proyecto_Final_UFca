# language: es
Característica: Simulación y Solicitud de Créditos
  Como asociado activo
  Quiero simular cuotas de crédito y enviar una solicitud
  Para obtener financiación desde la versión Web o Móvil

  Escenario: Simulación de crédito en la aplicación Móvil
    Dado que estoy autenticado como "asociado" en la versión "mobile"
    Cuando entro a la pestaña "Créditos"
    Y selecciono el tipo de crédito "Libre inversión"
    Y digito el monto "1500000" y plazo de "12" meses
    Entonces el sistema simula y muestra el valor estimado de la cuota mensual

  Escenario: Envío y aprobación de solicitud de crédito por Comité
    Dado que estoy autenticado como "asociado" en la versión "mobile"
    Cuando envío una solicitud de crédito de "1500000" COP con tipo "Libre inversión"
    Y la solicitud entra al estado "pendiente"
    Y el administrador remite el caso al Comité Evaluador
    Y los miembros del comité aprueban el crédito en la versión "web"
    Entonces el crédito cambia a estado "aprobado" y queda listo para desembolso
