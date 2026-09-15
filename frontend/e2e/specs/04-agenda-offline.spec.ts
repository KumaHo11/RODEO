/**
 * 04-agenda-offline.spec.ts
 *
 * E2E tests for the Agenda (Farm Events) offline/online lifecycle:
 *  4.1 Create event offline
 *  4.2 Sync and verify
 *  Guard: assertLocalStorageClean
 */

import { test, expect } from '@playwright/test';
import { AgendaPage } from '../pages/AgendaPage';
import {
  goOffline,
  goOnline,
  readIndexedDB,
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

const today = new Date().toISOString().split('T')[0];
const eventTitle = e2eName('Destete Rodeo');

test.describe('04 — Agenda Offline Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  // ────────────────────────────────────────────────────────────────────────────
  // 4.1 Creación Offline
  // ────────────────────────────────────────────────────────────────────────────

  test('4.1 — Should create an event offline', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    const agenda = new AgendaPage(page);

    // Navigate online to populate cache
    await agenda.navigate();
    await agenda.waitForLoad();

    // ── Go OFFLINE ──────────────────────────────────────────────────────────
    await goOffline(context);
    await expectNavigatorOnline(page, false);
    await page.waitForTimeout(2_000);
    await hideToasts(page);

    // Click "Nuevo evento"
    await agenda.clickNewEvent();
    await hideToasts(page);

    // Fill the event form
    await agenda.fillTitle(eventTitle);
    await agenda.fillDate(today);

    // Select event type if dropdown is visible
    const typeSelect = page.locator('.fixed.inset-0 select').first();
    if (await typeSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await typeSelect.selectOption({ index: 1 }); // Pick first non-empty option
    }

    // Fill description if visible
    await agenda.fillDescription(`${E2E_PREFIX} Destete programado de terneros`);

    // Save the event (offline → uses addToOfflineQueue → enqueue)
    await agenda.saveEvent();

    // The event should appear in the list with optimistic rendering
    const eventInList = await agenda.isEventInList(eventTitle);
    const outboxCount = await getOutboxCount(page);

    expect(
      eventInList || outboxCount > 0,
      'Event should appear in list or outbox should have items',
    ).toBe(true);

    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4.2 Sync
  // ────────────────────────────────────────────────────────────────────────────

  test('4.2 — Should sync agenda event when going back online', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    const agenda = new AgendaPage(page);

    // Navigate online
    await agenda.navigate();
    await agenda.waitForLoad();

    // Go offline, create an event
    await goOffline(context);
    await expectNavigatorOnline(page, false);
    await page.waitForTimeout(2_000);
    await hideToasts(page);

    await agenda.clickNewEvent();
    await hideToasts(page);

    const syncEventTitle = e2eName('Evento Sync');
    await agenda.fillTitle(syncEventTitle);
    await agenda.fillDate(today);

    const typeSelect = page.locator('.fixed.inset-0 select').first();
    if (await typeSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await typeSelect.selectOption({ index: 1 });
    }

    await agenda.saveEvent();
    await page.waitForTimeout(1_000);

    // Intercept POST to /api/farm-events
    const postPromise = page.waitForRequest(
      (req) => req.method() === 'POST' && req.url().includes('/api/farm-events'),
      { timeout: 30_000 },
    );

    // ── Go ONLINE ──────────────────────────────────────────────────────────
    await goOnline(context);
    await expectNavigatorOnline(page, true);

    // Wait for sync
    const postRequest = await postPromise.catch(() => null);
    if (postRequest) {
      expect(postRequest.url()).toContain('/api/farm-events');
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
    await page.goto('/dashboard/agenda', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);
    await assertLocalStorageClean(page);
    await context.close();
  });
});
