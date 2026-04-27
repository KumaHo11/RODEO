from pydantic import BaseModel, ConfigDict
from typing import Dict, Any, List, Optional

# ---- Request Models ----
class CleanseMappingRequest(BaseModel):
    tenant_id: str
    file_data_json: List[Dict[str, Any]]
    final_mappings: Dict[str, str]
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "tenant_id": "tenant_001",
                "file_data_json": [{"Tmn": "50 ha", "Fech In": "2023-01-01"}],
                "final_mappings": {"Tmn": "field_size", "Fech In": "entry_date"}
            }
        }
    )

# ---- Response Models ----
class AmbiguousColumn(BaseModel):
    raw_header: str
    inferred_type: str
    score: int
    top_guess: Optional[str] = None
    sample_data: List[str]

class AnalyzeResponse(BaseModel):
    mapped: Dict[str, str]
    ambiguous: List[AmbiguousColumn]
    raw_data: List[Dict[str, Any]]
    message: str

class ResolveResponse(BaseModel):
    clean_data: List[Dict[str, Any]]
    message: str

# ---- Ticket 2: Financial Models ----
class MarketPriceModel(BaseModel):
    category: str
    price_ars: float
    unit: str
    recorded_at: Optional[str] = None
    source: str = "MAG"

class FinancialScenarioRequest(BaseModel):
    org_id: str
    threshold_days: int = 20

class FinancialInsightResponse(BaseModel):
    autonomy_days: int
    supplement_cost_monthly: float
    capital_released_by_sale: float
    days_gained_by_sale: int
    sell_category: str
    sell_pct: float
    recommendation: str

# ---- Ticket 3: Climate Models ----
class ClimatePredictionRequest(BaseModel):
    paddock_id: str
    rainfall_mm: float
    days_forecast: int = 21

class ClimatePredictionResponse(BaseModel):
    paddock_id: str
    projected_rebrote_kg_ha: float
    new_autonomy_days: int
    confidence_score: float
    message: str
