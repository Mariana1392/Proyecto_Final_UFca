# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ufca_e2e.spec.ts >> UFCA E2E QA Test Suite >> Debe navegar a la sección de Roles y mostrar el listado
- Location: tests\ufca_e2e.spec.ts:156:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.getAttribute: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('aside').first()

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e7]:
          - img "UFCA" [ref=e8]
          - generic [ref=e9]:
            - generic [ref=e10]: UFCA
            - generic [ref=e11]: Unión Familiar de Crédito y Ahorro
        - generic [ref=e12]:
          - button "Tema oscuro" [ref=e13]:
            - img [ref=e14]
          - button "Inicio" [ref=e16]:
            - img
            - generic [ref=e17]: Inicio
          - button "Login" [ref=e18]:
            - img
            - generic [ref=e19]: Login
    - main [ref=e21]:
      - generic [ref=e23]:
        - generic [ref=e24]:
          - generic [ref=e30]:
            - generic [ref=e31]:
              - generic [ref=e32]:
                - img "UFCA" [ref=e35]
                - generic [ref=e36]:
                  - heading "UFCA" [level=1] [ref=e37]
                  - paragraph [ref=e38]: Unión Familiar de Crédito y Ahorro
                  - generic [ref=e39]:
                    - img [ref=e40]
                    - text: Sistema Integral de Gestión
              - paragraph [ref=e43]:
                - text: Administra tus ahorros y crédito
                - text: con la confianza de una familia.
              - generic [ref=e44]:
                - img [ref=e46]
                - generic [ref=e48]:
                  - paragraph [ref=e49]: Lleva UFCA en tu bolsillo
                  - paragraph [ref=e50]:
                    - text: Descarga nuestra aplicación móvil oficial.
                    - strong [ref=e51]: "Recuerda:"
                    - text: El acceso a la app es exclusivo para asociados aprobados en la cooperativa.
                  - link "Descargar APK (Android)" [ref=e52]:
                    - /url: /ufca-app.apk
                    - img [ref=e53]
                    - text: Descargar APK (Android)
              - img [ref=e61]
            - generic [ref=e66]:
              - img "Gestión Financiera Familiar" [ref=e69]
              - generic [ref=e72]:
                - img [ref=e74]
                - generic [ref=e76]:
                  - paragraph [ref=e77]: 100% Seguro
                  - paragraph [ref=e78]: Tus datos protegidos
              - generic [ref=e79]:
                - generic [ref=e80]: "2"
                - generic [ref=e81]: Años
          - img [ref=e83]
        - generic [ref=e86]:
          - generic [ref=e87]:
            - generic [ref=e88]:
              - generic [ref=e89]:
                - img [ref=e90]
                - text: Acerca de UFCA
              - heading "Fondo de Beneficio Familiar" [level=2] [ref=e92]
              - paragraph [ref=e93]: Una sociedad conformada por familiares y amigos dedicada a gestionar microinversiones, préstamos y ahorros con transparencia y confianza.
            - generic [ref=e94]:
              - generic [ref=e95]:
                - generic [ref=e97]:
                  - img "Equipo UFCA" [ref=e98]
                  - generic [ref=e100]:
                    - paragraph [ref=e101]:
                      - text: "\"Más que finanzas,"
                      - text: somos una familia."
                    - paragraph [ref=e102]: — María Edilma Arboleda Londoño, Administradora
                - generic [ref=e103]:
                  - img [ref=e105]
                  - generic [ref=e108]:
                    - paragraph [ref=e109]: Ubicación
                    - paragraph [ref=e110]: Medellín, Colombia
                - generic [ref=e111]:
                  - img [ref=e113]
                  - generic [ref=e116]:
                    - paragraph [ref=e117]: Trayectoria
                    - paragraph [ref=e118]: 2 años de experiencia
              - generic [ref=e119]:
                - generic [ref=e120]:
                  - generic [ref=e121]:
                    - img [ref=e123]
                    - generic [ref=e128]:
                      - paragraph [ref=e129]: Tipo de organización
                      - paragraph [ref=e130]: Fondo familiar
                  - generic [ref=e131]:
                    - img [ref=e133]
                    - generic [ref=e136]:
                      - paragraph [ref=e137]: Valor central
                      - paragraph [ref=e138]: Confianza y cercanía
                  - generic [ref=e139]:
                    - img [ref=e141]
                    - generic [ref=e145]:
                      - paragraph [ref=e146]: Enfoque
                      - paragraph [ref=e147]: Crecer juntos como familia
                  - generic [ref=e148]:
                    - img [ref=e150]
                    - generic [ref=e152]:
                      - paragraph [ref=e153]: Fundación
                      - paragraph [ref=e154]: 2023 · Medellín
                - generic [ref=e155]:
                  - generic [ref=e156]:
                    - img [ref=e158]
                    - generic [ref=e161]:
                      - paragraph [ref=e162]: Nuestros Servicios
                      - paragraph [ref=e163]: Lo que ofrecemos a nuestros asociados
                  - generic [ref=e164]:
                    - generic [ref=e165]:
                      - img [ref=e167]
                      - paragraph [ref=e169]: Préstamos
                      - generic [ref=e170]: Crédito
                    - generic [ref=e171]:
                      - img [ref=e173]
                      - paragraph [ref=e176]: Ahorro permanente para metas a corto plazo
                      - generic [ref=e177]: Ahorro
                    - generic [ref=e178]:
                      - img [ref=e180]
                      - paragraph [ref=e183]: Ahorro voluntario con flexibilidad total
                      - generic [ref=e184]: Ahorro
                - img [ref=e190]
          - img [ref=e196]
        - generic [ref=e201]:
          - generic [ref=e202]:
            - generic [ref=e203]:
              - img [ref=e204]
              - text: Descubre nuestros servicios
            - heading "Todo lo que necesitas" [level=2] [ref=e206]
            - paragraph [ref=e207]: Gestiona tus finanzas personales en una sola plataforma moderna, segura y accesible.
          - generic [ref=e208]:
            - generic [ref=e209]:
              - img [ref=e211]
              - heading "Ahorros" [level=3] [ref=e214]
              - paragraph [ref=e215]: Ahorro permanente y voluntario con seguimiento en tiempo real para cada asociado.
              - generic [ref=e216]: Permanente · Voluntario
            - generic [ref=e218]:
              - img [ref=e220]
              - heading "Créditos" [level=3] [ref=e222]
              - paragraph [ref=e223]: Solicitud, aprobación y seguimiento de créditos de forma ágil y transparente.
              - generic [ref=e224]: Préstamos · Liquidación
            - generic [ref=e226]:
              - img [ref=e228]
              - heading "Asociados" [level=3] [ref=e233]
              - paragraph [ref=e234]: Gestión completa de beneficios prioritarios para el núcleo familiar.
              - generic [ref=e235]: Membresías · Referidos
            - generic [ref=e237]:
              - img [ref=e239]
              - heading "Dashboard" [level=3] [ref=e242]
              - paragraph [ref=e243]: Obtenga estadísticas con gráficas interactivas con reportes del estado de cuenta en tiempo real.
              - generic [ref=e244]: Reportes · Gráficas
          - generic [ref=e250]:
            - generic [ref=e251]:
              - paragraph [ref=e252]: ¿Listo para empezar?
              - heading "Únete a la familia UFCA" [level=3] [ref=e253]
              - paragraph [ref=e254]: Accede a todos los beneficios — ahorros, créditos y más — con el respaldo de una comunidad familiar.
            - generic [ref=e255]:
              - generic [ref=e256]:
                - generic [ref=e257]:
                  - img [ref=e258]
                  - generic [ref=e260]:
                    - paragraph [ref=e261]: 100% Seguro
                    - paragraph [ref=e262]: Datos protegidos
                - generic [ref=e263]:
                  - img [ref=e264]
                  - generic [ref=e267]:
                    - paragraph [ref=e268]: Confiable
                    - paragraph [ref=e269]: 2 años de trayectoria
              - button "Quiero ser asociado" [ref=e270]:
                - img [ref=e271]
                - text: Quiero ser asociado
              - button "Ya soy asociado — Ingresar" [ref=e274]:
                - img [ref=e275]
                - text: Ya soy asociado — Ingresar
      - generic [ref=e281]:
        - generic [ref=e282]:
          - generic [ref=e283]:
            - generic [ref=e284]:
              - img "UFCA" [ref=e285]
              - generic [ref=e286]:
                - paragraph [ref=e287]: UFCA
                - paragraph [ref=e288]: Unión Familiar de Crédito y Ahorro
            - generic [ref=e289]:
              - link "Facebook" [ref=e290]:
                - /url: "#"
                - img [ref=e291]
              - link "Twitter" [ref=e293]:
                - /url: "#"
                - img [ref=e294]
              - link "Instagram" [ref=e296]:
                - /url: "#"
                - img [ref=e297]
              - link "LinkedIn" [ref=e300]:
                - /url: "#"
                - img [ref=e301]
          - generic [ref=e305]:
            - paragraph [ref=e306]: Servicios
            - list [ref=e307]:
              - listitem [ref=e308]:
                - button "Ahorros Permanentes" [ref=e309] [cursor=pointer]: Ahorros Permanentes
              - listitem [ref=e311]:
                - button "Ahorros Voluntarios" [ref=e312] [cursor=pointer]: Ahorros Voluntarios
              - listitem [ref=e314]:
                - button "Créditos" [ref=e315] [cursor=pointer]: Créditos
              - listitem [ref=e317]:
                - button "Eventos" [ref=e318] [cursor=pointer]: Eventos
          - generic [ref=e320]:
            - paragraph [ref=e321]: Información
            - list [ref=e322]:
              - listitem [ref=e323]:
                - generic [ref=e324] [cursor=pointer]: Sobre nosotros
              - listitem [ref=e326]:
                - generic [ref=e327] [cursor=pointer]: Términos y condiciones
              - listitem [ref=e329]:
                - generic [ref=e330] [cursor=pointer]: Política de privacidad
              - listitem [ref=e332]:
                - generic [ref=e333] [cursor=pointer]: Preguntas frecuentes
          - generic [ref=e335]:
            - paragraph [ref=e336]: Contacto
            - generic [ref=e337]:
              - link "+57 314 758 7250" [ref=e338] [cursor=pointer]:
                - /url: https://wa.me/573147587250
                - img [ref=e340]
                - generic [ref=e342]: +57 314 758 7250
              - link "marboledalondono@gmail.com" [ref=e343] [cursor=pointer]:
                - /url: https://mail.google.com/mail/?view=cm&fs=1&to=marboledalondono@gmail.com
                - img [ref=e345]
                - generic [ref=e348]: marboledalondono@gmail.com
              - link "Calle 102c No. 77b 56, Medellín" [ref=e349] [cursor=pointer]:
                - /url: https://www.google.com/maps/search/?api=1&query=Calle+102c+No.+77b+56,+Medell%C3%ADn,+Colombia
                - img [ref=e351]
                - generic [ref=e354]: Calle 102c No. 77b 56, Medellín
        - generic [ref=e355]:
          - paragraph [ref=e356]: © 2026 UFCA · Unión Familiar de Crédito y Ahorro · Todos los derechos reservados.
          - generic [ref=e357]: Plataforma activa · Medellín, Colombia
  - region "Notifications alt+T"
```

# Test source

```ts
  101 |         contentType: 'application/json',
  102 |         body: JSON.stringify([
  103 |           { id: '1', clave: 'monto_obligatorio_ahorro_permanente', valor: '50000' },
  104 |           { id: '2', clave: 'tasa_interes_credito_libre', valor: '1.5' }
  105 |         ])
  106 |       });
  107 |     });
  108 | 
  109 |     // Interceptar llamadas a notificaciones
  110 |     await page.route('**/rest/v1/notificaciones*', async route => {
  111 |       await route.fulfill({
  112 |         status: 200,
  113 |         contentType: 'application/json',
  114 |         body: JSON.stringify([])
  115 |       });
  116 |     });
  117 | 
  118 |     // Interceptar llamadas a roles
  119 |     await page.route('**/rest/v1/roles*', async route => {
  120 |       await route.fulfill({
  121 |         status: 200,
  122 |         contentType: 'application/json',
  123 |         body: JSON.stringify([
  124 |           { id: 'role-admin-id', nombre: 'admin', label: 'Administrador', descripcion: 'Rol de administrador', activo: true, es_sistema: true },
  125 |           { id: 'role-asociado-id', nombre: 'asociado', label: 'Asociado', descripcion: 'Rol de asociado', activo: true, es_sistema: true },
  126 |           { id: 'role-usuario-id', nombre: 'usuario', label: 'Usuario', descripcion: 'Rol de usuario', activo: true, es_sistema: true }
  127 |         ])
  128 |       });
  129 |     });
  130 |   });
  131 | 
  132 |   test('Debe cargar la pantalla de login y permitir inicio de sesión simulado', async ({ page }) => {
  133 |     // Ir a la página de inicio
  134 |     await page.goto('/');
  135 | 
  136 |     // Asegurarse de que el botón de ingresar esté visible
  137 |     const ingresarBtn = page.locator('text=Ya soy asociado — Ingresar').first();
  138 |     await expect(ingresarBtn).toBeVisible();
  139 | 
  140 |     // Hacer clic en Ingresar para ir a la vista de Login si no estamos ahí
  141 |     await ingresarBtn.click();
  142 | 
  143 |     // Rellenar campos de Login
  144 |     await page.fill('input[type="email"]', 'admin@ufca.com');
  145 |     await page.fill('input[type="password"]', 'password123');
  146 | 
  147 |     // Clic en el botón de iniciar sesión
  148 |     const submitBtn = page.locator('button[type="submit"]');
  149 |     await expect(submitBtn).toBeVisible();
  150 |     await submitBtn.click();
  151 | 
  152 |     // Verificar que redirige y muestra el dashboard o la barra de navegación del Layout
  153 |     await expect(page.locator('text=Administrador Pruebas').or(page.locator('text=Dashboard')).first()).toBeVisible({ timeout: 10000 });
  154 |   });
  155 | 
  156 |   test('Debe navegar a la sección de Roles y mostrar el listado', async ({ page }) => {
  157 |     // Forzar estado de autenticación en sessionStorage y localStorage antes de cargar la página
  158 |     await page.addInitScript(() => {
  159 |       window.localStorage.setItem('ufca-auth', JSON.stringify({
  160 |         currentSession: {
  161 |           access_token: 'mock-jwt-token',
  162 |           token_type: 'bearer',
  163 |           expires_in: 3600,
  164 |           refresh_token: 'mock-refresh-token',
  165 |           user: {
  166 |             id: 'e229c293-6ba6-4b2a-8ea6-f7614e5b8772',
  167 |             aud: 'authenticated',
  168 |             role: 'authenticated',
  169 |             email: 'admin@ufca.com',
  170 |             email_confirmed_at: '2026-06-30T10:00:00Z'
  171 |           },
  172 |           expires_at: 2090216462
  173 |         },
  174 |         expiresAt: 2090216462
  175 |       }));
  176 | 
  177 |       window.sessionStorage.setItem('ufca_u', JSON.stringify({
  178 |         id: 'e229c293-6ba6-4b2a-8ea6-f7614e5b8772',
  179 |         nombre: 'Administrador Pruebas',
  180 |         email: 'admin@ufca.com',
  181 |         username: 'admin_qa',
  182 |         rol: 'admin',
  183 |         label: 'Administrador',
  184 |         rol_id: 'role-admin-id',
  185 |         activo: true,
  186 |         permisos: ['dashboard', 'gestion_roles', 'gestion_usuarios', 'ahorros', 'liquidaciones', 'gestion_asociados', 'creditos']
  187 |       }));
  188 |     });
  189 | 
  190 |     // Ir a la página y dejar que cargue directamente autenticado
  191 |     await page.goto('/');
  192 |     
  193 |     // Verificar que estamos en la vista de Dashboard
  194 |     await expect(page.locator('text=Dashboard').first()).toBeVisible();
  195 | 
  196 |     // Esperar a que el layout lateral esté estable en la página
  197 |     await page.waitForSelector('aside', { state: 'visible' });
  198 | 
  199 |     // Asegurar que el sidebar esté abierto y visible en pantalla
  200 |     const sidebar = page.locator('aside').first();
> 201 |     const classes = await sidebar.getAttribute('class');
      |                                   ^ Error: locator.getAttribute: Test timeout of 30000ms exceeded.
  202 |     if (classes && classes.includes('-translate-x-full')) {
  203 |       const menuBtn = page.locator('button[aria-label="Menú"]').first();
  204 |       await menuBtn.click();
  205 |       await page.waitForTimeout(500); // esperar animación de transición
  206 |     }
  207 | 
  208 |     // Expandir el menú de "Configuración"
  209 |     const configMenu = page.locator('text=Configuración').first();
  210 |     await configMenu.click();
  211 |     await page.waitForTimeout(300); // pequeña espera por si se expande con transición
  212 | 
  213 |     // Hacer clic en "Gestión de roles"
  214 |     const rolesLink = page.locator('text=Gestión de roles').first();
  215 |     await rolesLink.click();
  216 | 
  217 |     // Verificar que muestra el listado de roles
  218 |     await expect(page.locator('text=Gestión de Roles y Permisos').first()).toBeVisible();
  219 |   });
  220 | });
  221 | 
```