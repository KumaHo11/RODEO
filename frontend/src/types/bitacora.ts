// ─────────────────────────────────────────────────────────────────────────────
// types/bitacora.ts
// Interfaces estrictas para el módulo de Bitácora de Rodeo
// ─────────────────────────────────────────────────────────────────────────────

export type BitacoraMediaType = 'audio' | 'image' | 'video' | 'text'

export type BitacoraSource = 'whatsapp' | 'web' | 'WHATSAPP' | 'APP'

export interface BitacoraOperator {
  id?: string
  name: string
  role?: string
  phone?: string
  avatarUrl?: string
}

export interface BitacoraAiResult {
  analyzedAt: string
  type: 'materia_seca' | 'condicion_corporal'
  value: number
  unit: string
  targetId: string // potreroId o rodeoId
  confidence?: number
  label?: string
}

export interface BitacoraEntry {
  // Core
  id: string
  source: BitacoraSource
  createdAt: string          // ISO string
  is_pending?: boolean

  // Operator
  operator?: BitacoraOperator
  // Raw DB fields (mapped from API response)
  user_display_name?: string
  user_email?: string

  // Content
  title?: string
  text?: string
  content?: string           // alias for text (API returns content)
  transcription?: string

  // Media
  mediaType?: BitacoraMediaType
  mediaUrl?: string
  audio_url?: string
  photo_url?: string
  video_url?: string
  thumbnailUrl?: string
  audio_duration_secs?: number

  // Location
  paddock_id?: string
  paddock_name?: string
  rodeo_id?: string

  // AI
  aiResult?: BitacoraAiResult
  analysis_result?: any       // Raw from API (WhatsApp AI banner)

  // Status
  status?: 'PENDING_REVIEW' | 'APPROVED' | 'DISMISSED'
}

/** Derives BitacoraMediaType from a raw API note object */
export function inferMediaType(note: BitacoraEntry): BitacoraMediaType {
  if (note.video_url) return 'video'
  if (note.audio_url) return 'audio'
  if (note.photo_url) return 'image'
  return 'text'
}

/** Maps a raw API field_notes row to BitacoraEntry */
export function mapRawNote(raw: any): BitacoraEntry {
  const entry: BitacoraEntry = {
    id: raw.id,
    source: raw.source ?? 'APP',
    createdAt: raw.created_at,
    is_pending: raw.is_pending ?? false,
    user_display_name: raw.user_display_name,
    user_email: raw.user_email,
    title: raw.title,
    content: raw.content,
    audio_url: raw.audio_url,
    photo_url: raw.photo_url,
    video_url: raw.video_url,
    audio_duration_secs: raw.audio_duration_secs,
    paddock_id: raw.paddock_id,
    paddock_name: raw.paddock_name,
    analysis_result: raw.analysis_result,
    status: raw.status,
  }
  entry.mediaType = inferMediaType(entry)

  if (raw.user_display_name) {
    entry.operator = {
      name: raw.user_display_name,
      phone: raw.sender_phone,
    }
  }

  return entry
}
