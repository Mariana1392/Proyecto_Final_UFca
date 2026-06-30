# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ufca_e2e.spec.ts >> UFCA E2E QA Test Suite >> Debe cargar la pantalla de login y permitir inicio de sesión simulado
- Location: tests\ufca_e2e.spec.ts:132:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Ya soy asociado — Ingresar').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Ya soy asociado — Ingresar').first()

```

```yaml
- banner:
  - img "UFCA"
  - text: UFCA Unión Familiar de Crédito y Ahorro
  - button "Tema oscuro":
    - img
  - button "Inicio":
    - img
    - text: Inicio
  - button "Login":
    - img
    - text: Login
- main:
  - img
  - paragraph: Cargando App...
  - img "UFCA"
  - paragraph: UFCA
  - paragraph: Unión Familiar de Crédito y Ahorro
  - link "Facebook":
    - /url: "#"
    - img
  - link "Twitter":
    - /url: "#"
    - img
  - link "Instagram":
    - /url: "#"
    - img
  - link "LinkedIn":
    - /url: "#"
    - img
  - paragraph: Servicios
  - list:
    - listitem:
      - button "Ahorros Permanentes"
    - listitem:
      - button "Ahorros Voluntarios"
    - listitem:
      - button "Créditos"
    - listitem:
      - button "Eventos"
  - paragraph: Información
  - list:
    - listitem: Sobre nosotros
    - listitem: Términos y condiciones
    - listitem: Política de privacidad
    - listitem: Preguntas frecuentes
  - paragraph: Contacto
  - link "+57 314 758 7250":
    - /url: https://wa.me/573147587250
    - img
    - text: +57 314 758 7250
  - link "marboledalondono@gmail.com":
    - /url: https://mail.google.com/mail/?view=cm&fs=1&to=marboledalondono@gmail.com
    - img
    - text: marboledalondono@gmail.com
  - link "Calle 102c No. 77b 56, Medellín":
    - /url: https://www.google.com/maps/search/?api=1&query=Calle+102c+No.+77b+56,+Medell%C3%ADn,+Colombia
    - img
    - text: Calle 102c No. 77b 56, Medellín
  - paragraph: © 2026 UFCA · Unión Familiar de Crédito y Ahorro · Todos los derechos reservados.
  - text: Plataforma activa · Medellín, Colombia
- region "Notifications alt+T"
```

# Test source

```ts
  38  |     // Interceptar llamadas de verificación de sesión (auth/v1/user)
  39  |     await page.route('**/auth/v1/user', async route => {
  40  |       await route.fulfill({
  41  |         status: 200,
  42  |         contentType: 'application/json',
  43  |         body: JSON.stringify({
  44  |           id: 'e229c293-6ba6-4b2a-8ea6-f7614e5b8772',
  45  |           aud: 'authenticated',
  46  |           role: 'authenticated',
  47  |           email: 'admin@ufca.com',
  48  |           email_confirmed_at: new Date().toISOString(),
  49  |           created_at: new Date().toISOString(),
  50  |           updated_at: new Date().toISOString()
  51  |         })
  52  |       });
  53  |     });
  54  | 
  55  |     // Interceptar llamadas a auth/v1/session
  56  |     await page.route('**/auth/v1/session', async route => {
  57  |       await route.fulfill({
  58  |         status: 200,
  59  |         contentType: 'application/json',
  60  |         body: JSON.stringify({
  61  |           session: null
  62  |         })
  63  |       });
  64  |     });
  65  | 
  66  |     // Interceptar la consulta de usuario y rol de Supabase
  67  |     await page.route('**/rest/v1/usuarios*', async route => {
  68  |       await route.fulfill({
  69  |         status: 200,
  70  |         contentType: 'application/json',
  71  |         body: JSON.stringify({
  72  |           id: 'e229c293-6ba6-4b2a-8ea6-f7614e5b8772',
  73  |           nombre: 'Administrador Pruebas',
  74  |           email: 'admin@ufca.com',
  75  |           username: 'admin_qa',
  76  |           activo: true,
  77  |           rol_id: 'role-admin-id',
  78  |           cedula: '12345678',
  79  |           telefono: '3000000000',
  80  |           roles: {
  81  |             nombre: 'admin',
  82  |             label: 'Administrador',
  83  |             rol_permisos: [
  84  |               { permiso_clave: 'dashboard', activo: true },
  85  |               { permiso_clave: 'gestion_roles', activo: true },
  86  |               { permiso_clave: 'gestion_usuarios', activo: true },
  87  |               { permiso_clave: 'ahorros', activo: true },
  88  |               { permiso_clave: 'creditos', activo: true },
  89  |               { permiso_clave: 'liquidaciones', activo: true },
  90  |               { permiso_clave: 'gestion_asociados', activo: true }
  91  |             ]
  92  |           }
  93  |         })
  94  |       });
  95  |     });
  96  | 
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
> 138 |     await expect(ingresarBtn).toBeVisible();
      |                               ^ Error: expect(locator).toBeVisible() failed
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