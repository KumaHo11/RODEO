#!/bin/bash
# Inyectar FIREBASE_ADMIN_CREDENTIALS_BASE64 en Cloud Run
set -e

SA_B64=$(python3 -c "
import base64, json
with open('/Users/javi/RODEO/frontend/firebase-sa-key.json') as f:
    data = json.load(f)
print(base64.b64encode(json.dumps(data).encode()).decode())
")

echo "▶ Actualizando env vars en Cloud Run con SA credentials..."
gcloud run services update rodeo-staging \
  --region southamerica-east1 \
  --update-env-vars "FIREBASE_ADMIN_CREDENTIALS_BASE64=${SA_B64}"

echo "✅ Listo! FIREBASE_ADMIN_CREDENTIALS_BASE64 inyectada en Cloud Run"
