/**
 * lib/firebase/storage-admin.ts
 * Sube un Buffer a Firebase Storage desde el servidor (sin SDK cliente).
 * Devuelve la URL pública del archivo.
 */
import { getStorage } from 'firebase-admin/storage'
import adminFirebase from './admin'

adminFirebase.getAdminApp()

export async function uploadBufferToStorage(
  buffer: Buffer,
  destination: string,  // ej. 'bitacora-audio/wa-1234.ogg'
  contentType: string
): Promise<string> {
  const bucket = getStorage().bucket()
  const file   = bucket.file(destination)

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  })

  // Hacer el archivo público
  await file.makePublic()

  return `https://storage.googleapis.com/${bucket.name}/${destination}`
}
