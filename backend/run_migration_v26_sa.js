/**
 * run_migration_v26_sa.js
 * Ejecuta la migración v26_eudr_compliance.sql usando el Cloud SQL Connector
 * con las credenciales del Service Account (FIREBASE_ADMIN_CREDENTIALS_BASE64).
 *
 * USO: node run_migration_v26_sa.js
 */
const path = require('path')
const fs   = require('fs')
const { Client } = require('pg')
const { Connector } = require('@google-cloud/cloud-sql-connector')

require('dotenv').config({ path: path.join(__dirname, '..', 'frontend', '.env.local') })

async function main() {
  const credsB64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64
  if (!credsB64) {
    console.error('❌ FIREBASE_ADMIN_CREDENTIALS_BASE64 not set')
    process.exit(1)
  }

  const creds = JSON.parse(Buffer.from(credsB64, 'base64').toString('utf8'))

  // SA email → project
  const saEmail  = creds.client_email  // firebase-admin-rodeo@rodeo-app-fac50.iam.gserviceaccount.com
  const project  = creds.project_id    // rodeo-app-fac50

  console.log(`\n🔑 Service Account: ${saEmail}`)
  console.log(`   GCP Project:      ${project}`)
  console.log(`   Instance:         rodeo-app-fac50:southamerica-east1:rodeo-db-preprod\n`)

  const instanceConnectionName = 'rodeo-app-fac50:southamerica-east1:rodeo-db-preprod'

  const connector = new Connector({
    auth: {
      // Use credentials from the service account key
      credentials: {
        client_email: creds.client_email,
        private_key:  creds.private_key,
      },
    },
  })

  const clientOpts = await connector.getOptions({
    instanceConnectionName,
    ipType: 'PUBLIC',
  })

  const pgClient = new Client({
    ...clientOpts,
    user:     'rodeo_service',
    password: 'rodeo_svc_staging_pass_123',
    database: 'rodeo',
  })

  await pgClient.connect()
  console.log('✅ Conectado a Cloud SQL via SA credentials')

  const sqlPath = path.join(__dirname, '..', 'v26_eudr_compliance.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  try {
    await pgClient.query('BEGIN')
    await pgClient.query(sql)
    await pgClient.query('COMMIT')
    console.log('✅ Migración v26_eudr_compliance completada exitosamente.')
    console.log('\nTablas creadas:')
    console.log('  - eudr_documents')
    console.log('  - feed_batches')
    console.log('  - eudr_dds_submissions')
    console.log('  - animal_custody_timeline (VIEW)')
  } catch (err) {
    await pgClient.query('ROLLBACK')
    console.error('❌ Error — ROLLBACK ejecutado.')
    console.error('   ', err.message)
    if (err.detail) console.error('   Detail:', err.detail)
    if (err.hint)   console.error('   Hint:',   err.hint)
    process.exit(1)
  } finally {
    await pgClient.end()
    connector.close()
  }
}

main().catch(e => {
  console.error('Error fatal:', e.message)
  process.exit(1)
})
