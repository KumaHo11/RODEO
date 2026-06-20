/**
 * POST /api/upload
 * Uploads a file to GCS and returns the public URL.
 * Accepts multipart/form-data with a 'file' field and optional 'folder' field.
 *
 * Upload order:
 *  1. Firebase Storage bucket (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
 *     — firebase-adminsdk-fbsvc has roles/storage.admin project-wide → always writable
 *     — bucket has allUsers objectViewer (set via gsutil iam ch) → URLs are public
 *  2. Custom GCS bucket (GCS_BUCKET_NAME) as fallback
 *
 * NOTE: makePublic() NOT used — bucket has Uniform IAM enabled which blocks per-object ACLs.
 *       Public access is granted at the bucket level (allUsers objectViewer).
 *
 * NOTE: Local filesystem fallback removed — Cloud Run containers are ephemeral.
 *       Files saved to /public/uploads disappear on restart, causing 404s.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { getStorage } from 'firebase-admin/storage'
import admin from '@/lib/firebase/admin'

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

    // ── Buckets to try in order ─────────────────────────────────────────────
    // Deduplicate: if both env vars point to the same bucket, try it only once
    const seen = new Set<string>()
    const bucketsToTry = [
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      process.env.GCS_BUCKET_NAME,
    ].filter((b): b is string => !!b && !seen.has(b) && seen.add(b) as unknown as boolean)

    if (bucketsToTry.length === 0) {
      console.error('[upload] No GCS bucket configured — set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET or GCS_BUCKET_NAME')
      return NextResponse.json({ error: 'Almacenamiento no configurado' }, { status: 500 })
    }

    for (const bucketName of bucketsToTry) {
      try {
        const storage = getStorage(admin.getAdminApp())
        const bucket = storage.bucket(bucketName)
        const gcsFile = bucket.file(gcsPath)

        await gcsFile.save(buffer, {
          metadata: { contentType: file.type || 'application/octet-stream' },
          resumable: false, // more reliable for files < 5MB
        })

        // NOTE: do NOT call makePublic() here — the bucket uses Uniform IAM
        // (bucket-level access). Public access is already granted via:
        //   gsutil iam ch allUsers:roles/storage.objectViewer gs://<bucket>
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}`
        console.log('[upload] GCS OK →', publicUrl, '(bucket:', bucketName, ')')
        return NextResponse.json({ url: publicUrl, filename: gcsPath })
      } catch (err: any) {
        console.error(`[upload] Failed with bucket "${bucketName}": ${err?.message} (code: ${err?.code ?? 'unknown'})`)
      }
    }

    // All GCS attempts failed
    console.error('[upload] All GCS buckets failed. SA needs Storage Object Admin on the bucket.')
    return NextResponse.json(
      { error: 'No se pudo guardar el archivo. Revisá los permisos IAM del bucket GCS.' },
      { status: 500 }
    )

  } catch (err: any) {
    console.error('POST /api/upload error:', err)
    return NextResponse.json({ error: 'Error al subir archivo: ' + err.message }, { status: 500 })
  }
}
