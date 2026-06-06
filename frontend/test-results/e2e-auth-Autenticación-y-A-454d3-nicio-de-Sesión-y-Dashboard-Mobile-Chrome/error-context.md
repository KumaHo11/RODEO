# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/auth.spec.ts >> Autenticación y Accesos >> Inicio de Sesión y Dashboard
- Location: tests/e2e/auth.spec.ts:20:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/dashboard|\/onboarding/
Received string:  "http://localhost:3000/login?next=%2Fdashboard"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    3 × unexpected value "http://localhost:3000/login?next=%2Fdashboard"
    - waiting for" http://localhost:3000/login?next=%2Fdashboard" navigation to finish...
    - navigated to "http://localhost:3000/login?next=%2Fdashboard"
    11 × unexpected value "http://localhost:3000/login?next=%2Fdashboard"

```

```yaml
- main:
  - heading "Inicia sesión" [level=1]
  - paragraph: Ingresa a tu cuenta para gestionar tu campo.
  - text: Correo electrónico
  - textbox "tu@email.com"
  - text: Contraseña
  - link "¿Olvidaste tu contraseña?":
    - /url: /forgot-password
  - textbox "••••••••"
  - button
  - button "Ingresar"
  - paragraph:
    - text: ¿No tienes una cuenta?
    - link "Regístrate":
      - /url: /register
- region "Notifications alt+T"
- alert
```

```
Error: Errores en consola de navegador detectados: [{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."}]

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 2
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
     |                                                                                                    ^ Error: Errores en consola de navegador detectados: [{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."}]
  27 |     expect(networkErrors.length, `Fallos de red detectados: ${networkErrors.join(', ')}`).toBe(0);
  28 |   },
  29 | });
  30 | export { expect };
  31 | 
```