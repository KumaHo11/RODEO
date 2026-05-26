/**
 * POST /api/upload
 * Uploads a file to GCS and returns the public URL.
 * Accepts multipart/form-data with a 'file' field and optional 'folder' field.
 *
 * Fallback chain:
 *  1. GCS (production / staging — needs GOOGLE_APPLICATION_CREDENTIALS_JSON or service account)
 *  2. Local filesystem → public/uploads/<file> → served at /uploads/<file> by Next.js (dev only)
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { getStorage } from 'firebase-admin/storage'
import admin from '@/lib/firebase/admin'

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'rodeo-app-fac50.firebasestorage.app'

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

    // ── 1. Try GCS first (production / staging) ─────────────────────────────
    try {
      const storage = getStorage(admin.getAdminApp())
      const bucket = storage.bucket(BUCKET_NAME)
      const gcsPath = `${folder}/${filename}`
      const gcsFile = bucket.file(gcsPath)

      const { randomUUID } = await import('crypto')
      const downloadToken = randomUUID()

      await gcsFile.save(buffer, {
        metadata: { 
          contentType: file.type || 'application/octet-stream',
          metadata: {
            firebaseStorageDownloadTokens: downloadToken
          }
        },
      })

      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(gcsPath)}?alt=media&token=${downloadToken}`
      console.log('[upload] GCS OK →', publicUrl)
      return NextResponse.json({ url: publicUrl, filename: gcsPath })
    } catch (gcsErr: any) {
      console.error('[upload] GCS failed — bucket:', BUCKET_NAME, '| error:', gcsErr?.code, gcsErr?.message)
    }

    // ── 2. Local filesystem fallback (dev only) ──────────────────────────────
    // Cloud Run has an ephemeral filesystem — local paths are not served and
    // will 404 immediately. Only allow this fallback in local development.
    if (process.env.NODE_ENV === 'production') {
      console.error('[upload] GCS failed in production — refusing local fallback to avoid broken URLs')
      return NextResponse.json(
        { error: 'No se pudo guardar el archivo. Problema con el almacenamiento en la nube.' },
        { status: 500 }
      )
    }

    try {
      const { writeFile, mkdir } = await import('fs/promises')
      const { join } = await import('path')

      const uploadsDir = join(process.cwd(), 'public', 'uploads')
      await mkdir(uploadsDir, { recursive: true })

      const localPath = join(uploadsDir, filename)
      await writeFile(localPath, buffer)

      const localUrl = `/uploads/${filename}`
      console.log('[upload] Local fallback OK →', localUrl)
      return NextResponse.json({ url: localUrl, filename, fallback: 'local' })
    } catch (fsErr: any) {
      console.error('[upload] Local fallback failed:', fsErr.message)
      return NextResponse.json(
        { error: 'No se pudo guardar el archivo (GCS y filesystem no disponibles)' },
        { status: 500 }
      )
    }

  } catch (err: any) {
    console.error('POST /api/upload error:', err)
    return NextResponse.json({ error: 'Error al subir archivo: ' + err.message }, { status: 500 })
  }
}
