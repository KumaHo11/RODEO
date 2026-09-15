/**
 * e2e/pages/HerdPage.ts
 *
 * Page Object Model for Rodeos (Herds) section.
 */

import { type Page, type Locator, expect } from '@playwright/test';

export class HerdPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly loadingSpinner: Locator;
  readonly newHerdButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Rodeos")');
    this.loadingSpinner = page.locator('.animate-spin').first();
    this.newHerdButton = page.locator('.tour-nuevo-rodeo, button:has-text("Nuevo rodeo")').first();
  }

  async navigate(): Promise<void> {
    await this.page.goto('/dashboard/herds', { waitUntil: 'domcontentloaded' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await this.page.waitForTimeout(2_000);
  }

  /** Click "Nuevo rodeo" button */
  async clickNewHerd(): Promise<void> {
    await this.newHerdButton.click();
    await this.page.waitForSelector('.fixed.inset-0', { timeout: 10_000 });
    await this.page.waitForTimeout(500);
  }

  /** Open an existing herd by name */
  async openHerd(herdName: string): Promise<void> {
    const herdCard = this.page.locator(`text="${herdName}"`).first();
    await herdCard.click();
    await this.page.waitForSelector('.fixed.inset-0', { timeout: 10_000 });
    await this.page.waitForTimeout(500);
  }

  // ── Modal: Tab Navigation ──────────────────────────────────────────────────

  /** Switch tab in HerdModal. Tabs: 'DATOS OPERATIVOS', 'ACTIVIDADES', 'REGISTROS', 'HISTORIAL' */
  async switchTab(tabLabel: string): Promise<void> {
    const tab = this.page.locator(`button:has-text("${tabLabel}")`).first();
    const isDisabled = await tab.getAttribute('disabled');
    if (isDisabled !== null) {
      throw new Error(`Tab "${tabLabel}" is disabled (locked)`);
    }
    await tab.click();
    await this.page.waitForTimeout(300);
  }

  /** Check if a tab is enabled (not locked) */
  async isTabEnabled(tabLabel: string): Promise<boolean> {
    const tab = this.page.locator(`button:has-text("${tabLabel}")`).first();
    if (!(await tab.isVisible({ timeout: 3_000 }).catch(() => false))) return false;
    const disabled = await tab.getAttribute('disabled');
    const classList = await tab.getAttribute('class') || '';
    return disabled === null && !classList.includes('cursor-not-allowed');
  }

  // ── Modal: Tab 1 — Datos Operativos ────────────────────────────────────────

  /** Fill the herd name. Placeholder: "Ej: Vacas preñadas 2026" */
  async fillName(name: string): Promise<void> {
    const nameInput = this.page.locator('.fixed.inset-0 input[placeholder*="Ej:"]').first();
    if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nameInput.fill(name);
      return;
    }
    // Fallback: first text input in the modal
    const fallback = this.page.locator('.fixed.inset-0 input[type="text"]').first();
    await fallback.fill(name);
  }

  /** Select a commercial category button (e.g., "Ternero/a", "Vaca preñada") */
  async selectCategory(category: string): Promise<void> {
    // Category items are <button> elements inside the modal
    // Use JS click to bypass pointer interception from parent containers
    await this.page.evaluate((cat) => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;
      const buttons = Array.from(modal.querySelectorAll('button'));
      const catBtn = buttons.find(b => b.textContent?.includes(cat));
      if (catBtn) {
        catBtn.scrollIntoView({ block: 'center' });
        catBtn.click();
      }
    }, category);
    await this.page.waitForTimeout(300);
  }

  /** Fill head count — looks for input near CABEZAS label */
  async fillHeadCount(count: number): Promise<void> {
    const input = this.page.locator('.fixed.inset-0 input[placeholder*="cabeza"], .fixed.inset-0 input[placeholder*="cantidad"]').first();
    if (await input.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await input.fill(String(count));
      return;
    }
    // Fallback: any number-like input
    const fallback = this.page.locator('.fixed.inset-0 input[inputmode="numeric"], .fixed.inset-0 input[type="number"]').first();
    if (await fallback.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await fallback.fill(String(count));
    }
  }

  /** Fill average weight */
  async fillWeight(weight: number): Promise<void> {
    const input = this.page.locator('.fixed.inset-0 input[placeholder*="kg"], .fixed.inset-0 input[placeholder*="peso"]').first();
    if (await input.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await input.fill(String(weight));
    }
  }

  /** Save the herd modal */
  async saveHerd(): Promise<void> {
    // Use JS click to bypass toast overlay interference
    await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find(b => 
        b.textContent?.includes('Guardar') || b.textContent?.includes('Crear rodeo')
      );
      if (saveBtn) {
        saveBtn.scrollIntoView({ block: 'center' });
        saveBtn.click();
      }
    });
    await this.page.waitForTimeout(2_000);
  }

  /** Close the modal */
  async closeModal(): Promise<void> {
    const closeBtn = this.page.locator('button[aria-label="Cerrar"], button >> svg.lucide-x').first();
    await closeBtn.click();
    await this.page.waitForTimeout(500);
  }

  // ── Modal: Tab 2 — Actividades ─────────────────────────────────────────────

  /** Click an activity type button */
  async selectActivity(activityLabel: string): Promise<void> {
    const actBtn = this.page.locator(`button:has-text("${activityLabel}"), div:has-text("${activityLabel}")`).first();
    await actBtn.click();
    await this.page.waitForTimeout(300);
  }

  /** Fill the activity count */
  async fillActivityCount(count: number): Promise<void> {
    const input = this.page.locator('input[type="number"]').first();
    await input.fill(String(count));
  }

  /** Fill activity date */
  async fillActivityDate(date: string): Promise<void> {
    const input = this.page.locator('input[type="date"]').first();
    await input.fill(date);
  }

  /** Submit the activity */
  async submitActivity(): Promise<void> {
    await this.page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b =>
        b.textContent?.includes('Registrar') || b.textContent?.includes('Confirmar')
      );
      if (btn) btn.click();
    });
    await this.page.waitForTimeout(1_000);
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  /** Check if a herd with the given name is visible in the list */
  async hasHerd(name: string): Promise<boolean> {
    const item = this.page.locator(`text="${name}"`).first();
    return item.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  /** Get the head count displayed for a herd */
  async getHeadCount(herdName: string): Promise<number | null> {
    const card = this.page.locator(`text="${herdName}"`).first().locator('..');
    const countEl = card.locator('text=/\\d+ cab/i').first();
    const text = await countEl.textContent().catch(() => null);
    if (!text) return null;
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /** Check if the pending/offline badge is visible */
  async isPendingBadgeVisible(): Promise<boolean> {
    const badge = this.page.locator('text=/pendiente|sin conexión|offline|guardado/i').first();
    return badge.isVisible({ timeout: 3_000 }).catch(() => false);
  }
}
