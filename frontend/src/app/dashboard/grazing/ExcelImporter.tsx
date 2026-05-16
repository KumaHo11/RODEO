'use client'
/**
 * ExcelImporter — Importador de movimientos de pastoreo desde Excel / CSV
 * ─────────────────────────────────────────────────────────────────────────
 * Flujo de 4 pasos:
 *   1. UPLOAD      — el usuario sube el archivo
 *   2. COLUMNS     — mapea las columnas del Excel a los campos del sistema
 *   3. MATCH       — cruza nombre de potreros/rodeos con la BD; resuelve los no reconocidos
 *   4. CONFIRM     — previsualización final e importación a grazing_plans
 *
 * Sin dependencias externas: funciona 100% offline con la librería xlsx.
 */
import React, { useCallback, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload, FileSpreadsheet, X, Check, Loader2, AlertTriangle,
  ChevronRight, ChevronLeft, CheckCircle2, XCircle, HelpCircle,
  ArrowRight, Info
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'columns' | 'match' | 'confirm' | 'done'

interface ColumnMapping {
  paddock: string   // header name in Excel for paddock
  herd: string      // header name in Excel for herd
  entry: string     // header name in Excel for entry date
  exit: string      // header name in Excel for exit date (optional)
  days: string      // header name for days (optional, used if no exit date)
  status: string    // header name for status (optional)
}

interface RawRow {
  [key: string]: any
}

type MatchStatus = 'ok' | 'partial' | 'error' | 'ignored'

interface MatchedRow {
  rowIdx: number
  rawPaddock: string
  rawHerd: string
  entryDate: string
  exitDate: string
  days: number
  status: string
  // resolved
  paddockId: string | null
  herdId: string | null
  paddockResolved: string  // name of matched paddock
  herdResolved: string     // name of matched herd
  matchStatus: MatchStatus
  // user overrides
  overridePaddockId: string | 'IGNORE' | ''
  overrideHerdId: string | 'IGNORE' | ''
}

interface Props {
  paddocks: any[]
  herds: any[]
  onClose: () => void
  onImported: (count: number) => void
}

// ─── Column alias dictionaries ─────────────────────────────────────────────────

const PADDOCK_ALIASES = ['potrero', 'lote', 'parcela', 'paddock', 'seccion', 'field', 'potreros', 'lotes', 'campo']
const HERD_ALIASES    = ['rodeo', 'rebaño', 'grupo', 'animales', 'herd', 'categoria', 'rodeos', 'lote animal', 'hacienda']
const ENTRY_ALIASES   = ['entrada', 'ingreso', 'inicio', 'start', 'desde', 'fecha entrada', 'fecha de entrada', 'fecha inicio', 'fecha ingreso']
const EXIT_ALIASES    = ['salida', 'egreso', 'fin', 'end', 'hasta', 'fecha salida', 'fecha de salida', 'fecha fin', 'fecha egreso']
const DAYS_ALIASES    = ['dias', 'días', 'duracion', 'duración', 'permanencia', 'noches', 'days']
const STATUS_ALIASES  = ['estado', 'status', 'tipo', 'completado', 'realizado']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function bestMatch(aliases: string[], headers: string[]): string {
  // Returns the header that best matches one of the aliases, or ''
  let best = ''
  let bestScore = 0
  for (const h of headers) {
    const hn = normalize(h)
    for (const alias of aliases) {
      const an = normalize(alias)
      let score = 0
      if (hn === an) score = 100
      else if (hn.includes(an) || an.includes(hn)) score = 80
      else if (hn.startsWith(an) || an.startsWith(hn)) score = 70
      if (score > bestScore) { bestScore = score; best = h }
    }
  }
  return bestScore >= 70 ? best : ''
}

function fuzzyMatchEntity(rawName: string, entities: { id: string; name: string }[]): { id: string | null; name: string; score: number } {
  const rn = normalize(rawName)
  if (!rn) return { id: null, name: '', score: 0 }

  let bestId: string | null = null
  let bestName = ''
  let bestScore = 0

  for (const e of entities) {
    const en = normalize(e.name)
    let score = 0
    if (en === rn) score = 100
    else if (en.includes(rn) || rn.includes(en)) score = 80
    else if (en.startsWith(rn) || rn.startsWith(en)) score = 70
    // Simple character overlap
    else {
      const overlap = [...rn].filter(c => en.includes(c)).length
      score = Math.round((overlap / Math.max(rn.length, en.length)) * 60)
    }
    if (score > bestScore) { bestScore = score; bestId = e.id; bestName = e.name }
  }

  if (bestScore >= 70) return { id: bestId, name: bestName, score: bestScore }
  return { id: null, name: bestName, score: bestScore }
}

function parseDate(val: any): string {
  if (!val) return ''
  if (typeof val === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(val)
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    } catch {}
    return ''
  }
  const s = String(val).trim()
  // dd/mm/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/')
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  // dd-mm-yyyy
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('-')
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // mm/dd/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(s)) {
    const [mm, dd, yy] = s.split('/')
    return `20${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return ''
}

function computeStatus(statusVal: any, entryDate: string, exitDate: string): string {
  const today = new Date().toISOString().split('T')[0]
  if (statusVal) {
    const sv = normalize(String(statusVal))
    if (sv.includes('complet') || sv.includes('realiz') || sv.includes('ok') || sv === '1') return 'COMPLETED'
    if (sv.includes('activ') || sv.includes('curso') || sv.includes('actual')) return 'ACTIVE'
  }
  if (exitDate && exitDate < today) return 'COMPLETED'
  if (entryDate <= today && (!exitDate || exitDate >= today)) return 'ACTIVE'
  return 'PLANNED'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExcelImporter({ paddocks, herds, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [filename, setFilename] = useState('')
  const [saving, setSaving] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Raw data from Excel
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<RawRow[]>([])

  // Step 2: column mapping
  const [colMapping, setColMapping] = useState<ColumnMapping>({
    paddock: '', herd: '', entry: '', exit: '', days: '', status: ''
  })

  // Step 3: matched rows
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([])

  // ─── File parsing ──────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    setGlobalError(null)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      setGlobalError('Solo se aceptan archivos .xlsx, .xls o .csv')
      return
    }
    setFilename(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array', cellDates: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' })
        if (data.length < 2) {
          setGlobalError('El archivo no tiene filas de datos. Verificá que tenga encabezados en la primera fila.')
          return
        }

        const rawHeaders = (data[0] as any[]).map(h => String(h ?? '').trim()).filter(Boolean)
        const rows: RawRow[] = (data.slice(1) as any[][])
          .filter(row => row.some(c => c !== '' && c !== null && c !== undefined))
          .map(row => {
            const obj: RawRow = {}
            rawHeaders.forEach((h, i) => { obj[h] = row[i] })
            return obj
          })

        if (rows.length === 0) {
          setGlobalError('No se encontraron filas con datos.')
          return
        }

        setHeaders(rawHeaders)
        setRawRows(rows)

        // Auto-detect columns
        const autoMapping: ColumnMapping = {
          paddock: bestMatch(PADDOCK_ALIASES, rawHeaders),
          herd: bestMatch(HERD_ALIASES, rawHeaders),
          entry: bestMatch(ENTRY_ALIASES, rawHeaders),
          exit: bestMatch(EXIT_ALIASES, rawHeaders),
          days: bestMatch(DAYS_ALIASES, rawHeaders),
          status: bestMatch(STATUS_ALIASES, rawHeaders),
        }
        setColMapping(autoMapping)
        setStep('columns')
      } catch (err: any) {
        setGlobalError('Error al leer el archivo: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [parseFile])

  // ─── Step 2 → Step 3: run matching ────────────────────────────────────────

  const runMatching = useCallback(() => {
    const paddockEntities = paddocks.map(p => ({ id: p.id, name: p.name }))
    const herdEntities    = herds.map(h => ({ id: h.id, name: h.name }))

    const matched: MatchedRow[] = rawRows.map((row, idx) => {
      const rawPaddock = String(row[colMapping.paddock] ?? '').trim()
      const rawHerd    = String(row[colMapping.herd] ?? '').trim()
      const entryDate  = parseDate(row[colMapping.entry])
      const exitDate   = colMapping.exit ? parseDate(row[colMapping.exit]) : ''
      const daysVal    = colMapping.days ? Number(row[colMapping.days]) : 0
      const statusVal  = colMapping.status ? row[colMapping.status] : null

      // If no exit date but have days, compute it
      let computedExit = exitDate
      if (!computedExit && daysVal > 0 && entryDate) {
        const d = new Date(entryDate + 'T00:00:00')
        d.setDate(d.getDate() + daysVal)
        computedExit = d.toISOString().split('T')[0]
      }

      const pMatch = fuzzyMatchEntity(rawPaddock, paddockEntities)
      const hMatch = fuzzyMatchEntity(rawHerd, herdEntities)

      let matchStatus: MatchStatus = 'ok'
      if (!pMatch.id && !hMatch.id) matchStatus = 'error'
      else if (!pMatch.id || !hMatch.id) matchStatus = 'partial'
      if (!entryDate) matchStatus = 'error'

      const resolvedStatus = computeStatus(statusVal, entryDate, computedExit)

      return {
        rowIdx: idx,
        rawPaddock,
        rawHerd,
        entryDate,
        exitDate: computedExit,
        days: daysVal || (entryDate && computedExit ? Math.round((new Date(computedExit).getTime() - new Date(entryDate).getTime()) / 86400000) : 14),
        status: resolvedStatus,
        paddockId: pMatch.id,
        herdId: hMatch.id,
        paddockResolved: pMatch.name,
        herdResolved: hMatch.name,
        matchStatus,
        overridePaddockId: '',
        overrideHerdId: '',
      }
    })

    setMatchedRows(matched)
    setStep('match')
  }, [rawRows, colMapping, paddocks, herds])

  // ─── Step 3 helpers ────────────────────────────────────────────────────────

  const updateOverridePaddock = (rowIdx: number, value: string) => {
    setMatchedRows(prev => prev.map(r => r.rowIdx === rowIdx ? { ...r, overridePaddockId: value } : r))
  }
  const updateOverrideHerd = (rowIdx: number, value: string) => {
    setMatchedRows(prev => prev.map(r => r.rowIdx === rowIdx ? { ...r, overrideHerdId: value } : r))
  }
  const toggleIgnoreRow = (rowIdx: number) => {
    setMatchedRows(prev => prev.map(r => {
      if (r.rowIdx !== rowIdx) return r
      const isIgnored = r.matchStatus === 'ignored'
      return { ...r, matchStatus: isIgnored ? (r.paddockId && r.herdId && r.entryDate ? 'ok' : 'partial') : 'ignored' }
    }))
  }

  const effectivePaddockId = (r: MatchedRow) => r.overridePaddockId || r.paddockId
  const effectiveHerdId    = (r: MatchedRow) => r.overrideHerdId    || r.herdId

  const importableRows = matchedRows.filter(r =>
    r.matchStatus !== 'ignored' &&
    effectivePaddockId(r) && effectivePaddockId(r) !== 'IGNORE' &&
    effectiveHerdId(r)    && effectiveHerdId(r)    !== 'IGNORE' &&
    r.entryDate
  )
  const unresolvedRows = matchedRows.filter(r =>
    r.matchStatus !== 'ignored' &&
    (!effectivePaddockId(r) || !effectiveHerdId(r) || !r.entryDate)
  )

  // ─── Step 4: import ────────────────────────────────────────────────────────

  const handleImport = async () => {
    setSaving(true)
    setImportErrors([])
    let count = 0
    const errors: string[] = []

    for (const row of importableRows) {
      const pId = effectivePaddockId(row)
      const hId = effectiveHerdId(row)
      if (!pId || !hId || !row.entryDate) continue

      try {
        const res = await apiFetch('/api/grazing-plans', {
          method: 'POST',
          body: JSON.stringify({
            paddock_id: pId,
            herd_id: hId,
            herd_ids: [hId],
            entry_date: row.entryDate,
            exit_date: row.exitDate || null,
            planned_recovery_days: 60,
            status: row.status,
            ai_analysis: { plan_source: 'excel_import', source_filename: filename }
          })
        })
        if (res.ok) {
          count++
        } else {
          const d = await res.json()
          errors.push(`Fila ${row.rowIdx + 2}: ${d.error || 'Error desconocido'}`)
        }
      } catch (err: any) {
        errors.push(`Fila ${row.rowIdx + 2}: ${err.message}`)
      }
    }

    setImportedCount(count)
    setImportErrors(errors)
    setSaving(false)
    setStep('done')
    if (count > 0) onImported(count)
  }

  // ─── Status badge helper ───────────────────────────────────────────────────

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'COMPLETED') return <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-gray-100 text-gray-500">Completado</span>
    if (status === 'ACTIVE')    return <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-green-100 text-green-700">En curso</span>
    return <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-700">Planificado</span>
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-950">Importar desde Excel</h3>
              <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">
                {filename || 'Ningún archivo seleccionado'} · {' '}
                {step === 'upload' ? 'Paso 1 de 4' : step === 'columns' ? 'Paso 2 de 4' : step === 'match' ? 'Paso 3 de 4' : step === 'confirm' ? 'Paso 4 de 4' : 'Listo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex items-center px-6 pt-4 pb-0 gap-2 shrink-0">
            {(['upload', 'columns', 'match', 'confirm'] as const).map((s, i) => {
              const steps = ['upload', 'columns', 'match', 'confirm']
              const currentIdx = steps.indexOf(step)
              const isDone = i < currentIdx
              const isCurrent = s === step
              const labels = ['Archivo', 'Columnas', 'Reconocimiento', 'Confirmar']
              return (
                <React.Fragment key={s}>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                      isDone ? 'bg-green-500 text-white' :
                      isCurrent ? 'bg-green-600 text-white ring-4 ring-green-100' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {isDone ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-bold hidden sm:block ${isCurrent ? 'text-gray-900' : isDone ? 'text-green-600' : 'text-gray-400'}`}>
                      {labels[i]}
                    </span>
                  </div>
                  {i < 3 && <div className="flex-1 h-px bg-gray-200" />}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Global error */}
          {globalError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{globalError}</p>
            </div>
          )}

          {/* ── STEP 1: Upload ─────────────────────────────────────────────── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all ${
                  dragging ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-400 hover:bg-gray-50'
                }`}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
                <div className="w-16 h-16 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-base font-black text-gray-700">Arrastrá tu archivo aquí</p>
                  <p className="text-sm text-gray-400 mt-1">o hacé clic para seleccionarlo</p>
                  <p className="text-xs text-gray-300 mt-2">Excel (.xlsx, .xls) · CSV</p>
                </div>
              </div>

              {/* What the system expects */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">¿Cómo debe estar formateado el archivo?</p>
                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                  El sistema detecta automáticamente las columnas. Tu archivo debe tener al menos una columna de <strong>Potrero</strong>, una de <strong>Rodeo</strong> y una de <strong>Fecha de entrada</strong>.
                  Cada fila representa un movimiento de pastoreo. Las columnas pueden estar en cualquier idioma o formato.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['Potrero / Lote', 'Rodeo / Rebaño', 'Fecha Entrada / Inicio', 'Fecha Salida / Fin', 'Días', 'Estado'].map(c => (
                    <span key={c} className="text-[9px] font-bold text-blue-600 bg-white border border-blue-200 px-1.5 py-0.5 rounded-md">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Column mapping ──────────────────────────────────────── */}
          {step === 'columns' && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                <p className="text-xs text-gray-600 font-medium">
                  Detectamos <strong>{headers.length}</strong> columnas y <strong>{rawRows.length}</strong> filas en <strong>{filename}</strong>.
                  El sistema asignó automáticamente las que reconoció — revisá y corregí si algo no está bien.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-2 gap-0 text-[10px] font-black text-gray-400 bg-gray-50 px-4 py-3 uppercase tracking-widest border-b border-gray-100">
                  <div>Campo del Sistema</div>
                  <div>Columna en tu Excel</div>
                </div>

                <div className="divide-y divide-gray-50">
                  {(
                    [
                      { key: 'paddock', label: 'Potrero *', required: true, hint: 'Nombre del potrero o lote' },
                      { key: 'herd',    label: 'Rodeo *',   required: true, hint: 'Nombre del rodeo o rebaño' },
                      { key: 'entry',   label: 'Fecha entrada *', required: true, hint: 'Cuándo entra el rodeo' },
                      { key: 'exit',    label: 'Fecha salida', required: false, hint: 'Cuándo sale el rodeo' },
                      { key: 'days',    label: 'Días de pastoreo', required: false, hint: 'Alternativa a Fecha salida' },
                      { key: 'status',  label: 'Estado', required: false, hint: 'Planificado / En Curso / Completado' },
                    ] as { key: keyof ColumnMapping; label: string; required: boolean; hint: string }[]
                  ).map(({ key, label, required, hint }) => (
                    <div key={key} className="grid grid-cols-2 gap-4 items-center px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div>
                        <p className={`text-sm font-bold ${required ? 'text-gray-900' : 'text-gray-600'}`}>{label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={colMapping[key]}
                          onChange={e => setColMapping(prev => ({ ...prev, [key]: e.target.value }))}
                          className={`flex-1 text-sm font-medium border rounded-lg px-3 py-2 outline-none transition-all ${
                            colMapping[key]
                              ? 'border-green-300 bg-green-50 text-green-900 focus:ring-2 focus:ring-green-200'
                              : required
                              ? 'border-orange-300 bg-orange-50/50 text-gray-700 focus:ring-2 focus:ring-orange-200'
                              : 'border-gray-200 text-gray-500 focus:ring-2 focus:ring-gray-200'
                          }`}
                        >
                          <option value="">{required ? '— Sin asignar —' : '— Opcional —'}</option>
                          {headers.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        {colMapping[key]
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          : required
                          ? <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                          : <HelpCircle className="w-4 h-4 text-gray-200 shrink-0" />
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample preview */}
              {rawRows.length > 0 && colMapping.paddock && colMapping.herd && (
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vista previa (primeras 3 filas)</p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {[colMapping.paddock, colMapping.herd, colMapping.entry, colMapping.exit].filter(Boolean).map(h => (
                            <th key={h} className="text-left text-[9px] font-black text-gray-400 uppercase tracking-widest pr-4 pb-1">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rawRows.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            {[colMapping.paddock, colMapping.herd, colMapping.entry, colMapping.exit].filter(Boolean).map(h => (
                              <td key={h} className="pr-4 py-1.5 font-medium text-gray-700 whitespace-nowrap">{String(row[h] ?? '—')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Match results ───────────────────────────────────────── */}
          {step === 'match' && (
            <div className="space-y-4">
              {/* Summary pills */}
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-xl text-xs font-bold text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {matchedRows.filter(r => r.matchStatus === 'ok').length} reconocidos
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {matchedRows.filter(r => r.matchStatus === 'partial').length} parciales
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700">
                  <XCircle className="w-3.5 h-3.5" />
                  {matchedRows.filter(r => r.matchStatus === 'error').length} sin reconocer
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-500">
                  {matchedRows.filter(r => r.matchStatus === 'ignored').length} ignorados
                </span>
              </div>

              {unresolvedRows.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2 items-start">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 font-medium">
                    <strong>{unresolvedRows.length} fila{unresolvedRows.length > 1 ? 's' : ''}</strong> no pudieron mapearse automáticamente. 
                    Asignalas manualmente o ignoralas para continuar.
                  </p>
                </div>
              )}

              {/* Match table */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="text-[9px] font-black text-gray-400 bg-gray-50 px-4 py-2.5 uppercase tracking-widest border-b border-gray-100 grid grid-cols-12 gap-2">
                  <div className="col-span-1">#</div>
                  <div className="col-span-2">Potrero (Excel)</div>
                  <div className="col-span-3">→ Mapear a potrero</div>
                  <div className="col-span-2">Rodeo (Excel)</div>
                  <div className="col-span-3">→ Mapear a rodeo</div>
                  <div className="col-span-1">Fecha</div>
                </div>

                <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {matchedRows.map(row => {
                    const isIgnored = row.matchStatus === 'ignored'
                    const eff_p = effectivePaddockId(row)
                    const eff_h = effectiveHerdId(row)
                    const pOk = eff_p && eff_p !== 'IGNORE'
                    const hOk = eff_h && eff_h !== 'IGNORE'
                    const rowOk = pOk && hOk && !!row.entryDate

                    const rowBg = isIgnored ? 'bg-gray-50 opacity-50' :
                      rowOk ? 'bg-white' :
                      row.matchStatus === 'partial' ? 'bg-amber-50/40' :
                      'bg-red-50/30'

                    return (
                      <div key={row.rowIdx} className={`grid grid-cols-12 gap-2 items-center px-4 py-2.5 transition-all ${rowBg}`}>
                        {/* Row number + status dot */}
                        <div className="col-span-1 flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            isIgnored ? 'bg-gray-300' :
                            rowOk ? 'bg-green-500' :
                            row.matchStatus === 'partial' ? 'bg-amber-400' :
                            'bg-red-400'
                          }`} />
                          <span className="text-[9px] text-gray-400 font-bold">{row.rowIdx + 2}</span>
                        </div>

                        {/* Raw paddock name */}
                        <div className="col-span-2 min-w-0">
                          <p className="text-[10px] font-bold text-gray-700 truncate" title={row.rawPaddock}>{row.rawPaddock || '—'}</p>
                        </div>

                        {/* Paddock resolver dropdown */}
                        <div className="col-span-3">
                          {row.paddockId && !row.overridePaddockId ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1 w-full truncate">
                              <Check className="w-3 h-3 shrink-0" />{row.paddockResolved}
                            </span>
                          ) : (
                            <select
                              value={row.overridePaddockId}
                              onChange={e => updateOverridePaddock(row.rowIdx, e.target.value)}
                              disabled={isIgnored}
                              className={`w-full text-[10px] font-medium border rounded-lg px-2 py-1.5 outline-none transition-all disabled:opacity-40 ${
                                (row.overridePaddockId && row.overridePaddockId !== 'IGNORE')
                                  ? 'border-green-300 text-green-900 bg-green-50'
                                  : 'border-orange-300 text-gray-700 bg-white'
                              }`}
                            >
                              <option value="">— Seleccioná potrero —</option>
                              {paddocks.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                              <option value="IGNORE">🚫 Ignorar esta fila</option>
                            </select>
                          )}
                        </div>

                        {/* Raw herd name */}
                        <div className="col-span-2 min-w-0">
                          <p className="text-[10px] font-bold text-gray-700 truncate" title={row.rawHerd}>{row.rawHerd || '—'}</p>
                        </div>

                        {/* Herd resolver dropdown */}
                        <div className="col-span-3">
                          {row.herdId && !row.overrideHerdId ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1 w-full truncate">
                              <Check className="w-3 h-3 shrink-0" />{row.herdResolved}
                            </span>
                          ) : (
                            <select
                              value={row.overrideHerdId}
                              onChange={e => updateOverrideHerd(row.rowIdx, e.target.value)}
                              disabled={isIgnored}
                              className={`w-full text-[10px] font-medium border rounded-lg px-2 py-1.5 outline-none transition-all disabled:opacity-40 ${
                                (row.overrideHerdId && row.overrideHerdId !== 'IGNORE')
                                  ? 'border-green-300 text-green-900 bg-green-50'
                                  : 'border-orange-300 text-gray-700 bg-white'
                              }`}
                            >
                              <option value="">— Seleccioná rodeo —</option>
                              {herds.map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                              ))}
                              <option value="IGNORE">🚫 Ignorar esta fila</option>
                            </select>
                          )}
                        </div>

                        {/* Entry date + ignore button */}
                        <div className="col-span-1 flex flex-col items-end gap-1">
                          {row.entryDate
                            ? <span className="text-[9px] font-bold text-gray-600 whitespace-nowrap">{row.entryDate.slice(5).replace('-', '/')}</span>
                            : <span className="text-[9px] text-red-400 font-bold">Sin fecha</span>
                          }
                          <button
                            onClick={() => toggleIgnoreRow(row.rowIdx)}
                            className="text-[8px] font-bold text-gray-300 hover:text-red-400 transition-colors whitespace-nowrap"
                            title={isIgnored ? 'Restaurar fila' : 'Ignorar esta fila'}
                          >
                            {isIgnored ? 'restaurar' : 'ignorar'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Confirm ─────────────────────────────────────────────── */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="p-5 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-base font-black text-green-900">
                    {importableRows.length} movimiento{importableRows.length > 1 ? 's' : ''} listo{importableRows.length > 1 ? 's' : ''} para importar
                  </p>
                  <p className="text-sm text-green-700 mt-1 font-medium">
                    Cada fila se creará como un nuevo movimiento de pastoreo en el Gantt, asignado al potrero y rodeo correspondiente.
                  </p>
                  {matchedRows.filter(r => r.matchStatus === 'ignored').length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {matchedRows.filter(r => r.matchStatus === 'ignored' || !effectivePaddockId(r) || !effectiveHerdId(r)).length} fila{matchedRows.filter(r => r.matchStatus === 'ignored').length > 1 ? 's' : ''} serán ignoradas.
                    </p>
                  )}
                </div>
              </div>

              {/* Preview of rows to import */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="text-[9px] font-black text-gray-400 bg-gray-50 px-4 py-2.5 uppercase tracking-widest border-b border-gray-100 grid grid-cols-4 gap-2">
                  <div>Potrero</div>
                  <div>Rodeo</div>
                  <div>Entrada → Salida</div>
                  <div className="text-right">Estado</div>
                </div>
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {importableRows.map(row => {
                    const pName = paddocks.find(p => p.id === effectivePaddockId(row))?.name ?? row.paddockResolved
                    const hName = herds.find(h => h.id === effectiveHerdId(row))?.name ?? row.herdResolved
                    return (
                      <div key={row.rowIdx} className="grid grid-cols-4 gap-2 items-center px-4 py-2.5">
                        <p className="text-xs font-bold text-gray-800 truncate">{pName}</p>
                        <p className="text-xs font-medium text-gray-600 truncate">{hName}</p>
                        <p className="text-xs font-medium text-gray-500">
                          {row.entryDate.slice(5).replace('-', '/')}
                          {row.exitDate && <> → {row.exitDate.slice(5).replace('-', '/')}</>}
                        </p>
                        <div className="flex justify-end"><StatusBadge status={row.status} /></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── DONE ────────────────────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="py-8 flex flex-col items-center gap-4">
              {importedCount > 0 ? (
                <>
                  <div className="w-16 h-16 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-gray-900">
                      {importedCount} movimiento{importedCount > 1 ? 's' : ''} importado{importedCount > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 font-medium">
                      Ya aparecen en el Gantt. Podés ajustar fechas y detalles directamente desde ahí.
                    </p>
                  </div>
                  {importErrors.length > 0 && (
                    <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs font-black text-amber-800 mb-1">Algunas filas tuvieron errores:</p>
                      {importErrors.map((e, i) => <p key={i} className="text-xs text-amber-700">{e}</p>)}
                    </div>
                  )}
                  <button onClick={onClose} className="mt-2 px-8 py-3 bg-green-600 text-white font-black text-sm rounded-xl hover:bg-green-700 transition-all shadow-sm">
                    Ver en el Gantt →
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-base font-bold text-gray-700">No se importó ningún movimiento</p>
                  {importErrors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                  <button onClick={() => setStep('match')} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-200 transition-all">
                    Volver a revisar
                  </button>
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer navigation */}
        {step !== 'done' && step !== 'upload' && (
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
            <button
              onClick={() => {
                if (step === 'columns') setStep('upload')
                else if (step === 'match') setStep('columns')
                else if (step === 'confirm') setStep('match')
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Atrás
            </button>

            {step === 'columns' && (
              <button
                onClick={runMatching}
                disabled={!colMapping.paddock || !colMapping.herd || !colMapping.entry}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-black text-sm rounded-xl hover:bg-green-700 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Analizar datos
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'match' && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-medium">
                  {importableRows.length} de {matchedRows.length} filas listas
                </span>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={importableRows.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-black text-sm rounded-xl hover:bg-green-700 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continuar
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {step === 'confirm' && (
              <button
                onClick={handleImport}
                disabled={saving || importableRows.length === 0}
                className="flex items-center gap-2 px-8 py-2.5 bg-green-600 text-white font-black text-sm rounded-xl hover:bg-green-700 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Importando...</>
                ) : (
                  <><ArrowRight className="w-4 h-4" />Importar {importableRows.length} movimiento{importableRows.length > 1 ? 's' : ''}</>
                )}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
