# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/daily-operations.spec.ts >> Operaciones y Módulos Diarios >> Calculadora Ganadera
- Location: tests/e2e/daily-operations.spec.ts:40:7

# Error details

```
Error: Errores en consola de navegador detectados: [{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"[ClimateAnalyticsProvider] Error fetching snapshots: Error: TimeoutError\n    at eval (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:21:51)"},{"type":"error","text":"Dashboard load error: Error: TimeoutError\n    at eval (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:21:51)"},{"type":"error","text":"[ClimateAnalyticsProvider] Error fetching snapshots: Error: TimeoutError\n    at eval (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:21:51)"},{"type":"error","text":"Error checking onboarding status: TypeError: Failed to fetch\n    at checkStatus (webpack-internal:///(app-pages-browser)/./src/components/OnboardingTour.tsx:99:39)"},{"type":"error","text":"Failed to load resource: the server responded with a status of 404 (Not Found)"}]

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 7
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "404" [level=1] [ref=e4]
    - heading "This page could not be found." [level=2] [ref=e6]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e12] [cursor=pointer]:
    - img [ref=e13]
  - alert [ref=e16]
```

# Test source

```ts
  1  | import { test as base, expect } from '@playwright/test';
  2  | 
  3  | // Fixture personalizado para auditar consola y red en TODOS los flujos
  4  | export const test = base.extend({
  5  |   page: async ({ page }, use) => {
  6  |     const consoleLogs: { type: string, text: string }[] = [];
  7  |     const networkErrors: string[] = [];
  8  | 
  9  |     page.on('console', msg => {
  10 |       if (msg.type() === 'error' || msg.type() === 'warning') {
  11 |         consoleLogs.push({ type: msg.type(), text: msg.text() });
  12 |       }
  13 |     });
  14 | 
  15 |     page.on('response', response => {
  16 |       // Registrar peticiones fallidas al backend/APIs
  17 |       if (response.status() >= 400 && response.url().includes('/api/')) {
  18 |         networkErrors.push(`[${response.status()}] ${response.url()}`);
  19 |       }
  20 |     });
  21 | 
  22 |     await use(page);
  23 | 
  24 |     // Assertions automáticos al finalizar cada test
  25 |     const errors = consoleLogs.filter(c => c.type === 'error');
> 26 |     expect(errors.length, `Errores en consola de navegador detectados: ${JSON.stringify(errors)}`).toBe(0);
     |                                                                                                    ^ Error: Errores en consola de navegador detectados: [{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"[ClimateAnalyticsProvider] Error fetching snapshots: Error: TimeoutError\n    at eval (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:21:51)"},{"type":"error","text":"Dashboard load error: Error: TimeoutError\n    at eval (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:21:51)"},{"type":"error","text":"[ClimateAnalyticsProvider] Error fetching snapshots: Error: TimeoutError\n    at eval (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:21:51)"},{"type":"error","text":"Error checking onboarding status: TypeError: Failed to fetch\n    at checkStatus (webpack-internal:///(app-pages-browser)/./src/components/OnboardingTour.tsx:99:39)"},{"type":"error","text":"Failed to load resource: the server responded with a status of 404 (Not Found)"}]
  27 |     expect(networkErrors.length, `Fallos de red detectados: ${networkErrors.join(', ')}`).toBe(0);
  28 |   },
  29 | });
  30 | export { expect };
  31 | 
```