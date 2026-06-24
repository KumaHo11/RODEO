/**
 * lib/offline/mediaSync.ts
 * Sincronización de archivos multimedia pendientes (audio y fotos).
 *
 * Cuando se recupera la conexión, este módulo:
 *  1. Lee todos los audios/fotos pendientes de rodeo_offline_audio (IndexedDB)
 *  2. Sube cada blob vía FormData al endpoint correspondiente
 *  3. Elimina del store local tras éxito
 *  4. Reporta progreso al OfflineManager
 */

import {
  getAllPendingAudios,
  getAllPendingPhotos,
  deletePendingAudio,
  deletePendingPhoto,
  type PendingAudio,
  type PendingPhoto,
} from '@/lib/audioOfflineStore'
import { auth } from '@/lib/firebase/client'

let _isSyncingMedia = false

export interface MediaSyncResult {
  audiosSynced: number
  photosSynced: number
  failed: number
}

/**
 * Sincroniza todos los audios y fotos pendientes.
 * Seguro para llamar múltiples veces — el lock evita procesamiento paralelo.
 */
export async function syncPendingMedia(): Promise<MediaSyncResult> {
  if (_isSyncingMedia) return { audiosSynced: 0, photosSynced: 0, failed: 0 }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { audiosSynced: 0, photosSynced: 0, failed: 0 }

  _isSyncingMedia = true
  let audiosSynced = 0
  let photosSynced = 0
  let failed = 0

  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return { audiosSynced: 0, photosSynced: 0, failed: 0 }

    // ── Sync pending audios ──────────────────────────────────────────────
    const pendingAudios = await getAllPendingAudios()
    for (const audio of pendingAudios) {
      const ok = await uploadAudio(audio, token)
      if (ok) {
        await deletePendingAudio(audio.id)
        audiosSynced++
      } else {
        failed++
      }
      // Small pause between uploads to avoid saturating rural connections
      await sleep(300)
    }

    // ── Sync pending photos ──────────────────────────────────────────────
    const pendingPhotos = await getAllPendingPhotos()
    for (const photo of pendingPhotos) {
      const ok = await uploadPhoto(photo, token)
      if (ok) {
        await deletePendingPhoto(photo.id)
        photosSynced++
      } else {
        failed++
      }
      await sleep(300)
    }

    if (audiosSynced + photosSynced > 0) {
      console.log(`[mediaSync] Synced: ${audiosSynced} audios, ${photosSynced} photos, ${failed} failed`)
      // Notify UI
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rodeo_media_synced', {
          detail: { audiosSynced, photosSynced, failed }
        }))
      }
    }
  } catch (err) {
    console.error('[mediaSync] Error during media sync:', err)
  } finally {
    _isSyncingMedia = false
  }

  return { audiosSynced, photosSynced, failed }
}

// ── Upload helpers ────────────────────────────────────────────────────────────

async function uploadAudio(audio: PendingAudio, token: string): Promise<boolean> {
  try {
    const formData = new FormData()
    formData.append('audio', audio.blob, `audio-${audio.id}.webm`)
    formData.append('title', audio.title)
    formData.append('transcript', audio.transcript || '')
    formData.append('durationSecs', String(audio.durationSecs))
    formData.append('createdAt', audio.createdAt)
    if (audio.lat !== null) formData.append('lat', String(audio.lat))
    if (audio.lng !== null) formData.append('lng', String(audio.lng))
    formData.append('type', 'AUDIO')
    formData.append('idempotency_key', `audio-${audio.id}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000) // 30s for uploads

    const res = await fetch('/api/field-notes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Idempotency-Key': `audio-${audio.id}`,
      },
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    // 2xx or 409 (already exists) = success
    return res.ok || res.status === 409
  } catch (err: any) {
    if (err.name === 'AbortError') console.warn('[mediaSync] Audio upload timeout:', audio.id)
    return false
  }
}

async function uploadPhoto(photo: PendingPhoto, token: string): Promise<boolean> {
  try {
    const formData = new FormData()
    formData.append('photo', photo.blob, `photo-${photo.id}.jpg`)
    formData.append('title', photo.title)
    formData.append('createdAt', photo.createdAt)
    if (photo.lat !== null) formData.append('lat', String(photo.lat))
    if (photo.lng !== null) formData.append('lng', String(photo.lng))
    formData.append('type', 'PHOTO')
    formData.append('idempotency_key', `photo-${photo.id}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    const res = await fetch('/api/field-notes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Idempotency-Key': `photo-${photo.id}`,
      },
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    return res.ok || res.status === 409
  } catch (err: any) {
    if (err.name === 'AbortError') console.warn('[mediaSync] Photo upload timeout:', photo.id)
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function isMediaSyncing(): boolean {
  return _isSyncingMedia
}
