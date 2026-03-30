/**
 * Satellite Service Wrapper for Sentinel-2 / Sentinel Hub API
 * Used for Normalized Difference Vegetation Index (NDVI) calculations.
 */

export interface SatelliteData {
  averageNdvi: number;
  grazableAreaPct: number; // Excludes water bodies / bare soil (NDVI < 0.1)
  estimatedAvailableDryMatterHa: number; // Kg MS / Ha estimated from NDVI
  captureDate: string;
}

/**
 * Mocks or connects to Sentinel Hub API.
 * 
 * TODO PHASE 3: To enable the real API, you will need a SENTINEL_HUB_CLIENT_ID 
 * and SENTINEL_HUB_CLIENT_SECRET. We will authenticate, get an OAuth token, 
 * and use the Statistical API using the paddock's GeoJSON geometry.
 */
export async function getPaddockNDVI(geojsonPolygon: any, area_ha: number): Promise<SatelliteData> {
  const isProd = process.env.NEXT_PUBLIC_USE_REAL_SATELLITE_API === 'true';

  if (isProd) {
    // 1. Get OAuth Token from Sentinel Hub
    // 2. Build Statistical API request using geojsonPolygon
    // 3. Process the response to get mean NDVI and histogram (to exclude NDVI < 0.1)
    throw new Error("Sentinel Hub API implies async auth. Missing credentials in env.");
  } else {
    // --- Mock Implementation for Prototype / Phase 2 ---
    // We simulate a realistic satellite response to build the UI immediately.
    
    // Delay to simulate network
    await new Promise(resolve => setTimeout(resolve, 800));

    // Randomize a decent NDVI between 0.3 and 0.8
    const randomNdvi = 0.3 + (Math.random() * 0.5);
    
    // Assume 90% is grazable, 10% might be lagoons or roads if area > 10ha
    const grazableAreaPct = area_ha > 10 ? 90 + Math.random() * 8 : 100;
    
    // Rough heuristic: NDVI 0.8 = ~3000 Kg MS/Ha, NDVI 0.3 = ~800 Kg MS/Ha
    const baseKg = 800;
    const maxKg = 3000;
    const estimatedAvailableDryMatterHa = Math.round(baseKg + ((randomNdvi - 0.3) / 0.5) * (maxKg - baseKg));

    const pastWeek = new Date();
    pastWeek.setDate(pastWeek.getDate() - Math.floor(Math.random() * 5));

    return {
      averageNdvi: Number(randomNdvi.toFixed(2)),
      grazableAreaPct: Number(grazableAreaPct.toFixed(1)),
      estimatedAvailableDryMatterHa,
      captureDate: pastWeek.toISOString().split('T')[0]
    };
  }
}
