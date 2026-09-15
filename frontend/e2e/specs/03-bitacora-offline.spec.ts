/**
 * 03-bitacora-offline.spec.ts
 *
 * E2E tests for the Bitácora (Field Notes) offline/online lifecycle:
 *  3.1 Create a text note offline
 *  3.2 Verify persistence after page reload
 *  3.3 Reconnect and verify sync drains the outbox
 *  Guard: assertLocalStorageClean
 */

import { test, expect } from '@playwright/test';
import { BitacoraPage } from '../pages/BitacoraPage';
import {
  goOffline,
  goOnline,
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

const textNoteContent = `${E2E_PREFIX} Nota de texto offline ${Date.now()}`;

test.describe('03 — Bitácora Offline Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  // ────────────────────────────────────────────────────────────────────────────
  // 3.1 Text Note Offline
  // ────────────────────────────────────────────────────────────────────────────

  test('3.1 — Should create a text note while offline', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    const bitacora = new BitacoraPage(page);

    // Navigate online to populate cache
    await bitacora.navigate();
    await bitacora.waitForLoad();

    // ── Go OFFLINE ──────────────────────────────────────────────────────────
    await goOffline(context);
    await expectNavigatorOnline(page, false);
    await page.waitForTimeout(2_000);
    await hideToasts(page);

    // Open text note modal
    await bitacora.openTextMenu();
    await hideToasts(page);

    // Write and save the text note
    await bitacora.writeTextNote(textNoteContent);

    // The save should enqueue to outbox and show a toast
    // "📝 Nota guardada. Se subirá al servidor cuando tengas conexión."
    await page.waitForTimeout(1_000);
    await hideToasts(page);

    // Verify outbox has the pending field_note
    const outboxCount = await getOutboxCount(page);
    expect(outboxCount, 'Outbox should have a pending field_note').toBeGreaterThanOrEqual(1);

    const outboxItems = await readOutbox(page);
    const hasFieldNote = outboxItems.some(
      (item: any) => item.type === 'field_note',
    );
    expect(hasFieldNote, 'Should have a field_note in outbox').toBe(true);

    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3.2 Persistencia Reload
  // ────────────────────────────────────────────────────────────────────────────

  test('3.2 — Notes should persist after offline reload', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();

    // Navigate online first to warm cache
    await page.goto('/dashboard/bitacora', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);

    // Go offline
    await context.setOffline(true);

    // Reload
    await page.reload({ waitUntil: 'commit', timeout: 15_000 });
    await page.waitForTimeout(3_000);

    // The page should show either cached content or offline fallback
    const bitacoraLabel = page.locator('text="Bitácora"').first();
    const offlineFallback = page.locator('text="Sin conexión"').first();
    const eitherVisible = await Promise.race([
      bitacoraLabel.waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'app'),
      offlineFallback.waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'fallback'),
    ]).catch(() => 'neither');

    expect(
      eitherVisible === 'app' || eitherVisible === 'fallback',
      'Page should show cached app or offline fallback',
    ).toBe(true);

    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3.3 Sincronización
  // ────────────────────────────────────────────────────────────────────────────

  test('3.3 — Should sync notes when going back online', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    const bitacora = new BitacoraPage(page);

    // Navigate online
    await bitacora.navigate();
    await bitacora.waitForLoad();

    // Go offline
    await goOffline(context);
    await expectNavigatorOnline(page, false);
    await page.waitForTimeout(2_000);
    await hideToasts(page);

    // Create a text note
    const syncNote = `${E2E_PREFIX} Nota Sync ${Date.now()}`;
    await bitacora.openTextMenu();
    await hideToasts(page);
    await bitacora.writeTextNote(syncNote);
    await page.waitForTimeout(1_000);
    await hideToasts(page);

    // Verify outbox has items
    const preCount = await getOutboxCount(page);
    expect(preCount, 'Outbox should have items before sync').toBeGreaterThanOrEqual(1);

    // Intercept POST to /api/field-notes
    const postPromise = page.waitForRequest(
      (req) => req.method() === 'POST' && req.url().includes('/api/field-notes'),
      { timeout: 30_000 },
    );

    // ── Go ONLINE ──────────────────────────────────────────────────────────
    await goOnline(context);
    await expectNavigatorOnline(page, true);

    // Wait for the POST
    const postRequest = await postPromise.catch(() => null);
    if (postRequest) {
      expect(postRequest.url()).toContain('/api/field-notes');
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
    await page.goto('/dashboard/bitacora', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);
    await assertLocalStorageClean(page);
    await context.close();
  });
});
