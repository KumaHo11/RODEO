# Runbook: Rotación de Credenciales de Base de Datos

> **Última actualización**: 2026-07-08
> **Autor**: Auditoría post-incidente del 4 de julio

## ⚠️ REGLA DE ORO

**El orden de actualización es CRÍTICO. Siempre seguir este orden:**

```
1. Cambiar contraseña en PostgreSQL  →  la vieja sigue funcionando hasta acá
2. Actualizar Secret Manager          →  los deploys futuros usarán la nueva
3. Actualizar Cloud Run env vars      →  el servicio activo se reinicia con la nueva
4. Actualizar .env.local              →  el desarrollo local usa la nueva
5. Verificar con /api/health          →  confirmar que todo conecta
```

**NUNCA** actualizar Cloud Run antes de confirmar que la nueva contraseña funciona en PostgreSQL.

---

## Procedimiento Paso a Paso

### Pre-requisitos

```bash
# 1. Autenticarse
gcloud auth login
gcloud auth application-default login

# 2. Verificar proyecto activo
gcloud config get-value project

# 3. Levantar proxy local (staging)
./start_proxy_staging.sh

# 4. Levantar proxy local (producción, en otro terminal)
./tools/cloud-sql-proxy --port 5433 rodeo-app-prod-v1:southamerica-east1:rodeo-db-prod
```

### Paso 1: Generar nuevas contraseñas

```bash
# Generar contraseñas seguras
node -e "const c=require('crypto'); console.log('APP:', 'rodeo_app_' + c.randomBytes(16).toString('hex')); console.log('SVC:', 'rodeo_svc_' + c.randomBytes(16).toString('hex'));"
```

### Paso 2: Cambiar contraseñas en PostgreSQL

```bash
# Para STAGING (via proxy en puerto 5432):
node -e "
const {Pool}=require('pg');
const pool=new Pool({host:'localhost',port:5432,user:'postgres',password:'RodeoStaging2026New!',database:'rodeo',ssl:false});
pool.query(\"ALTER ROLE rodeo_app PASSWORD 'NUEVA_PASS_APP'\").then(()=>console.log('✅ rodeo_app')).catch(console.error);
pool.query(\"ALTER ROLE rodeo_service PASSWORD 'NUEVA_PASS_SVC'\").then(()=>console.log('✅ rodeo_service')).catch(console.error).finally(()=>pool.end());
"

# Para PRODUCCIÓN (via proxy en puerto 5433):
node -e "
const {Pool}=require('pg');
const pool=new Pool({host:'localhost',port:5433,user:'postgres',password:'RodeoProd2026New!',database:'rodeo_main',ssl:false});
pool.query(\"ALTER ROLE rodeo_app PASSWORD 'NUEVA_PASS_APP'\").then(()=>console.log('✅ rodeo_app')).catch(console.error);
pool.query(\"ALTER ROLE rodeo_service PASSWORD 'NUEVA_PASS_SVC'\").then(()=>console.log('✅ rodeo_service')).catch(console.error).finally(()=>pool.end());
"
```

### Paso 3: Verificar que las nuevas contraseñas funcionan

```bash
node -e "
const {Pool}=require('pg');
const pool=new Pool({host:'localhost',port:5432,user:'rodeo_app',password:'NUEVA_PASS_APP',database:'rodeo',ssl:false});
pool.query('SELECT current_user').then(r=>console.log('✅',r.rows[0])).catch(e=>console.error('❌',e.message)).finally(()=>pool.end());
"
```

### Paso 4: Actualizar Secret Manager

```bash
# Staging
echo -n "postgresql://rodeo_app:NUEVA_PASS_APP@localhost:5432/rodeo?host=/cloudsql/rodeo-app-fac50:southamerica-east1:rodeo-db-preprod" | \
gcloud secrets versions add rodeo-db-url --data-file=- --project=rodeo-app-fac50

# Producción
echo -n "postgresql://rodeo_app:NUEVA_PASS_APP@localhost:5432/rodeo_main?host=/cloudsql/rodeo-app-prod-v1:southamerica-east1:rodeo-db-prod" | \
gcloud secrets versions add rodeo-db-url --data-file=- --project=rodeo-app-prod-v1
```

### Paso 5: Actualizar Cloud Run

```bash
# Staging
gcloud run services update rodeo-staging \
  --region=southamerica-east1 --project=rodeo-app-fac50 \
  --update-env-vars="DATABASE_URL=postgresql://rodeo_app:NUEVA_PASS_APP@localhost:5432/rodeo?host=/cloudsql/rodeo-app-fac50:southamerica-east1:rodeo-db-preprod" \
  --update-env-vars="DATABASE_URL_SERVICE=postgresql://rodeo_service:NUEVA_PASS_SVC@localhost:5432/rodeo?host=/cloudsql/rodeo-app-fac50:southamerica-east1:rodeo-db-preprod"

# Producción
gcloud run services update rodeo-prod \
  --region=southamerica-east1 --project=rodeo-app-prod-v1 \
  --update-env-vars="DATABASE_URL=postgresql://rodeo_app:NUEVA_PASS_APP@localhost:5432/rodeo_main?host=/cloudsql/rodeo-app-prod-v1:southamerica-east1:rodeo-db-prod" \
  --update-env-vars="DATABASE_URL_SERVICE=postgresql://rodeo_service:NUEVA_PASS_SVC@localhost:5432/rodeo_main?host=/cloudsql/rodeo-app-prod-v1:southamerica-east1:rodeo-db-prod"
```

### Paso 6: Actualizar .env.local

Editar `frontend/.env.local` con las nuevas contraseñas.

### Paso 7: Verificar

```bash
# Staging
curl -s https://staging.rodeoagtech.com/api/health | python3 -m json.tool

# Producción
curl -s https://rodeoagtech.com/api/health | python3 -m json.tool

# Local
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

---

## Arquitectura de conexión (referencia)

```
┌──────────────────────────────────────────────────────────────┐
│                      Cloud Run                                │
│  ┌──────────────┐    ┌─────────────────────┐                  │
│  │ Next.js App  │───▶│ Cloud SQL Connector  │──▶ Unix Socket   │
│  │ (server.js)  │    │ (auto-mounted)       │   /cloudsql/...  │
│  └──────────────┘    └─────────────────────┘                  │
│       │                       │                               │
│       │ DATABASE_URL          │ IAM: cloudsql.client           │
│       │ (env var)             │ (REQUIRED on SA)              │
│       ▼                       ▼                               │
│  postgresql://rodeo_app:PASS@localhost:5432/DB               │
│  ?host=/cloudsql/PROJECT:REGION:INSTANCE                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      Local Dev                                │
│  ┌──────────────┐    ┌─────────────────────┐                  │
│  │ Next.js Dev  │───▶│ Cloud SQL Auth Proxy │──▶ TCP :5432     │
│  │ (npm run dev)│    │ (manual start)       │                  │
│  └──────────────┘    └─────────────────────┘                  │
│       │                       │                               │
│       │ DATABASE_URL          │ ADC: gcloud auth login         │
│       │ (.env.local)          │ (REQUIRED locally)            │
│       ▼                       ▼                               │
│  postgresql://rodeo_app:PASS@localhost:5432/DB                │
│  (no ?host= param for local)                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Credenciales actuales (post-restauración 2026-07-08)

### Staging (`rodeo-app-fac50` / `rodeo-db-preprod`)
| Rol | Contraseña | Tiene BYPASSRLS |
|-----|-----------|----------------|
| `postgres` | `RodeoStaging2026New!` | ✅ Sí (superuser) |
| `rodeo_app` | `rodeo_app_staging_pass_123` | ❌ No (sujeto a RLS) |
| `rodeo_service` | `rodeo_svc_staging_pass_123` | ✅ Sí |

### Producción (`rodeo-app-prod-v1` / `rodeo-db-prod`)
| Rol | Contraseña | Tiene BYPASSRLS |
|-----|-----------|----------------|
| `postgres` | `RodeoProd2026New!` | ✅ Sí (superuser) |
| `rodeo_app` | `rodeo_app_prod_db04957641c66cb9cbc60e33986073e7` | ❌ No (sujeto a RLS) |
| `rodeo_service` | `rodeo_svc_prod_0a715eb2804550abf1e496d2d5341bd8` | ✅ Sí |

> **IMPORTANTE**: Estas contraseñas deben almacenarse en un gestor de contraseñas del equipo (1Password, etc.), NO solo en archivos .env.
