/**
 * Firebase Auth — Browser Client
 * Capa de autenticación (Firebase Auth)
 *
 * Persistencia LOCAL explícita: garantiza que la sesión se guarda en
 * IndexedDB (no sessionStorage), permitiendo reabrir la PWA offline
 * sin necesidad de re-login.
 */
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// Singleton — evita duplicación en hot reload (dev)
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Persistencia LOCAL explícita — sesión persiste en IndexedDB para offline.
// Firebase v9+ usa LOCAL por defecto en la mayoría de navegadores, pero
// esto lo garantiza en todos los contextos (WebView, iframe, incognito).
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase] setPersistence failed (non-critical):', err.message)
  })
}

export default app
