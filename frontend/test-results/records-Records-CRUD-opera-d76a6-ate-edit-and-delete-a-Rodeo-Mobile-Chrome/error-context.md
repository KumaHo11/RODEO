# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: records.spec.ts >> Records CRUD operations >> Should be able to create, edit and delete a Rodeo
- Location: tests/records.spec.ts:19:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('text=Nuevo rodeo') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - heading "Inicia sesión" [level=1] [ref=e6]
        - paragraph [ref=e7]: Ingresa a tu cuenta para gestionar tu campo.
      - generic [ref=e8]:
        - generic [ref=e9]:
          - text: Correo electrónico
          - textbox "tu@email.com" [ref=e10]
        - generic [ref=e11]:
          - generic [ref=e12]:
            - generic [ref=e13]: Contraseña
            - link "¿Olvidaste tu contraseña?" [ref=e14] [cursor=pointer]:
              - /url: /forgot-password
          - generic [ref=e15]:
            - textbox "••••••••" [ref=e16]
            - button [ref=e17] [cursor=pointer]:
              - img [ref=e18]
        - button "Ingresar" [ref=e21] [cursor=pointer]:
          - text: Ingresar
          - img [ref=e22]
      - paragraph [ref=e24]:
        - text: ¿No tienes una cuenta?
        - link "Regístrate" [ref=e25] [cursor=pointer]:
          - /url: /register
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e31] [cursor=pointer]:
    - img [ref=e32]
  - alert [ref=e35]
  - iframe [ref=e36]:
    
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Records CRUD operations', () => {
  4  | 
  5  |   test.beforeEach(async ({ page }) => {
  6  |     // Log in before each test to ensure IndexedDB session is active
  7  |     await page.goto('/login');
  8  |     await page.waitForSelector('form');
  9  |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  10 |     await page.fill('input[type="password"]', '1q2w3e4r');
  11 |     await page.click('button[type="submit"]');
  12 |     // Wait until the dashboard or onboarding loads
  13 |     await page.waitForURL(/.*(dashboard|onboarding).*/, { timeout: 15000 });
  14 |     
  15 |     // Go to the dashboard herds (Rodeos) as starting point
  16 |     await page.goto('/dashboard/herds');
  17 |   });
  18 | 
  19 |   test('Should be able to create, edit and delete a Rodeo', async ({ page }) => {
  20 |     // We are on Rodeos page
> 21 |     await page.waitForSelector('text=Nuevo rodeo', { timeout: 10000 });
     |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  22 |     
  23 |     // Create new Rodeo
  24 |     await page.click('button:has-text("Nuevo rodeo")');
  25 |     
  26 |     // Modal opens
  27 |     await page.waitForSelector('text=Detalles generales');
  28 |     
  29 |     const uniqueRodeoName = `Playwright Rodeo ${Date.now()}`;
  30 |     await page.fill('input[placeholder="Ej: Lote Recría 1"]', uniqueRodeoName);
  31 |     
  32 |     // Find the save button (usually says "Guardar" or "Crear")
  33 |     const saveButton = page.locator('button:has-text("Guardar")');
  34 |     await saveButton.click();
  35 |     
  36 |     // Expect the modal to close and the rodeo to appear in the list
  37 |     await expect(page.locator(`text=${uniqueRodeoName}`)).toBeVisible();
  38 |     
  39 |     // Now Edit it
  40 |     // Wait for the modal to be gone
  41 |     await expect(saveButton).toBeHidden();
  42 |     
  43 |     // Delete it (Cleanup)
  44 |     // Wait for a delete button on the card or list
  45 |     // Click on the specific row or card's trash icon
  46 |     // Note: depends on DOM. Assuming there is a trash icon inside the card containing uniqueRodeoName
  47 |     const cardOrRow = page.locator(`text=${uniqueRodeoName}`).locator('..').locator('..');
  48 |     
  49 |     // Hover to reveal trash icon
  50 |     await cardOrRow.hover();
  51 |     const trashButton = cardOrRow.locator('button').locator('.lucide-trash-2').first();
  52 |     
  53 |     if (await trashButton.isVisible()) {
  54 |       await trashButton.click();
  55 |       
  56 |       // Confirm modal
  57 |       const confirmButton = page.locator('button:has-text("Sí, eliminar")');
  58 |       await confirmButton.waitFor();
  59 |       await confirmButton.click();
  60 |       
  61 |       // Verify deletion
  62 |       await expect(page.locator(`text=${uniqueRodeoName}`)).toBeHidden();
  63 |     }
  64 |   });
  65 | 
  66 |   // Potrero test
  67 |   test('Should be able to navigate to Potreros and see the list', async ({ page }) => {
  68 |     await page.goto('/dashboard/paddocks-list');
  69 |     await page.waitForSelector('text=Nuevo potrero', { timeout: 10000 });
  70 |     await expect(page.locator('h1')).toContainText('Potreros');
  71 |   });
  72 | 
  73 |   // Bitácora test
  74 |   test('Should be able to navigate to Bitácora and add a note', async ({ page }) => {
  75 |     await page.goto('/dashboard/bitacora');
  76 |     await page.waitForSelector('text=Nuevo registro', { timeout: 10000 });
  77 |     await expect(page.locator('h1')).toContainText('Bitácora');
  78 |   });
  79 | });
  80 | 
```