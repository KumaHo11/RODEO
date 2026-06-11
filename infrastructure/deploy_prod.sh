#!/bin/bash
set -e

# Deploy script for Production - Fort Knox Architecture
# Deploys Backend (Internal), Parser (Internal), and Frontend (Public)

REGION="southamerica-east1"
PROJECT_ID="rodeo-app-fac50"
PROD_DOMAIN="rodeoagtech.com"

# 1. BUILD AND DEPLOY EXPRESS BACKEND (INTERNAL ONLY)
echo "▶ Construyendo y desplegando Backend (Express) en Cloud Run [Internal]..."
gcloud builds submit ./backend --tag gcr.io/$PROJECT_ID/rodeo-backend-prod
gcloud run deploy rodeo-backend-prod \
  --image gcr.io/$PROJECT_ID/rodeo-backend-prod \
  --region $REGION \
  --platform managed \
  --ingress internal \
  --no-allow-unauthenticated \
  --update-secrets="DATABASE_URL=rodeo-db-url-prod:latest"

# Obtener la URL interna del backend
BACKEND_INTERNAL_URL=$(gcloud run services describe rodeo-backend-prod --region $REGION --format 'value(status.url)')

# 2. BUILD AND DEPLOY PYTHON PARSER (INTERNAL ONLY)
echo "▶ Construyendo y desplegando Parser (Python) en Cloud Run [Internal]..."
gcloud builds submit ./parser_service --tag gcr.io/$PROJECT_ID/rodeo-parser-prod
gcloud run deploy rodeo-parser-prod \
  --image gcr.io/$PROJECT_ID/rodeo-parser-prod \
  --region $REGION \
  --platform managed \
  --ingress internal \
  --no-allow-unauthenticated

# Obtener la URL interna del parser
PARSER_INTERNAL_URL=$(gcloud run services describe rodeo-parser-prod --region $REGION --format 'value(status.url)')

# 3. BUILD AND DEPLOY NEXT.JS FRONTEND (PUBLIC)
echo "▶ Construyendo y desplegando Frontend (Next.js) en Cloud Run [Public]..."
# Asumimos que los build-args de firebase ya están en Google Secret Manager o en el entorno de Cloud Build
gcloud builds submit ./frontend --tag gcr.io/$PROJECT_ID/rodeo-frontend-prod
gcloud run deploy rodeo-frontend-prod \
  --image gcr.io/$PROJECT_ID/rodeo-frontend-prod \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="BACKEND_URL=${BACKEND_INTERNAL_URL},PARSER_URL=${PARSER_INTERNAL_URL},NEXT_PUBLIC_APP_URL=https://${PROD_DOMAIN}" \
  --update-secrets="DATABASE_URL=rodeo-db-url-prod:latest,RESEND_API_KEY=resend-api-key-prod:latest,FIREBASE_ADMIN_CREDENTIALS_BASE64=firebase-sa-key-prod:latest"

# 4. CONFIGURAR DOMINIO
echo "▶ Configurando mapeo de dominio..."
gcloud beta run domain-mappings create --service rodeo-frontend-prod --domain $PROD_DOMAIN --region $REGION || true
gcloud beta run domain-mappings create --service rodeo-frontend-prod --domain www.$PROD_DOMAIN --region $REGION || true

echo "✅ Despliegue de Producción completado exitosamente con Arquitectura Zero Trust."
