# Summary of User Stories (HUs) and Acceptance Criteria (CAs)

Total HUs: 75

## HU_01: Yo como Administrador quiero registrar los roles para poder guardar el registro de los roles disponibles

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_01_01 | No debe existir más de un registro de rol con el mismo nombre | Realizado |
| CA_01_02 | El registro de roles no se guardará si no se han completado todos los campos obligatorios. | Realizado |
| CA_01_03 | Si ocurre un error durante el registro (por ejemplo, falta información, duplicado, etc.), se debe mostrar un mensaje claro de error al usuario. | Realizado |

---

## HU_02: Yo como Administrador quiero buscar los roles para poder encontrar los roles disponibles

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_02_01 | Al realizar la búsqueda, solo se deben mostrar roles que realmente existen y estén disponibles, sin duplicados ni roles eliminados. | Realizado |
| CA_02_02 | El sistema debe permitir la búsqueda por nombre y mostrar los resultados rápidamente. | Realizado |
| CA_02_03 | Si no se encuentra ningún rol con los criterios de búsqueda, se debe mostrar un mensaje indicando que no hay resultados disponibles. | Realizado |

---

## HU_03: Yo como Administrador quiero editar los roles para poder realizar modificaciones a los roles actuales

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_03_01 | El sistema debe permitir modificar los datos del rol (nombre, descripción, permisos, estado, etc.) y guardar los cambios correctamente. | Realizado |
| CA_03_02 | No se debe permitir que, tras la edición, existan dos roles con el mismo nombre o identificador dentro del sistema. | Realizado |
| CA_03_03 | Al guardar los cambios, el sistema debe mostrar un mensaje de confirmación de éxito; si ocurre un error (datos inválidos, duplicados, campos obligatorios vacíos), se debe mostrar un mensaje claro de error indicando el problema. | Realizado |

---

## HU_04: Yo como Administrador necesito Cambiar el estado de los roles para poder activar o desactivar los roles

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_04_01 | El sistema debe permitir cambiar el estado de un rol entre activo e inactivo, sin borrar su información.  Excepto roles protegidos | Realizado |
| CA_04_02 | No se debe poder desactivar roles que estén marcados como obligatorios para el funcionamiento mínimo del sistema (por ejemplo, Administrador). | Realizado |
| CA_04_03 | Al cambiar el estado de un rol, el sistema debe mostrar un mensaje de confirmación y registrar la fecha y usuario que realizó el cambio. | Realizado |

---

## HU_05: Yo como Administrador necesito Listar los roles  para poder organizar la visualizacion de los roles en su orden impuesto

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_05_01 | El sistema debe mostrar un listado con todos los roles registrados, indicando como mínimo nombre, estado (activo/inactivo). | Realizado |
| CA_05_02 | El listado de roles debe estar ordenado según el criterio definido (por ejemplo, por nombre o prioridad) y permitir paginación o scroll si la cantidad es  superior a 5 registros | Realizado |
| CA_05_03 | Cuando el usuario cree un rol con datos válidos y completos, el sistema debe almacenarlo correctamente y reflejarlo en el listado de roles. | Realizado |

---

## HU_06: Yo como Administrador necesito Ver detalles de lo roles para poder ver la informacion de cada rol registrado

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_06_01 | Al seleccionar un rol de la lista, el sistema debe mostrar una pantalla o ventana con toda la información registrada del rol (nombre, descripción, permisos asociados, estado, fecha de creación/modificación). | Realizado |
| CA_06_02 | Solo usuarios con permisos de Administrador podrán acceder a la vista de detalles de roles. | Realizado |
| CA_06_03 | La vista de detalles de un rol presenta en una sola pantalla los datos generales del rol (nombre, descripción, estado, tipo, fechas y cantidad de usuarios asignados), la gestión de permisos (agregar o quitar permisos individualmente). | Realizado |

---

## HU_07: Yo como Administrador quiero eliminar los roles  para poder mantener actualizado el sistema y evitar roles que ya no se utilicen

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_07_01 | El sistema debe permitir eliminar un rol solo si este no está asociado a usuarios activos o a procesos críticos. | Realizado |
| CA_07_02 | Antes de eliminar un rol, el sistema debe solicitar confirmación al usuario mediante un mensaje de advertencia. | Realizado |
| CA_07_03 | Una vez eliminado el rol, este no debe aparecer en listados operativos y se debe registrar en un log de auditoría la acción realizada. | Realizado |

---

## HU_08: Yo como Administrador necesito Listar permisos de los roles para poder visualizar qué acciones tiene permitido realizar cada rol dentro del sistema

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_08_01 | Al seleccionar un rol, el sistema debe mostrar la lista de permisos que tiene asignados (funciones o módulos a los que puede acceder). | Realizado |
| CA_08_02 | La lista de permisos debe ser clara e indicar, para cada permiso, el tipo de acción permitida (ver, crear, editar, eliminar, etc.). | Realizado |
| CA_08_03 | Si el rol no tiene permisos asignados, el sistema debe mostrar un mensaje indicándolo. | Realizado |

---

## HU_09: Yo como Administrador necesito agregar permisos de los roles para poder definir qué acciones puede realizar cada rol.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_09_01 | El sistema debe permitir seleccionar uno o varios permisos disponible y asignarlos a un rol sin duplicar permisos ya existentes. | Realizado |
| CA_09_02 | No se podrán guardar los cambios si no se selecciona al menos un permiso o si se produce algún conflicto de permisos; en ese caso, se mostrará un mensaje de error claro. | Realizado |
| CA_09_03 | Al agregar permisos correctamente, el sistema debe mostrar un mensaje de éxito y actualizar de inmediato la lista de permisos asociados al rol. | Realizado |

---

## HU_10: Yo como Administrador necesito eliminar permisos de los roles para poder restringir acciones que un rol ya no debe realizar.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_10_01 | El sistema debe permitir eliminar uno o varios permisos de un rol sin afectar otros permisos asociados. | Realizado |
| CA_10_02 | No se debe permitir eliminar permisos si esto deja al rol sin ningún acceso mínimo requerido para operar (según reglas del negocio). | Realizado |
| CA_10_03 | Al eliminar permisos, el sistema debe pedir confirmación y mostrar un mensaje de éxito o error según el resultado. | Realizado |

---

## HU_11: Yo como Administrador quiero registrar los usuarios para poder permitirles el acceso al sistema de acuerdo a sus roles

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_11_01 | El sistema debe permitir registrar usuarios nuevos con datos obligatorios como nombre, identificación, nombre de usuario, contraseña y rol asignado. | Realizado |
| CA_11_02 | No se podrá registrar un usuario con un nombre de usuario o identificación que ya exista en el sistema. | Realizado |
| CA_11_03 | Al guardar el registro exitosamente, se debe mostrar un mensaje de confirmación y el nuevo usuario debe quedar disponible para iniciar sesión según su rol. | Realizado |

---

## HU_12: Yo como Administrador quiero Asignar Rol al usuario para poder controlar el nivel de acceso que tiene cada usuario dentro del sistema

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_12_01 | El sistema debe permitir asignar uno de los roles disponibles (Administrador, Asociado) a un usuario al momento de su registro o desde la edición de su perfil. | Realizado |
| CA_12_02 | Solo se podrá asignar un rol activo por usuario a la vez; al modificar el rol, el sistema debe reflejar los nuevos permisos de forma inmediata sin necesidad de que el usuario cierre sesión. | Realizado |
| CA_12_03 | Al guardar el rol asignado exitosamente, el sistema debe mostrar un mensaje de confirmación y el usuario debe poder acceder únicamente a las funcionalidades correspondientes al rol que le fue asignado. | Realizado |

---

## HU_13: Yo como Administrador quiero buscar los usuarios para poder ubicarlos facilmente dentro del sistema

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_13_01 | El sistema debe permitir buscar usuarios por al menos uno de estos criterios: nombre, identificación, nombre de usuario o rol. | Realizado |
| CA_13_02 | El resultado de la búsqueda debe mostrar la lista de usuarios que coincidan, con datos básicos como nombre, usuario, rol y estado. | Realizado |
| CA_13_03 | Si no se encuentra ningún usuario con los criterios ingresados, se debe mostrar un mensaje indicando que no hay resultados. | Realizado |

---

## HU_14: Yo como Administrador necesito editar los usuarios para poder actualizar su información cuando sea necesario

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_14_01 | El sistema debe permitir modificar los datos de un usuario (por ejemplo, correo, rol, estado), respetando campos obligatorios y validaciones. | Realizado |
| CA_14_02 | No se debe permitir cambiar el nombre de usuario o identificación a uno que ya exista en otro usuario. | Realizado |
| CA_14_03 | Al guardar los cambios, se debe mostrar un mensaje de éxito; si la validación falla, se debe mostrar un mensaje de error sin aplicar cambios. | Realizado |

---

## HU_15: Yo como Administrador necesito cambiar el estado de los usuarios para poder activar o desactivar su acceso al sistema

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_15_01 | El sistema debe permitir cambiar el estado de un usuario entre activo e inactivo sin eliminar su información. | Realizado |
| CA_15_02 | Los usuarios en estado inactivo no podrán iniciar sesión ni realizar acciones en el sistema. | Realizado |
| CA_15_03 | Cada cambio de estado debe registrarse con fecha, hora y usuario administrador que realizó la acción. | Realizado |

---

## HU_16: Yo como Administrador quiero Listar los usuarios para poder visualizar su información general dentro del sistema

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_16_01 | El sistema debe mostrar un listado de todos los usuarios con información básica: nombre, usuario, rol y estado. | Realizado |
| CA_16_02 | El listado debe permitir ordenar o filtrar por al menos uno de los criterios: rol o estado. | Realizado |
| CA_16_03 | Si no hay usuarios registrados, se debe mostrar un mensaje indicando que no existen usuarios en el sistema. | Realizado |

---

## HU_17: Yo como Administrador necesito Ver detalles de los usuarios para poder visualizar informacion mas detallada de cada usuario

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_17_01 | Al seleccionar un usuario del listado, el sistema debe mostrar toda su información registrada, incluyendo datos personales, rol, estado y fecha de creación/modificación. | Realizado |
| CA_17_02 | Solo administradores o usuarios con permisos específicos podrán acceder a los detalles completos de otros usuarios. | Realizado |
| CA_17_03 | La vista de detalle del usuario debe presentar la información de forma legible, estructurada y fácil de consultar para facilitar la validación de sus datos. | Realizado |

---

## HU_18: Yo como Administrador necesito eliminar usuarios para poder mantener el sistema limpio y seguro de usuarios inexistentes

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_18_01 | El sistema debe permitir eliminar usuarios solo si no están asociados a procesos críticos activos, según las reglas del negocio. | Realizado |
| CA_18_02 | Antes de eliminar un usuario, el sistema debe mostrar un mensaje de confirmación con advertencia de que la acción es irreversible. | Realizado |
| CA_18_03 | Una vez eliminado, el usuario no debe poder iniciar sesión ni aparecer en listados operativos, y la acción debe quedar registrada. | Realizado |

---

## HU_19: Yo como Usuario necesito Iniciar sesion  para poder ingresar al sistema de una manera mas segura y confiable

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_19_01 | El sistema debe permitir que un usuario inicie sesión ingresando sus credenciales (correo y contraseña). | Realizado |
| CA_19_02 | Si las credenciales son incorrectas o el usuario está inactivo, el sistema debe impedir el acceso y mostrar un mensaje claro de error. | Realizado |
| CA_19_03 | Al iniciar sesión correctamente, el sistema debe redirigir al usuario a la pantalla principal correspondiente a su rol y registrar la fecha . | Realizado |

---

## HU_20: Yo como Usuario quiero cerrar sesion para poder mantenr mis datos personales seguros

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_20_01 | El sistema debe permitir al usuario cerrar sesión desde cualquier pantalla mediante una opción visible. | Realizado |
| CA_20_02 | Al cerrar sesión, se debe invalidar la sesión activa y redirigir al usuario a la pantalla de inicio de sesión. | Realizado |
| CA_20_03 | Si el usuario intenta acceder a recursos protegidos después de cerrar sesión, el sistema debe solicitar nuevamente autenticación. | Realizado |

---

## HU_21: Yo como Usuario quiero Recuperar contraseña para poder acceder nuevamente al sistema en caso de olvidarla

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_21_01 | El sistema debe permitir al usuario solicitar recuperación de contraseña con su correo registrado | Realizado |
| CA_21_02 | El sistema debe enviar un enlace o código de recuperación válido por un tiempo limitado. | Realizado |
| CA_21_03 | El sistema debe enviar un enlace o código de recuperación válido por un tiempo limitado. | Realizado |

---

## HU_22: Yo como Administrador quiero registrar los ahorros permanentes para poder dar inicio al plan de ahorro obligatorio de los asociados

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_22_01 | El sistema permite registrar el monto obligatorio del plan de ahorro permanente | Realizado |
| CA_22_02 | El registro se asocia a un miembro existente y tiene una fecha de inicio del ahorro permanente | Realizado |
| CA_22_03 | El Administrador puede cargar el saldo inicial del ahorro permanente | Realizado |

---

## HU_23: Yo como Administrador necesito buscar los ahorros permanentes para poder encontrar rápidamente el registro de ahorro de un asociado en específico.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_23_01 | La búsqueda encuentra registros por nombre, cédula | Realizado |
| CA_23_02 | El resultado muestra el saldo actual y la fecha de inicio del plan | Realizado |
| CA_23_03 | La búsqueda debe ser rápida y precisa | Realizado |

---

## HU_24: Yo como Administrador necesito listar los ahorros permanentes para poder visualizar la totalidad de los planes de ahorro permanentes activos

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_24_01 | El sistema muestra un listado completo de todos los planes de ahorro permanentes activos | Realizado |
| CA_24_02 | La lista incluye el nombre del asociado, el saldo y la fecha de inicio | Realizado |
| CA_24_03 | El Administrador puede ordenar la lista por saldo o antigüedad | Realizado |

---

## HU_25: Yo como Administrador necesito ver detalles de los ahorros permanentes para poder consultar el saldo, las transacciones y el estado actual de cada plan de ahorro

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_25_01 | La vista de detalle muestra el saldo actual del plan de ahorro | Realizado |
| CA_25_02 | Se presenta el historial completo de transacciones (depósitos) a los ahorros permanentes | Realizado |
| CA_25_03 | La vista indica el estado actual del plan (Activo/Inactivo) | Realizado |

---

## HU_26: Yo como Administrador quiero ver pdf de los ahorros permanentes para poder generar y entregar al asociado un extracto o comprobante de su ahorro

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_26_01 | El sistema genera un archivo PDF del extracto de ahorro | Realizado |
| CA_26_02 | El extracto incluye el saldo actual y el historial de transacciones del ahorro | Realizado |
| CA_26_03 | El Administrador puede seleccionar un rango de fechas para el extracto | Realizado |

---

## HU_27: Yo como Administrador quiero Editar Ahorro Permanente para poder corregir o actualizar la información registrada del ahorro del asociado

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_27_01 | El administrador puede modificar el monto de aporte mensual del asociado en cualquier momento, siempre que el ahorro esté activo. | Realizado |
| CA_27_02 | La fecha de inicio solo puede corregirse si el ahorro aún no tiene movimientos registrados. | Realizado |
| CA_27_03 | El administrador puede registrar o actualizar una nota interna sobre el ahorro en cualquier momento. | Realizado |

---

## HU_28: Yo como Administrador quiero Cambiar de estado el ahorro permanente para poder activar, inactivar o anular el ahorro según las políticas de la cooperativa

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_28_01 | El sistema permite cambiar el estado del ahorro permanente | Realizado |
| CA_28_02 | Los estados disponibles son: Activo, Inactivo y Anulado | Realizado |
| CA_28_03 | El sistema solicita confirmación antes de realizar el cambio | Realizado |

---

## HU_29: Administrador quiero anular ahorros permanentes  para poder corregir errores o cancelar un registro de ahorro que no sea válido.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_29_01 | El Administrador puede anular un registro de ahorro permanente no válido | Realizado |
| CA_29_02 | Al anular, se requiere ingresar la justificación y el sistema registra la anulación | Realizado |
| CA_29_03 | El sistema debe mostrar un mensaje de confirmación antes de ejecutar la anulación | Realizado |

---

## HU_30: Asociado necesito buscar los ahorros permanentes para poder saber si tengo el ahorro permanente activo

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_30_01 | La búsqueda muestra el estado "Activo" del ahorro | Realizado |
| CA_30_02 | El Asociado puede buscar por su Cédula | Realizado |
| CA_30_03 | El sistema confirma la existencia del plan de ahorro | Realizado |

---

## HU_31: Asociado necesito listar los ahorros permanentes para poder visualizar un resumen de mi ahorro permanente en un vistazo

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_31_01 | El sistema debe permitir buscar ahorros realizados en las fechas anteriores / transacciones anteriores | Realizado |
| CA_31_02 | Al realizar la búsqueda, el sistema debe mostrar solo los resultados que coincidan con los criterios ingresados. | Realizado |
| CA_31_03 | Si no se encuentran resultados, el sistema debe mostrar un mensaje indicando que no existen ahorros permanentes con los datos ingresados. | Realizado |

---

## HU_32: Asociado necesito ver detalles de los ahorros permanentes para poder ver información mas detallada de el ahorro

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_32_01 | Cada registro debe mostrar información básica como monto, fecha de creación y estado. | Realizado |
| CA_32_02 | El listado debe permitir ordenarse por fecha o monto. | Realizado |
| CA_32_03 | Si el asociado no tiene ahorros voluntarios, el sistema debe mostrar un mensaje indicando que no hay registros disponibles. | Realizado |

---

## HU_33: Asociado necesito ver pdf de los ahorros permanentes para poder tener un soporte físico/digital de los términos y condiciones de mi ahorro

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_33_01 | El PDF generado debe contener: nombre del asociado, número de cédula, tipo de ahorro, monto ahorrado, cuota mensual, fecha de inicio y estado actual del ahorro. | Realizado |
| CA_33_02 | Al hacer clic en el botón "Descargar PDF", el sistema debe generar y descargar automáticamente un archivo PDF con la información del ahorro seleccionado. | Realizado |
| CA_33_03 | El PDF debe incluir el encabezado institucional de UFCA con nombre de la entidad, fecha y hora de generación del documento. | Realizado |

---

## HU_34: Administrador necesito registrar los ahorros voluntarios para poder permitir a los asociados crear planes de ahorro adicionales y flexibles

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_34_01 | El sistema permite crear nuevos planes de ahorro voluntario con reglas flexibles | Realizado |
| CA_34_02 | El registro del plan incluye la definición de la frecuencia de ahorro y el monto objetivo (opcional) | Realizado |
| CA_34_03 | El plan creado queda activo y visible para el asociado en su perfil | Realizado |

---

## HU_35: Administrador Administrador necesito buscar los ahorros voluntarios para poder encontrar rápidamente el registro de ahorro de un asociado en específico

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_35_01 | El Administrador puede buscar planes por nombre del asociado | Realizado |
| CA_35_02 | El resultado de la búsqueda es instantáneo y muestra el estado actual del ahorro | Realizado |
| CA_35_03 | La búsqueda debe ser compatible con la función de autocompletado para asociados existentes | Realizado |

---

## HU_36: Administrador Administrador quiero listar los ahorros voluntarios para poder visualizar la totalidad de los planes de ahorro voluntarios activos

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_36_01 | El sistema muestra un listado completo de todos los planes de ahorro voluntario activos | Realizado |
| CA_36_02 | El listado incluye, al menos, el nombre del asociado, el tipo de plan y el saldo actual | Realizado |
| CA_36_03 | El Administrador puede ordenar el listado por saldo o por fecha de creación del plan | Realizado |

---

## HU_37: Administrador Administrador quiero ver detalles de los ahorros voluntarios  para poder consultar el saldo, las transacciones y el estado actual de cada plan de ahorro

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_37_01 | El detalle del plan muestra el saldo total actual de forma destacada | Realizado |
| CA_37_02 | Se presenta un listado de todas las transacciones (depósitos/retiros) del plan | Realizado |
| CA_37_03 | La vista indica el estado actual del plan (Activo, inactivo) | Realizado |

---

## HU_38: Administrador necesito ver pdf de los ahorros voluntarios para poder generar y entregar al asociado un extracto o comprobante de su ahorro

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_38_01 | El sistema genera un archivo PDF al solicitar el extracto del ahorro voluntario | Realizado |
| CA_38_02 | El extracto incluye el resumen de saldos y las transacciones del periodo | Realizado |
| CA_38_03 | El Administrador puede imprimir o enviar por correo electrónico el PDF al asociado | Realizado |

---

## HU_39: Administrador necesito Editar Ahorro Voluntario para poder Yo como Administrador necesito Editar Ahorro Voluntario para poder actualizar o corregir los montos, períodos y condiciones del ahorro voluntario de los asociados cuando sea necesario por cambios en sus circunstancias o corrección de errores.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_39_01 | Actualizar unicamente el ahorro voluntario | Realizado |
| CA_39_02 | El sistema debe permitir al Administrador modificar los campos del ahorro voluntario: monto mensual, porcentaje de ahorro, fecha de inicio, fecha de fin (opcional), periodicidad (mensual/quincenal) y estado (activo/inactivo), validando que los valores sean coherentes y positivos. | Realizado |
| CA_39_03 | Al guardar los cambios, el sistema debe registrar un historial de modificaciones que incluya: fecha del cambio, usuario que realizó el cambio, valores anteriores y nuevos valores, además de enviar una notificación al Asociado informando sobre los cambios realizados en su ahorro voluntario. | Realizado |

---

## HU_40: Yo como Administrador necesito anular ahorros voluntarios para poder corregir errores o cancelar un registro de ahorro que no sea válido

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_40_01 | El Administrador puede seleccionar y anular un registro de ahorro no válido | Realizado |
| CA_40_02 | El sistema registra una justificación obligatoria para cada anulación | Realizado |
| CA_40_03 | Se notifica al asociado sobre la cancelación y el motivo (si aplica) | Realizado |

---

## HU_41: Yo como Asociado necesito buscar los ahorros voluntarios para poder encontrar un ahorro especifico de forma rapida

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_41_01 | El sistema debe permitir buscar ahorros voluntarios por criterios como fecha o estado. | Realizado |
| CA_41_02 | Al realizar la búsqueda, el sistema debe mostrar solo los resultados que coincidan con los criterios ingresados. | Realizado |
| CA_41_03 | Si no se encuentran resultados, el sistema debe mostrar un mensaje indicando que no existen ahorros voluntarios con los datos ingresados. | Realizado |

---

## HU_42: Yo como Asociado necesito listar los ahorros voluntarios para poder visualizar todos mis ahorros registrados

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_42_01 | El sistema debe mostrar un listado con todos los ahorros voluntarios asociados al usuario. | Realizado |
| CA_42_02 | Cada registro debe mostrar información básica como monto, fecha de creación y estado. | Realizado |
| CA_42_03 | El listado debe permitir ordenarse por fecha o monto. | Realizado |

---

## HU_43: Yo como Asociado necesito ver detalles de los ahorros voluntarios  para poder conocer la información completa de cada ahorro.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_43_01 | El sistema debe permitir seleccionar un ahorro voluntario desde el listado. | Realizado |
| CA_43_02 | Al seleccionar un ahorro, el sistema debe mostrar información detallada como monto, fechas, movimientos y estado. | Realizado |
| CA_43_03 | El detalle mostrado debe corresponder correctamente al ahorro seleccionado. | Realizado |

---

## HU_44: Yo como Asociado necesito ver pdf de los ahorros voluntarios para poder consultar y descargar la información de mis ahorros en un documento PDF.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_44_01 | El sistema debe permitir generar un archivo PDF del ahorro voluntario seleccionado. | Realizado |
| CA_44_02 | El PDF debe contener información clara y completa del ahorro voluntario (datos del asociado, monto, fechas, estado o movimientos). | Realizado |
| CA_44_03 | El sistema debe permitir visualizar el PDF antes de descargarlo. | Realizado |

---

## HU_45: Yo como Administrador quiero registrar creditos para poder documentar y formalizar la aprobación de un préstamo a un asociado

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_45_01 | El sistema permite crear un crédito buscando al asociado mediante autocompletado por nombre o cédula; solo se muestran asociados registrados | Realizado |
| CA_45_02 | La formalización captura: tipo de crédito (libre inversión, educación, vivienda, calamidad), monto, tasa de interés anual, plazo en meses y fecha de desembolso; el sistema calcula automáticamente la cuota mensual usando amortización francesa | Realizado |
| CA_45_03 | El registro admite adjuntar un documento de soporte (PDF, JPG, PNG, Word hasta 10 MB) que se almacena en Supabase Storage, y establece el estado de aprobación inicial (Pendiente, En revisión, Aprobado, etc.) junto con observaciones opcionales | Realizado |

---

## HU_46: Yo como Administrador quiero buscar los creditos para poder encontrar rápidamente un expediente de crédito por asociado, número o estado

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_46_01 | El Administrador puede buscar expedientes por nombre del asociado o por cédula; el buscador muestra sugerencias de autocompletado con los asociados que tienen créditos registrados | Realizado |
| CA_46_02 | La búsqueda permite filtrar por cualquiera de los siete estados del ciclo de vida: Pendiente, En revisión, Aprobado, Desembolsado, En mora, Pagado y Rechazado | Realizado |
| CA_46_03 | El sistema filtra los resultados en tiempo real a medida que el administrador escribe, sin necesidad de confirmar la búsqueda; los resultados se paginan de 10 en 10 | Realizado |

---

## HU_47: Yo como Administrador necesito listar creditos para poder ver la cartera total de créditos y generar informes de desempeño

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_47_01 | El sistema presenta cuatro indicadores de cartera: total de créditos activos con distribución por estado, monto total de capital otorgado con promedio por crédito, cuota mensual total a recaudar, y plazo promedio y tasa promedio ponderada | Realizado |
| CA_47_02 | El listado tabular muestra por crédito: asociado, cédula, tipo, monto, tasa de interés, plazo, cuota mensual, saldo pendiente, estado de aprobación y si tiene documento de soporte adjunto | Realizado |
| CA_47_03 | El Administrador puede generar y descargar un informe de desempeño de cartera en formato PDF que incluye indicadores globales, distribución por tipo y estado, análisis de mora y tabla resumen de créditos | Realizado |

---

## HU_48: Yo como Administrador necesito ver detalles de los creditos  para poder monitorear el saldo, las cuotas pagadas/pendientes y el historial de pagos de cada crédito

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_48_01 | La vista de detalle muestra: saldo pendiente, cuotas pagadas vs. cuotas totales con barra de progreso, fecha de próxima cuota, fecha de vencimiento final y días en mora si aplica | Realizado |
| CA_48_02 | Se presenta el historial completo de pagos con: número de cuota, fecha, monto pagado, capital e interés aplicados, saldo antes y después de cada pago, método de pago y observaciones; exportable a CSV | Realizado |
| CA_48_03 | Se especifican la tasa de interés anual y mensual, la cuota mensual fija calculada por amortización francesa, la fecha de desembolso, la fecha de próximo pago y el estado de mora con días vencidos si corresponde | Realizado |

---

## HU_49: Yo como Administrador necesito editar los creditos  para poder corregir errores en la información del préstamo o actualizar los términos si es necesario

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_49_01 | El sistema permite actualizar: tipo de crédito, monto, tasa de interés, plazo, fecha de desembolso, estado de aprobación, observaciones y documento de soporte adjunto; la cuota mensual se recalcula automáticamente al cambiar monto, tasa o plazo | Realizado |
| CA_49_02 | El sistema muestra una notificación de éxito con el nombre del administrador que editó y la fecha y hora exacta de la modificación | Realizado |
| CA_49_03 | Se persisten en base de datos los campos editado_por y editado_en; si el estado cambia, también se guardan la fecha efectiva del cambio (fecha_estado_cambio) y el motivo (motivo_estado_cambio) | Realizado |

---

## HU_50: Yo como Administrador quiero cambiar el estado de los creditos  para poder gestionar el ciclo de vida del crédito (Aprobado, Desembolsado, En Mora, Pagado)

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_50_01 | El sistema permite cambiar el estado manualmente entre: Pendiente, En revisión, Aprobado, Desembolsado, En mora, Pagado y Rechazado; los estados Aprobado, Desembolsado y En mora bloquean la anulación del crédito | Realizado |
| CA_50_02 | Se registran en base de datos la fecha efectiva del cambio (fecha_estado_cambio) y el motivo del cambio (motivo_estado_cambio), ambos visibles en la pestaña de auditoría del detalle del crédito | Realizado |
| CA_50_03 | El sistema detecta mora automáticamente al cargar la pantalla: si la cuota vigente supera la fecha de vencimiento calcula los días transcurridos y actualiza el estado en base de datos sin intervención del administrador; el estado se revierte automáticamente si el saldo se regulariza | Realizado |

---

## HU_51: Yo como Administrador necesito Anular los creditos para poder remover un registro de crédito erróneo o cancelado de la base de datos

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_51_01 | El administrador puede anular créditos registrados con errores o datos incorrectos desde la tabla de créditos activos, mediante el botón de anulación (ícono papelera). La acción marca el crédito como anulado (no lo elimina) y lo mueve a la pestaña "Anulados". | Realizado |
| CA_51_02 | El sistema ejecuta un proceso de dos pasos: primero solicita al administrador una justificación escrita obligatoria del motivo de anulación; luego exige escribir la palabra "ANULAR" para confirmar la acción. Sin cumplir ambos pasos no se puede proceder. | Realizado |
| CA_51_03 | No se permite anular créditos que se encuentren en estado Aprobado, Desembolsado o En mora, ya que tienen compromisos financieros activos. Solo pueden anularse créditos en estado Pendiente, En revisión, Rechazado o Pagado. El sistema muestra un mensaje de error indicando el motivo del bloqueo. | Realizado |

---

## HU_52: Yo como Administrador necesito Ver pdf del credito para poder Tener un comprobante de mi credito

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_52_01 | El sistema muestra el perfil completo del crédito al abrir el diálogo de detalle: número de crédito (CRE-XXXXXXXX), tipo de crédito, monto aprobado, monto desembolsado (igual al monto aprobado), tasa de interés anual (EA) con su equivalente mensual, plazo total en meses, fecha de inicio (desembolso) y fecha de vencimiento calculada. El estado del crédito puede ser: Pendiente, En revisión, Aprobado, Desembolsado, En mora, Pagado o Rechazado. Se muestran también el nombre completo y cédula del asociado titular. | Realizado |
| CA_52_02 | El sistema presenta un resumen financiero calculado al abrir el detalle: saldo pendiente, capital pagado (suma de pagos registrados), intereses pagados (suma de pagos registrados), intereses pendientes estimados (proyección amortización francesa), cuotas pagadas y pendientes sobre el total del plazo, valor de la cuota mensual, próxima fecha de pago (calculada desde la fecha de desembolso) y días en mora si aplica. También incluye una barra de progreso del crédito. La información refleja los pagos registrados en tiempo real. | Realizado |
| CA_52_03 | El diálogo de detalle incluye la pestaña "Pagos" con el historial real de transacciones: número de cuota, fecha de pago, monto pagado, capital, interés, saldo después del pago, método de pago (efectivo, transferencia, cheque) y botón de comprobante individual descargable (PDF) por cada transacción. El historial puede exportarse completo en formato PDF o CSV. También existe la pestaña "Cuotas" con la tabla de amortización francesa proyectada. | Realizado |

---

## HU_53: Yo como Asociado necesito buscar los creditos para poder  encontrar un crédito específico.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_53_01 | El sistema debe clasificar los créditos del asociado en dos categorías simples e intuitivas mediante pestañas o botones rápidos:
1. "Activos / En Curso": Créditos pendientes de pago (estados: aprobado, desembolsado, en mora).
2. "Historial / Finalizados": Créditos ya pagados, rechazados o anulados. | Realizado |
| CA_53_02 | El sistema debe mostrar en tarjetas resumen de fácil lectura el estado general de su deuda:
 Saldo total pendiente de pago (capital acumulado).
 Valor de la próxima cuota mensual.
Indicador de alerta roja si tiene algún crédito vencido ("En mora"). | Realizado |
| CA_53_03 | Si el asociado no tiene créditos en la sección seleccionada, el sistema debe mostrar un estado vacío amigable con un texto de ayuda:
 En Activos: "No tienes créditos activos en este momento. Si necesitas financiamiento, puedes solicitar un crédito aquí." junto a un botón directo para iniciar una solicitud.
 En Historial: "Tu historial de créditos finalizados está vacío." | Realizado |

---

## HU_54: Yo como Asociado necesito listar creditos para poder  visualizar todos mis créditos registrados.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_54_01 | El sistema muestra todos los créditos vinculados al asociado autenticado (identificado por su asociado_id o cédula de respaldo). Los créditos anulados aparecen con opacidad reducida y etiqueta "Anulado". En la parte superior se presentan KPIs personales: total de créditos, saldo total pendiente, cuota mensual vigente y cantidad en mora. | Realizado |
| CA_54_02 | Cada tarjeta de crédito muestra: número de crédito (CRE-...), tipo de crédito, badge de estado, monto aprobado, plazo, cuotas pagadas y pendientes, saldo pendiente, tasa de interés, fecha de inicio, fecha de vencimiento, próxima fecha de cuota o fecha vencida, y barra de progreso de pago. Los créditos en mora se destacan con borde rojo y días de mora. | Realizado |
| CA_54_03 | El sistema presenta el listado de créditos ordenado de forma automática por fecha de creación (de la más reciente a la más antigua) para asegurar que el asociado visualice primero sus créditos y solicitudes más recientes. | Realizado |

---

## HU_55: Yo como Asociado necesito ver detalles de los creditos  para poder  conocer la información completa de cada crédito.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_55_01 | El asociado puede seleccionar cualquier crédito haciendo clic en su tarjeta o en el botón "Ver detalle". El sistema abre un diálogo de detalle completo y carga automáticamente el historial de pagos reales desde la base de datos. | Realizado |
| CA_55_02 | Al seleccionar un crédito, el diálogo muestra el perfil completo (número, tipo, asociado, monto, tasa, plazo, fechas), el resumen financiero en tiempo real (saldo, capital/intereses pagados, cuotas, próximo pago, días mora) y las pestañas de tabla de cuotas proyectadas, historial de pagos, documentos de soporte y auditoría de cambios. | Realizado |
| CA_55_03 | Toda la información del diálogo corresponde exclusivamente al crédito seleccionado (selectedItem), cargado directamente desde el estado local que refleja los datos de Supabase. El historial de pagos se consulta en tiempo real filtrando por el id del crédito seleccionado. | Realizado |

---

## HU_56: Yo como Administrador quiero registrar las liquidaciones  para poder documentar el cálculo final de pagos a asociados por conceptos como retiros o cesantías

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_56_01 | El sistema permite registrar liquidaciones de 5 tipos financieros: Retiro voluntario, Expulsión, Fallecimiento, Liquidación anual y Otro (sin conceptos laborales). Al seleccionar un asociado, el sistema pre-carga automáticamente de la base de datos sus saldos acumulados de Ahorro Permanente, Ahorro Voluntario y el Saldo de Crédito Pendiente para preparar la liquidación. | Realizado |
| CA_56_02 | El registro de la liquidación incluye: asociado titular (autocompletado), tipo de liquidación, fecha de corte, fecha de liquidación, estado de gestión (En proceso ), motivo y una lista de conceptos clasificados como crédito (+) o débito (-). El monto neto final a entregar o cobrar se calcula automáticamente restando las deudas del dinero ahorrado | Realizado |
| CA_56_03 | Al crear o actualizar una liquidación, el sistema muestra una notificación breve en pantalla al asociado que incluye: Tipo de liquidación, Fecha de corte y Monto neto calculado. | Realizado |

---

## HU_57: Yo como Administrador necesito buscar las liquidaciones para poder encontrar rápidamente un registro de liquidación por asociado o por fecha

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_57_01 | La búsqueda encuentra liquidaciones por nombre del asociado o fecha de registro | Realizado |
| CA_57_02 | El resultado muestra el monto total o el concepto de la liquidación | Realizado |
| CA_57_03 | La búsqueda debe ser rápida y con opción de filtrado por periodo | Realizado |

---

## HU_58: Yo como Administrador necesito listar las liquidaciones  para poder revisar todas las liquidaciones que se han procesado en un período de tiempo

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_58_01 | El sistema muestra un listado completo de todas las liquidaciones procesadas | Realizado |
| CA_58_02 | La lista incluye el monto, el asociado y la fecha de pago | Realizado |
| CA_58_03 | El Administrador puede ordenar la lista por estado o fecha | Realizado |

---

## HU_59: Yo como Administrador necesito ver el pdf de las liquidaciones  para poder generar y entregar al asociado el documento oficial de su liquidación

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_59_01 | El sistema genera un archivo PDF del documento oficial de liquidación | Realizado |
| CA_59_02 | El PDF incluye el desglose de los conceptos que componen el monto final | Realizado |
| CA_59_03 | El PDF generado es descargable y contiene firma o sello de validación | Realizado |

---

## HU_60: Yo como Administrador necesito anular las liquidaciones  para poder corregir liquidaciones que se hayan registrado con errores o datos incorrectos

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_60_01 | El Administrador puede anular una liquidación registrada con errores | Realizado |
| CA_60_02 | La anulación requiere una justificación obligatoria y un registro de la acción | Realizado |
| CA_60_03 | La liquidación anulada se marca con estado Inválido y se excluye de totales | Realizado |

---

## HU_61: Yo como Administrador quiero ver detalles de las liquidaciones para poder ver el desglose completo de los valores calculados en cada liquidación

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_61_01 | El sistema debe permitir seleccionar una liquidación y mostrar todos los valores calculados asociados | Realizado |
| CA_61_02 | Los datos mostrados deben corresponder exactamente a la liquidación seleccionada (sin mezclar información de otras). | Realizado |
| CA_61_03 | El usuario debe poder regresar al listado de liquidaciones desde la vista de detalle. | Realizado |

---

## HU_62: Yo como Asociado quiero buscar las liquidaciones para poder encontrar una liquidación específica.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_62_01 | El asociado puede buscar sus liquidaciones anteriores seleccionando el Año (ejemplo: 2024, 2025). | Realizado |
| CA_62_02 | El asociado puede ver si su trámite de liquidación está En proceso (pendiente de pago) o si ya fue Pagada. | Realizado |
| CA_62_03 | El asociado puede ver su historial de liquidaciones de años pasados y descargar el comprobante en PDF. | Realizado |

---

## HU_63: Yo como Asociado quiero listar las liquidaciones  para poder visualizar todas mis liquidaciones registradas.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_63_01 | El sistema debe mostrar un listado con todas las liquidaciones asociadas al usuario. | Realizado |
| CA_63_02 | Cada liquidación debe mostrar información básica como periodo, monto y estado. | Realizado |
| CA_63_03 | Si no existen liquidaciones, el sistema debe mostrar un mensaje indicando que no hay registros disponibles. | Realizado |

---

## HU_64: Yo como Asociado quiero ver detalles de las liquidaciones para poder conocer la información completa de cada liquidación.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_64_01 | El sistema debe permitir seleccionar una liquidación desde el listado. | Realizado |
| CA_64_02 | Al seleccionar una liquidación, el sistema debe mostrar el detalle completo de la información. | Realizado |
| CA_64_03 | El detalle mostrado debe corresponder a la liquidación seleccionada. | Realizado |

---

## HU_65: Yo como Asociado quiero ver el pdf de las liquidaciones  para poder consultar y descargar la liquidación en formato PDF.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_65_01 | El sistema debe permitir generar el PDF de la liquidación seleccionada. | Realizado |
| CA_65_02 | El PDF debe mostrar información clara y completa de la liquidación. | Realizado |
| CA_65_03 | El sistema debe permitir visualizar o descargar el PDF correctamente. | Realizado |

---

## HU_66: Yo como Administrador quiero Listar para poder consultar  las solicitudes de ingreso enviadas al Comité Evaluador y dar seguimiento a los aspirantes registrados.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_66_01 | El sistema debe mostrar todas las solicitudes de ingreso registradas con información básica del aspirante. | Realizado |
| CA_66_02 | Cada solicitud debe mostrar su estado actual (pendiente, aprobada o rechazada). | Realizado |
| CA_66_03 | El sistema debe permitir identificar fácilmente cuáles solicitudes están pendientes de evaluación. | Realizado |

---

## HU_67: Yo como Administrador necesito ver los detalles de una solicitud de ingreso para poder revisar la información completa del aspirante antes de tomar una decisión.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_67_01 | Al seleccionar una solicitud, el sistema debe mostrar toda la información diligenciada en el formulario de inscripción. | Realizado |
| CA_67_02 | El sistema debe mostrar los documentos o soportes adjuntos, en caso de que existan. | Realizado |
| CA_67_03 | La información debe visualizarse en modo consulta sin alterar los datos originales enviados por el aspirante. | Realizado |

---

## HU_68: Yo como Administrador necesito aprobar una solicitud evaluada por el Comité para poder aceptar formalmente al aspirante como nuevo asociado.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_68_01 | Solo se debe permitir aprobar solicitudes que se encuentren en estado pendiente. | Realizado |
| CA_68_02 | Al aprobar una solicitud, el sistema debe actualizar automáticamente su estado a “Aprobada”. | Realizado |
| CA_68_03 | Una vez aprobada, la solicitud debe quedar registrada como parte del historial del proceso de evaluación. | Realizado |

---

## HU_69: Yo como Administrador necesito  Rechazar una solicitud evaluada por el Comité para poder dejar constancia de que el aspirante no fue aceptado en la asociación.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_69_01 | Solo se debe permitir rechazar solicitudes que estén en estado pendiente. | Realizado |
| CA_69_02 | Al rechazar una solicitud, el sistema debe actualizar su estado a “Rechazada”. | Realizado |
| CA_69_03 | El sistema debe permitir registrar la observación o motivo del rechazo. | Realizado |

---

## HU_70: Yo como Administrador necesito eliminar una solicitud de ingreso para poder depurar registros inválidos, duplicados o enviados por error.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_70_01 | El sistema debe permitir eliminar únicamente solicitudes que no hayan sido procesadas definitivamente o que estén marcadas como rechazadas | Realizado |
| CA_70_02 | Antes de eliminar, el sistema debe solicitar confirmación de la acción. | Realizado |
| CA_70_03 | Una vez eliminada, la solicitud no debe aparecer en el listado principal de evaluaciones. | Realizado |

---

## HU_71: Yo como Administrador necesito consultar el historial de solicitudes evaluadas por el Comité para poder hacer seguimiento al proceso de admisión de nuevos aspirantes.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_71_01 | El sistema debe permitir consultar solicitudes pendientes, aprobadas y rechazadas. | Realizado |
| CA_71_02 | Cada solicitud debe conservar la fecha en la que fue enviada y la fecha en la que fue evaluada. | Realizado |
| CA_71_03 | El historial debe permitir conocer el resultado final de cada proceso de evaluación. | Realizado |

---

## HU_72: Yo como Administrador necesito visualizar el dashboard general para poder revisar todos los indicadores clave de desempeño financiero y operativo del sistema.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_72_01 | Mostrar tarjetas resumen en pesos (COP) de: Cartera de créditos, Capital en ahorros (permanente/voluntario), Intereses cobrados y Asociados activos. | Realizado |
| CA_72_02 | Mostrar un estado gris de "Sin datos" en el gráfico circular si la base de datos está vacía. | Realizado |
| CA_72_03 | Mostrar la evolución temporal en gráficos integrados (áreas para los últimos 6 meses de ahorros y barras para los últimos 3 meses de créditos). | Realizado |

---

## HU_73: Yo como Administrador quiero Ver detalles de las mediciones para poder analizar la evolución y los datos exactos que componen cada indicador de gestión

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_73_01 | Mostrar tooltips interactivos con los valores exactos en COP y cantidades al pasar el cursor sobre las gráficas. | Realizado |
| CA_73_02 | Ofrecer un panel lateral de "Resumen financiero" con barras para detallar monto, capital, intereses y liquidaciones | Realizado |
| CA_73_03 | Permitir exportar el monto completo de créditos y el historial de pagos de un asociado a archivos CSV descargables. | Realizado |

---

## HU_74: Yo como Administrador quiero consultar mediciones para poder generar reportes personalizados sobre el rendimiento del sistema en un periodo específico

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_74_01 | Mostrar el estado y saldo de ahorro permanente del asociado seleccionado antes de configurar su extracto. | Realizado |
| CA_74_02 | Permitir filtrar la información del reporte mediante selectores de calendario ("Fecha inicio" y "Fecha fin"). | Realizado |
| CA_74_03 | Generar una vista previa interactiva en pantalla (usando un iframe) antes de descargar o imprimir el archivo PDF consolidado. | Realizado |

---

## HU_75: Yo como Asociado quiero acceder a mi dashboard personalizado para poder  ver de forma rápida mi proceso de ahorros, cuotas y créditos.

| CA Code | Acceptance Criterion | Estado |
| --- | --- | --- |
| CA_74_01 | El Asociado debe ver tarjetas dinámicas con su saldo de Ahorro permanente, Ahorro voluntario, su Saldo total en créditos y la suma consolidada de su Patrimonio total. | Realizado |
| CA_74_02 | El dashboard del Asociado debe listar sus últimos 5 movimientos reales combinando aportes permanentes y depósitos voluntarios, indicando el tipo de movimiento, origen y fecha relativa (ej. "Hace 2d"). | Realizado |
| CA_74_03 | Si el Asociado cuenta con un crédito activo, el sistema debe renderizar una tarjeta con el saldo pendiente, su cuota mensual, su plazo y una barra de progreso que indica visualmente el porcentaje pagado de la deuda. | Realizado |

---

