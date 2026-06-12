# language: es
Característica: Autenticación de Usuarios en UFCA
  Como usuario del sistema (Asociado, Administrador o Solicitante)
  Quiero iniciar sesión, recuperar mi contraseña y cerrar sesión
  Para acceder a mis funcionalidades correspondientes de forma segura en Web y Móvil

  Antecedentes:
    Dado que el sistema de base de datos Supabase está activo

  Esquema del escenario: Inicio de sesión exitoso en la plataforma
    Dado que estoy en la pantalla de inicio de sesión en la versión "<plataforma>"
    Cuando ingreso mi correo "<correo>" y mi contraseña "<clave>"
    Y presiono el botón de ingresar
    Entonces inicio sesión correctamente
    Y el sistema me redirige al "<modulo_destino>"

    Ejemplos:
      | plataforma | correo                 | clave     | modulo_destino |
      | web        | admin@ufca.com         | Admin123  | dashboard      |
      | web        | asociado@ufca.com      | Asoc123   | dashboard      |
      | mobile     | admin_m@ufca.com       | Admin123  | Inicio         |
      | mobile     | asociado_m@ufca.com    | Asoc123   | Inicio         |

  Escenario: Recuperación de contraseña
    Dado que estoy en la pantalla de inicio de sesión en la versión "web"
    Cuando hago clic en "Recuperar contraseña"
    Y completo mi correo "asociado@ufca.com" y presiono enviar
    Entonces el sistema muestra un mensaje de correo de recuperación enviado
