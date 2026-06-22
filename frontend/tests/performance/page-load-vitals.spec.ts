import { test, expect } from '@playwright/test';

/**
 * Tests de Rendimiento — Web Vitals por página
 *
 * Mide LCP, FCP y CLS en cada página crítica.
 * Umbrales basados en las recomendaciones de la auditoría QA.
 *
 * Corre bajo el proyecto 'chromium' (con storageState del OWNER).
 *
 * Nota: en producción estos umbrales son más exigentes porque la latencia
 * real se considera. En desarrollo local los tiempos son más bajos.
 */

interface WebVitals {
  lcp: number;    // Largest Contentful Paint (ms)
  fcp: number;    // First Contentful Paint (ms)
  cls: number;    // Cumulative Layout Shift (unitless)
}

async function measureWebVitals(page: any, url: string): Promise<WebVitals> {
  await page.goto(url);

  // Inyectar PerformanceObserver para capturar métricas
  const vitals = await page.evaluate(() => {
    return new Promise<WebVitals>((resolve) => {
      let lcp = 0;
      let fcp = 0;
      let cls = 0;
      let clsEntries = 0;

      const timeout = setTimeout(() => resolve({ lcp, fcp, cls }), 8000);

      // LCP
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            lcp = entries[entries.length - 1].startTime;
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}

      // FCP
      try {
        new PerformanceObserver((list) => {
          const entry = list.getEntriesByName('first-contentful-paint')[0];
          if (entry) fcp = entry.startTime;
        }).observe({ type: 'paint', buffered: true });
      } catch {}

      // CLS
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {}

      // Esperar a que la página cargue completamente
      if (document.readyState === 'complete') {
        setTimeout(() => {
          clearTimeout(timeout);
          resolve({ lcp, fcp, cls });
        }, 3000);
      } else {
        window.addEventListener('load', () => {
          setTimeout(() => {
            clearTimeout(timeout);
            resolve({ lcp, fcp, cls });
          }, 3000);
        });
      }
    });
  });

  return vitals;
}

// Configuración de umbrales por página (en ms para LCP/FCP, decimal para CLS)
const pages = [
  { name: 'Dashboard',    path: '/dashboard',             lcpMax: 3000, fcpMax: 1500, clsMax: 0.1 },
  { name: 'Grazing/Gantt',path: '/dashboard/grazing',     lcpMax: 4000, fcpMax: 2000, clsMax: 0.15 },
  { name: 'Mapa',         path: '/dashboard/map',         lcpMax: 4000, fcpMax: 2000, clsMax: 0.1 },
  { name: 'Mi Campo',     path: '/dashboard/mi-campo',    lcpMax: 3000, fcpMax: 1500, clsMax: 0.1 },
  { name: 'Bitácora',     path: '/dashboard/bitacora',    lcpMax: 2500, fcpMax: 1500, clsMax: 0.1 },
  { name: 'Tareas',       path: '/dashboard/tareas',      lcpMax: 2500, fcpMax: 1500, clsMax: 0.1 },
  { name: 'Agenda',       path: '/dashboard/agenda',      lcpMax: 3000, fcpMax: 1500, clsMax: 0.1 },
  { name: 'Clima',        path: '/dashboard/clima',       lcpMax: 3000, fcpMax: 2000, clsMax: 0.1 },
];

test.describe('Web Vitals por Página', () => {
  for (const { name, path, lcpMax, fcpMax, clsMax } of pages) {
    test(`${name} — LCP<${lcpMax}ms, FCP<${fcpMax}ms, CLS<${clsMax}`, async ({ page }) => {
      // Asegurarse de que la página cargue
      await page.goto(path);
      await page.waitForSelector('h1, main', { timeout: 20000 });

      const vitals = await measureWebVitals(page, path);

      console.log(`[${name}] LCP: ${vitals.lcp.toFixed(0)}ms | FCP: ${vitals.fcp.toFixed(0)}ms | CLS: ${vitals.cls.toFixed(3)}`);

      // Solo fallar si los valores son SIGNIFICATIVAMENTE peores que el umbral
      // LCP de 0 puede indicar que la API no está disponible (no falla el test de vitals)
      if (vitals.lcp > 0) {
        expect(vitals.lcp, `LCP en ${path} debe ser < ${lcpMax}ms`).toBeLessThan(lcpMax);
      }
      if (vitals.fcp > 0) {
        expect(vitals.fcp, `FCP en ${path} debe ser < ${fcpMax}ms`).toBeLessThan(fcpMax);
      }
      expect(vitals.cls, `CLS en ${path} debe ser < ${clsMax}`).toBeLessThan(clsMax);
    });
  }
});
