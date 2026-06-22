import { test, expect } from '@playwright/test';

/**
 * Tests de Acceso No Autenticado
 *
 * Corre bajo el proyecto 'security' (sin storageState → sin cookie de sesión).
 * Verifica que todas las rutas protegidas y APIs rechacen el acceso correctamente.
 */
test.describe('Unauthorized Access — Rutas Protegidas', () => {
  test('GET /dashboard sin sesión → redirect a /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('GET /dashboard/grazing sin sesión → redirect a /login', async ({ page }) => {
    await page.goto('/dashboard/grazing');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('GET /dashboard/mi-campo sin sesión → redirect a /login', async ({ page }) => {
    await page.goto('/dashboard/mi-campo');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('GET /dashboard/equipo sin sesión → redirect a /login', async ({ page }) => {
    await page.goto('/dashboard/equipo');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('GET /onboarding sin sesión → redirect a /login', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe('Unauthorized Access — API Routes sin Bearer', () => {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';

  test('GET /api/paddocks sin auth → 401', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/paddocks`);
    expect(response.status()).toBe(401);
  });

  test('GET /api/herds sin auth → 401', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/herds`);
    expect(response.status()).toBe(401);
  });

  test('GET /api/grazing-plans sin auth → 401', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/grazing-plans`);
    expect(response.status()).toBe(401);
  });

  test('POST /api/insights-ai sin auth → 401', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/insights-ai`, {
      data: { context: {} },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /api/tasks sin auth → 401', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/tasks`);
    expect(response.status()).toBe(401);
  });

  test('GET /api/field-notes sin auth → 401', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/field-notes`);
    expect(response.status()).toBe(401);
  });

  test('Authorization: Bearer INVALID → 401', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/paddocks`, {
      headers: { Authorization: 'Bearer INVALID_TOKEN_XXXX' },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('Admin Bypass — No activo en producción', () => {
  test('?_admin=1 en producción no debe dar acceso admin sin subdominio', async ({ page }) => {
    // Este test verifica que el query param no activa el bypass en producción.
    // En desarrollo, el test simplemente navega y verifica que no se expone
    // información de admin sin autenticación.
    await page.goto('/dashboard?_admin=1');

    // Debe redirigir a login (no autenticado) o quedarse en login
    // Jamás debe mostrar el panel de admin sin token SUPER_ADMIN
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('X-Admin-Subdomain header sin auth → no da acceso', async ({ page }) => {
    // Establecer header antes de navegar
    await page.setExtraHTTPHeaders({ 'x-admin-subdomain': '1' });
    await page.goto('/admin/dashboard');
    // Debe redirigir a login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
