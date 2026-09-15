/**
 * e2e/helpers/offline.helper.ts
 *
 * Utilidades para tests E2E de ciclo offline/online en RODEO.
 * Incluye: toggle de red, lectura de IndexedDB, outbox inspection,
 * guardrail de localStorage, helpers de media mock, y wait helpers.
 */

import { type Page, type BrowserContext, expect } from '@playwright/test';

// ─── Network Toggle ──────────────────────────────────────────────────────────

/** Simulate going offline at the browser level */
export async function goOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true);
  // Give the app time to detect the offline state
  await context.pages()[0]?.waitForTimeout(500);
}

/** Simulate restoring connectivity */
export async function goOnline(context: BrowserContext): Promise<void> {
  await context.setOffline(false);
  // Give the app time to detect online and trigger sync
  await context.pages()[0]?.waitForTimeout(1_000);
}

// ─── IndexedDB Inspection ────────────────────────────────────────────────────

/**
 * Read all records from an IndexedDB object store.
 * Database: rodeo-offline-db (the main app database)
 */
export async function readIndexedDB(
  page: Page,
  storeName: string,
  dbName = 'rodeo-offline-db',
  dbVersion = 3,
): Promise<any[]> {
  return page.evaluate(
    ({ dbName, dbVersion, storeName }) => {
      return new Promise<any[]>((resolve, reject) => {
        const req = indexedDB.open(dbName, dbVersion);
        req.onerror = () => reject(new Error(`Failed to open ${dbName}`));
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            resolve([]);
            return;
          }
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const getAll = store.getAll();
          getAll.onsuccess = () => {
            db.close();
            resolve(getAll.result || []);
          };
          getAll.onerror = () => {
            db.close();
            reject(new Error(`Failed to getAll from ${storeName}`));
          };
        };
      });
    },
    { dbName, dbVersion, storeName },
  );
}

/**
 * Read all items from the outbox store in rodeo-offline-db
 */
export async function readOutbox(page: Page): Promise<any[]> {
  return readIndexedDB(page, 'outbox');
}

/**
 * Get the count of pending items in the outbox
 */
export async function getOutboxCount(page: Page): Promise<number> {
  const items = await readOutbox(page);
  return items.length;
}

/**
 * Wait for the outbox to be fully drained (all items synced).
 * Polls every 2 seconds up to the given timeout.
 */
export async function waitForOutboxEmpty(
  page: Page,
  timeout = 60_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const count = await getOutboxCount(page);
    if (count === 0) return;
    await page.waitForTimeout(2_000);
  }
  // Final assertion for clear error message
  const finalCount = await getOutboxCount(page);
  expect(finalCount, `Outbox still has ${finalCount} items after ${timeout}ms`).toBe(0);
}

/**
 * Read all records from the media IndexedDB (rodeo_offline_audio).
 */
export async function readMediaStore(
  page: Page,
  storeName: 'pending_audios' | 'pending_photos',
): Promise<any[]> {
  return readIndexedDB(page, storeName, 'rodeo_offline_audio', 2);
}

// ─── localStorage Guardrail ──────────────────────────────────────────────────

/**
 * Assert that no legacy/forbidden localStorage keys exist.
 * RODEO migrated everything to IndexedDB; these keys should NOT be present.
 */
const FORBIDDEN_LS_KEYS = [
  'rodeo_cached_herds',
  'rodeo_cached_notes_bitacora',
  'rodeo_cached_paddocks',
  'rodeo_offline_queue',
  'rodeo_cached_farm_events',
];

export async function assertLocalStorageClean(page: Page): Promise<void> {
  const violations = await page.evaluate((keys) => {
    return keys.filter(k => localStorage.getItem(k) !== null);
  }, FORBIDDEN_LS_KEYS);

  expect(
    violations,
    `Forbidden localStorage keys found: ${violations.join(', ')}. ` +
    `RODEO should use IndexedDB exclusively.`,
  ).toHaveLength(0);
}

// ─── Sync Event Helpers ──────────────────────────────────────────────────────

/**
 * Wait for the 'rodeo_sync_completed' CustomEvent on the window.
 * Resolves when the event fires, or rejects after timeout.
 */
export async function waitForSyncComplete(
  page: Page,
  timeout = 45_000,
): Promise<void> {
  await page.evaluate((timeout) => {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('rodeo_sync_completed not received')),
        timeout,
      );
      window.addEventListener(
        'rodeo_sync_completed',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }, timeout);
}

/**
 * Wait for the 'rodeo_prefetch_done' CustomEvent on the window.
 */
export async function waitForPrefetchDone(
  page: Page,
  timeout = 30_000,
): Promise<void> {
  await page.evaluate((timeout) => {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('rodeo_prefetch_done not received')),
        timeout,
      );
      window.addEventListener(
        'rodeo_prefetch_done',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }, timeout);
}

// ─── Mock Media Helpers ──────────────────────────────────────────────────────

/**
 * Create a 1x1 red PNG buffer for use as a mock image in file inputs.
 */
export function createMockImageBuffer(): Buffer {
  // Minimal valid PNG: 1x1 pixel, red (#FF0000)
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  return png;
}

/**
 * Inject a mock pending audio into the rodeo_offline_audio IndexedDB.
 * This simulates an audio recorded while offline without needing microphone access.
 */
export async function injectMockPendingAudio(
  page: Page,
  id: string,
  title = '[E2E-TEST] Audio mock',
): Promise<void> {
  await page.evaluate(
    ({ id, title }) => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('rodeo_offline_audio', 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('pending_audios')) {
            db.createObjectStore('pending_audios', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('pending_photos')) {
            db.createObjectStore('pending_photos', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('pending_audios', 'readwrite');
          // Create a minimal audio blob
          const blob = new Blob(['mock-audio-data'], { type: 'audio/webm' });
          tx.objectStore('pending_audios').put({
            id,
            blob,
            durationSecs: 5,
            lat: -34.6,
            lng: -58.4,
            createdAt: new Date().toISOString(),
            title,
            transcript: '[E2E-TEST] Transcripción de prueba',
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
        req.onerror = () => reject(req.error);
      });
    },
    { id, title },
  );
}

// ─── Naming Convention ───────────────────────────────────────────────────────

/** Prefix all E2E test entities to avoid polluting staging data */
export const E2E_PREFIX = '[E2E-TEST]';

/** Generate a unique E2E test name */
export function e2eName(base: string): string {
  const ts = Date.now().toString(36).slice(-4);
  return `${E2E_PREFIX} ${base} ${ts}`;
}

// ─── Navigator.onLine Check ─────────────────────────────────────────────────

/**
 * Verify the browser's navigator.onLine reflects expected state.
 */
export async function expectNavigatorOnline(
  page: Page,
  expected: boolean,
): Promise<void> {
  const actual = await page.evaluate(() => navigator.onLine);
  expect(actual, `Expected navigator.onLine to be ${expected}`).toBe(expected);
}
