import io
import pandas as pd
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import auth

if not firebase_admin._apps:
    firebase_admin.initialize_app()

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: No token provided")
    
    token = authorization.split("Bearer ")[1]
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")

from app.schemas import (
    AnalyzeResponse, CleanseMappingRequest, ResolveResponse,
    FinancialScenarioRequest, FinancialInsightResponse,
    ClimatePredictionRequest, ClimatePredictionResponse
)
from app.services import identify_columns, cleanse_mapped_data, calculate_financial_scenario, predict_biomass_growth

app = FastAPI(
    title="Rodeo Smart Parser API",
    description="Microservicio de NLP para ingesta inteligente de Excel/CSV",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/parser/analyze", response_model=AnalyzeResponse)
async def analyze_file(
    file: UploadFile = File(...),
    tenant_id: str = Form("default_tenant"),
    user: dict = Depends(get_current_user)
):
    """
    Recibe un archivo crudo (CSV/XLSX), lo perfila, identifica las columnas usando NLP 
    y retorna la data mapeada y ambigua junto a los datos crudos estandarizados.
    """
    try:
        content = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
            
        df.dropna(how='all', inplace=True)
        raw_rows = df.where(pd.notnull(df), None).to_dict(orient="records")
        
        mapped_cols, ambiguous_cols = identify_columns(df, tenant_id)
        
        return AnalyzeResponse(
            mapped=mapped_cols,
            ambiguous=ambiguous_cols,
            raw_data=raw_rows,
            message="Análisis completado exitosamente."
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo el archivo: {str(e)}")

@app.post("/api/parser/resolve", response_model=ResolveResponse)
async def resolve_and_cleanse(req: CleanseMappingRequest, user: dict = Depends(get_current_user)):
    """
    Recibe el JSON crudo y la configuración final de mappings (manual y automática).
    Aplica limpieza estructural (tipo casteo y regex) a las variables objetivo.
    """
    try:
        df = pd.DataFrame(req.file_data_json)
        df_clean = cleanse_mapped_data(df, req.final_mappings)
        
        # Guardar en DB el update del tenant (Fuera de Scope en el demo)
        
        clean_json = df_clean.where(pd.notnull(df_clean), None).to_dict(orient="records")
        return ResolveResponse(
            clean_data=clean_json,
            message="Limpieza completada y datos estructurados."
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/insights/financial-scenarios", response_model=FinancialInsightResponse)
async def get_financial_scenarios(req: FinancialScenarioRequest, user: dict = Depends(get_current_user)):
    """
    Ticket 2: Cruza la biología del campo con la economía local.
    Sugiere si suplementar o vender basado en precios del MAG.
    """
    try:
        # En una app real, esto consultaría la DB de Supabase/Postgres
        # Aquí implementamos la lógica central.
        result = calculate_financial_scenario(req.org_id, req.threshold_days)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/predictions/biomass-growth", response_model=ClimatePredictionResponse)
async def get_biomass_prediction(req: ClimatePredictionRequest, user: dict = Depends(get_current_user)):
    """
    Ticket 3: Motor Predictivo Climático.
    Traduce milímetros de lluvia en kg MS/ha proyectados.
    """
    try:
        result = predict_biomass_growth(req.paddock_id, req.rainfall_mm, req.days_forecast)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
