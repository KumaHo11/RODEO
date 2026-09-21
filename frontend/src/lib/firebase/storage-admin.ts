/**
 * lib/firebase/storage-admin.ts
 * Sube un Buffer a GCS desde el servidor (webhook, sin sesión de usuario).
 *
 * IMPORTANTE — por qué usamos @google-cloud/storage con ADC y NO firebase-admin/storage:
 * ─────────────────────────────────────────────────────────────────────────────────────
 * 1. firebase-admin con cert(saJson) llama a googleapis.com/oauth2 con la SA private key.
 *    Eso falla en Cloud Run con ERR_STREAM_PREMATURE_CLOSE.
 * 2. El bucket tiene "Uniform Bucket-Level Access" habilitado → makePublic() lanza
 *    "Cannot update access control for an object when uniform bucket-level access is enabled."
 * 3. @google-cloud/storage con ADC usa el metadata server interno de Cloud Run
 *    (http://metadata.google.internal) — no necesita llamadas externas de auth.
 *
 * El bucket (rodeo-media / rodeo-media-prod) ya tiene:
 *   - allUsers: roles/storage.objectViewer → lectura pública sin ACL por objeto
 *   - Compute SA: roles/storage.objectAdmin → escritura vía ADC
 */
import { Storage } from '@google-cloud/storage'

function createGcsClient(): Storage {
  // En Cloud Run: ADC usa el metadata server automáticamente
  if (process.env.K_SERVICE || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new Storage()
  }
  // Fallback local: usar la SA key del admin de Firebase
  if (process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64) {
    try {
      const json = JSON.parse(
        Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64, 'base64').toString('utf8')
      )
      return new Storage({
        projectId: json.project_id,
        credentials: { client_email: json.client_email, private_key: json.private_key },
      })
    } catch {
      console.warn('[storage-admin] Failed to parse FIREBASE_ADMIN_CREDENTIALS_BASE64, using ADC')
    }
  }
  return new Storage()
}

const gcs = createGcsClient()
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'rodeo-media'

export async function uploadBufferToStorage(
  buffer: Buffer,
  destination: string,  // ej. 'bitacora-audio/wa-1234.ogg'
  contentType: string
): Promise<string> {
  const bucket = gcs.bucket(BUCKET_NAME)
  const file   = bucket.file(destination)

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
    // NO makePublic() — el bucket usa Uniform IAM con allUsers:objectViewer
  })

  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`
  console.log('[storage-admin] Upload OK →', publicUrl)
  return publicUrl
}
