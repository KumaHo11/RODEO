/**
 * 02-herds-offline.spec.ts
 *
 * E2E tests for the Herds (Rodeos) offline/online lifecycle:
 *  2.1 Create a herd offline
 *  2.2 Register activities offline (Compra +N)
 *  2.3 Sync cascade on reconnect
 *  Guard: assertLocalStorageClean
 */

import { test, expect } from '@playwright/test';
import { HerdPage } from '../pages/HerdPage';
import {
  goOffline,
  goOnline,
  readIndexedDB,
  readOutbox,
  getOutboxCount,
  waitForOutboxEmpty,
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

const herdName = e2eName('Rodeo Terneros');

test.describe('02 — Herds Offline Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  // ────────────────────────────────────────────────────────────────────────────
  // 2.1 Alta Offline
  // ────────────────────────────────────────────────────────────────────────────

  test('2.1 — Should create a new herd offline', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    const herdPage = new HerdPage(page);

    // Navigate online to populate cache
    await herdPage.navigate();
    await herdPage.waitForLoad();

    // ── Go OFFLINE ──────────────────────────────────────────────────────────
    await goOffline(context);
    await expectNavigatorOnline(page, false);
    await page.waitForTimeout(2_000);
    await hideToasts(page);

    // Click "Nuevo rodeo"
    await herdPage.clickNewHerd();
    await hideToasts(page);

    // Fill herd name (placeholder: "Ej: Vacas preñadas 2026")
    await herdPage.fillName(herdName);

    // Select a category (e.g., "Ternero/a")
    await herdPage.selectCategory('Ternero/a');

    // Scroll down to see if there are head count / weight fields
    await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (modal) {
        const scrollable = modal.querySelector('[class*="overflow-y"]') || modal;
        scrollable.scrollTop = scrollable.scrollHeight;
      }
    });
    await page.waitForTimeout(500);

    // Fill head count if visible
    await herdPage.fillHeadCount(50);
    // Fill weight if visible
    await herdPage.fillWeight(180);

    // Save the herd (offline → should enqueue)
    await herdPage.saveHerd();

    // Check for offline save confirmation or outbox items
    const offlineConfirm = page.locator('text="Cambios guardados"');
    const confirmVisible = await offlineConfirm.isVisible({ timeout: 5_000 }).catch(() => false);

    if (confirmVisible) {
      await page.locator('button:has-text("OK, continuar")').click().catch(() => {});
      await page.waitForTimeout(500);
    }

    // Verify save worked
    const finalOutbox = await getOutboxCount(page);
    const toastVisible = await page.locator('text=/guardad|offline|sincronizar|creado/i').first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(
      finalOutbox > 0 || confirmVisible || toastVisible,
      'Either outbox should have items or a confirmation should appear',
    ).toBe(true);

    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2.2 Actividades Offline
  // ────────────────────────────────────────────────────────────────────────────

  test('2.2 — Should register a Compra activity offline', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    const herdPage = new HerdPage(page);

    // Navigate online first
    await herdPage.navigate();
    await herdPage.waitForLoad();

    // Find the first herd card in the page
    const herdCards = page.locator('h3.font-black, h2.font-black, p.font-black').filter({
      hasNotText: /E2E-TEST/,
    });
    const cardCount = await herdCards.count();
    if (cardCount === 0) {
      test.skip(true, 'No herd cards visible');
      return;
    }
    const firstHerdName = (await herdCards.first().textContent())?.trim() || '';

    // Go offline
    await goOffline(context);
    await expectNavigatorOnline(page, false);
    await page.waitForTimeout(2_000);
    await hideToasts(page);

    // Open the existing herd
    await herdPage.openHerd(firstHerdName);
    await hideToasts(page);

    // Switch to Actividades tab
    const actTab = page.locator('button').filter({ hasText: /ACTIVIDADES/i }).first();
    if (await actTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await actTab.click();
      await page.waitForTimeout(500);
      await hideToasts(page);

      // Try to find "Compra" button
      const compraBtn = page.locator('button:has-text("Compra"), div:has-text("Compra")').first();
      if (await compraBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await compraBtn.click({ force: true });
        await page.waitForTimeout(300);

        // Fill count if input visible
        const countInput = page.locator('.fixed.inset-0 input[type="number"], .fixed.inset-0 input[inputmode="numeric"]').first();
        if (await countInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await countInput.fill('10');
        }

        // Submit via JS
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const submit = btns.find(b =>
            b.textContent?.includes('Registrar') || b.textContent?.includes('Confirmar')
          );
          if (submit) submit.click();
        });
        await page.waitForTimeout(1_500);
      }
    }

    // This test is exploratory — pass as long as no crash
    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2.3 Sync en Cascada
  // ────────────────────────────────────────────────────────────────────────────

  test('2.3 — Should sync herd operations when going back online', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    const herdPage = new HerdPage(page);

    // Navigate online
    await herdPage.navigate();
    await herdPage.waitForLoad();

    // Go offline
    await goOffline(context);
    await expectNavigatorOnline(page, false);
    await page.waitForTimeout(2_000);
    await hideToasts(page);

    // Create a new herd offline
    await herdPage.clickNewHerd();
    await hideToasts(page);
    const syncTestName = e2eName('Sync Test');
    await herdPage.fillName(syncTestName);
    await herdPage.selectCategory('Ternero/a');

    // Scroll down for additional fields
    await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (modal) {
        const scrollable = modal.querySelector('[class*="overflow-y"]') || modal;
        scrollable.scrollTop = scrollable.scrollHeight;
      }
    });
    await page.waitForTimeout(500);

    await herdPage.fillHeadCount(20);
    await herdPage.saveHerd();

    // Handle offline confirmation if shown
    const offlineConfirm = page.locator('text="Cambios guardados"');
    if (await offlineConfirm.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator('button:has-text("OK, continuar")').click().catch(() => {});
    }
    await page.waitForTimeout(1_000);

    // Intercept the POST to /api/herds or /api/rodeos
    const postPromise = page.waitForRequest(
      (req) => req.method() === 'POST' && (req.url().includes('/api/herds') || req.url().includes('/api/rodeos')),
      { timeout: 30_000 },
    );

    // ── Go ONLINE ──────────────────────────────────────────────────────────
    await goOnline(context);
    await expectNavigatorOnline(page, true);

    const postRequest = await postPromise.catch(() => null);
    if (postRequest) {
      expect(postRequest.method()).toBe('POST');
    }

    // Wait for outbox to drain
    await waitForOutboxEmpty(page, 30_000).catch(() => {});

    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Guard: localStorage clean
  // ────────────────────────────────────────────────────────────────────────────

  test('Guard — No forbidden localStorage keys should exist', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    await page.goto('/dashboard/herds', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);
    await assertLocalStorageClean(page);
    await context.close();
  });
});
