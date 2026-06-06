# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/onboarding.spec.ts >> Onboarding y Configuración Inicial >> Creación de estructura del campo
- Location: tests/e2e/onboarding.spec.ts:13:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: Errores en consola de navegador detectados: [{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"Error checking onboarding status: TypeError: Failed to fetch\n    at checkStatus (webpack-internal:///(app-pages-browser)/./src/components/OnboardingTour.tsx:99:39)"},{"type":"error","text":"[ClimateAnalyticsProvider] Error fetching snapshots: TypeError: Failed to fetch\n    at apiFetch (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:29:22)\n    at async ClimateAnalyticsProvider.useCallback[fetchSnapshots] (webpack-internal:///(app-pages-browser)/./src/lib/context/ClimateAnalyticsContext.tsx:40:29)"},{"type":"error","text":"[ClimateAnalyticsProvider] Error fetching snapshots: TypeError: Failed to fetch\n    at apiFetch (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:29:22)\n    at async ClimateAnalyticsProvider.useCallback[fetchSnapshots] (webpack-internal:///(app-pages-browser)/./src/lib/context/ClimateAnalyticsContext.tsx:40:29)"},{"type":"error","text":"Dashboard load error: TypeError: Failed to fetch\n    at apiFetch (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:29:22)\n    at async Promise.all (index 2)\n    at async load (webpack-internal:///(app-pages-browser)/./src/app/dashboard/page.tsx:134:108)"},{"type":"error","text":"Dashboard load error: TypeError: Failed to fetch\n    at apiFetch (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:29:22)\n    at async Promise.all (index 4)\n    at async load (webpack-internal:///(app-pages-browser)/./src/app/dashboard/page.tsx:134:108)"},{"type":"error","text":"Error fetching menu config: TypeError: Failed to fetch\n    at DashboardLayout.useEffect (webpack-internal:///(app-pages-browser)/./src/app/dashboard/layout.tsx:96:13)\n    at Object.react_stack_bottom_frame (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:28327:20)\n    at runWithFiberInDEV (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:987:30)\n    at commitHookEffectListMount (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:13664:29)\n    at commitHookPassiveMountEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:13751:11)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17113:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17105:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17166:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17105:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17166:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17166:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17105:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17166:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17105:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17166:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17105:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17105:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17105:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17166:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17105:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17105:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17166:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17166:11)\n    at recursivelyTraverseReconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17065:9)\n    at reconnectPassiveEffects (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:17105:11)\n    at doubleInvokeEffectsOnFiber (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:20218:11)\n    at runWithFiberInDEV (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:987:30)\n    at recursivelyTraverseAndDoubleInvokeEffectsInDEV (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:20182:17)\n    at recursivelyTraverseAndDoubleInvokeEffectsInDEV (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:20188:17)\n    at recursivelyTraverseAndDoubleInvokeEffectsInDEV (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:20188:17)\n    at recursivelyTraverseAndDoubleInvokeEffectsInDEV (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:20188:17)\n    at recursivelyTraverseAndDoubleInvokeEffectsInDEV (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:20188:17)\n    at recursivelyTraverseAndDoubleInvokeEffectsInDEV (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:20188:17)"},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"[ClimateAnalyticsProvider] Error fetching snapshots: TypeError: Failed to fetch\n    at apiFetch (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:29:22)\n    at async ClimateAnalyticsProvider.useCallback[fetchSnapshots] (webpack-internal:///(app-pages-browser)/./src/lib/context/ClimateAnalyticsContext.tsx:40:29)"},{"type":"error","text":"Dashboard load error: TypeError: Failed to fetch\n    at apiFetch (webpack-internal:///(app-pages-browser)/./src/lib/apiFetch.ts:29:22)\n    at async Promise.all (index 5)\n    at async load (webpack-internal:///(app-pages-browser)/./src/app/dashboard/page.tsx:134:108)"},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."}]

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 12
```

```
Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
=========================== logs ===========================
  "commit" event fired
  "domcontentloaded" event fired
  "load" event fired
============================================================
```

# Page snapshot

```yaml
- generic:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - button [ref=e5] [cursor=pointer]:
        - img [ref=e6]
      - generic [ref=e7]:
        - button [ref=e9] [cursor=pointer]:
          - img [ref=e10]
        - link "J" [ref=e14] [cursor=pointer]:
          - /url: /dashboard/profile
          - generic [ref=e15]: J
    - main [ref=e16]:
      - generic [ref=e18]:
        - generic [ref=e19]:
          - generic [ref=e20]:
            - heading "Panel principal" [level=1] [ref=e21]
            - paragraph [ref=e22]: Centro de mando unificado
          - button "Descargar historial" [ref=e26] [cursor=pointer]:
            - img [ref=e27]
            - text: Descargar historial
        - generic [ref=e30]:
          - generic [ref=e31]:
            - heading "Clima actual" [level=2] [ref=e33]:
              - img [ref=e34]
              - text: Clima actual
            - generic [ref=e37]:
              - generic:
                - img
              - generic [ref=e39]:
                - paragraph [ref=e40]: 18°
                - generic [ref=e41]:
                  - paragraph [ref=e42]: Nublado
                  - paragraph [ref=e43]:
                    - img [ref=e44]
                    - generic [ref=e47]: Antonio Carboni, Trébol, Antonio Carboni, Cuartel Antonio Carboni, Partido de Lobos, Buenos Aires, B7243, Argentina
              - generic [ref=e49]:
                - generic [ref=e50]:
                  - paragraph [ref=e51]: Sáb
                  - paragraph [ref=e52]: ☁️
                  - paragraph [ref=e53]: 18°
                - generic [ref=e54]:
                  - paragraph [ref=e55]: Dom
                  - paragraph [ref=e56]: 🌧️
                  - paragraph [ref=e57]: 3.6mm
                - generic [ref=e58]:
                  - paragraph [ref=e59]: Lun
                  - paragraph [ref=e60]: 🌧️
                  - paragraph [ref=e61]: 2.4mm
                - generic [ref=e62]:
                  - paragraph [ref=e63]: Mar
                  - paragraph [ref=e64]: ☁️
                  - paragraph [ref=e65]: 14°
          - generic [ref=e67]:
            - generic [ref=e68]:
              - generic [ref=e69]:
                - img [ref=e70]
                - heading "Mercado ganadero" [level=3] [ref=e72]
              - generic [ref=e73]:
                - generic [ref=e74]: Est.
                - generic [ref=e75]:
                  - img [ref=e76]
                  - text: MAG Cañuelas
            - generic [ref=e79]:
              - generic [ref=e80]:
                - paragraph [ref=e81]: INMAG — Índice novillo
                - generic [ref=e82]:
                  - paragraph [ref=e83]: $4.236/kg vivo
                  - generic [ref=e84]:
                    - img [ref=e85]
                    - text: +0.1%
                - paragraph [ref=e88]:
                  - text: MAG Cañuelas (Último cierre válido)
                  - generic [ref=e89]: · 2026-06-05
              - generic [ref=e90]:
                - img [ref=e91]
                - paragraph [ref=e94]: 7d CME LE
            - generic [ref=e95]:
              - generic [ref=e96]:
                - paragraph [ref=e97]: CME Live Cattle
                - paragraph [ref=e98]: $250,07 USD/cwt
              - generic [ref=e99]:
                - paragraph [ref=e100]: USD/ARS
                - paragraph [ref=e101]: $1.442
        - generic [ref=e102]:
          - generic [ref=e103]:
            - generic [ref=e104]:
              - heading "Gestión operativa" [level=2] [ref=e105]:
                - img [ref=e106]
                - text: Gestión operativa
              - link "Ver agenda" [ref=e109] [cursor=pointer]:
                - /url: /dashboard/agenda
            - generic [ref=e113]:
              - generic [ref=e114]:
                - generic [ref=e115]: may
                - generic [ref=e116]: "19"
              - generic [ref=e117]:
                - paragraph [ref=e120]: "Mortandad: 10 cab. · Vaquillonas"
                - paragraph [ref=e121]: Evento de campo
          - generic [ref=e122]:
            - generic [ref=e123]:
              - heading "Logística de movimientos" [level=2] [ref=e124]:
                - img [ref=e125]
                - text: Logística de movimientos
              - link "Planificador" [ref=e127] [cursor=pointer]:
                - /url: /dashboard/grazing
            - paragraph [ref=e131]:
              - img [ref=e132]
              - text: Sin movimientos planificados
        - generic [ref=e135]:
          - generic [ref=e136]:
            - generic [ref=e137]:
              - heading "Pastoreo y vigor (NDVI)" [level=2] [ref=e138]:
                - img [ref=e139]
                - text: Pastoreo y vigor (NDVI)
              - button "Actualizar" [ref=e145] [cursor=pointer]
            - generic [ref=e148]:
              - generic [ref=e149]:
                - generic [ref=e150]:
                  - generic [ref=e151]:
                    - paragraph [ref=e152]:
                      - text: Crecimiento
                      - generic "Promedio diario kg MS/ha/d" [ref=e153]:
                        - img [ref=e154]
                    - generic [ref=e156]:
                      - generic [ref=e157]: "7.7"
                      - generic [ref=e158]: kg MS/ha/d
                    - generic [ref=e159]:
                      - img [ref=e160]
                      - text: 0.0 (0%)
                  - generic [ref=e161]:
                    - paragraph [ref=e162]: Ración ajustada
                    - generic [ref=e163]:
                      - generic [ref=e164]: "11.5"
                      - generic [ref=e165]: kg/EV/d
                    - generic [ref=e166]: "-0.5 kg vs base · ×0.96 clim."
                  - generic [ref=e167]:
                    - paragraph [ref=e168]: ΔCC estimado
                    - generic [ref=e169]:
                      - generic [ref=e170]: "-0.002"
                      - generic [ref=e171]: u/día
                    - paragraph [ref=e172]: CC estable
                - button "Actualizar" [ref=e173] [cursor=pointer]:
                  - img [ref=e174]
              - generic [ref=e179]:
                - button "Crecimiento" [ref=e180] [cursor=pointer]: Crecimiento
                - button "NDVI" [ref=e182] [cursor=pointer]: NDVI
                - button "Ración Ajust." [ref=e184] [cursor=pointer]: Ración Ajust.
                - button "ΔCC" [ref=e186] [cursor=pointer]: ΔCC
                - button "Lluvia 7d" [ref=e188] [cursor=pointer]: Lluvia 7d
              - generic [ref=e192]:
                - generic [ref=e193]: Crecimiento — kg MS/ha/d promedio de potreros
                - generic [ref=e194]: Ración Ajust. — base 12 kg/EV × mult. climático
                - generic [ref=e195]: NDVI — vigor fotosintético 0→1
                - generic [ref=e196]: ΔCC — variación CC estimada por día
          - generic [ref=e197]:
            - heading "Carga animal (EV/ha)" [level=2] [ref=e199]:
              - img [ref=e200]
              - text: Carga animal (EV/ha)
            - generic [ref=e205]:
              - generic [ref=e206]:
                - img [ref=e207]
                - generic [ref=e210]:
                  - paragraph [ref=e211]: "0.17"
                  - paragraph [ref=e212]: Actual
              - generic [ref=e214]:
                - generic [ref=e215]:
                  - paragraph [ref=e216]: Límite óptimo
                  - paragraph [ref=e217]: 0.8 EV/ha
                - generic [ref=e218]: Balanceado
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e224] [cursor=pointer]:
    - img [ref=e225]
  - alert [ref=e228]
  - iframe [ref=e229]:
    
  - generic:
    - generic:
      - img
    - generic [ref=e231]:
      - alertdialog [ref=e232]:
        - generic [ref=e233]:
          - heading "Clima en tiempo real" [level=3] [ref=e234]
          - generic [ref=e235]: Monitorea las condiciones climáticas de tu campo y recibe alertas de estrés térmico o heladas al instante.
        - button "Next" [active] [ref=e238] [cursor=pointer]: Siguiente — 1/3
      - img [ref=e240]
```

# Test source

```ts
  1  | import { test, expect } from '../fixtures/rodeo-fixture';
  2  | 
  3  | test.describe('Onboarding y Configuración Inicial', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Basic login before onboarding
  6  |     await page.goto('/login');
  7  |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  8  |     await page.fill('input[type="password"]', '1q2w3e4r');
  9  |     await page.click('button[type="submit"]');
  10 |     await page.waitForURL(/\/dashboard|\/onboarding/);
  11 |   });
  12 | 
  13 |   test('Creación de estructura del campo', async ({ page }) => {
  14 |     await page.goto('/onboarding');
  15 |     
  16 |     // This is a figurative test case, ensuring that inputs and buttons
  17 |     // commonly found in the onboarding wizard can be interacted with.
  18 |     
  19 |     // Wait for onboarding to load
> 20 |     await page.waitForLoadState('networkidle');
     |                ^ Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
  21 | 
  22 |     // Just verifying the page title or a known element exists
  23 |     // The exact selectors will be adjusted once the UI is finalized
  24 |     const continueBtn = page.locator('button:has-text("Continuar"), button:has-text("Siguiente")').first();
  25 |     
  26 |     if (await continueBtn.isVisible()) {
  27 |       // Step 1: Ubicación
  28 |       const locationInput = page.locator('input[name="location"], input[placeholder*="Ubicación"]');
  29 |       if (await locationInput.isVisible()) await locationInput.fill('Ruta Prov 4');
  30 |       await continueBtn.click();
  31 |       
  32 |       // Step 2: Potreros
  33 |       const addPaddockBtn = page.locator('button:has-text("Agregar Potrero"), button:has-text("Nuevo Potrero")');
  34 |       if (await addPaddockBtn.isVisible()) {
  35 |         await addPaddockBtn.click();
  36 |         const paddockName = page.locator('input[name="name"], input[name="paddockName"]');
  37 |         if (await paddockName.isVisible()) await paddockName.fill('Lote Frontal');
  38 |         const savePaddockBtn = page.locator('button:has-text("Guardar")');
  39 |         if (await savePaddockBtn.isVisible()) await savePaddockBtn.click();
  40 |       }
  41 |       await continueBtn.click();
  42 |     }
  43 |   });
  44 | });
  45 | 
```