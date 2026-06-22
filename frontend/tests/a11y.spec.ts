import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Tests de Accesibilidad — axe-core en todas las páginas protegidas
 *
 * NOTA: Login eliminado del beforeEach — la sesión la provee storageState.
 * Los tests sin auth (login, registro) no necesitan beforeEach.
 *
 * Expandido de 2 páginas a todas las páginas principales de la app.
 */

// ─────────────────────────────────────────────────────────────
// Páginas públicas — no requieren sesión
// ─────────────────────────────────────────────────────────────
test.describe('A11y — Páginas Públicas', () => {
  test('Login — debe pasar axe y ser navegable por teclado', async ({ page }) => {
    await page.goto('/login');

    const results = await new AxeBuilder({ page }).analyze();
    if (results.violations.length > 0) {
      console.log('Axe violations in /login:', JSON.stringify(results.violations, null, 2));
    }
    expect(results.violations).toEqual([]);

    // Navegación por teclado
    await page.focus('body');
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('Registro — debe pasar axe', async ({ page }) => {
    await page.goto('/register');
    await page.waitForSelector('form', { timeout: 10000 });

    const results = await new AxeBuilder({ page }).analyze();
    if (results.violations.length > 0) {
      console.log('Axe violations in /register:', JSON.stringify(results.violations, null, 2));
    }
    expect(results.violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// Páginas protegidas — usan storageState via proyecto chromium
// ─────────────────────────────────────────────────────────────
const protectedPages = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Mi Campo', path: '/dashboard/mi-campo' },
  { name: 'Grazing / Gantt', path: '/dashboard/grazing' },
  { name: 'Mapa', path: '/dashboard/map' },
  { name: 'Bitácora', path: '/dashboard/bitacora' },
  { name: 'Tareas', path: '/dashboard/tareas' },
  { name: 'Agenda', path: '/dashboard/agenda' },
  { name: 'Clima', path: '/dashboard/clima' },
  { name: 'Planes', path: '/dashboard/planes' },
  { name: 'Equipo', path: '/dashboard/equipo' },
  { name: 'Perfil', path: '/dashboard/profile' },
  { name: 'Calculadora', path: '/dashboard/calculadora' },
];

test.describe('A11y — Páginas Protegidas', () => {
  for (const { name, path } of protectedPages) {
    test(`${name} (${path}) — debe pasar axe`, async ({ page }) => {
      await page.goto(path);
      // Esperar que la página cargue algo (no blank)
      await page.waitForSelector('h1, main, [role="main"]', { timeout: 20000 });

      const results = await new AxeBuilder({ page })
        // Ignorar violaciones de color en elementos de terceros (Leaflet, etc.)
        .exclude('.leaflet-container')
        .analyze();

      if (results.violations.length > 0) {
        console.log(`Axe violations in ${path}:`, JSON.stringify(results.violations, null, 2));
      }

      expect(results.violations).toEqual([]);
    });
  }
});
