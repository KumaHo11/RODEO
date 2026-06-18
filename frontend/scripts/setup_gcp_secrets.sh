#!/usr/bin/env bash
# ============================================================
# RODEO — Setup GCP Secret Manager for Firebase Admin Credentials
# ============================================================
# Este script crea los secrets necesarios en GCP Secret Manager
# para ambos proyectos (staging y producción).
#
# PRERREQUISITO: Correr con una cuenta que tenga:
#   - roles/secretmanager.admin en rodeo-app-fac50
#   - roles/secretmanager.admin en rodeo-app-prod-v1
#
# Uso (desde la raíz del proyecto, autenticado como usuario):
#   gcloud auth login
#   bash scripts/setup_gcp_secrets.sh
# ============================================================

set -euo pipefail

STAGING_PROJECT="rodeo-app-fac50"
PROD_PROJECT="rodeo-app-prod-v1"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}✅ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $*${NC}"; }
error() { echo -e "${RED}❌ $*${NC}"; }

echo "🔐 RODEO — GCP Secret Manager Setup"
echo "======================================"

# ── Función helper para crear o actualizar un secret ────────────────
create_or_update_secret() {
  local project=$1
  local secret_name=$2
  local value=$3

  if gcloud secrets describe "$secret_name" --project="$project" &>/dev/null; then
    warn "Secret '$secret_name' ya existe en $project — actualizando versión..."
    echo -n "$value" | gcloud secrets versions add "$secret_name" \
      --project="$project" \
      --data-file=- 2>&1
    info "Versión actualizada: $secret_name ($project)"
  else
    info "Creando secret '$secret_name' en $project..."
    echo -n "$value" | gcloud secrets create "$secret_name" \
      --project="$project" \
      --replication-policy=automatic \
      --data-file=- 2>&1
    info "Secret creado: $secret_name ($project)"
  fi
}

# ── Función para otorgar acceso al Cloud Run SA ──────────────────────
grant_secret_access() {
  local project=$1
  local secret_name=$2
  local sa_email=$3

  gcloud secrets add-iam-policy-binding "$secret_name" \
    --project="$project" \
    --member="serviceAccount:$sa_email" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>&1 && info "Acceso otorgado: $sa_email → $secret_name ($project)" \
    || warn "No se pudo otorgar acceso (puede ya existir): $sa_email → $secret_name"
}

# ── 1. Staging (rodeo-app-fac50) ────────────────────────────────────
echo ""
echo "─── Staging: $STAGING_PROJECT ─────────────────────────────────"
gcloud config set project "$STAGING_PROJECT" --quiet

# El SA de Firebase Admin de staging debe estar en un archivo separado.
# Si no existe /tmp/sa_staging.json, solicitarlo.
if [ ! -f "/tmp/sa_staging.json" ]; then
  warn "No se encontró /tmp/sa_staging.json"
  echo "Por favor, descargá el service account JSON de:"
  echo "  https://console.firebase.google.com/project/$STAGING_PROJECT/settings/serviceaccounts/adminsdk"
  echo "Y guardalo en /tmp/sa_staging.json"
  echo ""
  read -p "Presioná Enter cuando esté listo (o Ctrl+C para cancelar)..."
fi

if [ -f "/tmp/sa_staging.json" ]; then
  SA_B64_STAGING=$(python3 -c "import base64,json; d=json.load(open('/tmp/sa_staging.json')); print(base64.b64encode(json.dumps(d).encode()).decode())")
  create_or_update_secret "$STAGING_PROJECT" "FIREBASE_ADMIN_CREDENTIALS_BASE64" "$SA_B64_STAGING"
  
  # Otorgar acceso al SA que usa Cloud Run para staging
  # Cloud Run SA: rodeo-staging@rodeo-app-fac50.iam.gserviceaccount.com (o el compute SA)
  STAGING_RUN_SA=$(gcloud run services describe rodeo-staging \
    --project="$STAGING_PROJECT" \
    --region=southamerica-east1 \
    --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null || \
    echo "$STAGING_PROJECT-compute@developer.gserviceaccount.com")
  grant_secret_access "$STAGING_PROJECT" "FIREBASE_ADMIN_CREDENTIALS_BASE64" "$STAGING_RUN_SA"
fi

# ── 2. Producción (rodeo-app-prod-v1) ───────────────────────────────
echo ""
echo "─── Producción: $PROD_PROJECT ──────────────────────────────────"
gcloud config set project "$PROD_PROJECT" --quiet

if [ ! -f "/tmp/sa_prod.json" ]; then
  warn "No se encontró /tmp/sa_prod.json"
  echo "Por favor, descargá el service account JSON de:"
  echo "  https://console.firebase.google.com/project/$PROD_PROJECT/settings/serviceaccounts/adminsdk"
  echo "Y guardalo en /tmp/sa_prod.json"
  echo ""
  read -p "Presioná Enter cuando esté listo (o Ctrl+C para cancelar)..."
fi

if [ -f "/tmp/sa_prod.json" ]; then
  SA_B64_PROD=$(python3 -c "import base64,json; d=json.load(open('/tmp/sa_prod.json')); print(base64.b64encode(json.dumps(d).encode()).decode())")
  create_or_update_secret "$PROD_PROJECT" "FIREBASE_ADMIN_CREDENTIALS_BASE64" "$SA_B64_PROD"

  PROD_RUN_SA=$(gcloud run services describe rodeo-prod \
    --project="$PROD_PROJECT" \
    --region=southamerica-east1 \
    --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null || \
    echo "$PROD_PROJECT-compute@developer.gserviceaccount.com")
  grant_secret_access "$PROD_PROJECT" "FIREBASE_ADMIN_CREDENTIALS_BASE64" "$PROD_RUN_SA"
fi

echo ""
echo "======================================"
info "Setup de secrets completado."
echo ""
echo "📋 Próximos pasos:"
echo "  1. Verificar que los secrets existen en la consola:"
echo "     https://console.cloud.google.com/security/secret-manager?project=$STAGING_PROJECT"
echo "     https://console.cloud.google.com/security/secret-manager?project=$PROD_PROJECT"
echo ""
echo "  2. Hacer un push a 'staging' y 'main' para que el deploy use los secrets."
echo "     El workflow ya tiene: --set-secrets=FIREBASE_ADMIN_CREDENTIALS_BASE64=FIREBASE_ADMIN_CREDENTIALS_BASE64:latest"
echo ""
echo "  3. Eliminar FIREBASE_ADMIN_CREDENTIALS_BASE64 de los GitHub Secrets"
echo "     (ya no se necesita ahí — se lee desde GCP Secret Manager)."
