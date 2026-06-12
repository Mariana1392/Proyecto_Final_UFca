# language: es
Característica: Gestión de Solicitud de Asociación a UFCA
  Como solicitante de ingreso al fondo de ahorro y crédito
  Quiero registrar mis datos y enviar mi solicitud de asociación
  Para ser evaluado y posteriormente activado como asociado activo en la plataforma Web y Móvil

  Escenario: Envío de solicitud de asociación en Web
    Dado que soy un visitante en el sitio web de UFCA
    Cuando completo el formulario de asociación con datos válidos
    Y adjunto los documentos requeridos
    Y presiono enviar solicitud
    Entonces el sistema registra mi solicitud con estado "pendiente"
    Y me muestra un mensaje de confirmación

  Escenario: Aprobación y activación de solicitud por Administrador
    Dado que un solicitante ha enviado una solicitud
    Y estoy autenticado como "admin" en la versión "web"
    Cuando accedo al módulo "Gestión de Usuarios"
    Y selecciono la solicitud pendiente
    Y presiono "Aprobar"
    Entonces el estado del usuario cambia a "pendiente_activacion"
    Y el sistema envía una invitación por correo electrónico

  Escenario: Activación de cuenta por primera cuota pagada
    Dado que recibí el correo de invitación y creé mi contraseña
    Y mi cuenta está en estado "pendiente_activacion"
    Cuando el administrador registra mi primer aporte de activación
    Entonces mi cuenta se activa completamente
    Y puedo ingresar a la aplicación "mobile" para ver mis ahorros
