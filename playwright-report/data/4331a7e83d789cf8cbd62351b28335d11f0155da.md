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
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('aside') to be visible

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
              - paragraph [ref=e47]:
                - text: Administra tus ahorros y crédito
                - text: con la confianza de una familia.
              - generic [ref=e48]:
                - img [ref=e50]
                - generic [ref=e53]:
                  - paragraph [ref=e54]: Lleva UFCA en tu bolsillo
                  - paragraph [ref=e55]:
                    - text: Descarga nuestra aplicación móvil oficial.
                    - strong [ref=e56]: "Recuerda:"
                    - text: El acceso a la app es exclusivo para asociados aprobados en la cooperativa.
                  - link "Descargar APK (Android)" [ref=e57] [cursor=pointer]:
                    - /url: /ufca-app.apk
                    - img [ref=e58]
                    - text: Descargar APK (Android)
              - img [ref=e67]
            - generic [ref=e76]:
              - img "Gestión Financiera Familiar" [ref=e79]
              - generic [ref=e82]:
                - img [ref=e84]
                - generic [ref=e86]:
                  - paragraph [ref=e87]: 100% Seguro
                  - paragraph [ref=e88]: Tus datos protegidos
              - generic [ref=e89]:
                - generic [ref=e90]: "2"
                - generic [ref=e91]: Años
          - img [ref=e93]
        - generic [ref=e96]:
          - generic [ref=e97]:
            - generic [ref=e98]:
              - generic [ref=e99]:
                - img [ref=e100]
                - text: Acerca de UFCA
              - heading "Fondo de Beneficio Familiar" [level=2] [ref=e102]
              - paragraph [ref=e103]: Una sociedad conformada por familiares y amigos dedicada a gestionar microinversiones, préstamos y ahorros con transparencia y confianza.
            - generic [ref=e104]:
              - generic [ref=e105]:
                - generic [ref=e107]:
                  - img "Equipo UFCA" [ref=e108]
                  - generic [ref=e110]:
                    - paragraph [ref=e111]:
                      - text: "\"Más que finanzas,"
                      - text: somos una familia."
                    - paragraph [ref=e112]: — María Edilma Arboleda Londoño, Administradora
                - generic [ref=e113]:
                  - img [ref=e115]
                  - generic [ref=e118]:
                    - paragraph [ref=e119]: Ubicación
                    - paragraph [ref=e120]: Medellín, Colombia
                - generic [ref=e121]:
                  - img [ref=e123]
                  - generic [ref=e126]:
                    - paragraph [ref=e127]: Trayectoria
                    - paragraph [ref=e128]: 2 años de experiencia
              - generic [ref=e129]:
                - generic [ref=e130]:
                  - generic [ref=e131]:
                    - img [ref=e133]
                    - generic [ref=e138]:
                      - paragraph [ref=e139]: Tipo de organización
                      - paragraph [ref=e140]: Fondo familiar
                  - generic [ref=e141]:
                    - img [ref=e143]
                    - generic [ref=e146]:
                      - paragraph [ref=e147]: Valor central
                      - paragraph [ref=e148]: Confianza y cercanía
                  - generic [ref=e149]:
                    - img [ref=e151]
                    - generic [ref=e155]:
                      - paragraph [ref=e156]: Enfoque
                      - paragraph [ref=e157]: Crecer juntos como familia
                  - generic [ref=e158]:
                    - img [ref=e160]
                    - generic [ref=e165]:
                      - paragraph [ref=e166]: Fundación
                      - paragraph [ref=e167]: 2023 · Medellín
                - generic [ref=e168]:
                  - generic [ref=e169]:
                    - img [ref=e171]
                    - generic [ref=e174]:
                      - paragraph [ref=e175]: Nuestros Servicios
                      - paragraph [ref=e176]: Lo que ofrecemos a nuestros asociados
                  - generic [ref=e177]:
                    - generic [ref=e178]:
                      - img [ref=e180]
                      - paragraph [ref=e183]: Préstamos
                      - generic [ref=e184]: Crédito
                    - generic [ref=e185]:
                      - img [ref=e187]
                      - paragraph [ref=e191]: Ahorro permanente para metas a corto plazo
                      - generic [ref=e192]: Ahorro
                    - generic [ref=e193]:
                      - img [ref=e195]
                      - paragraph [ref=e198]: Ahorro voluntario con flexibilidad total
                      - generic [ref=e199]: Ahorro
                - img [ref=e205]
          - img [ref=e215]
        - generic [ref=e220]:
          - generic [ref=e221]:
            - generic [ref=e222]:
              - img [ref=e223]
              - text: Descubre nuestros servicios
            - heading "Todo lo que necesitas" [level=2] [ref=e229]
            - paragraph [ref=e230]: Gestiona tus finanzas personales en una sola plataforma moderna, segura y accesible.
          - generic [ref=e231]:
            - generic [ref=e232]:
              - img [ref=e234]
              - heading "Ahorros" [level=3] [ref=e238]
              - paragraph [ref=e239]: Ahorro permanente y voluntario con seguimiento en tiempo real para cada asociado.
              - generic [ref=e240]: Permanente · Voluntario
            - generic [ref=e242]:
              - img [ref=e244]
              - heading "Créditos" [level=3] [ref=e247]
              - paragraph [ref=e248]: Solicitud, aprobación y seguimiento de créditos de forma ágil y transparente.
              - generic [ref=e249]: Préstamos · Liquidación
            - generic [ref=e251]:
              - img [ref=e253]
              - heading "Asociados" [level=3] [ref=e258]
              - paragraph [ref=e259]: Gestión completa de beneficios prioritarios para el núcleo familiar.
              - generic [ref=e260]: Membresías · Referidos
            - generic [ref=e262]:
              - img [ref=e264]
              - heading "Dashboard" [level=3] [ref=e267]
              - paragraph [ref=e268]: Obtenga estadísticas con gráficas interactivas con reportes del estado de cuenta en tiempo real.
              - generic [ref=e269]: Reportes · Gráficas
          - generic [ref=e275]:
            - generic [ref=e276]:
              - paragraph [ref=e277]: ¿Listo para empezar?
              - heading "Únete a la familia UFCA" [level=3] [ref=e278]
              - paragraph [ref=e279]: Accede a todos los beneficios — ahorros, créditos y más — con el respaldo de una comunidad familiar.
            - generic [ref=e280]:
              - generic [ref=e281]:
                - generic [ref=e282]:
                  - img [ref=e283]
                  - generic [ref=e285]:
                    - paragraph [ref=e286]: 100% Seguro
                    - paragraph [ref=e287]: Datos protegidos
                - generic [ref=e288]:
                  - img [ref=e289]
                  - generic [ref=e292]:
                    - paragraph [ref=e293]: Confiable
                    - paragraph [ref=e294]: 2 años de trayectoria
              - button "Quiero ser asociado" [ref=e295]:
                - img [ref=e296]
                - text: Quiero ser asociado
              - button "Ya soy asociado — Ingresar" [ref=e301]:
                - img [ref=e302]
                - text: Ya soy asociado — Ingresar
      - generic [ref=e308]:
        - generic [ref=e309]:
          - generic [ref=e310]:
            - generic [ref=e311]:
              - img "UFCA" [ref=e312]
              - generic [ref=e313]:
                - paragraph [ref=e314]: UFCA
                - paragraph [ref=e315]: Unión Familiar de Crédito y Ahorro
            - generic [ref=e316]:
              - link "Facebook" [ref=e317] [cursor=pointer]:
                - /url: "#"
                - img [ref=e318]
              - link "Twitter" [ref=e320] [cursor=pointer]:
                - /url: "#"
                - img [ref=e321]
              - link "Instagram" [ref=e323] [cursor=pointer]:
                - /url: "#"
                - img [ref=e324]
              - link "LinkedIn" [ref=e328] [cursor=pointer]:
                - /url: "#"
                - img [ref=e329]
          - generic [ref=e333]:
            - paragraph [ref=e334]: Servicios
            - list [ref=e335]:
              - listitem [ref=e336]:
                - button "Ahorros Permanentes" [ref=e337] [cursor=pointer]: Ahorros Permanentes
              - listitem [ref=e339]:
                - button "Ahorros Voluntarios" [ref=e340] [cursor=pointer]: Ahorros Voluntarios
              - listitem [ref=e342]:
                - button "Créditos" [ref=e343] [cursor=pointer]: Créditos
              - listitem [ref=e345]:
                - button "Eventos" [ref=e346] [cursor=pointer]: Eventos
          - generic [ref=e348]:
            - paragraph [ref=e349]: Información
            - list [ref=e350]:
              - listitem [ref=e351]:
                - generic [ref=e352] [cursor=pointer]: Sobre nosotros
              - listitem [ref=e354]:
                - generic [ref=e355] [cursor=pointer]: Términos y condiciones
              - listitem [ref=e357]:
                - generic [ref=e358] [cursor=pointer]: Política de privacidad
              - listitem [ref=e360]:
                - generic [ref=e361] [cursor=pointer]: Preguntas frecuentes
          - generic [ref=e363]:
            - paragraph [ref=e364]: Contacto
            - generic [ref=e365]:
              - link "+57 314 758 7250" [ref=e366] [cursor=pointer]:
                - /url: https://wa.me/573147587250
                - img [ref=e368]
                - generic [ref=e370]: +57 314 758 7250
              - link "marboledalondono@gmail.com" [ref=e371] [cursor=pointer]:
                - /url: https://mail.google.com/mail/?view=cm&fs=1&to=marboledalondono@gmail.com
                - img [ref=e373]
                - generic [ref=e376]: marboledalondono@gmail.com
              - link "Calle 102c No. 77b 56, Medellín" [ref=e377] [cursor=pointer]:
                - /url: https://www.google.com/maps/search/?api=1&query=Calle+102c+No.+77b+56,+Medell%C3%ADn,+Colombia
                - img [ref=e379]
                - generic [ref=e382]: Calle 102c No. 77b 56, Medellín
        - generic [ref=e383]:
          - paragraph [ref=e384]: © 2026 UFCA · Unión Familiar de Crédito y Ahorro · Todos los derechos reservados.
          - generic [ref=e385]: Plataforma activa · Medellín, Colombia
  - region "Notifications alt+T"
```

# Test source

```ts
  97  |     // Interceptar llamadas a configuracion global
  98  |     await page.route('**/rest/v1/configuracion*', async route => {
  99  |       await route.fulfill({
  100 |         status: 200,
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
> 197 |     await page.waitForSelector('aside', { state: 'visible' });
      |                ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  198 | 
  199 |     // Asegurar que el sidebar esté abierto y visible en pantalla
  200 |     const sidebar = page.locator('aside').first();
  201 |     const classes = await sidebar.getAttribute('class');
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