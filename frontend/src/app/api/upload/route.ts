/**
 * POST /api/upload
 * Uploads a file to GCS and returns the public URL.
 * Accepts multipart/form-data with a 'file' field and optional 'folder' field.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { Storage } from '@google-cloud/storage'

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'rodeo-media'

// Initialize GCS client
const getStorage = () => {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (credsJson) {
    try {
      const creds = JSON.parse(credsJson)
      return new Storage({ credentials: creds, projectId: creds.project_id })
    } catch (e) {
      console.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', e)
    }
  }
  // In Cloud Run, uses default service account
  return new Storage({ projectId: process.env.GCLOUD_PROJECT || 'rodeo-staging' })
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'uploads'

    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = file.name.split('.').pop() || 'bin'
    const timestamp = Date.now()
    const uid = decoded.uid.slice(0, 8)
    const filename = `${folder}/${uid}_${timestamp}.${ext}`

    try {
      const storage = getStorage()
      const bucket = storage.bucket(BUCKET_NAME)
      const gcsFile = bucket.file(filename)

      await gcsFile.save(buffer, {
        metadata: { contentType: file.type || 'application/octet-stream' },
      })

      // Make the file publicly readable
      await gcsFile.makePublic()

      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`
      return NextResponse.json({ url: publicUrl, filename })
    } catch (gcsErr: any) {
      console.error('GCS upload error:', gcsErr.message)
      // Fallback: return a data URL so the UI still works in dev/staging without GCS
      const base64 = buffer.toString('base64')
      const mimeType = file.type || 'application/octet-stream'
      const dataUrl = `data:${mimeType};base64,${base64}`
      console.warn('GCS unavailable — returning data URL as fallback')
      return NextResponse.json({ url: dataUrl, filename, fallback: true })
    }
  } catch (err: any) {
    console.error('POST /api/upload error:', err)
    return NextResponse.json({ error: 'Error al subir archivo: ' + err.message }, { status: 500 })
  }
}
