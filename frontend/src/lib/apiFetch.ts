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

const DEFAULT_TIMEOUT_MS = 30000

export async function apiFetch(url: string, options?: RequestInit & { timeout?: number }): Promise<Response> {
  const token = await auth.currentUser?.getIdToken()
  const isFormData = options?.body instanceof FormData

  // Merge caller's signal with our timeout signal
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('TimeoutError')), options?.timeout || DEFAULT_TIMEOUT_MS)

  // If caller already provided a signal, abort ours when theirs fires too
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort(options.signal?.reason), { once: true })
  }

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    // Si el servidor indica sesión expirada/inválida, notificar a la app
    // para que limpie el estado local y redirija al login.
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rodeo_auth_expired', {
        detail: { url, status: 401 }
      }))
    }

    return res
  } catch (err: any) {
    if (err.name === 'AbortError' || err.message === 'TimeoutError') {
      console.warn(`[apiFetch] Timeout fetching ${url}`)
      return new Response(JSON.stringify({ error: 'Request timed out' }), {
        status: 504,
        statusText: 'Gateway Timeout',
        headers: { 'Content-Type': 'application/json' }
      })
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
