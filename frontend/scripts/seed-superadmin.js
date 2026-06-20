/**
 * Script de seed para crear el Super Admin inicial de RODEO.
 * Ejecutar con: node --env-file=.env.local scripts/seed-superadmin.js
 *
 * Usa FIREBASE_ADMIN_CREDENTIALS_BASE64 (o FIREBASE_SERVICE_ACCOUNT_JSON).
 */
const admin = require('firebase-admin')
const { Pool } = require('pg')

const SUPER_ADMIN = {
  email: 'superadmin@rodeo.app',
  password: process.env.SUPER_ADMIN_PASSWORD || 'R0d30@Pr0d#2026!',
  first_name: 'Super',
  last_name: 'Admin',
  system_role: 'SUPER_ADMIN',
}

function getServiceAccount() {
  // Intentar FIREBASE_ADMIN_CREDENTIALS_BASE64 primero (el que ya usamos en el proyecto)
  const b64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64
  if (b64) {
    try {
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
    } catch {}
  }
  // Fallback: FIREBASE_SERVICE_ACCOUNT_JSON
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (json) {
    try { return JSON.parse(json) } catch {}
  }
  return null
}

async function main() {
  console.log('\n🌱 RODEO — Seeding Super Admin...\n')

  const serviceAccount = getServiceAccount()
  if (!serviceAccount) {
    console.error('❌ No se encontró credencial de Service Account.')
    console.error('   Asegurate de tener FIREBASE_ADMIN_CREDENTIALS_BASE64 o FIREBASE_SERVICE_ACCOUNT_JSON en .env.local')
    process.exit(1)
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    // ── 1. Verificar si el Super Admin ya existe en la DB ──────────────────
    const existingDb = await pool.query(
      `SELECT firebase_uid, email FROM profiles WHERE email = $1 AND system_role = 'SUPER_ADMIN'`,
      [SUPER_ADMIN.email]
    )

    if (existingDb.rows.length > 0) {
      console.log(`⚠️  Super Admin ya existe en la DB: ${SUPER_ADMIN.email}`)

      // Re-aplicar custom claims por si acaso
      const uid = existingDb.rows[0].firebase_uid
      if (uid) {
        await admin.auth().setCustomUserClaims(uid, { system_role: 'SUPER_ADMIN' })
        console.log('✅ Custom claims re-aplicados en Firebase.')
      }
    } else {
      // ── 2. Verificar si ya existe en Firebase Auth ─────────────────────
      let fbUser = null
      try {
        fbUser = await admin.auth().getUserByEmail(SUPER_ADMIN.email)
        console.log(`⚠️  Usuario ya existe en Firebase Auth: ${fbUser.uid}`)
      } catch {
        // No existe, crear
        console.log(`🔐 Creando usuario en Firebase Auth: ${SUPER_ADMIN.email}`)
        fbUser = await admin.auth().createUser({
          email: SUPER_ADMIN.email,
          password: SUPER_ADMIN.password,
          displayName: `${SUPER_ADMIN.first_name} ${SUPER_ADMIN.last_name}`,
          emailVerified: true,
        })
        console.log(`   Firebase UID: ${fbUser.uid}`)
      }

      // ── 3. Setear custom claim ─────────────────────────────────────────
      await admin.auth().setCustomUserClaims(fbUser.uid, { system_role: 'SUPER_ADMIN' })
      console.log('   ✅ Custom claim system_role=SUPER_ADMIN seteado')

      // ── 4. Insertar perfil en Cloud SQL ───────────────────────────────
      await pool.query(
        `INSERT INTO profiles (firebase_uid, email, first_name, last_name, system_role, is_active, onboarding_step)
         VALUES ($1, $2, $3, $4, $5, true, 99)
         ON CONFLICT (firebase_uid) DO UPDATE
         SET system_role = $5, is_active = true, first_name = $3, last_name = $4`,
        [fbUser.uid, SUPER_ADMIN.email, SUPER_ADMIN.first_name, SUPER_ADMIN.last_name, SUPER_ADMIN.system_role]
      )
      console.log('   ✅ Perfil insertado en Cloud SQL')

      // ── 5. Audit log ──────────────────────────────────────────────────
      try {
        await pool.query(
          `INSERT INTO audit_logs (actor_email, action, entity_type, new_value)
           VALUES ($1, 'SUPER_ADMIN_CREATED', 'profile', $2)`,
          ['seed-script', JSON.stringify({ email: SUPER_ADMIN.email, uid: fbUser.uid })]
        )
      } catch {
        console.log('   ℹ️  audit_logs no disponible aún (se creará con la migración)')
      }
    }

    // ── 6. Verificar/insertar system_config defaults ───────────────────────
    console.log('\n📋 Verificando system_config...')
    let existingKeys = []
    try {
      const configKeys = await pool.query('SELECT key FROM system_config')
      existingKeys = configKeys.rows.map(r => r.key)
    } catch {
      console.log('   ℹ️  Tabla system_config no existe aún (se creará con la migración)')
    }

    if (existingKeys.length === 0 && existingKeys !== null) {
      const defaults = [
        { key: 'stripe_publishable_key', value: '', label: 'Stripe Publishable Key',   category: 'payments', is_secret: false },
        { key: 'stripe_secret_key',      value: '', label: 'Stripe Secret Key',         category: 'payments', is_secret: true  },
        { key: 'stripe_webhook_secret',  value: '', label: 'Stripe Webhook Secret',     category: 'payments', is_secret: true  },
        { key: 'mp_public_key',          value: '', label: 'MercadoPago Public Key',    category: 'payments', is_secret: false },
        { key: 'mp_access_token',        value: '', label: 'MercadoPago Access Token',  category: 'payments', is_secret: true  },
      ]

      for (const cfg of defaults) {
        try {
          await pool.query(
            `INSERT INTO system_config (key, value, label, category, is_secret)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT (key) DO NOTHING`,
            [cfg.key, cfg.value, cfg.label, cfg.category, cfg.is_secret]
          )
          console.log(`   ✅ Config: ${cfg.key}`)
        } catch {
          console.log(`   ⚠️  No se pudo insertar config: ${cfg.key}`)
        }
      }
    }

    console.log('\n🎉 Seed completado!\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  Email:     ${SUPER_ADMIN.email}`)
    console.log(`  Password:  ********** (desde env var)`)
    console.log(`  Panel:     http://localhost:3000/admin/dashboard`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n⚠️  Cambiá la contraseña después del primer login.\n')

  } catch (err) {
    console.error('❌ Error durante el seed:', err.message || err)
    process.exit(1)
  } finally {
    await pool.end()
    process.exit(0)
  }
}

main()
