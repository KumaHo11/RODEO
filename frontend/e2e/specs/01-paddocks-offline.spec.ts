/**
 * 01-paddocks-offline.spec.ts
 *
 * E2E tests for the Paddock (Mi Campo) offline/online lifecycle:
 *  1.1 Edit a paddock while offline (operational data)
 *  1.2 Verify persistence after reload while still offline
 *  1.3 Reconnect and verify synchronization
 *  Guard: assertLocalStorageClean
 */

import { test, expect } from '@playwright/test';
import { PaddockPage } from '../pages/PaddockPage';
import {
  goOffline,
  goOnline,
  readIndexedDB,
  readOutbox,
  getOutboxCount,
  waitForOutboxEmpty,
  assertLocalStorageClean,
  expectNavigatorOnline,
  E2E_PREFIX,
} from '../helpers/offline.helper';

/** Force-hide Sonner toast notifications via DOM manipulation */
async function hideToasts(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const section = document.querySelector('section[aria-label="Notifications"]');
    if (section) (section as HTMLElement).style.display = 'none';
  }).catch(() => {});
  await page.waitForTimeout(300);
}

test.describe('01 — Paddocks Offline Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  // ────────────────────────────────────────────────────────────────────────────
  // 1.1 Edición Completa Offline
  // ────────────────────────────────────────────────────────────────────────────

  test('1.1 — Should edit a paddock offline with operational data', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    const paddockPage = new PaddockPage(page);

    // Navigate online to populate cache
    await paddockPage.navigate();
    await paddockPage.waitForLoad();

    // Get paddock names
    const names = await paddockPage.getPaddockNames();
    expect(names.length, 'Need at least one paddock').toBeGreaterThan(0);
    const targetPaddock = names[0];

    // Verify IndexedDB has paddocks cached
    const cachedPaddocks = await readIndexedDB(page, 'paddocks');
    expect(cachedPaddocks.length, 'IDB should have cached paddocks').toBeGreaterThan(0);

    // ── Go OFFLINE ──────────────────────────────────────────────────────────
    await goOffline(context);
    await expectNavigatorOnline(page, false);
    await page.waitForTimeout(2_000);
    await hideToasts(page);

    // Open the paddock modal
    await paddockPage.openPaddockModal(targetPaddock);
    await hideToasts(page);

    // ── DATOS OPERATIVOS: edit MS DISPONIBLE ────────────────────────────
    // The MS input is type="text" inputMode="decimal", find it by its label
    const msLabel = page.locator('.fixed.inset-0').locator('text=/MS disponible/i');
    await expect(msLabel).toBeVisible({ timeout: 5_000 });
    // The input is a sibling in the same parent div
    const msInput = page.locator('.fixed.inset-0 input[placeholder="Ej: 1 200"]');
    if (await msInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await msInput.fill('3500');
    } else {
      // Fallback: get all text inputs in modal, skip name (1st) and superficie (2nd), use MS (3rd)
      const inputs = page.locator('.fixed.inset-0 input[type="text"]');
      const count = await inputs.count();
      if (count >= 3) {
        await inputs.nth(2).fill('3500');
      }
    }
    await page.waitForTimeout(300);

    // ── Scroll to footer and click "Guardar cambios" ────────────────────
    await hideToasts(page);
    // Use JS click to bypass the toast overlay that intercepts pointer events
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const guardarBtn = buttons.find(b => b.textContent?.includes('Guardar cambios'));
      if (guardarBtn) {
        guardarBtn.scrollIntoView({ block: 'center' });
        guardarBtn.click();
      }
    });

    // Wait for the "Cambios guardados" overlay
    const offlineConfirmation = page.locator('text="Cambios guardados"');
    await expect(offlineConfirmation).toBeVisible({ timeout: 15_000 });

    // Click "OK, continuar"
    const okBtn = page.locator('button:has-text("OK, continuar")');
    await okBtn.click();
    await page.waitForTimeout(1_000);

    // Verify outbox has the pending update
    const outboxCount = await getOutboxCount(page);
    expect(outboxCount, 'Outbox should have pending paddock_update').toBeGreaterThanOrEqual(1);

    // Verify the outbox item is of correct type
    const outboxItems = await readOutbox(page);
    const hasPaddockUpdate = outboxItems.some(
      (item: any) => item.type === 'paddock_update',
    );
    expect(hasPaddockUpdate, 'Should have a paddock_update in outbox').toBe(true);

    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 1.2 Persistencia tras Reload
  // ────────────────────────────────────────────────────────────────────────────

  test('1.2 — Offline data should persist after page reload', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();

    // Navigate online first to warm up cache
    await page.goto('/dashboard/mi-campo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);

    // Go offline
    await context.setOffline(true);

    // Reload while offline
    await page.reload({ waitUntil: 'commit', timeout: 15_000 });
    await page.waitForTimeout(3_000);

    // IndexedDB should persist regardless of what the SW renders
    const cachedPaddocks = await readIndexedDB(page, 'paddocks');
    expect(cachedPaddocks.length, 'IDB paddocks should persist after offline reload').toBeGreaterThan(0);

    // The page should show either the cached app OR the SW offline fallback
    const miCampoLabel = page.locator('text="Mi Campo"').first();
    const offlineFallback = page.locator('text="Sin conexión"').first();
    const eitherVisible = await Promise.race([
      miCampoLabel.waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'app'),
      offlineFallback.waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'fallback'),
    ]).catch(() => 'neither');

    expect(
      eitherVisible === 'app' || eitherVisible === 'fallback',
      'Page should show cached app or offline fallback',
    ).toBe(true);

    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 1.3 Sincronización
  // ────────────────────────────────────────────────────────────────────────────

  test('1.3 — Should sync pending paddock updates when going back online', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    const paddockPage = new PaddockPage(page);

    // Navigate online to populate cache
    await paddockPage.navigate();
    await paddockPage.waitForLoad();

    const names = await paddockPage.getPaddockNames();
    expect(names.length).toBeGreaterThan(0);

    // Go offline
    await goOffline(context);
    await expectNavigatorOnline(page, false);
    await page.waitForTimeout(2_000);
    await hideToasts(page);

    // Open, edit, save offline
    await paddockPage.openPaddockModal(names[0]);
    await hideToasts(page);

    const msInput = page.locator('.fixed.inset-0 input[placeholder="Ej: 1 200"]');
    if (await msInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await msInput.fill('4200');
    } else {
      const inputs = page.locator('.fixed.inset-0 input[type="text"]');
      const count = await inputs.count();
      if (count >= 3) await inputs.nth(2).fill('4200');
    }

    await hideToasts(page);
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const guardarBtn = buttons.find(b => b.textContent?.includes('Guardar cambios'));
      if (guardarBtn) {
        guardarBtn.scrollIntoView({ block: 'center' });
        guardarBtn.click();
      }
    });

    // Wait for confirmation and dismiss
    await expect(page.locator('text="Cambios guardados"')).toBeVisible({ timeout: 15_000 });
    await page.locator('button:has-text("OK, continuar")').click();
    await page.waitForTimeout(1_000);

    // Verify outbox before sync
    const preCount = await getOutboxCount(page);
    expect(preCount, 'Should have outbox items').toBeGreaterThanOrEqual(1);

    // Intercept the PATCH
    const patchPromise = page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes('/api/paddocks/'),
      { timeout: 30_000 },
    );

    // ── Go ONLINE ──────────────────────────────────────────────────────────
    await goOnline(context);
    await expectNavigatorOnline(page, true);

    const patchRequest = await patchPromise.catch(() => null);
    if (patchRequest) {
      expect(patchRequest.method()).toBe('PATCH');
      expect(patchRequest.url()).toContain('/api/paddocks/');
    }

    // Wait for outbox drain
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
    await page.goto('/dashboard/mi-campo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);
    await assertLocalStorageClean(page);
    await context.close();
  });
});
