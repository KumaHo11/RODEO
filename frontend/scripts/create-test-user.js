#!/usr/bin/env node
/**
 * RODEO — Crear usuario de prueba con plan LATIFUNDIO
 * 
 * Usa Firebase Admin SDK para crear/obtener el usuario en Firebase Auth,
 * luego inserta el perfil + organización + plan en la DB.
 *
 * Uso: node scripts/create-test-user.js
 */
const { Pool } = require('pg')
const path = require('path')
const fs = require('fs')

// ── Cargar .env.local ──────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)="?([^"]*)"?$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

// ── Config del usuario de prueba ─────────────────────────────────────────────
const TEST_USER = {
  email:    'javi.osorio.1@gmail.com',
  password: '1q2w3e4r',
  name:     'Javi Osorio',
  orgName:  'Estancia Demo LATIFUNDIO',
  plan:     'latifundio',
}

// ── Firebase Admin ────────────────────────────────────────────────────────────
let initializeApp, getApps, getAuth, credential
try {
  const adminApp = require('firebase-admin/app')
  const adminAuth = require('firebase-admin/auth')
  initializeApp = adminApp.initializeApp
  getApps       = adminApp.getApps
  credential    = adminApp.cert ? adminApp : require('firebase-admin').credential
  getAuth       = adminAuth.getAuth
} catch {
  // fallback para versiones legacy
  try {
    const admin = require('firebase-admin')
    initializeApp = admin.initializeApp.bind(admin)
    getApps       = () => admin.apps
    getAuth       = () => admin.auth()
    credential    = admin.credential
  } catch {
    console.error('❌ firebase-admin no está instalado')
    process.exit(1)
  }
}

const saBase64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64
if (!saBase64) {
  console.error('❌ FIREBASE_ADMIN_CREDENTIALS_BASE64 no está en .env.local')
  process.exit(1)
}

const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'))

const existingApps = getApps()
let app
if (!existingApps.length) {
  app = initializeApp({
    credential: (credential.cert || require('firebase-admin').credential.cert)(serviceAccount),
    projectId:  process.env.FIREBASE_ADMIN_PROJECT_ID || serviceAccount.project_id,
  })
} else {
  app = existingApps[0]
}

const auth = getAuth(app)

// ── PostgreSQL ────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL,
  ssl: false,
  connectionTimeoutMillis: 15000,
})

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🐄 RODEO — Crear usuario de prueba LATIFUNDIO')
  console.log('=============================================')
  console.log(`📧 Email:    ${TEST_USER.email}`)
  console.log(`🔑 Password: ${TEST_USER.password}`)
  console.log(`📋 Plan:     ${TEST_USER.plan}`)
  console.log('')

  // ── 1. Firebase Auth: crear o reusar usuario ──────────────────────────────
  let firebaseUser
  try {
    firebaseUser = await auth.getUserByEmail(TEST_USER.email)
    console.log(`✅ Usuario Firebase existente: ${firebaseUser.uid}`)
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log('📝 Creando usuario en Firebase Auth...')
      firebaseUser = await auth.createUser({
        email:         TEST_USER.email,
        password:      TEST_USER.password,
        displayName:   TEST_USER.name,
        emailVerified: true,
      })
      console.log(`✅ Usuario Firebase creado: ${firebaseUser.uid}`)
    } else {
      throw err
    }
  }

  // Si el usuario existe pero queremos resetear el password
  try {
    await auth.updateUser(firebaseUser.uid, {
      password:      TEST_USER.password,
      emailVerified: true,
    })
    console.log('✅ Password actualizado/confirmado en Firebase')
  } catch (err) {
    console.warn('⚠️  No se pudo actualizar password:', err.message)
  }

  const FIREBASE_UID = firebaseUser.uid

  // ── 2. DB: verificar si ya existe el perfil ───────────────────────────────
  const client = await pool.connect()
  try {
    const existing = await client.query(
      `SELECT p.id, p.organization_id, o.name as org_name
       FROM profiles p
       LEFT JOIN organizations o ON o.id = p.organization_id
       WHERE p.firebase_uid = $1`,
      [FIREBASE_UID]
    )

    if (existing.rows.length > 0) {
      const profile = existing.rows[0]
      console.log(`\nℹ️  Perfil ya existe en DB: ${profile.id}`)
      console.log(`   Org: ${profile.org_name || '(sin org)'}`)
      
      // Actualizar plan a LATIFUNDIO de todas formas
      await upgradePlanToLatifundio(client, profile.organization_id)
      console.log('\n✅ Plan actualizado a LATIFUNDIO')
    } else {
      // ── 3. Crear organización nueva ───────────────────────────────────────
      console.log('\n📝 Creando organización en DB...')
      
      // Buscar plan LATIFUNDIO en subscriptions_plans
      const planResult = await client.query(
        `SELECT id FROM subscriptions_plans 
         WHERE LOWER(name) LIKE '%latifundio%' OR LOWER(name) LIKE '%enterprise%'
         LIMIT 1`
      )
      
      let planId = planResult.rows[0]?.id
      
      if (!planId) {
        // Crear el plan si no existe
        const newPlan = await client.query(
          `INSERT INTO subscriptions_plans 
             (name, slug, price, price_ars, price_usd, paddocks_limit, herds_limit, has_ai_analysis, billing_period)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          ['LATIFUNDIO', 'latifundio', 299, 299000, 299, 9999, 9999, true, 'monthly']
        )
        planId = newPlan.rows[0]?.id
        
        if (!planId) {
          // Buscar de nuevo (ON CONFLICT DO NOTHING)
          const retry = await client.query(
            `SELECT id FROM subscriptions_plans WHERE LOWER(name) = 'latifundio' LIMIT 1`
          )
          planId = retry.rows[0]?.id
        }
        console.log(`  ✅ Plan LATIFUNDIO creado/encontrado: ${planId}`)
      } else {
        console.log(`  ✅ Plan LATIFUNDIO encontrado: ${planId}`)
      }

      // Crear organización
      const orgResult = await client.query(
        `INSERT INTO organizations (name, subscription_plan_id)
         VALUES ($1, $2)
         RETURNING id`,
        [TEST_USER.orgName, planId]
      )
      const orgId = orgResult.rows[0].id
      console.log(`  ✅ Organización creada: ${orgId}`)

      // Crear perfil
      const profileResult = await client.query(
        `INSERT INTO profiles 
           (firebase_uid, email, organization_id, role, is_active, first_name, last_name, onboarding_step)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          FIREBASE_UID,
          TEST_USER.email,
          orgId,
          'OWNER',
          true,
          'Javi',
          'Osorio',
          10, // onboarding completo
        ]
      )
      const profileId = profileResult.rows[0].id
      console.log(`  ✅ Perfil creado: ${profileId}`)

      // Agregar feature flags de LATIFUNDIO
      await upgradePlanToLatifundio(client, orgId)
    }

    // ── 4. Verificar resultado final ──────────────────────────────────────
    const finalCheck = await client.query(
      `SELECT 
         p.id as profile_id,
         p.firebase_uid,
         p.email,
         p.role,
         o.name as org_name,
         sp.name as plan_name,
         sp.slug as plan_slug
       FROM profiles p
       JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN subscriptions_plans sp ON sp.id = o.subscription_plan_id
       WHERE p.firebase_uid = $1`,
      [FIREBASE_UID]
    )

    const u = finalCheck.rows[0]
    console.log('\n🎉 Usuario de prueba listo!')
    console.log('=====================================')
    console.log(`📧 Email:       ${TEST_USER.email}`)
    console.log(`🔑 Password:    ${TEST_USER.password}`)
    console.log(`🆔 Firebase UID:${FIREBASE_UID}`)
    console.log(`🏢 Org:         ${u?.org_name}`)
    console.log(`📋 Plan:        ${u?.plan_name} (${u?.plan_slug})`)
    console.log(`👤 Rol:         ${u?.role}`)
    console.log('=====================================')
    console.log('\n▶️  Abrí http://localhost:3000 e iniciá sesión con estas credenciales.')
    console.log('   Vas a tener acceso completo a todas las features: Metrics, Time Machine,')
    console.log('   Deforestation Guard, Compliance, Animales individuales, etc.\n')

  } finally {
    client.release()
    await pool.end()
    process.exit(0)
  }
}

async function upgradePlanToLatifundio(client, orgId) {
  if (!orgId) return

  // Buscar o crear el plan LATIFUNDIO
  let planResult = await client.query(
    `SELECT id FROM subscriptions_plans 
     WHERE LOWER(name) LIKE '%latifundio%' OR LOWER(slug) = 'latifundio'
     LIMIT 1`
  )
  
  let planId = planResult.rows[0]?.id
  if (!planId) {
    const inserted = await client.query(
      `INSERT INTO subscriptions_plans 
         (name, slug, price, price_ars, price_usd, paddocks_limit, herds_limit, has_ai_analysis, billing_period)
       VALUES ('LATIFUNDIO', 'latifundio', 299, 299000, 299, 9999, 9999, true, 'monthly')
       RETURNING id`
    )
    planId = inserted.rows[0].id
  }

  // Actualizar el plan de la org
  await client.query(
    `UPDATE organizations SET subscription_plan_id = $1 WHERE id = $2`,
    [planId, orgId]
  )

  // Insertar feature flags explícitos para LATIFUNDIO
  const flags = [
    'metrics_module', 'deforestation_guard', 'animal_registry',
    'ndvi_access', 'ai_insights', 'offline_mode', 'voice_bitacora',
    'advanced_reports', 'api_access', 'carbon_module', 'grazing_planner',
    'tareas', 'equipo', 'agenda', 'clima', 'map', 'climate_adjustment',
  ]

  // Verificar si existe la tabla plan_feature_flags
  const tableCheck = await client.query(
    `SELECT 1 FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name = 'plan_feature_flags'`
  )

  if (tableCheck.rows.length > 0) {
    for (const flag of flags) {
      await client.query(
        `INSERT INTO plan_feature_flags (org_id, flag_key, flag_type, flag_value)
         VALUES ($1, $2, 'boolean', true)
         ON CONFLICT (org_id, flag_key) DO UPDATE SET flag_value = true`,
        [orgId, flag]
      )
    }
    console.log(`  ✅ ${flags.length} feature flags de LATIFUNDIO activados`)
  } else {
    console.log('  ℹ️  Tabla plan_feature_flags no existe — plan por slug')
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
