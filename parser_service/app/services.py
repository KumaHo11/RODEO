import pandas as pd
from fuzzywuzzy import process
from typing import Dict, Any, List, Tuple
import re

# --- CONFIGURACIÓN SEMÁNTICA GLOBAL ---
ENTITIES_METADATA = {
    'field_size':     {'type': 'numeric', 'global_synonyms': ['superficie', 'hectareas', 'ha', 'area', 'total_ha', 'tamaño', 'tamano']},
    'paddock_name':   {'type': 'string',  'global_synonyms': ['potrero', 'lote', 'parcela', 'paddock', 'nombre', 'seccion']},
    'herd_name':      {'type': 'string',  'global_synonyms': ['rodeo', 'grupo', 'animales', 'herd', 'rebaño', 'lote animal']},
    'entry_date':     {'type': 'date',    'global_synonyms': ['fecha de entrada', 'inicio', 'start', 'desde', 'fecha inicio', 'ingreso']},
    'exit_date':      {'type': 'date',    'global_synonyms': ['fecha de salida', 'fin', 'end', 'hasta', 'fecha fin', 'egreso']},
    'cow_equivalent': {'type': 'numeric', 'global_synonyms': ['equivalente vaca', 'ev', 'carga', 'cabezas ev', 'total ev']},
    'dry_matter':     {'type': 'numeric', 'global_synonyms': ['materia seca', 'disponibilidad', 'ms', 'pasto', 'kg ms', 'rinde']}
}

def get_tenant_dictionary(tenant_id: str) -> Dict[str, List[str]]:
    if tenant_id == 'tenant_123':
        return {'field_size': ['tmn', 'sup_tot']}
    return {}

def profile_column_data(series: pd.Series) -> str:
    sample = series.dropna().astype(str).head(5)
    if sample.empty:
        return 'unknown'
        
    try:
        pd.to_datetime(sample, format='mixed', errors='raise')
        return 'date'
    except Exception:
        pass
        
    numeric_mask = sample.str.contains(r'^\s*[-+]?\d+[\.,]?\d*\s*[a-zA-Z%\s]*$', regex=True)
    if numeric_mask.sum() == len(sample):
        return 'numeric'
        
    return 'string'

def score_adjustment_by_type(inferred_type: str, expected_type: str) -> int:
    if inferred_type == 'unknown':
        return 0
    if inferred_type == expected_type:
        return +15
    elif inferred_type in ['numeric', 'date'] and expected_type == 'string':
        return -20
    elif inferred_type == 'string' and expected_type in ['numeric', 'date']:
        return -30
    return 0

def identify_columns(df: pd.DataFrame, tenant_id: str, threshold: int = 85) -> Tuple[Dict[str, str], List[Dict[str, Any]]]:
    mapped_cols = {}
    ambiguous_cols = []
    
    tenant_dict = get_tenant_dictionary(tenant_id)
    
    for raw_header in df.columns:
        header_lower = str(raw_header).lower().strip()
        series = df[raw_header]
        inferred_type = profile_column_data(series)
        
        best_match_key = None
        highest_score = 0
        
        for entity, _ in ENTITIES_METADATA.items():
            if entity in tenant_dict:
                match, score = process.extractOne(header_lower, tenant_dict[entity])
                if score and score > highest_score:
                    highest_score = score
                    best_match_key = entity
                    
        if highest_score < 95:
            for entity, meta in ENTITIES_METADATA.items():
                match, score = process.extractOne(header_lower, meta['global_synonyms'])
                if score and score > highest_score:
                    highest_score = score
                    best_match_key = entity
                    
        if best_match_key:
            expected_type = ENTITIES_METADATA[best_match_key]['type']
            highest_score += score_adjustment_by_type(inferred_type, expected_type)
            highest_score = max(0, min(100, highest_score))
            
        if highest_score >= threshold:
            mapped_cols[raw_header] = best_match_key
        else:
            ambiguous_cols.append({
                'raw_header': raw_header,
                'inferred_type': inferred_type,
                'score': highest_score,
                'top_guess': best_match_key,
                'sample_data': series.dropna().astype(str).head(3).tolist()
            })
            
    return mapped_cols, ambiguous_cols

def cleanse_mapped_data(df: pd.DataFrame, final_mappings: Dict[str, str]) -> pd.DataFrame:
    df_clean = pd.DataFrame()
    for raw_head, entity in final_mappings.items():
        if entity == 'ignore' or raw_head not in df.columns:
            continue
            
        series = df[raw_head].copy()
        expected_type = ENTITIES_METADATA.get(entity, {}).get('type', 'string')
        
        if expected_type == 'numeric':
            # Handle potential multiple dots as thousand separators
            val_str = str(series.iloc[0]) if not series.empty else ""
            if val_str.count('.') > 1:
                series = series.astype(str).str.replace('.', '', regex=False)
            
            series = series.astype(str).str.replace(r'[^\d.,]', '', regex=True)
            series = series.str.replace(',', '.')
            series = pd.to_numeric(series, errors='coerce').round(2)
        elif expected_type == 'date':
            series = pd.to_datetime(series, format='mixed', errors='coerce').dt.strftime('%Y-%m-%d')
        elif expected_type == 'string':
            series = series.astype(str).str.strip().str.title()
            series = series.replace({'Nan': None, 'Nat': None, 'NaN': None})
            
        df_clean[entity] = series
        
    return df_clean

# --- Ticket 2 Logic: Financial Scenario Engine ---
def calculate_financial_scenario(org_id: str, threshold: int) -> Dict[str, Any]:
    """
    Simula la decisión entre comprar suplemento o vender hacienda de descarte.
    """
    # Mock data (In production this comes from DB)
    total_ev = 450.0
    current_autonomy = 12
    herd_count = 380
    
    # Market Prices (Mocked from MAG)
    price_vaca_refugo = 1450.0  # ARS/kg
    price_maiz = 210.0         # ARS/kg
    
    # Supplementation Cost
    # 1 EV consume ~4kg de maíz/día como suplemento de emergencia
    daily_supplement_kg = total_ev * 4 
    monthly_cost = daily_supplement_kg * price_maiz * 30
    
    # Capital Released by Selling 10% (Cull Cows)
    sell_pct = 0.10
    animals_to_sell = herd_count * sell_pct
    avg_weight = 420.0
    capital_released = animals_to_sell * avg_weight * price_vaca_refugo
    
    # Days Gained
    # Al vender el 10%, la carga baja y el pasto dura ~11% más
    days_gained = round(current_autonomy * 0.11)
    
    recommendation = (
        f"La autonomía es crítica ({current_autonomy} días). "
        f"Vender el 10% de vacas de descarte libera ${capital_released:,.0f} ARS "
        f"y gana {days_gained} días de pasto, evitando un gasto mensual de ${monthly_cost:,.0f} ARS en maíz."
    )
    
    return {
        "autonomy_days": current_autonomy,
        "supplement_cost_monthly": monthly_cost,
        "capital_released_by_sale": capital_released,
        "days_gained_by_sale": days_gained,
        "sell_category": "Vaca Refugo",
        "sell_pct": sell_pct,
        "recommendation": recommendation
    }

# --- Ticket 3 Logic: Predictive Climate Motor ---
def predict_biomass_growth(paddock_id: str, rainfall_mm: float, days: int) -> Dict[str, Any]:
    """
    Calcula el crecimiento proyectado basado en la eficiencia del uso del agua (WUE).
    """
    # WUE Coeficiente: kg MS / ha / mm
    # Un valor típico en la pampa húmeda es entre 10 y 20.
    wue_coef = 15.0 
    
    projected_growth = rainfall_mm * wue_coef
    
    # Autonomy impact
    # Asumiendo una demanda de 11 kg MS/EV/día y una carga de 1 EV/ha
    new_autonomy_added = round(projected_growth / 11)
    
    return {
        "paddock_id": paddock_id,
        "projected_rebrote_kg_ha": projected_growth,
        "new_autonomy_days": new_autonomy_added,
        "confidence_score": 85.0,
        "message": f"Con {rainfall_mm}mm de lluvia, se proyecta un rebrote de {projected_growth} kg MS/ha en {days} días."
    }
