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

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID || 'rodeo-app-fac50'
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const saEmail     = process.env.FIREBASE_ADMIN_IMPERSONATE_SA
  const credBase64  = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64

  const storageBucket = process.env.GCS_BUCKET_NAME || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'rodeo-app-fac50.firebasestorage.app'

  // Opción 0: Service Account JSON completo en base64 (preferido en Cloud Run)
  if (credBase64) {
    const saJson = JSON.parse(Buffer.from(credBase64, 'base64').toString('utf8'))
    return initializeApp({
      credential: cert(saJson),
      storageBucket,
    })
  }

  const hasServiceAccountKey =
    clientEmail && clientEmail !== 'PENDIENTE' &&
    privateKey  && privateKey  !== 'PENDIENTE'

  if (hasServiceAccountKey) {
    // Opción 1: Service account key explícita (producción / CI)
    return initializeApp({
      credential: cert({ projectId, clientEmail: clientEmail!, privateKey: privateKey! }),
      storageBucket,
    })
  }

  // Opción 2 & 3: Application Default Credentials
  // Funciona con:
  //   - gcloud auth application-default login (desarrollo local)
  //   - Workload Identity / metadata server (Cloud Run, GKE)
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
