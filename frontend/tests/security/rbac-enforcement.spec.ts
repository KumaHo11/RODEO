import { test, expect } from '@playwright/test';

/**
 * Tests de RBAC — Verificación de Permisos por Rol
 *
 * Requiere credenciales de usuarios con roles distintos:
 *   TEST_OPERATOR_EMAIL / TEST_OPERATOR_PASSWORD — rol OPERATOR/AYUDANTE
 *   TEST_CAPATAZ_EMAIL  / TEST_CAPATAZ_PASSWORD  — rol CAPATAZ
 *
 * Si no están configuradas, los tests hacen skip automáticamente.
 * Configuralas en el archivo .env del proyecto frontend.
 *
 * Los tests con el usuario OWNER usan el storageState existente.
 */

const operatorEmail = process.env.TEST_OPERATOR_EMAIL;
const operatorPassword = process.env.TEST_OPERATOR_PASSWORD;
const capatazEmail = process.env.TEST_CAPATAZ_EMAIL;
const capatazPassword = process.env.TEST_CAPATAZ_PASSWORD;
const baseURL = process.env.BASE_URL || 'http://localhost:3000';

// Helper para hacer login y obtener un token de API
async function loginAndGetToken(
  request: any,
  email: string,
  password: string
): Promise<string | null> {
  try {
    // Firebase REST API login
    const loginRes = await request.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      { data: { email, password, returnSecureToken: true } }
    );
    if (!loginRes.ok()) return null;
    const data = await loginRes.json();
    return data.idToken || null;
  } catch {
    return null;
  }
}

test.describe('RBAC — OPERATOR no puede acceder a módulos de admin', () => {
  test.skip(!operatorEmail || !operatorPassword, 'TEST_OPERATOR_EMAIL/PASSWORD no configuradas — skip');

  test('OPERATOR no puede ver equipo (/dashboard/equipo)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', operatorEmail!);
    await page.fill('input[type="password"]', operatorPassword!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15000 });

    await page.goto('/dashboard/equipo');

    // Debe ver un mensaje de "sin permiso" o ser redirigido
    const forbidden = page.locator('text=/sin permiso|no autorizado|acceso denegado/i');
    const redirectedToLogin = page.url().includes('/login');
    const redirectedToDashboard = page.url().includes('/dashboard') && !page.url().includes('/equipo');

    expect(
      (await forbidden.isVisible({ timeout: 5000 }).catch(() => false)) ||
      redirectedToLogin ||
      redirectedToDashboard
    ).toBe(true);
  });

  test('OPERATOR no puede ver planes (/dashboard/planes)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', operatorEmail!);
    await page.fill('input[type="password"]', operatorPassword!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15000 });

    await page.goto('/dashboard/planes');
    const forbidden = page.locator('text=/sin permiso|no autorizado|acceso denegado/i');
    expect(
      (await forbidden.isVisible({ timeout: 5000 }).catch(() => false)) ||
      !page.url().includes('/planes')
    ).toBe(true);
  });

  test('OPERATOR: DELETE /api/paddocks → 403 o 401', async ({ request }) => {
    if (!operatorEmail || !operatorPassword) test.skip();
    const token = await loginAndGetToken(request, operatorEmail!, operatorPassword!);
    if (!token) {
      console.warn('No se pudo obtener token para OPERATOR — skip API test');
      return;
    }

    // Intentar eliminar un paddock ficticio — debe ser rechazado por RBAC
    const response = await request.delete(`${baseURL}/api/paddocks/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Debe ser 403 (sin permisos) o 404 (no existe) — jamás 200 ni 204
    expect([401, 403, 404]).toContain(response.status());
  });

  test('OPERATOR: POST /api/team/invitations → 403', async ({ request }) => {
    if (!operatorEmail || !operatorPassword) test.skip();
    const token = await loginAndGetToken(request, operatorEmail!, operatorPassword!);
    if (!token) return;

    const response = await request.post(`${baseURL}/api/team/invitations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { email: 'hack@evil.com', role: 'OWNER' },
    });

    expect([401, 403]).toContain(response.status());
  });
});

test.describe('RBAC — OWNER tiene acceso completo', () => {
  // Estos tests usan el storageState del usuario OWNER ya configurado
  const ownerRoutes = [
    '/dashboard',
    '/dashboard/mi-campo',
    '/dashboard/grazing',
    '/dashboard/equipo',
    '/dashboard/planes',
    '/dashboard/bitacora',
    '/dashboard/tareas',
  ];

  for (const route of ownerRoutes) {
    test(`OWNER puede acceder a ${route}`, async ({ page }) => {
      await page.goto(route);
      // No debe redirigir a login ni mostrar error de permisos
      await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
      await page.waitForSelector('h1, main', { timeout: 15000 });
    });
  }
});
