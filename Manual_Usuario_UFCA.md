# Manual de Usuario Integral - Sistema UFCA
**Proyecto:** Unión Familiar de Ahorro y Crédito (UFCA)  
**Actividades:** 3.3.3 - Elaboración del Manual de Usuario Final  
**Elaborado por:**  
*   **Mariana Valencia Ospina** (Coordinadora de Documentación & Diseño Gráfico)  
*   **Dairo Montiel Tobar** (Redactor Técnico & Control de Calidad)  
**Institución:** Servicio Nacional de Aprendizaje (SENA)  
**Programa:** Análisis y Desarrollo de Software (ADSO)  
**Fecha de Aprobación:** 29 de junio de 2026  
**Versión:** 1.0.0  

---

## Glosario de Términos del Sistema UFCA
1.  **Asociado:** Miembro activo de la cooperativa familiar que tiene derecho a realizar ahorros, simular/solicitar créditos y participar en los beneficios colectivos.
2.  **Usuario Pendiente:** Persona que ha llenado el formulario de registro pero cuya asociación aún no ha sido aprobada ni activada en el sistema mediante el primer aporte.
3.  **Ahorro Permanente:** Cuota de ahorro obligatoria mensual definida por la asamblea de la cooperativa. Es la base para determinar la capacidad de crédito del asociado.
4.  **Ahorro Voluntario:** Depósitos discrecionales realizados por el asociado para incrementar su capital, los cuales generan un rendimiento por interés mensual.
5.  **Simulador de Crédito:** Herramienta interactiva que calcula la cuota mensual, el interés proyectado y el saldo amortizado según el monto y plazo solicitados.
6.  **Comité Evaluador:** Rol del sistema con permisos para revisar la capacidad de endeudamiento del asociado y decidir sobre la aprobación o rechazo de solicitudes de crédito.
7.  **Administrador:** Rol con control total del sistema, responsable de la asignación de roles, gestión de usuarios, auditoría y modificación de reglas de negocio operativas.
8.  **RLS (Row Level Security):** Mecanismo de PostgreSQL en Supabase que restringe los registros visibles para que un asociado solo acceda a su propia información financiera.

---

# SECCIÓN 1: MÓDULO DE REGISTRO Y ACCESO (FLUJOS PÚBLICOS)

Esta sección describe cómo un nuevo usuario solicita ingresar a UFCA, activa su cuenta y administra sus credenciales de seguridad.

---

### Guía Interactiva 1.1: Solicitud de Nueva Asociación
*Herramienta Tango: Grabado en la landing page pública.*

*   **Paso 1:** Ingrese a la URL pública oficial del sistema UFCA.
    *   *Captura de pantalla:* `[Vista: Home / Landing Page de Bienvenida]`
    *   *Descripción:* Se muestra el banner principal de UFCA con opciones de ingreso.
    *   *Acción:* Haga clic en el botón **"Solicitar Asociación"** ubicado en el centro de la pantalla.
*   **Paso 2:** Diligencie el formulario de pre-registro.
    *   *Captura de pantalla:* `[Vista: Formulario de Solicitud de Asociación]`
    *   *Descripción:* Formulario modal con campos de datos personales.
    *   *Acciones:*
        1. Escriba su **Nombre Completo** en el primer campo de texto.
        2. Escriba su **Cédula de Ciudadanía** (solo números).
        3. Escriba su número de **Teléfono Móvil** de contacto.
        4. Escriba su **Correo Electrónico** (debe ser un correo válido y activo).
        5. Escriba su **Dirección Residencial**.
*   **Paso 3:** Envíe la postulación.
    *   *Captura de pantalla:* `[Vista: Botón de Envío]`
    *   *Acción:* Haga clic en el botón **"Enviar Solicitud"** en la parte inferior del formulario.
    *   *Mensaje del sistema:* Se desplegará una alerta flotante (*toast*) en la esquina superior derecha indicando: *"Solicitud enviada con éxito. Un administrador revisará su información."*

---

### Guía Interactiva 1.2: Activación de Cuenta y Creación de Contraseña
*Herramienta Tango: Grabado a partir del enlace de correo de invitación.*

> [!NOTE]
> Este flujo se inicia una vez el Administrador aprueba al usuario y el sistema envía automáticamente una invitación por correo electrónico a través de Supabase Auth y el servicio Resend.

*   **Paso 1:** Abra su bandeja de correo electrónico personal.
    *   *Descripción:* Localice el correo remitido por `noreply@ufca.app` con el asunto *"Invitación a unirse a la plataforma UFCA"*.
    *   *Acción:* Abra el correo y haga clic en el botón interactivo **"Activar mi Cuenta"**.
*   **Paso 2:** Redirección automática a la plataforma.
    *   *Captura de pantalla:* `[Vista: Crear Contraseña - /?bienvenido=1]`
    *   *Descripción:* La plataforma detectará el token de invitación en la URL y mostrará el formulario exclusivo de creación de credenciales.
*   **Paso 3:** Defina su contraseña de acceso seguro.
    *   *Captura de pantalla:* `[Vista: Formulario de Nueva Contraseña]`
    *   *Acciones:*
        1. Escriba su contraseña deseada en el campo **"Nueva Contraseña"** (mínimo 6 caracteres).
        2. Escriba exactamente la misma contraseña en el campo **"Confirmar Contraseña"**.
        3. Haga clic en el botón **"Guardar y Acceder"**.
    *   *Mensaje del sistema:* *"Contraseña establecida. Bienvenido a UFCA."* El sistema iniciará su sesión automáticamente y lo redireccionará al Dashboard del Asociado.

---

### Guía Interactiva 1.3: Recuperación de Contraseña
*Herramienta Tango: Grabado desde el panel de Login.*

*   **Paso 1:** Acceda a la pantalla de Login y solicite ayuda.
    *   *Captura de pantalla:* `[Vista: Login - Botón ¿Olvidó su contraseña?]`
    *   *Acción:* Haga clic en el enlace **"¿Olvidó su contraseña?"** situado debajo del botón de ingreso.
*   **Paso 2:** Proporcione su correo registrado.
    *   *Captura de pantalla:* `[Vista: Formulario Recuperar Password]`
    *   *Acción:* Escriba su correo en el campo **"Correo Electrónico"** y haga clic en **"Enviar Enlace de Recuperación"**.
*   **Paso 3:** Use el enlace de restablecimiento.
    *   *Descripción:* Abra el correo recibido y haga clic en el enlace. Este lo redireccionará a la pantalla `restablecer-password`.
    *   *Acción:* Escriba su nueva contraseña en los campos correspondientes y presione **"Restablecer Contraseña"** para completar el flujo.

---

# SECCIÓN 2: MÓDULO DEL ASOCIADO (AUTOGESTIÓN FINANCIERA)

Este módulo está diseñado para que el asociado consulte sus saldos, realice el seguimiento de sus ahorros permanentes y voluntarios, simule créditos y presente solicitudes formales de financiamiento.

---

### Guía Interactiva 2.1: Navegación por el Dashboard de Asociado
*Herramienta Tango: Grabado en la sesión de asociado activo.*

*   **Paso 1:** Visualice el resumen global financiero.
    *   *Captura de pantalla:* `[Vista: Dashboard Asociado - Tarjetas de Resumen]`
    *   *Descripción:* Se presentan tres tarjetas principales superiores:
        1.  **Ahorro Permanente:** Muestra el acumulado histórico de las cuotas mensuales.
        2.  **Ahorro Voluntario:** Muestra el acumulado de depósitos voluntarios libres.
        3.  **Saldo Pendiente Créditos:** Muestra la deuda actual consolidada de préstamos aprobados.
*   **Paso 2:** Revise el estado de su cuenta.
    *   *Descripción:* Si su cuenta está marcada como *"Pendiente de Activación"* (debido a que falta el pago de la cuota de afiliación inicial), verá un banner informativo de color naranja que bloquea el acceso a ahorros voluntarios y créditos hasta que se registre dicho abono inicial.

---

### Guía Interactiva 2.2: Consulta de Ahorros
*Herramienta Tango: Grabado en la vista "Mis Ahorros".*

*   **Paso 1:** Ingrese a la vista de ahorros personales.
    *   *Captura de pantalla:* `[Menú Lateral -> Mis Ahorros]`
    *   *Acción:* En el menú lateral de la aplicación, haga clic en la opción **"Mis Ahorros"**.
*   **Paso 2:** Navegue por las pestañas de Ahorro Permanente y Voluntario.
    *   *Captura de pantalla:* `[Vista de Mis Ahorros con pestañas 'Ahorro Permanente' y 'Ahorro Voluntario']`
    *   *Acción:* Seleccione la pestaña **"Ahorro Permanente"** para auditar sus aportes obligatorios periódicos, o **"Ahorro Voluntario"** para examinar depósitos o retiros adicionales.
*   **Paso 3:** Analice el historial de transacciones.
    *   *Captura de pantalla:* `[Tabla de Transacciones de Ahorro]`
    *   *Descripción:* Tabla detallada con columnas: *Fecha, Tipo de Movimiento (Aporte, Retiro, Interés), Monto, Método de Pago, Descripción, y Saldo Acumulado*.

---

### Guía Interactiva 2.3: Simulación y Solicitud de Crédito
*Herramienta Tango: Grabado en la vista "Mis Créditos".*

*   **Paso 1:** Abra el módulo de créditos para asociados.
    *   *Captura de pantalla:* `[Menú Lateral -> Créditos]`
    *   *Acción:* Haga clic en **"Créditos"** en el menú lateral.
*   **Paso 2:** Simule un crédito antes de solicitarlo.
    *   *Captura de pantalla:* `[Vista: Simulador de Créditos / Botón Nueva Simulación]`
    *   *Acción:* Haga clic en el botón **"Nueva Simulación"**.
    *   *Acciones en el Simulador:*
        1. Seleccione el **Tipo de Crédito** (ej. Ordinario, Emergencia, Vivienda).
        2. Escriba el **Monto Solicitado** (ej. `2,000,000`).
        3. Escriba el **Plazo en Meses** (ej. `12` meses).
        4. Observe cómo el simulador muestra en tiempo real la tasa de interés aplicable (ej. `1.2%` mensual) y el valor calculado de la cuota mensual aproximada.
*   **Paso 3:** Solicite formalmente el crédito.
    *   *Captura de pantalla:* `[Vista: Formulario de Solicitud de Crédito]`
    *   *Descripción:* Si la simulación es correcta, el asociado puede presionar el botón **"Solicitar Crédito"** para transferir los datos al formulario formal.
    *   *Acciones adicionales:*
        1. Escriba el **Destino del Crédito** (ej. *"Gastos médicos"*).
        2. Escriba la **Garantía** (ej. *"Aportes permanentes"*).
        3. Adjunte soportes si es requerido y haga clic en **"Confirmar y Enviar Solicitud"**.
    *   *Mensaje del sistema:* *"Solicitud de crédito ingresada en estado 'Pendiente' para evaluación del comité."*

---

# SECCIÓN 3: MÓDULO DE ADMINISTRACIÓN (GESTIÓN Y CONTROL)

Este módulo está destinado exclusivamente a los usuarios con rol de Administrador. Permite la administración de cuentas, la alteración de parámetros operacionales y el control financiero global de la cooperativa.

---

### Guía Interactiva 3.1: Gestión de Usuarios y Asignación de Roles
*Herramienta Tango: Grabado en "Gestión de Usuarios".*

*   **Paso 1:** Navegue a la administración de usuarios del sistema.
    *   *Captura de pantalla:* `[Menú Lateral -> Gestión de Usuarios]`
    *   *Acción:* Haga clic en la opción **"Gestión de Usuarios"**.
*   **Paso 2:** Active un asociado nuevo tras su primer aporte.
    *   *Captura de pantalla:* `[Fila del usuario con botón 'Activar Cuenta' o 'Registrar Primer Aporte']`
    *   *Descripción:* Los nuevos asociados aparecen con un estado de activación pendiente.
    *   *Acción:* Haga clic sobre el registro del asociado y seleccione **"Registrar Activación"**, ingresando el valor correspondiente a su cuota de afiliación inicial.
*   **Paso 3:** Modifique roles y permisos de usuarios.
    *   *Captura de pantalla:* `[Formulario modal Editar Rol]`
    *   *Acción:* Haga clic en el botón **"Editar"** (icono de lápiz) en la fila del usuario deseado. Seleccione el nuevo rol en el menú desplegable (ej. cambiar de *"Usuario"* a *"Asociado"* o *"Comité Evaluador"*) y presione **"Guardar Cambios"**.

---

### Guía Interactiva 3.2: Configuración de Reglas de Negocio
*Herramienta Tango: Grabado en la vista "Configuración del Sistema".*

*   **Paso 1:** Ingrese al panel de control de parámetros del negocio.
    *   *Captura de pantalla:* `[Menú Lateral -> Configuración]`
    *   *Acción:* Seleccione la opción **"Configuración"** en el menú de navegación administrativo.
*   **Paso 2:** Modifique los parámetros operativos.
    *   *Captura de pantalla:* `[Vista: Reglas de Negocio del Fondo de Ahorro]`
    *   *Descripción:* Se listan campos editables que definen el comportamiento financiero del sistema:
        *   *Tasa de Interés de Créditos (%)*
        *   *Tasa de Interés de Ahorro Voluntario (%)*
        *   *Monto Máximo de Crédito en relación al Ahorro Permanente (ej. 3 veces el saldo ahorrado).*
        *   *Plazo Máximo en Meses.*
*   **Paso 3:** Guarde y aplique los cambios globales.
    *   *Acción:* Modifique el valor de la tasa de interés (ej. cambiar de `1.5` a `1.2`) y haga clic en **"Guardar Reglas de Negocio"**.
    *   *Impacto del sistema:* Las nuevas solicitudes y simulaciones utilizarán de inmediato los parámetros actualizados.

---

### Guía Interactiva 3.3: Generación y Exportación de Reportes Financieros
*Herramienta Tango: Grabado en "Reportes".*

*   **Paso 1:** Diríjase al módulo de informes consolidados.
    *   *Captura de pantalla:* `[Menú Lateral -> Reportes]`
    *   *Acción:* Haga clic en la opción **"Reportes"**.
*   **Paso 2:** Seleccione y filtre los datos.
    *   *Captura de pantalla:* `[Vista de Reportes - Filtros de Fecha y Tipo]`
    *   *Acciones:*
        1. Seleccione el tipo de informe deseado (ej. *"Consolidado de Ahorros"*, *"Cartera de Créditos"*).
        2. Ingrese el rango de fechas para el análisis (Fecha Inicio - Fecha Fin).
*   **Paso 3:** Exporte a los formatos deseados.
    *   *Captura de pantalla:* `[Botones de Exportación PDF / Excel]`
    *   *Acciones:*
        *   Haga clic en el botón **"Exportar a Excel"** para descargar una hoja de cálculo estructurada mediante *ExcelJS*.
        *   Haga clic en el botón **"Exportar a PDF"** para descargar un informe corporativo formateado con *jsPDF*.

---

# SECCIÓN 4: MÓDULO DEL COMITÉ EVALUADOR (APROBACIÓN DE CRÉDITOS)

Esta sección orienta a los miembros del Comité Evaluador sobre cómo revisar las solicitudes financieras y registrar el flujo de aprobación y posterior desembolso.

---

### Guía Interactiva 4.1: Evaluación de Solicitudes de Crédito Pendientes
*Herramienta Tango: Grabado en la cuenta del Comité Evaluador.*

*   **Paso 1:** Ingrese a la bandeja de evaluación.
    *   *Captura de pantalla:* `[Menú Lateral -> Comité Evaluador]`
    *   *Acción:* Haga clic en la opción **"Comité Evaluador"**.
*   **Paso 2:** Revise los antecedentes y balances del solicitante.
    *   *Captura de pantalla:* `[Tabla de Solicitudes Pendientes con botón 'Evaluar']`
    *   *Acción:* Localice la solicitud en estado *"Pendiente"* y haga clic en el botón **"Evaluar"**.
*   **Paso 3:** Analice la viabilidad financiera.
    *   *Captura de pantalla:* `[Modal de Evaluación de Crédito]`
    *   *Descripción:* El sistema presenta de forma automática:
        *   El monto solicitado por el asociado.
        *   El saldo total acumulado en su **Ahorro Permanente**.
        *   Una validación de regla de negocio que verifica si el monto solicitado supera el límite permitido (ej. 300% de sus ahorros permanentes).

---

### Guía Interactiva 4.2: Decisión del Comité y Registro de Desembolso
*Herramienta Tango: Continuación del modal de evaluación.*

*   **Paso 1:** Registre la aprobación o el rechazo de la solicitud.
    *   *Acciones:*
        *   Si el asociado cumple con todos los requisitos, haga clic en el botón verde **"Aprobar Crédito"**.
        *   Si el asociado no posee capacidad suficiente o no cumple las reglas, escriba la justificación en el campo *"Observaciones"* y haga clic en el botón rojo **"Rechazar Crédito"**.
*   **Paso 2:** Registre el desembolso físico/electrónico de fondos.
    *   *Captura de pantalla:* `[Modal de Registro de Desembolso para créditos Aprobados]`
    *   *Descripción:* Una vez aprobado, el crédito pasa a estado *"Aprobado"* pero requiere confirmación de entrega de dinero.
    *   *Acciones:*
        1. Seleccione la solicitud aprobada.
        2. Haga clic en **"Registrar Desembolso"**.
        3. Ingrese la **Fecha de Desembolso**, el **Método de Transferencia** (ej. *"Transferencia Bancaria"*) y el **Número de Referencia** de la transacción bancaria.
        4. Haga clic en **"Confirmar Desembolso"**.
    *   *Impacto del sistema:* El estado del crédito cambia automáticamente a **"En pago"** y el saldo total de la deuda del asociado se actualiza, habilitando el cálculo de amortización y permitiendo registrar los pagos mensuales futuros.

---

# SECCIÓN 5: PLAN DE USABILIDAD Y VALIDACIÓN CRUZADA

De acuerdo con la **Acción 5 del plan de trabajo**, es indispensable realizar una evaluación de usabilidad del manual para certificar que cumpla con los estándares de adopción tecnológica requeridos.

### Protocolo de Evaluación de Usabilidad:
1.  **Selección de Usuarios de Prueba:**  
    Seleccionar a 3 personas ajenas al desarrollo del software (por ejemplo, familiares de la familia cooperativa que representen al usuario final *"Asociado"*).
2.  **Entrega del Borrador:**  
    Proporcionar a los usuarios de prueba las guías interactivas de Tango del Módulo de Asociado.
3.  **Ejecución Autónoma de Tareas (Sin Asistencia):**  
    Pedir a cada usuario que complete de manera autónoma las siguientes tareas usando únicamente las instrucciones del manual:
    *   *Tarea A:* Registrar una nueva solicitud de asociación.
    *   *Tarea B:* Ingresar al sistema y consultar su saldo de Ahorro Permanente.
    *   *Tarea C:* Realizar la simulación de un crédito por $1,500,000 a 6 meses.
4.  **Medición de Indicadores de Éxito:**  
    Calcular la tasa de efectividad utilizando la fórmula del indicador de usabilidad definido en el plan de trabajo:
    $$\text{Tasa de Efectividad} = \frac{\text{Usuarios de prueba que completan las tareas sin asistencia}}{\text{Total de usuarios de prueba}} \times 100$$
    *El estándar de aceptación del proyecto es del $\ge 90\%$. Si un usuario requiere asistencia o encuentra una instrucción confusa, se documentará el paso conflictivo para su posterior ajuste en la fase de retroalimentación (Acción 6).*
