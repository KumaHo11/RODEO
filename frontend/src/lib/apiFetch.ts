/**
 * apiFetch — Authenticated fetch helper
 * Automatically attaches Firebase ID token as Bearer token in Authorization header.
 * Use in client components instead of raw fetch to API routes.
 */
import { auth } from '@/lib/firebase/client'

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = await auth.currentUser?.getIdToken()
  // Don't set Content-Type for FormData — browser handles multipart boundary
  const isFormData = options?.body instanceof FormData
  return fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
