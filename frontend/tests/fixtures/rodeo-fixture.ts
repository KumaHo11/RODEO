import { test as base, expect } from '@playwright/test';

// Fixture personalizado para auditar consola y red en TODOS los flujos
export const test = base.extend({
  page: async ({ page }, use) => {
    const consoleLogs: { type: string, text: string }[] = [];
    const networkErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleLogs.push({ type: msg.type(), text: msg.text() });
      }
    });

    page.on('response', response => {
      // Registrar peticiones fallidas al backend/APIs
      if (response.status() >= 400 && response.url().includes('/api/')) {
        networkErrors.push(`[${response.status()}] ${response.url()}`);
      }
    });

    await use(page);

    // Assertions automáticos al finalizar cada test
    const errors = consoleLogs.filter(c => c.type === 'error');
    expect(errors.length, `Errores en consola de navegador detectados: ${JSON.stringify(errors)}`).toBe(0);
    expect(networkErrors.length, `Fallos de red detectados: ${networkErrors.join(', ')}`).toBe(0);
  },
});
export { expect };
