/**
 * POST /api/animals/import
 * Importación masiva de animales desde un archivo CSV.
 *
 * Espera un FormData con el campo `file` (text/csv).
 *
 * Columnas soportadas en el CSV (header case-insensitive):
 *   - visual_tag / caravana       → identificador visual (recomendado)
 *   - rfid_code  / rfid           → código RFID
 *   - name / nombre               → nombre del animal
 *   - sex / sexo                  → MACHO | HEMBRA
 *   - breed / raza                → string libre
 *   - birth_date / fecha_nacimiento → YYYY-MM-DD | DD/MM/YYYY | DD-MM-YYYY
 *   - category / categoria        → string libre (categoría)
 *   - weight / peso               → número (kg, solo para referencia)
 *   - notes / notas               → texto libre
 *
 * Responde con un resumen de importación:
 *   { inserted, skipped, errors: [{ row, identifier, reason }] }
 *
 * NUNCA aborta completamente por filas inválidas — procesa todo el lote
 * y reporta errores por fila.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServicePool } from '@/lib/db'

export const runtime = 'nodejs'
// Aceptar archivos de hasta 10 MB
export const maxDuration = 30

// ── CSV Parser ────────────────────────────────────────────────────────────────

/** Parsea una línea CSV respetando comillas dobles */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/** Normaliza nombres de columnas para soportar variantes en español/inglés */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const HEADER_MAP: Record<string, string> = {
  visualtag: 'visual_tag', caravana: 'visual_tag', tag: 'visual_tag', etiqueta: 'visual_tag',
  rfidcode: 'rfid_code', rfid: 'rfid_code',
  name: 'name', nombre: 'name',
  sex: 'sex', sexo: 'sex', genero: 'sex',
  breed: 'breed', raza: 'breed',
  birthdate: 'birth_date', fechanacimiento: 'birth_date', nacimiento: 'birth_date',
  category: 'category', categoria: 'category', categoría: 'category',
  weight: 'weight', peso: 'weight',
  notes: 'notes', notas: 'notes',
}

/** Intenta parsear fechas en múltiples formatos */
function parseDate(raw: string): string | null {
  if (!raw || raw.trim() === '') return null
  const s = raw.trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`
  // Intentar Date.parse como último recurso
  const parsed = Date.parse(s)
  if (!isNaN(parsed)) return new Date(parsed).toISOString().split('T')[0]
  return null
}

/** Normaliza el sexo a MACHO | HEMBRA | null */
function parseSex(raw: string): 'MACHO' | 'HEMBRA' | null {
  const s = raw?.toLowerCase().trim() ?? ''
  if (['macho', 'm', 'male', 'toro', 'novillo', 'torito'].includes(s)) return 'MACHO'
  if (['hembra', 'f', 'female', 'vaca', 'vaquillona', 'ternera'].includes(s)) return 'HEMBRA'
  return null
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Parsear FormData
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Se esperaba un FormData con el campo "file"' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Campo "file" requerido en el FormData' }, { status: 400 })

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'El archivo debe tener extensión .csv' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 400 })
    }

    const text = await file.text()
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')

    if (rawLines.length < 2) {
      return NextResponse.json({ error: 'El CSV debe tener al menos una fila de encabezado y una fila de datos' }, { status: 400 })
    }

    // Parsear encabezados
    const rawHeaders = parseCsvLine(rawLines[0])
    const columnMap: Record<number, string> = {}

    for (let i = 0; i < rawHeaders.length; i++) {
      const normalized = normalizeHeader(rawHeaders[i])
      const mapped = HEADER_MAP[normalized]
      if (mapped) columnMap[i] = mapped
    }

    // Verificar que al menos una columna de identificador exista
    const mappedCols = Object.values(columnMap)
    const hasIdentifier = mappedCols.includes('visual_tag') || mappedCols.includes('rfid_code') || mappedCols.includes('name')
    if (!hasIdentifier) {
      return NextResponse.json({
        error: 'El CSV no tiene ninguna columna de identificador reconocida. Se requiere al menos una de: visual_tag/caravana, rfid_code/rfid, name/nombre.',
        detected_headers: rawHeaders,
      }, { status: 400 })
    }

    // Procesar filas en lote — nunca abortamos todo por filas inválidas
    const inserted: string[] = []
    const errors: { row: number; identifier: string; reason: string }[] = []

    const pool = getServicePool()

    for (let lineIdx = 1; lineIdx < rawLines.length; lineIdx++) {
      const rowNum = lineIdx + 1 // fila 1-indexed para el usuario
      const values = parseCsvLine(rawLines[lineIdx])

      // Mapear columnas a campos
      const row: Record<string, string> = {}
      for (const [colIdxStr, fieldName] of Object.entries(columnMap)) {
        row[fieldName] = values[Number(colIdxStr)] ?? ''
      }

      const visual_tag = row['visual_tag']?.trim() || null
      const rfid_code = row['rfid_code']?.trim() || null
      const name = row['name']?.trim() || null

      const identifier = visual_tag ?? rfid_code ?? name ?? `Fila ${rowNum}`

      if (!visual_tag && !rfid_code && !name) {
        errors.push({ row: rowNum, identifier, reason: 'Sin identificador válido (visual_tag, rfid_code o nombre vacíos)' })
        continue
      }

      const birth_date = parseDate(row['birth_date'] ?? '')
      const sex = parseSex(row['sex'] ?? '')
      const breed = row['breed']?.trim() || null
      const notes = row['notes']?.trim() || null

      try {
        await pool.query(
          `INSERT INTO animals (
              org_id, visual_tag, rfid_code, name, sex, breed,
              birth_date, notes, status, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'VIVO', NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [auth.orgId, visual_tag, rfid_code, name, sex, breed, birth_date, notes]
        )
        inserted.push(identifier)
      } catch (rowErr: any) {
        const reason = rowErr?.message ?? 'Error de base de datos'
        errors.push({ row: rowNum, identifier, reason })
      }
    }

    return NextResponse.json({
      success: true,
      total: rawLines.length - 1,
      inserted: inserted.length,
      skipped: errors.length,
      errors: errors.slice(0, 100), // Limitar a 100 errores en la respuesta
    }, { status: 200 })

  } catch (err: any) {
    console.error('POST /api/animals/import error:', err)
    return NextResponse.json({
      error: 'Error interno del servidor',
      detail: err?.message ?? 'Error desconocido',
    }, { status: 500 })
  }
}
