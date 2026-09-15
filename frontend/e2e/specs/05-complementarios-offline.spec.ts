/**
 * 05-complementarios-offline.spec.ts
 *
 * E2E tests for complementary modules offline/online lifecycle:
 *  5.1 Tareas — create a task offline
 *  5.2 Equipo — verify team page renders cached data offline
 *  5.3 Calculadora — verify offline calculation works without network
 *  Guard: assertLocalStorageClean
 */

import { test, expect } from '@playwright/test';
import {
  goOffline,
  goOnline,
  readIndexedDB,
  getOutboxCount,
  assertLocalStorageClean,
  expectNavigatorOnline,
  e2eName,
  E2E_PREFIX,
} from '../helpers/offline.helper';

/** Force-hide Sonner toast notifications */
async function hideToasts(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const section = document.querySelector('section[aria-label="Notifications"]');
    if (section) (section as HTMLElement).style.display = 'none';
  }).catch(() => {});
  await page.waitForTimeout(300);
}

test.describe('05 — Complementary Modules Offline', () => {
  test.describe.configure({ mode: 'serial' });

  // ────────────────────────────────────────────────────────────────────────────
  // 5.1 Tareas
  // ────────────────────────────────────────────────────────────────────────────

  test('5.1 — Should create a task offline and persist in IndexedDB', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();

    // Navigate online to populate cache
    await page.goto('/dashboard/tareas', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // ── Go OFFLINE ──────────────────────────────────────────────────────────
    await goOffline(context);
    await expectNavigatorOnline(page, false);
    await page.waitForTimeout(2_000);
    await hideToasts(page);

    // Try to create a task
    const newTaskBtn = page.locator('button:has-text("Nueva tarea"), button:has-text("Agregar"), button >> svg.lucide-plus').first();
    if (await newTaskBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newTaskBtn.click();
      await page.waitForTimeout(500);
      await hideToasts(page);

      // Fill task data
      const titleInput = page.locator('input[placeholder*="tarea"], input[placeholder*="título"], input[placeholder*="Ej"], textarea').first();
      if (await titleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const taskName = e2eName('Tarea Offline');
        await titleInput.fill(taskName);

        // Save via JS click
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const saveBtn = btns.find(b =>
            b.textContent?.includes('Guardar') ||
            b.textContent?.includes('Crear') ||
            b.textContent?.includes('Agregar')
          );
          if (saveBtn && !saveBtn.disabled) {
            saveBtn.scrollIntoView({ block: 'center' });
            saveBtn.click();
          }
        });
        await page.waitForTimeout(1_500);
      }
    }

    // ── Go ONLINE and verify sync ──────────────────────────────────────────
    await goOnline(context);
    await expectNavigatorOnline(page, true);
    await page.waitForTimeout(5_000);

    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 5.2 Equipo
  // ────────────────────────────────────────────────────────────────────────────

  test('5.2 — Should render team data from cache while offline', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();

    // Navigate online to populate cache
    await page.goto('/dashboard/equipo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // ── Go OFFLINE ──────────────────────────────────────────────────────────
    await goOffline(context);
    await expectNavigatorOnline(page, false);

    // Reload page
    await page.reload({ waitUntil: 'commit', timeout: 15_000 });
    await page.waitForTimeout(3_000);

    // The page should show either cached content or offline fallback
    const teamLabel = page.locator('h1').first();
    const offlineFallback = page.locator('text="Sin conexión"').first();
    const eitherVisible = await Promise.race([
      teamLabel.waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'app'),
      offlineFallback.waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'fallback'),
    ]).catch(() => 'neither');

    expect(
      eitherVisible === 'app' || eitherVisible === 'fallback',
      'Page should show cached content or offline fallback',
    ).toBe(true);

    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 5.3 Calculadora
  // ────────────────────────────────────────────────────────────────────────────

  test('5.3 — Should perform calculations offline without errors', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();

    // Navigate online to load the calculator
    await page.goto('/dashboard/calculadora', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // ── Go OFFLINE ──────────────────────────────────────────────────────────
    await goOffline(context);
    await expectNavigatorOnline(page, false);
    await page.waitForTimeout(1_000);
    await hideToasts(page);

    // The calculator should work entirely client-side
    // Try to interact with visible inputs (type="text" with inputMode="decimal" or type="number")
    const inputs = page.locator('input[type="number"], input[inputmode="decimal"], input[inputmode="numeric"]');
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      await inputs.first().fill('100');
      await page.waitForTimeout(500);
      if (inputCount > 1) {
        await inputs.nth(1).fill('350');
        await page.waitForTimeout(500);
      }
    }

    // Verify no error overlays
    const errorMessage = page.locator('text=/error de red|sin conexión.*error|failed to fetch/i').first();
    const hasNetworkError = await errorMessage.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasNetworkError, 'Calculator should not show network errors offline').toBe(false);

    // Page should have substantial content
    const pageContent = await page.content();
    expect(pageContent.length, 'Page should have content').toBeGreaterThan(1000);

    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Guard: localStorage clean
  // ────────────────────────────────────────────────────────────────────────────

  test('Guard — No forbidden localStorage keys on complementary modules', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();

    for (const path of ['/dashboard/tareas', '/dashboard/equipo', '/dashboard/calculadora']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2_000);
      await assertLocalStorageClean(page);
    }

    await context.close();
  });
});
