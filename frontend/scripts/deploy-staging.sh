#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# RODEO — Deploy a staging en GCP Cloud Run
# Uso: ./scripts/deploy-staging.sh [PROJECT_ID_o_NUMBER]
# Si no pasás argumento, intenta detectar el proyecto activo de gcloud
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Falla si cualquier comando falla

# Auto-detectar Project ID si no se pasa como argumento
if [ -z "$1" ]; then
  echo "▶ Detectando proyecto GCP activo..."
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
  if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo "❌ No se pudo detectar el proyecto. Pasalo como argumento:"
    echo "   ./scripts/deploy-staging.sh TU_PROJECT_ID"
    exit 1
  fi
  echo "  ✓ Proyecto detectado: $PROJECT_ID"
else
  PROJECT_ID=$1
fi

REGION="southamerica-east1"
SERVICE_NAME="rodeo-staging"
REGISTRY="$REGION-docker.pkg.dev"
IMAGE="$REGISTRY/$PROJECT_ID/rodeo-images/rodeo-frontend:staging"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🐄 RODEO — Deploy to Staging"
echo "  Proyecto: $PROJECT_ID"
echo "  Región:   $REGION"
echo "  Imagen:   $IMAGE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Verificar gcloud configurado ─────────────────────────────────────────────
echo ""
echo "▶ [1/5] Verificando configuración GCP..."
gcloud config set project $PROJECT_ID
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

# ── Habilitar APIs necesarias ─────────────────────────────────────────────────
echo ""
echo "▶ [2/5] Habilitando APIs GCP..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com --quiet

# ── Crear Artifact Registry si no existe ─────────────────────────────────────
echo ""
echo "▶ [3/5] Configurando Artifact Registry..."
gcloud artifacts repositories describe rodeo-images \
  --location=$REGION 2>/dev/null || \
gcloud artifacts repositories create rodeo-images \
  --repository-format=docker \
  --location=$REGION \
  --description="RODEO Docker images"

# ── Cargar variables de entorno desde .env.local ──────────────────────────────
echo ""
echo "▶ [4/5] Cargando variables de entorno..."
if [ -f ".env.local" ]; then
  export $(grep -v '^#' .env.local | xargs)
  echo "  ✓ .env.local cargado"
else
  echo "  ⚠️  No se encontró .env.local — usando variables del sistema"
fi

# ── Build y Push ──────────────────────────────────────────────────────────────
echo ""
echo "▶ [5/5] Build + Push de imagen Docker..."
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --platform linux/amd64 \
  -t $IMAGE \
  .

docker push $IMAGE

# ── Deploy a Cloud Run ────────────────────────────────────────────────────────
echo ""
echo "▶ Desplegando en Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --port=3000 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL" \
  --set-env-vars="NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --set-env-vars="GEMINI_API_KEY=$GEMINI_API_KEY" \
  --set-env-vars="RESEND_API_KEY=$RESEND_API_KEY" \
  --quiet

# ── Resultado ─────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deploy completado!"
echo ""
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(status.url)')
echo "  🌐 URL: $SERVICE_URL"
echo ""
echo "  Próximos pasos:"
echo "  1. Agregar $SERVICE_URL en Supabase → Auth → Redirect URLs"
echo "  2. Ver logs: gcloud run logs read --service=$SERVICE_NAME --region=$REGION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
