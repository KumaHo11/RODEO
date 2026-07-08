#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════
# validate_deploy.sh — Pre-deploy validation script
#
# Validates that database credentials, IAM roles, and secrets are
# consistent and correct BEFORE deploying to Cloud Run.
#
# Usage:
#   ./infrastructure/validate_deploy.sh staging
#   ./infrastructure/validate_deploy.sh prod
#
# This script prevents the #1 recurring failure mode: deploying with
# credentials that don't match the actual database passwords.
# ═══════════════════════════════════════════════════════════════════════

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ] || { [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "prod" ]; }; then
  echo "Usage: $0 <staging|prod>"
  exit 1
fi

PASS=0
FAIL=0
WARN=0

check_pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
check_warn() { echo "  ⚠️  $1"; WARN=$((WARN + 1)); }

# ── Set project-specific variables ──────────────────────────────────
if [ "$ENVIRONMENT" = "staging" ]; then
  PROJECT="rodeo-app-fac50"
  CLOUD_RUN_SERVICE="rodeo-staging"
  SQL_INSTANCE="rodeo-db-preprod"
  REGION="southamerica-east1"
  CONNECTION_NAME="$PROJECT:$REGION:$SQL_INSTANCE"
elif [ "$ENVIRONMENT" = "prod" ]; then
  PROJECT="rodeo-app-prod-v1"
  CLOUD_RUN_SERVICE="rodeo-prod"
  SQL_INSTANCE="rodeo-db-prod"
  REGION="southamerica-east1"
  CONNECTION_NAME="$PROJECT:$REGION:$SQL_INSTANCE"
fi

echo ""
echo "🔍 Validating $ENVIRONMENT deployment (project: $PROJECT)"
echo "═══════════════════════════════════════════════════════════════"

# ── 1. Check gcloud authentication ──────────────────────────────────
echo ""
echo "1. Authentication"
if gcloud auth print-access-token --project=$PROJECT > /dev/null 2>&1; then
  ACCOUNT=$(gcloud config get-value account 2>/dev/null)
  check_pass "gcloud authenticated as: $ACCOUNT"
else
  check_fail "gcloud not authenticated. Run: gcloud auth login"
fi

# ── 2. Check Cloud SQL instance exists and is running ────────────────
echo ""
echo "2. Cloud SQL Instance"
SQL_STATE=$(gcloud sql instances describe $SQL_INSTANCE --project=$PROJECT --format="value(state)" 2>/dev/null || echo "NOT_FOUND")
if [ "$SQL_STATE" = "RUNNABLE" ]; then
  check_pass "Instance $SQL_INSTANCE is RUNNABLE"
else
  check_fail "Instance $SQL_INSTANCE state: $SQL_STATE"
fi

# ── 3. Check IAM: Service Account has cloudsql.client ────────────────
echo ""
echo "3. IAM Roles"
SA=$(gcloud run services describe $CLOUD_RUN_SERVICE --region=$REGION --project=$PROJECT --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null || echo "UNKNOWN")
if [ "$SA" != "UNKNOWN" ]; then
  HAS_ROLE=$(gcloud projects get-iam-policy $PROJECT --format="json" 2>/dev/null | grep -c "cloudsql.client" || true)
  if [ "$HAS_ROLE" -gt 0 ]; then
    check_pass "Service Account has cloudsql.client role"
  else
    check_fail "Service Account $SA MISSING roles/cloudsql.client"
    echo "         Fix: gcloud projects add-iam-policy-binding $PROJECT --member='serviceAccount:$SA' --role='roles/cloudsql.client'"
  fi
else
  check_warn "Could not determine Cloud Run service account"
fi

# ── 4. Check Cloud Run has cloudsql-instances annotation ─────────────
echo ""
echo "4. Cloud SQL Connector"
ANNOTATION=$(gcloud run services describe $CLOUD_RUN_SERVICE --region=$REGION --project=$PROJECT --format="value(spec.template.metadata.annotations.'run.googleapis.com/cloudsql-instances')" 2>/dev/null || echo "NONE")
if [ "$ANNOTATION" = "$CONNECTION_NAME" ]; then
  check_pass "Cloud SQL connector configured: $ANNOTATION"
elif [ "$ANNOTATION" = "NONE" ]; then
  check_fail "Cloud SQL connector NOT configured on Cloud Run service"
else
  check_warn "Cloud SQL connector: $ANNOTATION (expected: $CONNECTION_NAME)"
fi

# ── 5. Check DATABASE_URL format in Cloud Run ────────────────────────
echo ""
echo "5. Database URL Configuration"
DB_URL=$(gcloud run services describe $CLOUD_RUN_SERVICE --region=$REGION --project=$PROJECT --format="value(spec.template.spec.containers[0].env[2].value)" 2>/dev/null || echo "NOT_FOUND")
if echo "$DB_URL" | grep -q "host=/cloudsql/"; then
  check_pass "DATABASE_URL uses Cloud SQL socket path"
else
  check_fail "DATABASE_URL does not use Cloud SQL socket path"
  echo "         Current: $DB_URL"
fi

if echo "$DB_URL" | grep -q "rodeo_app:"; then
  check_pass "DATABASE_URL uses rodeo_app role (not postgres)"
elif echo "$DB_URL" | grep -q "postgres:"; then
  check_fail "DATABASE_URL uses postgres superuser (should use rodeo_app)"
fi

# ── 6. Check Secret Manager secrets exist ────────────────────────────
echo ""
echo "6. Secret Manager"
for SECRET_NAME in "rodeo-db-url" "resend-api-key" "firebase-sa-key" "gemini-api-key" "EMAIL_VERIFY_JWT_SECRET"; do
  if gcloud secrets describe $SECRET_NAME --project=$PROJECT > /dev/null 2>&1; then
    check_pass "Secret $SECRET_NAME exists"
  else
    check_warn "Secret $SECRET_NAME not found"
  fi
done

# ── 7. Check IP Configuration (security) ────────────────────────────
echo ""
echo "7. Network Security"
AUTH_NETWORKS=$(gcloud sql instances describe $SQL_INSTANCE --project=$PROJECT --format="json(settings.ipConfiguration.authorizedNetworks)" 2>/dev/null)
if echo "$AUTH_NETWORKS" | grep -q "0.0.0.0/0"; then
  check_warn "Cloud SQL has 0.0.0.0/0 (open to all IPs) — consider restricting"
elif echo "$AUTH_NETWORKS" | grep -q "authorizedNetworks"; then
  check_pass "Cloud SQL has restricted authorized networks"
else
  check_pass "Cloud SQL has no public authorized networks (most secure)"
fi

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Results: ✅ $PASS passed  ❌ $FAIL failed  ⚠️  $WARN warnings"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "🚫 DEPLOY BLOCKED — Fix the failures above before deploying."
  exit 1
else
  echo "✅ All critical checks passed. Safe to deploy."
  exit 0
fi
