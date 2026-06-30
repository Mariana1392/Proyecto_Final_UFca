import { test, expect } from '@playwright/test';

test.describe('UFCA E2E QA Test Suite', () => {

  test.beforeEach(async ({ page }) => {
    // Interceptar cualquier consulta de base de datos no especificada para evitar bloqueos del frontend (se registra primero, y las específicas registradas después lo sobrescriben)
    await page.route('**/rest/v1/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Interceptar llamadas a Supabase Auth y base de datos para simular un backend estable
    await page.route('**/auth/v1/token?grant_type=password', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: {
            id: 'e229c293-6ba6-4b2a-8ea6-f7614e5b8772',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'admin@ufca.com',
            email_confirmed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        })
      });
    });

    // Interceptar llamadas de verificación de sesión (auth/v1/user)
    await page.route('**/auth/v1/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e229c293-6ba6-4b2a-8ea6-f7614e5b8772',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'admin@ufca.com',
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
    });

    // Interceptar llamadas a auth/v1/session
    await page.route('**/auth/v1/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: null
        })
      });
    });

    // Interceptar la consulta de usuario y rol de Supabase
    await page.route('**/rest/v1/usuarios*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e229c293-6ba6-4b2a-8ea6-f7614e5b8772',
          nombre: 'Administrador Pruebas',
          email: 'admin@ufca.com',
          username: 'admin_qa',
          activo: true,
          rol_id: 'role-admin-id',
          cedula: '12345678',
          telefono: '3000000000',
          roles: {
            nombre: 'admin',
            label: 'Administrador',
            rol_permisos: [
              { permiso_clave: 'dashboard', activo: true },
              { permiso_clave: 'gestion_roles', activo: true },
              { permiso_clave: 'gestion_usuarios', activo: true },
              { permiso_clave: 'ahorros', activo: true },
              { permiso_clave: 'creditos', activo: true },
              { permiso_clave: 'liquidaciones', activo: true },
              { permiso_clave: 'gestion_asociados', activo: true }
            ]
          }
        })
      });
    });

    // Interceptar llamadas a configuracion global
    await page.route('**/rest/v1/configuracion*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '1', clave: 'monto_obligatorio_ahorro_permanente', valor: '50000' },
          { id: '2', clave: 'tasa_interes_credito_libre', valor: '1.5' }
        ])
      });
    });

    // Interceptar llamadas a notificaciones
    await page.route('**/rest/v1/notificaciones*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Interceptar llamadas a roles
    await page.route('**/rest/v1/roles*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'role-admin-id', nombre: 'admin', label: 'Administrador', descripcion: 'Rol de administrador', activo: true, es_sistema: true },
          { id: 'role-asociado-id', nombre: 'asociado', label: 'Asociado', descripcion: 'Rol de asociado', activo: true, es_sistema: true },
          { id: 'role-usuario-id', nombre: 'usuario', label: 'Usuario', descripcion: 'Rol de usuario', activo: true, es_sistema: true }
        ])
      });
    });
  });

  test('Debe cargar la pantalla de login y permitir inicio de sesión simulado', async ({ page }) => {
    // Ir a la página de inicio
    await page.goto('/');

    // Asegurarse de que el botón de ingresar esté visible
    const ingresarBtn = page.locator('text=Ya soy asociado — Ingresar').first();
    await expect(ingresarBtn).toBeVisible();

    // Hacer clic en Ingresar para ir a la vista de Login si no estamos ahí
    await ingresarBtn.click();

    // Rellenar campos de Login
    await page.fill('input[type="email"]', 'admin@ufca.com');
    await page.fill('input[type="password"]', 'password123');

    // Clic en el botón de iniciar sesión
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verificar que redirige y muestra el dashboard o la barra de navegación del Layout
    await expect(page.locator('text=Administrador Pruebas').or(page.locator('text=Dashboard')).first()).toBeVisible({ timeout: 10000 });
  });

  test('Debe navegar a la sección de Roles y mostrar el listado', async ({ page }) => {
    // Forzar estado de autenticación en sessionStorage y localStorage antes de cargar la página
    await page.addInitScript(() => {
      window.localStorage.setItem('ufca-auth', JSON.stringify({
        currentSession: {
          access_token: 'mock-jwt-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: {
            id: 'e229c293-6ba6-4b2a-8ea6-f7614e5b8772',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'admin@ufca.com',
            email_confirmed_at: '2026-06-30T10:00:00Z'
          },
          expires_at: 2090216462
        },
        expiresAt: 2090216462
      }));

      window.sessionStorage.setItem('ufca_u', JSON.stringify({
        id: 'e229c293-6ba6-4b2a-8ea6-f7614e5b8772',
        nombre: 'Administrador Pruebas',
        email: 'admin@ufca.com',
        username: 'admin_qa',
        rol: 'admin',
        label: 'Administrador',
        rol_id: 'role-admin-id',
        activo: true,
        permisos: ['dashboard', 'gestion_roles', 'gestion_usuarios', 'ahorros', 'liquidaciones', 'gestion_asociados', 'creditos']
      }));
    });

    // Ir a la página y dejar que cargue directamente autenticado
    await page.goto('/');
    
    // Verificar que estamos en la vista de Dashboard
    await expect(page.locator('text=Dashboard').first()).toBeVisible();

    // Esperar a que el layout lateral esté estable en la página
    await page.waitForSelector('aside', { state: 'visible' });

    // Asegurar que el sidebar esté abierto y visible en pantalla
    const sidebar = page.locator('aside').first();
    const classes = await sidebar.getAttribute('class');
    if (classes && classes.includes('-translate-x-full')) {
      const menuBtn = page.locator('button[aria-label="Menú"]').first();
      await menuBtn.click();
      await page.waitForTimeout(500); // esperar animación de transición
    }

    // Expandir el menú de "Configuración"
    const configMenu = page.locator('text=Configuración').first();
    await configMenu.click();
    await page.waitForTimeout(300); // pequeña espera por si se expande con transición

    // Hacer clic en "Gestión de roles"
    const rolesLink = page.locator('text=Gestión de roles').first();
    await rolesLink.click();

    // Verificar que muestra el listado de roles
    await expect(page.locator('text=Gestión de Roles y Permisos').first()).toBeVisible();
  });
});
