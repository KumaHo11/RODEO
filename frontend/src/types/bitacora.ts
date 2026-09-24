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

export interface PastureAIResult {
  estimated_dry_matter_kg_ha: number;
  confidence_interval: { min: number; max: number };
  predominant_species: string[];
  average_height_cm: number;
  ground_cover_percentage: number;
  growth_stage: 'vegetativo' | 'reproductivo' | 'senescente';
  pasture_status: 'optimo' | 'bajo' | 'pasado';
  regional_context_note: string;
  recommendation: string;
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

  // Operator — raw DB fields
  operator?: BitacoraOperator
  user_display_name?: string
  user_email?: string
  sender_phone?: string      // WA: número del remitente (E.164)

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
  /** Multiple photos from a WhatsApp album send (same sender, ≤90s window or same wa_batch_id) */
  groupedPhotos?: string[]
  /** Server-side batch ID assigned by the WhatsApp webhook to group album photos */
  wa_batch_id?: string

  // Location
  paddock_id?: string
  paddock_name?: string
  rodeo_id?: string
  rodeo_name?: string

  // AI
  aiResult?: BitacoraAiResult
  analysis_result?: any       // Raw from API (WhatsApp AI banner)

  // Status
  status?: 'PENDING_REVIEW' | 'APPROVED' | 'DISMISSED'

  // Internal grouping marker (excluded from render)
  __grouped?: boolean
}

/** Derives BitacoraMediaType from a raw API note object */
export function inferMediaType(note: BitacoraEntry): BitacoraMediaType {
  if (note.video_url) return 'video'
  if (note.audio_url) return 'audio'
  if (note.photo_url) return 'image'
  return 'text'
}

/** Formats a phone number for display as a name fallback */
function formatPhoneDisplay(phone: string): string {
  // E.164 → "+54 9 11 ···" style (show first 8 chars max)
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 11) {
    // +549XXXXXXXXXX → +54 9 11 XXXX (show only prefix to protect privacy)
    return `+${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(3, 5)} ···`
  }
  return phone
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
    sender_phone: raw.sender_phone,
    title: raw.title,
    content: raw.content,
    audio_url: raw.audio_url,
    photo_url: raw.photo_url,
    groupedPhotos: (() => {
      // Defensive: node-postgres may return photo_urls (JSONB) in different shapes:
      //  1. Native JS array (most common with pg JSONB): ["url1","url2"]
      //  2. PG text[] literal: {https://...,https://...}
      //  3. JSON string (stringified JSONB): '["url1","url2"]'
      //  4. null / undefined / empty array
      let arr: any = raw.photo_urls
      if (typeof arr === 'string') {
        if (arr.startsWith('{')) {
          // PG text[] literal -> strip braces, split, unquote
          arr = arr
            .slice(1, -1)
            .match(/(?:[^,"]|"[^"]*")+/g)
            ?.map((s: string) => s.replace(/^"|"$/g, '').trim())
            .filter(Boolean) ?? []
        } else if (arr.startsWith('[')) {
          // JSON array string from JSONB serialization
          try { arr = JSON.parse(arr) } catch { arr = [] }
        } else {
          arr = []
        }
      }
      return Array.isArray(arr) && arr.length > 0 ? (arr as string[]) : undefined
    })(),
    video_url: raw.video_url,
    audio_duration_secs: raw.audio_duration_secs,
    wa_batch_id: raw.wa_batch_id ?? undefined,
    paddock_id: raw.paddock_id,
    paddock_name: raw.paddock_name,
    rodeo_id: raw.rodeo_id,
    rodeo_name: raw.rodeo_name,
    analysis_result: raw.analysis_result,
    status: raw.status,
    aiResult: raw.analysis_result?.type === 'materia_seca' || raw.analysis_result?.type === 'condicion_corporal'
      ? raw.analysis_result
      : undefined,
  }
  entry.mediaType = inferMediaType(entry)

  // ── Operator resolution (Fix 1): fallback chain ─────────────────────────
  // Priority: user_display_name > formatted phone > undefined
  const operatorName =
    raw.user_display_name?.trim() ||
    (raw.sender_phone ? formatPhoneDisplay(raw.sender_phone) : undefined)

  if (operatorName) {
    entry.operator = {
      name: operatorName,
      phone: raw.sender_phone,
      // Role from team membership if provided by API JOIN
      role: raw.operator_role ?? undefined,
      avatarUrl: raw.operator_avatar_url ?? undefined,
    }
  }

  return entry
}

/**
 * Groups photo-only WA notes from the same sender.
 *
 * New architecture (v28+): The webhook debounce buffer now writes ONE row per album
 * with all photos in photo_urls[]. mapRawNote() already converts that into groupedPhotos.
 * Those entries pass through this function untouched (groupedPhotos is already set).
 *
 * Legacy support (pre-v28): Multiple rows were created with the same wa_batch_id.
 * Phase 1 groups by wa_batch_id. Phase 2 is a 90-second time-window fallback for
 * even older entries without a batch_id.
 */
export function groupWaPhotoEntries(entries: BitacoraEntry[]): BitacoraEntry[] {
  const WINDOW_MS = 90 * 1000 // 90 seconds (fallback)
  const result: BitacoraEntry[] = []
  const consumed = new Set<string>()

  // ── Phase 1: group by wa_batch_id ─────────────────────────────────────────
  const batchMap = new Map<string, BitacoraEntry[]>()
  for (const entry of entries) {
    const bid = entry.wa_batch_id
    if (
      bid &&
      (entry.source === 'WHATSAPP' || entry.source === 'whatsapp') &&
      entry.mediaType === 'image' &&
      entry.photo_url &&
      !entry.groupedPhotos  // skip new-style single-row albums (already consolidated)
    ) {
      if (!batchMap.has(bid)) batchMap.set(bid, [])
      batchMap.get(bid)!.push(entry)
    }
  }

  for (const entry of entries) {
    if (consumed.has(entry.id)) continue

    const bid = entry.wa_batch_id
    if (
      bid &&
      (entry.source === 'WHATSAPP' || entry.source === 'whatsapp') &&
      entry.mediaType === 'image' &&
      entry.photo_url &&
      !entry.groupedPhotos  // new-style albums already have groupedPhotos, skip
    ) {
      const group = batchMap.get(bid)!
      // Mark all siblings as consumed
      group.forEach(s => consumed.add(s.id))

      if (group.length > 1) {
        // Sort by createdAt asc so groupedPhotos array is chronological
        const sorted = [...group].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        result.push({
          ...sorted[0],
          groupedPhotos: sorted.map(s => s.photo_url!),
        })
      } else {
        result.push(entry)
      }
      continue
    }

    // ── Phase 2: fallback time-window grouping for entries without wa_batch_id ───
    const isWaPhoto =
      (entry.source === 'WHATSAPP' || entry.source === 'whatsapp') &&
      entry.mediaType === 'image' &&
      !!entry.photo_url &&
      !!entry.sender_phone &&
      !entry.wa_batch_id  // skip if already has a batch_id (handled above)

    if (!isWaPhoto) {
      if (!consumed.has(entry.id)) result.push(entry)
      consumed.add(entry.id)
      continue
    }

    const aTime = new Date(entry.createdAt).getTime()
    const siblings: BitacoraEntry[] = [entry]

    for (const b of entries) {
      if (consumed.has(b.id) || b.id === entry.id) continue
      const bTime = new Date(b.createdAt).getTime()
      if (Math.abs(bTime - aTime) > WINDOW_MS) continue
      if (
        (b.source === 'WHATSAPP' || b.source === 'whatsapp') &&
        b.mediaType === 'image' &&
        b.sender_phone === entry.sender_phone &&
        b.photo_url &&
        !b.wa_batch_id
      ) {
        siblings.push(b)
        consumed.add(b.id)
      }
    }

    consumed.add(entry.id)

    if (siblings.length > 1) {
      result.push({
        ...entry,
        groupedPhotos: siblings.map(s => s.photo_url!),
      })
    } else {
      result.push(entry)
    }
  }

  return result
}
