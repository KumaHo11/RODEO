import { test, expect } from '@playwright/test';

/**
 * Tests de Inyección SQL, XSS e IDOR
 *
 * Estos tests usan el storageState del usuario OWNER (vía proyecto chromium).
 * Verifican que el backend sanitize inputs y que no haya cross-org data leakage.
 */

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

// Helper para extraer token de las cookies del storageState
async function getAuthToken(page: any): Promise<string | null> {
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c: any) => c.name === '__session');
  return sessionCookie?.value || null;
}

test.describe('Inyección SQL — Inputs de usuario sanitizados', () => {
  test('SQL injection en nombre de potrero → no crash, response 200 o 400', async ({ page, request }) => {
    await page.goto('/dashboard/mi-campo');
    await page.waitForSelector('h1', { timeout: 15000 });

    const token = await getAuthToken(page);
    if (!token) return;

    // Intentar crear un potrero con nombre malicioso
    const response = await request.post(`${baseURL}/api/paddocks`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: "'; DROP TABLE paddocks; --",
        area_ha: 10,
      },
    });

    // Debe aceptar (y sanitizar) o rechazar con 400 — jamás 500
    expect([200, 201, 400, 403, 422]).toContain(response.status());
    // Verificar que la tabla paddocks sigue existiendo
    const listResponse = await request.get(`${baseURL}/api/paddocks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listResponse.status()).toBe(200);
  });

  test('SQL injection en filtros de query → no crash', async ({ page, request }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('h1', { timeout: 15000 });

    const token = await getAuthToken(page);
    if (!token) return;

    const response = await request.get(`${baseURL}/api/grazing-plans?status=PLANNED' OR 1=1--`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // No debe devolver 500 (server error)
    expect(response.status()).not.toBe(500);
  });
});

test.describe('XSS — Contenido de usuario no ejecutable', () => {
  test('XSS en notas de bitácora → se escapa en respuesta', async ({ page, request }) => {
    await page.goto('/dashboard/bitacora');
    await page.waitForSelector('h1', { timeout: 15000 });

    const token = await getAuthToken(page);
    if (!token) return;

    const xssPayload = "<script>window.__xss_executed=true</script>";

    // Intentar crear una nota con XSS
    const createRes = await request.post(`${baseURL}/api/field-notes`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { notes: xssPayload, type: 'OBSERVATION' },
    });

    if (createRes.status() === 201 || createRes.status() === 200) {
      const data = await createRes.json();
      const noteId = data?.id || data?.data?.id;

      if (noteId) {
        // Navegar a la bitácora y verificar que el script no se ejecutó
        await page.goto('/dashboard/bitacora');
        await page.waitForLoadState('networkidle');

        const xssExecuted = await page.evaluate(() => (window as any).__xss_executed);
        expect(xssExecuted).toBeFalsy();
      }
    }
  });

  test('XSS en nombre de rodeo → no ejecuta en la UI', async ({ page, request }) => {
    const token = await getAuthToken(page);
    if (!token) return;

    const xssPayload = '<img onerror=\'window.__xss2=true\' src=x>';

    await request.post(`${baseURL}/api/herds`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: xssPayload, head_count: 1 },
    });

    await page.goto('/dashboard/mi-campo');
    await page.waitForLoadState('networkidle');

    const xssExecuted = await page.evaluate(() => (window as any).__xss2);
    expect(xssExecuted).toBeFalsy();
  });
});

test.describe('IDOR — No hay acceso cruzado entre organizaciones', () => {
  test('API no devuelve paddocks de otras organizaciones', async ({ page, request }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('h1', { timeout: 15000 });

    const token = await getAuthToken(page);
    if (!token) return;

    // Obtener los paddocks del usuario autenticado
    const ownPaddocksRes = await request.get(`${baseURL}/api/paddocks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ownPaddocksRes.status()).toBe(200);
    const ownPaddocks = await ownPaddocksRes.json();

    // Intentar acceder a un UUID que no pertenece a su org
    // (UUID inventado que casi con certeza es de otra org o no existe)
    const foreignId = '00000000-dead-beef-0000-000000000001';
    const foreignRes = await request.get(`${baseURL}/api/paddocks/${foreignId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Debe ser 404 (no encontrado en su org) o 403 (explícito)
    expect([404, 403]).toContain(foreignRes.status());
  });

  test('API no devuelve grazing-plans de otras organizaciones', async ({ page, request }) => {
    const token = await getAuthToken(page);
    if (!token) return;

    const foreignPlanId = '00000000-dead-beef-0000-000000000002';
    const response = await request.get(`${baseURL}/api/grazing-plans/${foreignPlanId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect([404, 403]).toContain(response.status());
  });
});

test.describe('Path Traversal — Upload seguro', () => {
  test('Upload con nombre de archivo traversal → rechazado o sanitizado', async ({ page, request }) => {
    const token = await getAuthToken(page);
    if (!token) return;

    // Intentar upload con path traversal en el filename
    const formData = new FormData();
    // Blob con nombre malicioso
    const blob = new Blob(['malicious content'], { type: 'text/plain' });
    formData.append('file', blob, '../../../etc/passwd');

    const response = await request.post(`${baseURL}/api/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: '../../../etc/passwd',
          mimeType: 'text/plain',
          buffer: Buffer.from('malicious content'),
        },
      },
    });

    // Debe rechazar con 400 o sanitizar el nombre — jamás ejecutar el traversal
    expect([400, 403, 422]).toContain(response.status());
  });
});
