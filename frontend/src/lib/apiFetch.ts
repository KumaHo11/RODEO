/**
 * apiFetch — Authenticated fetch helper
 * Automatically attaches Firebase ID token as Bearer token in Authorization header.
 * Use in client components instead of raw fetch to API routes.
 *
 * Includes an 8-second timeout to prevent the UI from hanging indefinitely
 * when the device appears online (navigator.onLine=true) but has no real
 * connectivity (common on iOS/Android Chrome).
 */
import { auth } from '@/lib/firebase/client'

const DEFAULT_TIMEOUT_MS = 8000

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = await auth.currentUser?.getIdToken()
  const isFormData = options?.body instanceof FormData

  // Merge caller's signal with our timeout signal
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  // If caller already provided a signal, abort ours when theirs fires too
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  } finally {
    clearTimeout(timer)
  }
}
