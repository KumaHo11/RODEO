/**
 * e2e/pages/AgendaPage.ts
 *
 * Page Object Model for Agenda (Farm Events) section.
 */

import { type Page, type Locator, expect } from '@playwright/test';

export class AgendaPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly loadingSpinner: Locator;
  readonly newEventButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Agenda")');
    this.loadingSpinner = page.locator('.animate-pulse').first();
    this.newEventButton = page.locator('.tour-nueva-fecha, button:has-text("Nuevo evento")').first();
  }

  async navigate(): Promise<void> {
    await this.page.goto('/dashboard/agenda', { waitUntil: 'domcontentloaded' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await this.page.waitForTimeout(2_000);
  }

  /** Click "Nuevo evento" */
  async clickNewEvent(): Promise<void> {
    await this.newEventButton.click();
    await this.page.waitForSelector('.fixed.inset-0', { timeout: 10_000 });
    await this.page.waitForTimeout(500);
  }

  // ── Event Form ─────────────────────────────────────────────────────────────

  /** Fill the event title */
  async fillTitle(title: string): Promise<void> {
    const input = this.page.locator('input[placeholder*="Vacunación"], input[placeholder*="Ej:"], label:has-text("TÍTULO") ~ input').first();
    await input.fill(title);
  }

  /** Select event type from dropdown */
  async selectEventType(type: string): Promise<void> {
    const select = this.page.locator('select').first();
    await select.selectOption({ label: type });
    await this.page.waitForTimeout(300);
  }

  /** Fill the event date */
  async fillDate(date: string): Promise<void> {
    const dateInput = this.page.locator('input[type="date"]').first();
    await dateInput.fill(date);
  }

  /** Fill the event end date */
  async fillEndDate(date: string): Promise<void> {
    const dateInput = this.page.locator('input[type="date"]').nth(1);
    if (await dateInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await dateInput.fill(date);
    }
  }

  /** Fill description */
  async fillDescription(desc: string): Promise<void> {
    const textarea = this.page.locator('textarea, input[placeholder*="descripción"]').first();
    if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await textarea.fill(desc);
    }
  }

  /** Check if a conditional field is visible (e.g., bull count for 'Servicio') */
  async isFieldVisible(labelText: string): Promise<boolean> {
    const field = this.page.locator(`text="${labelText}"`).first();
    return field.isVisible({ timeout: 3_000 }).catch(() => false);
  }

  /** Fill bull count (only for Servicio type) */
  async fillBullCount(count: number): Promise<void> {
    const input = this.page.locator('label:has-text("toros") ~ input, label:has-text("TOROS") ~ input, input[placeholder*="toros"]').first();
    if (await input.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await input.fill(String(count));
    }
  }

  /** Fill bull weight (only for Servicio type) */
  async fillBullWeight(weight: number): Promise<void> {
    const input = this.page.locator('label:has-text("peso") ~ input, label:has-text("PESO") ~ input').last();
    if (await input.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await input.fill(String(weight));
    }
  }

  /** Save the event */
  async saveEvent(): Promise<void> {
    // Button text is "Crear Evento" for new or "Actualizar" for edit
    await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find(b =>
        b.textContent?.includes('Crear Evento') ||
        b.textContent?.includes('Actualizar') ||
        b.textContent?.includes('Guardar')
      );
      if (saveBtn) {
        saveBtn.scrollIntoView({ block: 'center' });
        saveBtn.click();
      }
    });
    await this.page.waitForTimeout(2_000);
  }

  // ── View Toggle ────────────────────────────────────────────────────────────

  /** Switch to calendar view */
  async switchToCalendar(): Promise<void> {
    const calBtn = this.page.locator('button:has-text("Calendario"), button >> svg.lucide-calendar').first();
    await calBtn.click();
    await this.page.waitForTimeout(500);
  }

  /** Switch to list view */
  async switchToList(): Promise<void> {
    const listBtn = this.page.locator('button:has-text("Lista")').first();
    await listBtn.click();
    await this.page.waitForTimeout(500);
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  /** Check if an event with the given title is in the list */
  async isEventInList(title: string): Promise<boolean> {
    const item = this.page.locator(`text="${title}"`).first();
    return item.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  /** Check if the pending/offline badge is visible on any event */
  async hasPendingBadge(): Promise<boolean> {
    const badge = this.page.locator('text=/Pendiente.*sincroniza|sin conexión/i').first();
    return badge.isVisible({ timeout: 3_000 }).catch(() => false);
  }
}
