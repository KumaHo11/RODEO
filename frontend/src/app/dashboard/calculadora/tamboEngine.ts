/**
 * tamboEngine.ts — Motor de cálculo para Indicadores Lecheros (Tambo)
 * ────────────────────────────────────────────────────────────────────────────
 * Motor de cálculo encapsulado en una clase con funciones puras para la 
 * nueva pestaña de Tambo en la calculadora de proyecciones.
 * 
 * Desarrollado para asesores ganaderos, prioriza exactitud e incluye
 * salvaguardas (manejo de errores) para divisiones por cero.
 */

export class TamboCalculatorEngine {
  
  /**
   * Energy Corrected Milk (ECM) - Leche Corregida por Energía
   * Estandariza la producción de leche para reflejar la energía requerida 
   * (equiparable a leche al 3.5% de grasa y 3.2% de proteína).
   * 
   * @param liters Litros de leche producidos.
   * @param fatKg Kilogramos de grasa producidos.
   * @param proteinKg Kilogramos de proteína producidos.
   * @returns Producción corregida por energía (ECM) en litros/kg.
   */
  public static calculateEcm(liters: number, fatKg: number, proteinKg: number): number {
    return (0.327 * liters) + (12.95 * fatKg) + (7.2 * proteinKg);
  }

  /**
   * Fat Corrected Milk (FCM) - Leche Corregida al 4% de Grasa
   * Estandariza la producción de leche a un contenido fijo del 4% de grasa.
   * 
   * @param liters Litros de leche producidos.
   * @param fatKg Kilogramos de grasa producidos.
   * @returns Producción corregida por grasa (FCM) en litros/kg.
   */
  public static calculateFcm(liters: number, fatKg: number): number {
    return (0.4 * liters) + (15 * fatKg);
  }

  /**
   * Dry Matter Intake (DMI) - Consumo Esperado de Materia Seca
   * Estima los requerimientos de consumo diario de materia seca según el peso 
   * del animal y su producción de leche corregida (FCM).
   * 
   * @param liveWeight Peso vivo del animal en kg.
   * @param fcm Producción de leche corregida por grasa (FCM).
   * @returns Consumo esperado de materia seca en kg/día.
   */
  public static calculateDmi(liveWeight: number, fcm: number): number {
    return (0.02 * liveWeight) + (0.3 * fcm);
  }

  /**
   * Feed Efficiency - Eficiencia de Conversión Alimenticia
   * Relación entre la leche corregida por energía (ECM) producida y el consumo 
   * de materia seca (DMI). Indica litros producidos por kg de MS ingerida.
   * 
   * @param ecm Producción corregida por energía (ECM).
   * @param dmi Consumo estimado de materia seca (DMI).
   * @throws Error Si el DMI es 0 (evita división por cero).
   * @returns Eficiencia de conversión alimenticia.
   */
  public static calculateFeedEfficiency(ecm: number, dmi: number): number {
    if (dmi === 0) {
      throw new Error("Error de cálculo: El consumo de materia seca (DMI) no puede ser 0.");
    }
    return ecm / dmi;
  }

  /**
   * Heat Detection Rate (HDR) - Tasa de Detección de Celo
   * Porcentaje de vacas elegibles que fueron efectivamente detectadas 
   * en celo e inseminadas.
   * 
   * @param inseminated Cantidad de vacas inseminadas.
   * @param eligible Cantidad de vacas elegibles para recibir servicio.
   * @throws Error Si la cantidad de vacas elegibles es 0.
   * @returns Tasa de detección de celo (%).
   */
  public static calculateHeatDetectionRate(inseminated: number, eligible: number): number {
    if (eligible === 0) {
      throw new Error("Error de cálculo: Las vacas elegibles no pueden ser 0.");
    }
    return (inseminated / eligible) * 100;
  }

  /**
   * Conception Rate (CR) - Tasa de Concepción
   * Porcentaje de vacas que resultaron preñadas sobre el total de inseminadas.
   * 
   * @param pregnant Cantidad de vacas preñadas confirmadas.
   * @param inseminated Cantidad de vacas inseminadas.
   * @throws Error Si la cantidad de vacas inseminadas es 0.
   * @returns Tasa de concepción (%).
   */
  public static calculateConceptionRate(pregnant: number, inseminated: number): number {
    if (inseminated === 0) {
      throw new Error("Error de cálculo: Las vacas inseminadas no pueden ser 0.");
    }
    return (pregnant / inseminated) * 100;
  }

  /**
   * Pregnancy Rate (PR) - Tasa de Preñez
   * Velocidad a la que las vacas quedan preñadas en un ciclo de 21 días.
   * Combina la eficiencia de la detección de celo y la fertilidad.
   * 
   * @param heatDetectionRate Tasa de detección de celo (%) - HDR.
   * @param conceptionRate Tasa de concepción (%) - CR.
   * @returns Tasa de preñez (%).
   */
  public static calculatePregnancyRate(heatDetectionRate: number, conceptionRate: number): number {
    return (heatDetectionRate * conceptionRate) / 100;
  }

  /**
   * Milking Cows Ratio - Relación Vacas en Ordeño / Vacas Secas
   * Proporción de vacas en producción activa (ordeño) respecto al rodeo de vacas total.
   * 
   * @param milkingCows Cantidad de vacas en ordeño (VO).
   * @param dryCows Cantidad de vacas secas (VS).
   * @throws Error Si el total de vacas (VO + VS) es 0.
   * @returns Porcentaje de vacas en ordeño respecto al total de vacas (%).
   */
  public static calculateMilkingCowsRatio(milkingCows: number, dryCows: number): number {
    const totalCows = milkingCows + dryCows;
    if (totalCows === 0) {
      throw new Error("Error de cálculo: El total de vacas (ordeño + secas) no puede ser 0.");
    }
    return (milkingCows / totalCows) * 100;
  }

  /**
   * Stocking Rate - Carga Animal
   * Densidad ganadera expresada en Equivalente Vaca (EV) por unidad de superficie.
   * 
   * @param totalHeads Cantidad total de cabezas en el rodeo.
   * @param cowEquivalent Valor de Equivalente Vaca promedio.
   * @param hectares Superficie efectiva del área evaluada en hectáreas.
   * @throws Error Si la superficie en hectáreas es 0.
   * @returns Carga animal (EV/ha).
   */
  public static calculateStockingRate(totalHeads: number, cowEquivalent: number, hectares: number): number {
    if (hectares === 0) {
      throw new Error("Error de cálculo: La superficie en hectáreas no puede ser 0.");
    }
    return (totalHeads * cowEquivalent) / hectares;
  }
}
