/**
 * Firebase Admin SDK — Server-side only
 * Usado en API routes para verificar ID tokens
 * NO importar en código client-side
 *
 * Estrategia de credenciales (en orden de prioridad):
 * 1. Service Account Key (FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY en .env.local)
 * 2. Impersonation del SA de Firebase via ADC (desarrollo local con gcloud ADC)
 * 3. Application Default Credentials puro (Cloud Run / GKE)
 */
import { initializeApp, getApps, cert, App, applicationDefault } from 'firebase-admin/app'
import { getAuth as getAdminAuth, Auth } from 'firebase-admin/auth'

let _adminAuth: Auth | null = null

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID
  if (!projectId) throw new Error('[Firebase Admin] FIREBASE_ADMIN_PROJECT_ID env var is required')
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const saEmail     = process.env.FIREBASE_ADMIN_IMPERSONATE_SA
  const credBase64  = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64

  const storageBucket = process.env.GCS_BUCKET_NAME
  if (!storageBucket) throw new Error('[Firebase Admin] GCS_BUCKET_NAME env var is required')

  // Opción 0: Service Account JSON completo en base64 (preferido en Cloud Run)
  if (credBase64) {
    try {
      const saJson = JSON.parse(Buffer.from(credBase64, 'base64').toString('utf8'))
      console.log(`[Firebase Admin] Initializing with SA credentials (project_id from SA: ${saJson.project_id}, configured project_id: ${projectId})`)
      if (saJson.project_id && saJson.project_id !== projectId) {
        console.warn(`[Firebase Admin] ⚠ PROJECT MISMATCH: SA is for "${saJson.project_id}" but FIREBASE_ADMIN_PROJECT_ID is "${projectId}". Auth operations will use the SA's project.`)
      }
      return initializeApp({
        credential: cert(saJson),
        storageBucket,
      })
    } catch (parseErr: any) {
      console.error('[Firebase Admin] Failed to parse FIREBASE_ADMIN_CREDENTIALS_BASE64:', parseErr.message)
      throw parseErr
    }
  }

  const hasServiceAccountKey =
    clientEmail && clientEmail !== 'PENDIENTE' &&
    privateKey  && privateKey  !== 'PENDIENTE'

  if (hasServiceAccountKey) {
    // Opción 1: Service account key explícita (producción / CI)
    console.log(`[Firebase Admin] Initializing with explicit SA key (projectId: ${projectId}, clientEmail: ${clientEmail})`)
    return initializeApp({
      credential: cert({ projectId, clientEmail: clientEmail!, privateKey: privateKey! }),
      storageBucket,
    })
  }

  // Opción 2 & 3: Application Default Credentials
  // Funciona con:
  //   - gcloud auth application-default login (desarrollo local)
  //   - Workload Identity / metadata server (Cloud Run, GKE)
  console.log(`[Firebase Admin] Initializing with ADC (projectId: ${projectId}, saEmail: ${saEmail || 'none'})`)
  return initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket,
    serviceAccountId: saEmail || undefined,
  })
}

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    if (!_adminAuth) {
      _adminAuth = getAdminAuth(getAdminApp())
    }
    return (_adminAuth as any)[prop]
  },
})

export default { getAdminApp }
