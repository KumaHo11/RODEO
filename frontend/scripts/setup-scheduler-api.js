#!/usr/bin/env node
/**
 * RODEO — Cloud Scheduler setup via REST API (usa ADC — no requiere gcloud CLI)
 * Crea/actualiza los jobs de cron para staging o producción.
 *
 * Uso: node scripts/setup-scheduler-api.js [staging|prod]
 *
 * Requiere: gcloud auth application-default login (ADC ya configurado)
 */
const { GoogleAuth } = require('google-auth-library')
const path = require('path')
const fs = require('fs')

// ── Config ────────────────────────────────────────────────────────────────────

const ENV = process.argv[2] || 'staging'

const CONFIG = {
  staging: {
    project:    'rodeo-app-fac50',
    appUrl:     'https://staging.rodeoagtech.com',
    service:    'rodeo-staging',
    secretName: 'CRON_SECRET',
  },
  prod: {
    project:    'rodeo-app-prod-v1',
    appUrl:     'https://app.rodeoagtech.com',
    service:    'rodeo-prod',
    secretName: 'CRON_SECRET',
  },
}

if (!CONFIG[ENV]) {
  console.error('❌ Entorno inválido. Usar: staging | prod')
  process.exit(1)
}

const { project, appUrl, service, secretName } = CONFIG[ENV]
const REGION   = 'southamerica-east1'
const LOCATION = `projects/${project}/locations/${REGION}`
const TZ       = 'America/Argentina/Buenos_Aires'

console.log(`\n🚀 RODEO Cloud Scheduler — ${ENV.toUpperCase()}`)
console.log(`   Proyecto: ${project}`)
console.log(`   App URL:  ${appUrl}`)
console.log('='.repeat(55))

// ── Google Auth ───────────────────────────────────────────────────────────────

const auth = new GoogleAuth({
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/cloudscheduler',
  ],
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAccessToken() {
  const client = await auth.getClient()
  const token  = await client.getAccessToken()
  return token.token
}

async function apiRequest(method, url, body = null, token) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
  }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(url, opts)
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, data: text } }
}

// ── Secret Manager — obtener CRON_SECRET ─────────────────────────────────────

async function getCronSecret(token) {
  // Prioridad 1: variable de entorno directa (para CI/CD o uso manual seguro)
  if (process.env.CRON_SECRET_OVERRIDE) {
    console.log('  ✅ Usando CRON_SECRET_OVERRIDE del entorno')
    return process.env.CRON_SECRET_OVERRIDE.trim()
  }
  // Prioridad 2: Secret Manager
  const url = `https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${secretName}/versions/latest:access`
  const { status, data } = await apiRequest('GET', url, null, token)
  if (status === 200 && data.payload?.data) {
    return Buffer.from(data.payload.data, 'base64').toString('utf-8').trim()
  }
  // Prioridad 3: .env.local
  console.log(`  ⚠️  Secret Manager: ${status} — buscando en .env.local...`)
  try {
    const envPath  = path.resolve(__dirname, '../.env.local')
    const envText  = fs.readFileSync(envPath, 'utf-8')
    const match    = envText.match(/^CRON_SECRET="?([^"\n]+)"?/m)
    if (match) return match[1].trim()
  } catch {}
  return null
}

// ── Cloud Scheduler — crear o actualizar job ──────────────────────────────────

async function upsertJob(token, cronSecret, { name, schedule, uri, description }) {
  const jobName = `${LOCATION}/jobs/${name}`
  const body = {
    name:        jobName,
    description,
    schedule,
    timeZone:    TZ,
    httpTarget: {
      uri,
      httpMethod: 'GET',
      headers: {
        'Authorization':  `Bearer ${cronSecret}`,
        'Content-Type':   'application/json',
        'X-Cron-Job':     name,
      },
    },
    retryConfig: { retryCount: 1 },
    attemptDeadline: '540s',
  }

  // Check if exists
  const checkUrl  = `https://cloudscheduler.googleapis.com/v1/${jobName}`
  const { status } = await apiRequest('GET', checkUrl, null, token)

  let res
  if (status === 200) {
    // Update (PATCH)
    const patchUrl = `https://cloudscheduler.googleapis.com/v1/${jobName}?updateMask=schedule,httpTarget,description,retryConfig,attemptDeadline`
    res = await apiRequest('PATCH', patchUrl, body, token)
    console.log(`  ♻️  Actualizado`)
  } else {
    // Create (POST)
    const createUrl = `https://cloudscheduler.googleapis.com/v1/${LOCATION}/jobs`
    res = await apiRequest('POST', createUrl, body, token)
    console.log(`  ✨ Creado`)
  }

  if (res.status >= 400) {
    console.error(`  ❌ Error ${res.status}:`, JSON.stringify(res.data).substring(0, 200))
    return false
  }
  return true
}

// ── Jobs a configurar ─────────────────────────────────────────────────────────

const JOBS = [
  {
    name:        'metrics-ingest-weekly',
    schedule:    '0 11 * * 1',   // Lunes 08:00 ART (11:00 UTC)
    uri:         `${appUrl}/api/cron/metrics-ingest`,
    description: 'RODEO Metrics: ingesta satelital semanal Sentinel-2 (NDVI/EVI/SAVI/NDMI/BSI)',
  },
  {
    name:        'climate-adjustment-daily',
    schedule:    '0 9 * * *',    // 06:00 ART (09:00 UTC) diario
    uri:         `${appUrl}/api/cron/climate-adjustment`,
    description: 'Ajuste Clima diario: recalcula dry matter con NDVI x lluvia x sequía',
  },
  {
    name:        'paddock-reminders-daily',
    schedule:    '30 10 * * *',  // 07:30 ART (10:30 UTC) diario
    uri:         `${appUrl}/api/cron/paddock-reminders`,
    description: 'Recordatorios de potreros: alertas de rotación y descanso',
  },
  {
    name:        'gap-detection-weekly',
    schedule:    '0 10 * * 0',   // Domingo 07:00 ART (10:00 UTC)
    uri:         `${appUrl}/api/cron/gap-detection`,
    description: 'Detección de gaps en el Gantt: potreros sin plan asignado',
  },
  {
    name:        'metrics-alerts-daily',
    schedule:    '0 12 * * *',   // 09:00 ART (12:00 UTC) diario
    uri:         `${appUrl}/api/cron/metrics-alerts`,
    description: 'Alert Engine: NDVI drop, BSI crítico, deforestación, compliance risk, sin datos 30d',
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let token
  try {
    token = await getAccessToken()
    console.log('✅ ADC token obtenido')
  } catch (err) {
    console.error('❌ Error obteniendo token ADC:', err.message)
    console.error('   Corré: gcloud auth application-default login')
    process.exit(1)
  }

  // Obtener CRON_SECRET
  process.stdout.write('🔑 Obteniendo CRON_SECRET... ')
  const cronSecret = await getCronSecret(token)
  if (!cronSecret) {
    console.error('\n❌ No se encontró CRON_SECRET en Secret Manager ni en .env.local')
    console.error('   Agregalo con: gcloud secrets create CRON_SECRET --data-file=-')
    process.exit(1)
  }
  console.log(`✅ (${cronSecret.length} chars)`)

  // Crear/actualizar cada job
  let allOk = true
  for (const job of JOBS) {
    process.stdout.write(`\n📅 ${job.name}\n   schedule: ${job.schedule} (${TZ})\n   uri: ${job.uri}\n   `)
    const ok = await upsertJob(token, cronSecret, job)
    if (!ok) allOk = false
  }

  // Listar jobs finales
  console.log('\n\n📋 Estado final de todos los jobs:')
  const listUrl = `https://cloudscheduler.googleapis.com/v1/${LOCATION}/jobs`
  const { data } = await apiRequest('GET', listUrl, null, token)
  if (data.jobs) {
    for (const j of data.jobs) {
      const shortName = j.name.split('/').pop()
      const lastRun   = j.lastAttemptTime ? new Date(j.lastAttemptTime).toLocaleString('es-AR') : 'nunca'
      const state     = j.state || 'ENABLED'
      console.log(`  ${state === 'ENABLED' ? '✅' : '⚠️ '} ${shortName.padEnd(35)} último: ${lastRun}`)
    }
  }

  console.log(`\n${allOk ? '🎉 Todos los jobs configurados correctamente!' : '⚠️  Algunos jobs tuvieron errores — revisá arriba'}`)
  if (!allOk) process.exit(1)
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message)
  process.exit(1)
})
