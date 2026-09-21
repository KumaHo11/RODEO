/**
 * POST /api/admin/retranscribe-wa-audios
 *
 * Re-transcribes field_notes that came from WhatsApp audio
 * but have no transcription (content is null or '[Audio — no se pudo procesar]').
 *
 * Query params:
 *   limit: number (default 20, max 50) — notes to process per call
 *   dry_run: boolean — if true, returns which notes would be processed without writing
 *
 * Auth: requires a valid Firebase token (any authenticated user of the org)
 * This is a dev/admin utility — in production consider restricting to admin role.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQuery, serviceMutate } from '@/lib/db'
import { transcribeAudio } from '@/lib/speechToText'

export async function POST(req: NextRequest) {
  // Auth
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const dryRun = searchParams.get('dry_run') === 'true'

  // Find WA audio notes without transcription in this org
  const rows = await serviceQuery<{
    id: string
    audio_url: string
    content: string | null
  }>(
    `SELECT fn.id, fn.audio_url, fn.content
     FROM field_notes fn
     JOIN profiles p ON p.id = fn.created_by
     WHERE fn.source = 'WHATSAPP'
       AND fn.audio_url IS NOT NULL
       AND (fn.content IS NULL
            OR fn.content = ''
            OR fn.content = '[Audio — no se pudo procesar]'
            OR fn.content = '[Sin voz detectable]')
       AND p.organization_id = (
         SELECT organization_id FROM profiles WHERE id = $1 LIMIT 1
       )
     ORDER BY fn.created_at DESC
     LIMIT $2`,
    [decoded.uid, limit]
  )

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      would_process: rows.length,
      notes: rows.map(r => ({ id: r.id, current_content: r.content })),
    })
  }

  const results: { id: string; status: 'ok' | 'error'; transcript?: string; error?: string }[] = []

  for (const row of rows) {
    try {
      // Download the audio from GCS
      const audioRes = await fetch(row.audio_url)
      if (!audioRes.ok) throw new Error(`HTTP ${audioRes.status} fetching audio`)

      const arrayBuffer = await audioRes.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Detect MIME from URL extension
      const ext = row.audio_url.split('?')[0].split('.').pop()?.toLowerCase() ?? 'ogg'
      const mimeMap: Record<string, string> = {
        ogg: 'audio/ogg',
        mp4: 'audio/mp4',
        webm: 'audio/webm',
        m4a: 'audio/mp4',
        mp3: 'audio/mpeg',
      }
      const mimeType = mimeMap[ext] ?? 'audio/ogg'

      const transcript = await transcribeAudio(buffer, mimeType)

      await serviceMutate(
        `UPDATE field_notes SET content = $1 WHERE id = $2`,
        [transcript, row.id]
      )

      results.push({ id: row.id, status: 'ok', transcript })
      console.log(`[retranscribe] ${row.id} → "${transcript.slice(0, 60)}"`)
    } catch (err: any) {
      console.error(`[retranscribe] ${row.id} FAILED:`, err.message)
      results.push({ id: row.id, status: 'error', error: err.message })
    }
  }

  const ok    = results.filter(r => r.status === 'ok').length
  const error = results.filter(r => r.status === 'error').length

  return NextResponse.json({ processed: results.length, ok, error, results })
}
