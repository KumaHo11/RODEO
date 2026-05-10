/**
 * lib/audioOfflineStore.ts
 *
 * Persiste blobs de audio e imágenes en IndexedDB para que sobrevivan
 * sin conexión a internet. Cuando se recupera la conexión,
 * la Bitácora los sube y transcribe automáticamente.
 */

const DB_NAME = 'rodeo_offline_audio'
const STORE_NAME = 'pending_audios'
const PHOTO_STORE = 'pending_photos'
const DB_VERSION = 2

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface PendingAudio {
  id: string           // UUID temporal local
  blob: Blob
  durationSecs: number
  lat: number | null
  lng: number | null
  createdAt: string    // ISO string
  title: string        // "Audio · HH:MM"
  transcript: string   // resultado de Web Speech (puede ser '')
}

export interface PendingPhoto {
  id: string           // UUID temporal local
  blob: Blob
  lat: number | null
  lng: number | null
  createdAt: string    // ISO string
  title: string        // "Foto · HH:MM"
}

// ── Audio helpers ────────────────────────────────────────────────────────────

export async function savePendingAudio(audio: PendingAudio): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(audio)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAllPendingAudios(): Promise<PendingAudio[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function deletePendingAudio(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function countPendingAudios(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ── Photo offline helpers ────────────────────────────────────────────────────

export async function savePendingPhoto(photo: PendingPhoto): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite')
    tx.objectStore(PHOTO_STORE).put(photo)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAllPendingPhotos(): Promise<PendingPhoto[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readonly')
    const req = tx.objectStore(PHOTO_STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function deletePendingPhoto(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite')
    tx.objectStore(PHOTO_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Returns total count of pending audios + pending photos */
export async function countPendingItems(): Promise<number> {
  const db = await openDB()
  const countStore = (storeName: string) =>
    new Promise<number>((res, rej) => {
      const tx = db.transaction(storeName, 'readonly')
      const req = tx.objectStore(storeName).count()
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
  const [a, p] = await Promise.all([countStore(STORE_NAME), countStore(PHOTO_STORE)])
  return a + p
}
