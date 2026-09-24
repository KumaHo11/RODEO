export interface IntaContext {
  region: string;
  species: string;
  conversionRules: string;
}

export class IntaContextService {
  static async getContext(lat?: number | null, lng?: number | null, date?: Date): Promise<IntaContext> {
    const defaultContext: IntaContext = {
      region: "Pampa Húmeda (Fallback - Sin geolocalización)",
      species: "Festuca, Agropiro, Trébol Blanco, Lotus, Rye grass",
      conversionRules: "1 cm de altura equivale aproximadamente a 250 kg MS/ha si la cobertura es >80%, o 150 kg MS/ha si es menor a 60%."
    };

    if (lat != null && lng != null) {
      if (lat < -38) {
        return {
          region: "Patagonia Norte",
          species: "Festuca, Agropiro alargado, Alfalfa",
          conversionRules: "1 cm de altura equivale a 180 kg MS/ha en invierno y 220 kg MS/ha en primavera."
        };
      } else if (lat > -30) {
        return {
          region: "NEA / NOA",
          species: "Gatton Panic, Grama Rhodes, Brachiaria",
          conversionRules: "1 cm de altura equivale a 280 kg MS/ha en verano."
        };
      } else {
        return {
          region: "Pampa Húmeda",
          species: "Festuca, Agropiro, Trébol Blanco, Lotus, Rye grass",
          conversionRules: "1 cm de altura equivale aproximadamente a 250 kg MS/ha si la cobertura es >80%, o 150 kg MS/ha si es menor a 60%."
        };
      }
    }

    return defaultContext;
  }
}
