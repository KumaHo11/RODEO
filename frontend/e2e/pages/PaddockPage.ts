/**
 * e2e/pages/PaddockPage.ts
 *
 * Page Object Model for Mi Campo (Paddocks) section.
 * Encapsulates selectors and actions for the paddock list, map, and PaddockModal.
 */

import { type Page, type Locator, expect } from '@playwright/test';

export class PaddockPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Navigate to Mi Campo */
  async navigate(): Promise<void> {
    await this.page.goto('/dashboard/mi-campo', { waitUntil: 'domcontentloaded' });
  }

  /** Wait for the page to finish loading */
  async waitForLoad(): Promise<void> {
    // The Mi Campo page has no <h1>. Wait for the "Potreros" label or "Mi Campo" label
    const potreros = this.page.locator('text=/Potreros.*\\(\\d+\\)/');
    const miCampo = this.page.locator('text="Mi Campo"').first();
    const editar = this.page.locator('button:has-text("Editar")').first();

    // Wait for any of these indicators to appear
    await Promise.race([
      potreros.first().waitFor({ state: 'visible', timeout: 30_000 }),
      miCampo.waitFor({ state: 'visible', timeout: 30_000 }),
    ]).catch(() => {});

    // Wait for loading skeletons to disappear
    const skeleton = this.page.locator('.animate-pulse').first();
    await skeleton.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});

    // Give IndexedDB prefetch time to populate
    await this.page.waitForTimeout(2_000);
  }

  /** Get all visible paddock names from the side panel */
  async getPaddockNames(): Promise<string[]> {
    // Paddock names are in <h3> elements with font-black inside the cards
    const items = this.page.locator('h3.font-black.text-gray-950, h3.font-black');
    const count = await items.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await items.nth(i).textContent();
      if (text?.trim()) names.push(text.trim());
    }
    return names;
  }

  /** Click "Editar" on a paddock card to open its modal */
  async openPaddockModal(paddockName: string): Promise<void> {
    // Each paddock card has cursor-pointer class (parent containers don't)
    const paddockCard = this.page.locator('div.cursor-pointer.rounded-2xl').filter({
      has: this.page.locator(`h3:has-text("${paddockName}")`),
    }).first();

    const editBtn = paddockCard.locator('button:has-text("Editar")').first();
    await editBtn.click();

    // Wait for the modal to appear (it's rendered as a fixed overlay)
    await this.page.waitForSelector('.fixed.inset-0', { timeout: 10_000 });
    await this.page.waitForTimeout(500);
  }

  // ── Modal: Tab Navigation ──────────────────────────────────────────────────

  /** Switch to a tab in the PaddockModal by label text */
  async switchTab(tabLabel: string): Promise<void> {
    // Tabs use uppercase text, match case-insensitively
    const tabButton = this.page.locator('.fixed.inset-0 button').filter({
      hasText: new RegExp(tabLabel, 'i'),
    }).first();
    await tabButton.click();
    await this.page.waitForTimeout(300);
  }

  // ── Modal: Tab 1 — Datos Operativos ────────────────────────────────────────

  /** Fill the paddock name field */
  async fillName(name: string): Promise<void> {
    const nameInput = this.page.locator('.fixed.inset-0 input').first();
    await nameInput.fill(name);
  }

  /** Get the current paddock name value */
  async getName(): Promise<string> {
    const nameInput = this.page.locator('.fixed.inset-0 input').first();
    return nameInput.inputValue();
  }

  /** Fill the dry matter field (kg MS/ha) */
  async fillDryMatter(value: string): Promise<void> {
    // Find the input near "MATERIA SECA" or "MS/HA" label
    const msInput = this.page.locator('.fixed.inset-0 input[placeholder*="kg"], .fixed.inset-0 input[type="number"]').nth(1);
    if (await msInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await msInput.fill(value);
    }
  }

  // ── Modal: Tab 2 — Infraestructura ─────────────────────────────────────────

  /** Toggle the water point switch */
  async toggleWaterPoint(): Promise<void> {
    const toggle = this.page.locator('.fixed.inset-0 button[class*="rounded-full"]').first();
    if (await toggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toggle.click();
    }
  }

  // ── Modal: Tab 3 — Registros ───────────────────────────────────────────────

  /** Write content in the note text area */
  async writeNote(content: string): Promise<void> {
    const textarea = this.page.locator('.fixed.inset-0 textarea').first();
    if (await textarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await textarea.fill(content);
    }
  }

  // ── Modal: Save & Close ────────────────────────────────────────────────────

  /** Click the main Save button on the modal */
  async saveModal(): Promise<void> {
    // The save button is at the bottom of the modal (green button with Check icon)
    const saveBtn = this.page.locator('.fixed.inset-0 button:has-text("Guardar")').first();
    await saveBtn.click();
    await this.page.waitForTimeout(2_000);
  }

  /** Close the modal */
  async closeModal(): Promise<void> {
    const closeBtn = this.page.locator('.fixed.inset-0 button[aria-label="Cerrar modal"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await this.page.waitForTimeout(500);
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  /** Check if the offline/pending badge is visible */
  async isPendingBadgeVisible(): Promise<boolean> {
    const badge = this.page.locator('text=/pendiente|sin conexión|offline/i').first();
    return badge.isVisible({ timeout: 3_000 }).catch(() => false);
  }

  /** Check if a specific paddock exists in the list */
  async hasPaddock(name: string): Promise<boolean> {
    const item = this.page.locator(`h3:has-text("${name}")`).first();
    return item.isVisible({ timeout: 5_000 }).catch(() => false);
  }
}
