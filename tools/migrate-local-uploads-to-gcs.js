/**
 * Migra los archivos locales de /uploads/ a GCS (rodeo-media)
 * y actualiza las URLs en la base de datos.
 *
 * Uso: node tools/migrate-local-uploads-to-gcs.js
 */

const { Storage } = require('@google-cloud/storage')
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const BUCKET_NAME = 'rodeo-media'
const UPLOADS_DIR = path.join(__dirname, '../frontend/public/uploads')
const SA_KEY_FILE = '/tmp/rodeo-sa-new.json'
const DB_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/rodeo'

async function main() {
  // Init GCS
  const saKey = JSON.parse(fs.readFileSync(SA_KEY_FILE, 'utf8'))
  const storage = new Storage({ credentials: saKey, projectId: 'rodeo-app-fac50' })
  const bucket = storage.bucket(BUCKET_NAME)

  // Init DB
  const db = new Client({ connectionString: DB_URL })
  await db.connect()
  console.log('✓ DB conectada')

  // Obtener todas las notas con URLs locales
  const { rows: notes } = await db.query(`
    SELECT id, audio_url, photo_url
    FROM field_notes
    WHERE audio_url LIKE '/uploads/%' OR photo_url LIKE '/uploads/%'
    ORDER BY created_at DESC
  `)
  console.log(`\n📋 ${notes.length} notas para migrar\n`)

  let migrated = 0
  let missing = 0
  let errors = 0

  for (const note of notes) {
    const isAudio = !!note.audio_url
    const localPath = isAudio ? note.audio_url : note.photo_url
    const filename = path.basename(localPath)
    const localFilePath = path.join(UPLOADS_DIR, filename)

    if (!fs.existsSync(localFilePath)) {
      console.log(`  ⚠️  FALTA local: ${filename}`)
      missing++
      continue
    }

    const ext = path.extname(filename).toLowerCase()
    const contentType = ext === '.webm' ? 'audio/webm'
      : ext === '.mp4' ? 'audio/mp4'
      : ext === '.ogg' ? 'audio/ogg'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : 'application/octet-stream'

    const folder = isAudio ? 'field-notes-audio' : 'field-notes'
    const gcsPath = `${folder}/${filename}`
    const downloadToken = crypto.randomUUID()

    try {
      const gcsFile = bucket.file(gcsPath)
      await gcsFile.save(fs.readFileSync(localFilePath), {
        metadata: {
          contentType,
          metadata: { firebaseStorageDownloadTokens: downloadToken }
        }
      })

      const newUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(gcsPath)}?alt=media&token=${downloadToken}`

      if (isAudio) {
        await db.query('UPDATE field_notes SET audio_url = $1 WHERE id = $2', [newUrl, note.id])
      } else {
        await db.query('UPDATE field_notes SET photo_url = $1 WHERE id = $2', [newUrl, note.id])
      }

      console.log(`  ✅ ${filename} → ${gcsPath}`)
      migrated++
    } catch (err) {
      console.error(`  ❌ Error en ${filename}:`, err.message)
      errors++
    }
  }

  await db.end()

  console.log(`\n${'='.repeat(50)}`)
  console.log(`✅ Migrados: ${migrated}`)
  console.log(`⚠️  Faltaban local: ${missing}`)
  console.log(`❌ Errores: ${errors}`)
  console.log(`${'='.repeat(50)}\n`)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
