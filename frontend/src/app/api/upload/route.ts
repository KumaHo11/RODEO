/**
 * POST /api/upload
 * Uploads a file to GCS and returns the public URL.
 * Accepts multipart/form-data with a 'file' field and optional 'folder' field.
 *
 * WHY @google-cloud/storage WITH ADC (not firebase-admin/storage):
 * ──────────────────────────────────────────────────────────────────
 * firebase-admin initialized with cert(saJson) fetches OAuth tokens from
 * https://www.googleapis.com/oauth2/v4/token using the SA private key.
 * This request fails in Cloud Run with ERR_STREAM_PREMATURE_CLOSE.
 *
 * @google-cloud/storage with Application Default Credentials (ADC) uses the
 * Cloud Run metadata server (http://metadata.google.internal) instead —
 * it's available locally in the container without any external network call.
 * The Cloud Run Compute SA (742778588748-compute@) already has
 * roles/storage.objectAdmin on rodeo-media-prod bucket.
 *
 * Bucket: rodeo-media-prod (not Firebase Storage)
 *   - allUsers has roles/storage.objectViewer  → public read
 *   - Compute SA has roles/storage.objectAdmin → write access via ADC
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { Storage } from '@google-cloud/storage'

// Instantiate a GCS client using ADC.
// In Cloud Run: automatically uses the Compute SA via metadata server.
// Locally: uses GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC.
const gcs = new Storage()

// Primary bucket: rodeo-media-prod (Compute SA has objectAdmin, allUsers has objectViewer)
const PRIMARY_BUCKET = 'rodeo-media-prod'

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
    const filename = `${uid}_${timestamp}.${ext}`
    const gcsPath = `${folder}/${filename}`

    // ── Upload ──────────────────────────────────────────────────────────────
    const bucket = gcs.bucket(PRIMARY_BUCKET)
    const gcsFile = bucket.file(gcsPath)

    await gcsFile.save(buffer, {
      metadata: { contentType: file.type || 'application/octet-stream' },
      resumable: false,
    })

    // NOTE: makePublic() NOT called — bucket uses Uniform IAM (allUsers objectViewer already set)
    const publicUrl = `https://storage.googleapis.com/${PRIMARY_BUCKET}/${gcsPath}`
    console.log('[upload] GCS OK →', publicUrl)
    return NextResponse.json({ url: publicUrl, filename: gcsPath })

  } catch (err: any) {
    console.error('[upload] Error:', err?.message, err?.code)
    return NextResponse.json(
      { error: 'No se pudo guardar el archivo: ' + err?.message },
      { status: 500 }
    )
  }
}
