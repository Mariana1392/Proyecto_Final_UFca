# Informe de Investigación: Herramientas de Documentación de Procesos (Tango.ai)
**Proyecto:** Sistema de Unión Familiar de Ahorro y Crédito (UFCA)  
**Actividad:** 3.3.2 - Investigar sobre la herramienta Tango para la elaboración del manual de usuario  
**Autores:** Mariana Valencia Ospina & Dairo Montiel Tobar (Aprendices SENA - ADSO)  
**Instructor Evaluador:** Instructor Técnico de ADSO - SENA  
**Fecha:** 29 de junio de 2026  

---

## 1. Introducción a Tango.ai
En el desarrollo de software y la ingeniería de requisitos, la transferencia de conocimiento al usuario final representa un hito crítico para garantizar la adopción de la tecnología. Tradicionalmente, la elaboración de manuales de usuario requería horas de captura manual de pantallas, edición de imágenes, redacción de texto instructivo y formateo visual.

**Tango (https://www.tango.ai/)** es una herramienta SaaS (Software as a Service) impulsada por inteligencia artificial diseñada para simplificar y automatizar la creación de guías de procedimientos paso a paso ("How-To Guides") y Procedimientos Operativos Estándar (SOP). 

### ¿Cómo funciona?
Tango opera principalmente a través de una **extensión de navegador web** (Chrome, Edge) o una **aplicación de escritorio**. El proceso consta de tres fases fundamentales:
1. **Captura Dinámica:** El creador del manual activa el botón de grabación e interactúa normalmente con el software (hace clics, escribe en formularios, navega por pestañas).
2. **Generación Automatizada:** La extensión de Tango detecta los eventos de la interfaz de usuario (DOM). Cada clic o entrada de teclado genera automáticamente un paso numerado con un título explicativo y una captura de pantalla perfectamente recortada y enfocada en el botón u objeto interactivo (con un recuadro naranja de énfasis).
3. **Personalización y Publicación:** El autor puede editar el texto redactado por la IA, difuminar información sensible (como cédulas o saldos financieros reales) y compartir la guía mediante un enlace web, exportación a PDF, HTML, Markdown o inyección interactiva ("Guidance").

---

## 2. Comparativa Técnica de Herramientas de Captura de Procesos

Para tomar una decisión tecnológica fundamentada para el proyecto UFCA, se evaluaron cuatro alternativas líderes en el mercado de la documentación automatizada de procesos: **Tango**, **Scribe**, **FlowShare** y **Guidde** (a través de www.guidemaker.com).

| Criterio | Tango.ai | Scribe (scribehost.com) | Guidde (guidde.com) | FlowShare (getflowshare.com) |
| :--- | :--- | :--- | :--- | :--- |
| **Formato de Salida Principal** | Guías web interactivas, PDF, Markdown y HTML. | Biblioteca estática de SOPs, PDF, páginas embebidas. | Videos interactivos animados con voz de IA y subtítulos. | Manuales de formato local descargables (PDF, Word, PPT). |
| **Enfoque de Experiencia** | **Soporte en vivo (In-App Guidance):** Guía al usuario en tiempo real sobre el software vivo. | **Biblioteca de consulta:** Repositorio centralizado de manuales escritos con capturas. | **Aprendizaje visual (L&D):** Videos explicativos cortos automatizados. | **Documentación local:** Software de escritorio sin dependencias de la nube pesadas. |
| **Tratamiento de Datos Sensibles** | Difuminado inteligente (Blur) manual y por patrones en el editor web. | Difuminado automático de contraseñas y datos numéricos. | Edición de video para ocultar áreas o rehacer pasos individuales. | Edición local directa sobre capturas de pantalla antes de exportar. |
| **Lógica de Ramificación** | **Sí (Branching):** Permite guías con rutas alternativas ("if-this-then-that"). | No disponible en la versión estándar o gratuita. | No aplica (estructura lineal de video). | Flujo secuencial lineal tradicional. |
| **Compatibilidad** | Aplicaciones Web (Extensión) y Escritorio (App Pro). | Web y Escritorio. | Web (Extensión de navegador). | Escritorio (Windows / Mac nativo) y Web. |

---

## 3. Justificación de la Elección de Tango para el Proyecto UFCA

El sistema **UFCA** es una aplicación con tres tipos de perfiles claramente diferenciados (Asociado, Administrador y Comité Evaluador) que realizan tareas financieras críticas tales como:
* Solicitudes de crédito con simulación de cuotas.
* Registro de aportes y ahorros permanentes/voluntarios.
* Configuración de reglas operativas de negocio (tasas de interés, montos máximos, etc.).

Al analizar las características de las herramientas, **Tango** se consagra como la herramienta óptima para UFCA debido a los siguientes factores:

1. **Flujo de "Guidance" para la Adopción del Asociado:**
   Muchos asociados de la cooperativa pueden ser personas con competencias digitales básicas. Tango permite inyectar la guía interactiva directamente en la aplicación web de producción. Cuando el asociado activa la guía "Cómo solicitar un crédito", la pantalla se oscurece y Tango resalta con un círculo brillante el botón exacto que debe presionar en su pantalla real, guiándolo de forma interactiva paso a paso.
2. **Edición Eficiente de Datos de Prueba:**
   Dado que el sistema de UFCA maneja saldos de ahorro y datos personales (cédulas, correos, nombres), la herramienta de edición y difuminado (*blur*) de Tango permite ocultar números de transacciones reales o nombres de asociados durante la grabación en entornos locales de desarrollo, protegiendo la confidencialidad.
3. **Documentación de Lógica Ramificada:**
   El flujo de crédito en UFCA depende del estado de activación de la cuenta (Asociados con cuenta activa vs asociados pendientes de pago de activación). La función de **branching** (ramificación) de Tango permite diseñar una única guía interactiva que se divide en dos caminos dependiendo de si el asociado tiene o no su cuenta activada.

---

## 4. Plan de Acción Colaborativo para Documentar UFCA en Tango

Para dar cumplimiento al plan de trabajo (`Plan_de_Trabajo_UFCA.xlsx`) de manera colaborativa, Mariana y Dairo adoptarán la siguiente metodología:

1. **Instalación y Configuración:**
   Mariana y Dairo instalarán la extensión oficial de **Tango.ai** en Google Chrome. Crearán un espacio de trabajo compartido llamado *"Proyecto UFCA - ADSO"* para co-editar las guías generadas.
2. **Estandarización de Estilos:**
   Se configurará el kit de marca (Brand Kit) en Tango con los colores corporativos de UFCA:
   * **Color Primario (Énfasis/Recuadro de Clic):** Verde Corporativo (`#10B981` / HSL/Tailwind emerald).
   * **Tipografía de Títulos:** Outfit / Inter.
3. **Grabación de Módulos (División de Trabajo):**
   * **Dairo Montiel (Redactor Técnico):** Grabará las secuencias del **Módulo de Asociado** utilizando un usuario de prueba en el entorno de desarrollo local. Capturará: Registro, Creación de Contraseña, Depósito en Ahorro Voluntario, Simulación y Solicitud de Crédito.
   * **Mariana Valencia (Diseñadora/Coordinadora):** Grabará el **Módulo de Administración** (Aprobación de asociados, Ajustes en las reglas de negocio, Asignación de Roles) y el **Módulo del Comité Evaluador** (Evaluación, Aprobación y Desembolso de solicitudes de crédito).
4. **Edición y Calidad:**
   Ambos aprendices realizarán una co-evaluación cruzada de las guías en Tango, puliendo el texto explicativo de la IA para que utilice un lenguaje claro y técnico, alineado con la terminología del SENA.
5. **Compilación y Entrega:**
   Las guías de Tango serán organizadas en una carpeta compartida pública y, de forma paralela, exportadas a PDF para ser consolidadas en el manual final que se subirá a Google Drive.

---

## 5. Conclusiones
La incorporación de herramientas modernas de documentación asistidas por IA como Tango representa una ventaja estratégica en el desarrollo de software. En el caso del sistema **UFCA**, no solo acelera la creación de la documentación escrita necesaria para la aprobación del proyecto formativo ADSO, sino que proporciona un mecanismo dinámico (Guidance) para la capacitación interactiva del usuario final, garantizando que el sistema sea fácil de operar y libre de errores humanos en el manejo de ahorros y créditos.
