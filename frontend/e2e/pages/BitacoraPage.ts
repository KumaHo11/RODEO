/**
 * e2e/pages/BitacoraPage.ts
 *
 * Page Object Model for Bitácora (Field Notes) section.
 */

import { type Page, type Locator, expect } from '@playwright/test';

export class BitacoraPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Bitácora")');
    this.loadingSpinner = page.locator('.animate-spin').first();
  }

  async navigate(): Promise<void> {
    await this.page.goto('/dashboard/bitacora', { waitUntil: 'domcontentloaded' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await this.page.waitForTimeout(2_000);
  }

  // ── Text Note ──────────────────────────────────────────────────────────────

  /** Open the text note modal by clicking the FileText icon button */
  async openTextMenu(): Promise<void> {
    // The text button is a round button with FileText icon, no text label
    // It's the 3rd action button in the bottom panel (camera, record, text)
    // We can target it by looking for the icon or by position
    const textBtn = this.page.locator('button >> svg.lucide-file-text').first();
    if (await textBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await textBtn.click();
    } else {
      // Fallback: find button containing FileText-like SVG near the record area
      // The text button is at the right of the central record button
      await this.page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        // Look for the button that triggers setShowTextMenu
        const textBtn = btns.find(b => {
          const svg = b.querySelector('svg');
          return svg && b.className.includes('rounded-full') && b.className.includes('w-14');
        });
        // The text button is the second w-14 button (first is camera)
        const smallButtons = btns.filter(b => b.className.includes('w-14') && b.className.includes('rounded-full'));
        if (smallButtons.length >= 2) smallButtons[1].click();
        else if (smallButtons.length === 1) smallButtons[0].click();
      });
    }
    await this.page.waitForTimeout(500);
  }

  /** Write and save a text note in the text menu modal */
  async writeTextNote(text: string): Promise<void> {
    // The text modal has title "Agregar texto" and a textarea
    const addTextTitle = this.page.locator('h3:has-text("Agregar texto")');
    await expect(addTextTitle).toBeVisible({ timeout: 5_000 });

    const textarea = this.page.locator('textarea[placeholder*="Ej:"]').first();
    await textarea.fill(text);
    await this.page.waitForTimeout(200);

    // Click "Guardar nota" button
    await this.page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent?.includes('Guardar nota'));
      if (saveBtn) saveBtn.click();
    });
    await this.page.waitForTimeout(1_500);
  }

  // ── Photo Note ─────────────────────────────────────────────────────────────

  /** Simulate attaching a photo via file input */
  async capturePhoto(buffer: Buffer, description?: string): Promise<void> {
    // Click the camera button (first w-14 rounded button)
    const cameraBtn = this.page.locator('button >> svg.lucide-camera').first();
    if (await cameraBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cameraBtn.click();
      await this.page.waitForTimeout(500);
    }

    // The photo menu shows options. Look for a file input
    const fileInput = this.page.locator('input[type="file"][accept*="image"]').first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles({
        name: 'e2e-photo.jpg',
        mimeType: 'image/jpeg',
        buffer,
      });
      await this.page.waitForTimeout(1_000);

      // Fill description if textarea visible
      if (description) {
        const textarea = this.page.locator('textarea').first();
        if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await textarea.fill(description);
        }
      }

      // Save via JS click
      await this.page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const saveBtn = btns.find(b =>
          b.textContent?.includes('Guardar') || b.textContent?.includes('Subir')
        );
        if (saveBtn && !saveBtn.disabled) saveBtn.click();
      });
      await this.page.waitForTimeout(1_500);
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** Get visible note titles from the history list */
  async getNoteTitles(): Promise<string[]> {
    const titles = this.page.locator('.font-bold.text-gray-950, p.font-bold');
    const count = await titles.count();
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await titles.nth(i).textContent();
      if (text?.trim()) result.push(text.trim());
    }
    return result;
  }

  /** Get the pending offline count from the badge */
  async getPendingCount(): Promise<number> {
    const badge = this.page.locator('text=/\\d+ pendiente/i').first();
    if (!(await badge.isVisible({ timeout: 3_000 }).catch(() => false))) return 0;
    const text = await badge.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /** Check if a note containing the given text is visible */
  async isNoteVisible(textContent: string): Promise<boolean> {
    const note = this.page.locator(`text="${textContent}"`).first();
    return note.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  /** Check if "Pendiente" badges are visible */
  async hasPendingBadges(): Promise<boolean> {
    const badge = this.page.locator('text=/Pendiente/i').first();
    return badge.isVisible({ timeout: 3_000 }).catch(() => false);
  }
}
