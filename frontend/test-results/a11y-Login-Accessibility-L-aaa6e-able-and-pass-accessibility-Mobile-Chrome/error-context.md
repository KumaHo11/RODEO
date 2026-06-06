# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> Login Accessibility >> Login form should be keyboard navigable and pass accessibility
- Location: tests/a11y.spec.ts:39:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 161

- Array []
+ Array [
+   Object {
+     "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
+     "help": "Elements must meet minimum color contrast ratio thresholds",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright",
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f9fafb",
+               "contrastRatio": 2.48,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#99a1af",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.48 (foreground color: #99a1af, background color: #f9fafb, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4\"><div class=\"w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin\"></div><p class=\"text-gray-400 font-bold tracking-widest text-[10px]\">Cargando panel...</p></div>",
+                 "target": Array [
+                   ".min-h-screen",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.48 (foreground color: #99a1af, background color: #f9fafb, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"text-gray-400 font-bold tracking-widest text-[10px]\">Cargando panel...</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "p",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2aa",
+       "wcag143",
+       "TTv5",
+       "TT13.c",
+       "EN-301-549",
+       "EN-9.1.4.3",
+       "ACT",
+       "RGAAv4",
+       "RGAA-3.2.1",
+     ],
+   },
+   Object {
+     "description": "Ensure the document has a main landmark",
+     "help": "Document should have one main landmark",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/landmark-one-main?application=playwright",
+     "id": "landmark-one-main",
+     "impact": "moderate",
+     "nodes": Array [
+       Object {
+         "all": Array [
+           Object {
+             "data": null,
+             "id": "page-has-main",
+             "impact": "moderate",
+             "message": "Document does not have a main landmark",
+             "relatedNodes": Array [],
+           },
+         ],
+         "any": Array [],
+         "failureSummary": "Fix all of the following:
+   Document does not have a main landmark",
+         "html": "<html lang=\"es\" data-scroll-behavior=\"smooth\">",
+         "impact": "moderate",
+         "none": Array [],
+         "target": Array [
+           "html",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.semantics",
+       "best-practice",
+     ],
+   },
+   Object {
+     "description": "Ensure that the page, or at least one of its frames contains a level-one heading",
+     "help": "Page should contain a level-one heading",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/page-has-heading-one?application=playwright",
+     "id": "page-has-heading-one",
+     "impact": "moderate",
+     "nodes": Array [
+       Object {
+         "all": Array [
+           Object {
+             "data": null,
+             "id": "page-has-heading-one",
+             "impact": "moderate",
+             "message": "Page must have a level-one heading",
+             "relatedNodes": Array [],
+           },
+         ],
+         "any": Array [],
+         "failureSummary": "Fix all of the following:
+   Page must have a level-one heading",
+         "html": "<html lang=\"es\" data-scroll-behavior=\"smooth\">",
+         "impact": "moderate",
+         "none": Array [],
+         "target": Array [
+           "html",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.semantics",
+       "best-practice",
+     ],
+   },
+   Object {
+     "description": "Ensure all page content is contained by landmarks",
+     "help": "All page content should be contained by landmarks",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/region?application=playwright",
+     "id": "region",
+     "impact": "moderate",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "isIframe": false,
+             },
+             "id": "region",
+             "impact": "moderate",
+             "message": "Some page content is not contained by landmarks",
+             "relatedNodes": Array [],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Some page content is not contained by landmarks",
+         "html": "<div class=\"min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4\"><div class=\"w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin\"></div><p class=\"text-gray-400 font-bold tracking-widest text-[10px]\">Cargando panel...</p></div>",
+         "impact": "moderate",
+         "none": Array [],
+         "target": Array [
+           ".min-h-screen",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.keyboard",
+       "best-practice",
+       "RGAAv4",
+       "RGAA-9.2.1",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active]:
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e6] [cursor=pointer]:
    - img [ref=e7]
  - alert [ref=e10]
  - iframe [ref=e11]:
    
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | 
  4  | test.describe('Accessibility and UI tests', () => {
  5  | 
  6  |   test.beforeEach(async ({ page }) => {
  7  |     // Log in before each test to ensure IndexedDB session is active
  8  |     await page.goto('/login');
  9  |     await page.waitForSelector('form');
  10 |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  11 |     await page.fill('input[type="password"]', '1q2w3e4r');
  12 |     await page.click('button[type="submit"]');
  13 |     // Wait until the dashboard or onboarding loads
  14 |     await page.waitForURL(/.*(dashboard|onboarding).*/, { timeout: 15000 });
  15 |   });
  16 | 
  17 |   test('Login form should pass accessibility (requires logging out first)', async ({ page }) => {
  18 |     // We need to go back to login to test its accessibility
  19 |     // The easiest way is to use a new clean context, but we are inside beforeEach.
  20 |     // We will just evaluate a sign out if possible, or just test a11y on the current page (dashboard).
  21 |     // Actually, let's test Rodeos accessibility here.
  22 |     
  23 |     await page.goto('/dashboard/herds');
  24 |     await page.waitForSelector('h1:has-text("Rodeos")', { timeout: 15000 });
  25 | 
  26 |     const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  27 |     
  28 |     // Output violations if any for debugging
  29 |     if (accessibilityScanResults.violations.length > 0) {
  30 |       console.log('Axe violations found in Rodeos:', JSON.stringify(accessibilityScanResults.violations, null, 2));
  31 |     }
  32 | 
  33 |     expect(accessibilityScanResults.violations).toEqual([]);
  34 |   });
  35 | });
  36 | 
  37 | test.describe('Login Accessibility', () => {
  38 |   // Separate describe block without the login beforeEach
  39 |   test('Login form should be keyboard navigable and pass accessibility', async ({ page }) => {
  40 |     await page.goto('/login');
  41 | 
  42 |     const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  43 |     
  44 |     if (accessibilityScanResults.violations.length > 0) {
  45 |       console.log('Axe violations found in Login:', JSON.stringify(accessibilityScanResults.violations, null, 2));
  46 |     }
  47 | 
> 48 |     expect(accessibilityScanResults.violations).toEqual([]);
     |                                                 ^ Error: expect(received).toEqual(expected) // deep equality
  49 | 
  50 |     await page.focus('body');
  51 |     await page.keyboard.press('Tab');
  52 |     const emailInput = page.locator('input[type="email"]');
  53 |     await expect(emailInput).toBeVisible();
  54 |   });
  55 | });
  56 | 
```