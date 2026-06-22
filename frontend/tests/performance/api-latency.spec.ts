import { test, expect } from '@playwright/test';

/**
 * Tests de Latencia de API
 *
 * Mide tiempos de respuesta de todos los endpoints críticos desde el browser.
 * Umbrales basados en la auditoría QA.
 *
 * Corre bajo el proyecto 'chromium' (con storageState del OWNER).
 */

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

interface ApiLatencyTest {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
  maxMs: number;
  // Algunos endpoints pueden fallar por razones de datos (404 si no hay registros)
  // solo verificamos la latencia, no el status code
  ignoreStatus?: boolean;
}

const apiTests: ApiLatencyTest[] = [
  { name: 'GET /api/paddocks',      method: 'GET',  path: '/api/paddocks',      maxMs: 800  },
  { name: 'GET /api/herds',         method: 'GET',  path: '/api/herds',         maxMs: 800  },
  { name: 'GET /api/grazing-plans', method: 'GET',  path: '/api/grazing-plans', maxMs: 1500 },
  { name: 'GET /api/field-notes',   method: 'GET',  path: '/api/field-notes',   maxMs: 1000 },
  { name: 'GET /api/tasks',         method: 'GET',  path: '/api/tasks',         maxMs: 1000 },
  { name: 'GET /api/organizations', method: 'GET',  path: '/api/organizations', maxMs: 800  },
  { name: 'GET /api/weather',       method: 'GET',  path: '/api/weather',       maxMs: 2000, ignoreStatus: true },
];

// Helper para extraer token de la cookie de sesión
async function getToken(page: any): Promise<string | null> {
  const cookies = await page.context().cookies();
  return cookies.find((c: any) => c.name === '__session')?.value || null;
}

test.describe('Latencias de API — Endpoints Críticos', () => {
  for (const { name, method, path, body, maxMs, ignoreStatus } of apiTests) {
    test(`${name} debe responder en < ${maxMs}ms`, async ({ page, request }) => {
      // Navegar al dashboard para tener sesión activa
      await page.goto('/dashboard');
      await page.waitForSelector('h1', { timeout: 15000 });

      const token = await getToken(page);
      if (!token) {
        console.warn(`No se encontró token para ${name} — skip`);
        return;
      }

      const start = Date.now();
      const response = method === 'GET'
        ? await request.get(`${baseURL}${path}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        : await request.post(`${baseURL}${path}`, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            data: body || {},
          });
      const elapsed = Date.now() - start;

      console.log(`[${name}] Status: ${response.status()} | Latencia: ${elapsed}ms (max: ${maxMs}ms)`);

      // Verificar latencia
      expect(elapsed, `${name} tardó ${elapsed}ms (máx permitido: ${maxMs}ms)`).toBeLessThan(maxMs);

      // Verificar que no sea un error del servidor (5xx)
      if (!ignoreStatus) {
        expect(response.status(), `${name} devolvió ${response.status()}`).toBeLessThan(500);
      }
    });
  }
});

test.describe('Latencias de IA — Endpoints Gemini (tolerante)', () => {
  test('POST /api/insights-ai debe responder en < 15s', async ({ page, request }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('h1', { timeout: 15000 });

    const token = await getToken(page);
    if (!token) return;

    // Contexto mínimo para el endpoint
    const context = {
      paddocks: 5, totalHa: 100, herds: 2, totalAnimals: 50,
      totalEV: 45, stockingRate: 0.45, activePlans: 1, restingPaddocks: 4,
      lastBiomassMs: null, daysSinceLastMove: 3, upcomingEvents: 0, score: 65,
    };

    const start = Date.now();
    const response = await request.post(`${baseURL}/api/insights-ai`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { context },
      timeout: 20000, // request timeout en Playwright
    });
    const elapsed = Date.now() - start;

    console.log(`[insights-ai] Status: ${response.status()} | Latencia: ${elapsed}ms`);

    // La IA puede ser lenta — verificar que no cuelgue más de 15s
    expect(elapsed).toBeLessThan(15000);
    // 403 es aceptable si el plan no incluye IA insights
    expect([200, 403]).toContain(response.status());
  });
});
