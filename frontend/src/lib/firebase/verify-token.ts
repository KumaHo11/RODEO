/**
 * Verificación de Firebase ID Tokens sin Admin SDK
 * Usa la API pública de Google para verificar JWTs de Firebase
 * Funciona en Edge Runtime y sin credenciales de service account
 */

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rodeo-app-fac50'

interface FirebaseTokenPayload {
  uid: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  iat: number
  exp: number
  aud: string
  iss: string
  sub: string
}

/**
 * Obtiene las claves públicas de Firebase para verificar JWTs
 * Las claves rotan cada hora — se cachean con max-age del header
 */
let _cachedKeys: Record<string, string> | null = null
let _keysExpiry = 0

async function getPublicKeys(): Promise<Record<string, string>> {
  if (_cachedKeys && Date.now() < _keysExpiry) return _cachedKeys

  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { cache: 'no-store' }
  )

  // Parsear max-age del header Cache-Control para saber cuándo expira
  const cacheControl = res.headers.get('cache-control') || ''
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/)
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) * 1000 : 3600 * 1000

  _cachedKeys = await res.json()
  _keysExpiry = Date.now() + maxAge
  return _cachedKeys!
}

/**
 * Verifica un Firebase ID Token y devuelve el payload decodificado
 * Usa jose para verificación criptográfica (Edge-compatible)
 */
export async function verifyFirebaseToken(idToken: string): Promise<FirebaseTokenPayload | null> {
  try {
    // Decodificar header para obtener kid (key id)
    const [headerB64] = idToken.split('.')
    const header = JSON.parse(Buffer.from(headerB64, 'base64').toString())
    const { kid } = header

    // Obtener la clave pública correspondiente
    const keys = await getPublicKeys()
    const publicKeyPem = keys[kid]
    if (!publicKeyPem) return null

    // Importar la clave pública y verificar la firma
    const { jwtVerify, importX509 } = await import('jose')
    const publicKey = await importX509(publicKeyPem, 'RS256')

    const { payload } = await jwtVerify(idToken, publicKey, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    })

    return {
      uid: payload.sub!,
      email: payload['email'] as string | undefined,
      email_verified: payload['email_verified'] as boolean | undefined,
      name: payload['name'] as string | undefined,
      picture: payload['picture'] as string | undefined,
      iat: payload.iat!,
      exp: payload.exp!,
      aud: typeof payload.aud === 'string' ? payload.aud : payload.aud![0],
      iss: payload.iss!,
      sub: payload.sub!,
    }
  } catch (err) {
    console.error('Firebase token verification failed:', err)
    return null
  }
}
