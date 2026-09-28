'use client'

/**
 * HerdAnimalesTab — Tab 3: Animales / CSV INTA
 *
 * Fase 3: Upload real a POST /api/herds/:id/animals
 */

import React, { useState, useCallback, useRef } from 'react'
import clsx from 'clsx'
import { Upload, Download, FileText, AlertTriangle, X, Check, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import type { HerdData } from '@/components/HerdModal'
import type { CSVConciliacion, CSVResolutionAction, AnimalCSVRow } from '@/types/herds'
import { CSV_RESOLUTION_LABELS } from '@/types/herds'

interface Props {
  herd: HerdData
  onRefresh: () => void
}

// ── Headers válidos del CSV formato INTA ─────────────────────────────────────
const INTA_HEADERS_REQUIRED = ['caravana']
const INTA_HEADERS_OPTIONAL = ['rp', 'sexo', 'categoria', 'fecha_nacimiento', 'peso_kg', 'raza', 'observaciones']

export default function HerdAnimalesTab({ herd }: Props) {
  const [conciliacion, setConciliacion] = useState<CSVConciliacion>({
    status: 'idle',
    csvRowCount: 0,
    declaredHeadCount: herd.head_count,
    diff: 0,
    justification: '',
    rows: [],
    validationErrors: {},
    fileName: '',
  })
  const [showAllRows, setShowAllRows] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── CSV Parsing ───────────────────────────────────────────────────────────

  const parseCSV = useCallback(async (file: File): Promise<AnimalCSVRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const lines = text.split(/\r?\n/).filter(l => l.trim())
          if (lines.length < 2) { reject(new Error('El archivo está vacío o no tiene datos')); return }

          // Normalizar headers
          const rawHeaders = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))

          // Validar que tenga al menos la columna de caravana
          const missingRequired = INTA_HEADERS_REQUIRED.filter(h => !rawHeaders.includes(h))
          if (missingRequired.length > 0) {
            reject(new Error(`Columnas requeridas faltantes: ${missingRequired.join(', ')}`)); return
          }

          const rows: AnimalCSVRow[] = []
          for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(/[;,]/).map(v => v.trim().replace(/^"|"$/g, ''))
            if (vals.every(v => !v)) continue // saltar filas vacías

            const row: AnimalCSVRow = { caravana: '', _rowIndex: i }
            rawHeaders.forEach((header, idx) => {
              const val = vals[idx] ?? ''
              if (header === 'caravana')          row.caravana = val
              else if (header === 'rp')           row.rp = val || undefined
              else if (header === 'sexo')         row.sexo = (val.toUpperCase() as 'M' | 'H') || undefined
              else if (header === 'categoria')    row.categoria = val.toUpperCase() as any || undefined
              else if (header === 'peso_kg')      row.peso_kg = val ? Number(val) : undefined
              else if (header === 'raza')         row.raza = val || undefined
              else if (header === 'observaciones') row.observaciones = val || undefined
            })
            rows.push(row)
          }
          resolve(rows)
        } catch (err: any) {
          reject(new Error('Error al leer el archivo: ' + err.message))
        }
      }
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsText(file, 'UTF-8')
    })
  }, [])

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setConciliacion(prev => ({
        ...prev,
        status: 'error',
        errorMessage: 'El archivo debe ser .csv',
        fileName: file.name,
      }))
      return
    }

    setConciliacion(prev => ({ ...prev, status: 'parsing', fileName: file.name }))

    try {
      const rows = await parseCSV(file)
      const diff = rows.length - herd.head_count

      if (diff === 0) {
        // Sin diferencia → listo para subir directamente
        setConciliacion(prev => ({
          ...prev,
          status: 'confirmed',
          csvRowCount: rows.length,
          diff: 0,
          rows,
          validationErrors: {},
          resolution: 'actualizar_stock',
          justification: 'CSV coincide con el stock declarado.',
        }))
      } else {
        // Diferencia → requiere conciliación
        setConciliacion(prev => ({
          ...prev,
          status: 'mismatch',
          csvRowCount: rows.length,
          declaredHeadCount: herd.head_count,
          diff,
          rows,
          validationErrors: {},
          resolution: undefined,
          justification: '',
        }))
      }
    } catch (err: any) {
      setConciliacion(prev => ({
        ...prev,
        status: 'error',
        errorMessage: err.message,
      }))
    }
  }, [herd.head_count, parseCSV])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const reset = useCallback(() => {
    setConciliacion({
      status: 'idle',
      csvRowCount: 0,
      declaredHeadCount: herd.head_count,
      diff: 0,
      justification: '',
      rows: [],
      validationErrors: {},
      fileName: '',
    })
    setShowAllRows(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [herd.head_count])

  // ── Template CSV download (Blob — sin depender de archivo estático) ────────
  const handleDownloadTemplate = () => {
    const csvContent = 'caravana,rp,sexo,categoria,fecha_nacimiento,peso_kg,raza,observaciones\n'
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'plantilla_animales.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 sm:p-8 space-y-5 max-w-4xl">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-gray-800">Padrón individual</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {herd.head_count.toLocaleString('es-AR')} cabezas declaradas en este rodeo
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          Plantilla
        </button>
      </div>

      {/* ── Dropzone (solo en idle/error) ─────────────────────────────── */}
      {(conciliacion.status === 'idle' || conciliacion.status === 'error') && (
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer',
              'transition-all duration-200 text-center',
              isDragOver
                ? 'border-green-400 bg-green-50'
                : 'border-gray-200 bg-gray-50 hover:border-green-300 hover:bg-green-50/40'
            )}
          >
            <div className={clsx(
              'w-12 h-12 rounded-2xl flex items-center justify-center transition-colors',
              isDragOver ? 'bg-green-100' : 'bg-white border border-gray-200'
            )}>
              <Upload className={clsx('w-6 h-6', isDragOver ? 'text-green-600' : 'text-gray-400')} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700">
                {isDragOver ? 'Soltá el archivo acá' : 'Arrastrá tu .csv aquí'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">o hacé clic para seleccionarlo</p>
              <p className="text-[10px] text-gray-400 mt-2">
                Formato: CSV INTA · columnas: caravana, rp, sexo, categoría, peso_kg, raza
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleInputChange}
          />
          {conciliacion.status === 'error' && (
            <div className="flex items-center gap-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs font-bold text-red-700">{conciliacion.errorMessage}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Parsing spinner ───────────────────────────────────────────── */}
      {conciliacion.status === 'parsing' && (
        <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
          <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-xs font-bold text-gray-600">Leyendo {conciliacion.fileName}…</p>
        </div>
      )}

      {/* ── UI de Conciliación ────────────────────────────────────────── */}
      {conciliacion.status === 'mismatch' && (
        <ConciliacionPanel
          herdId={herd.id!}
          conciliacion={conciliacion}
          onUpdate={updates => setConciliacion(prev => ({ ...prev, ...updates }))}
          onCancel={reset}
          onConfirm={async () => {
            if (!conciliacion.resolution || conciliacion.justification.trim().length < 10) return
            setConciliacion(prev => ({ ...prev, status: 'uploading' }))
            try {
              const res = await apiFetch(`/api/herds/${herd.id}/animals`, {
                method: 'POST',
                body: JSON.stringify({
                  rows: conciliacion.rows,
                  resolution: conciliacion.resolution,
                  justification: conciliacion.justification,
                }),
              })
              if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                throw new Error(j.error ?? `Error ${res.status}`)
              }
              const result = await res.json()
              setConciliacion(prev => ({ ...prev, status: 'done', csvRowCount: result.uploaded ?? prev.csvRowCount }))
              import('sonner').then(({ toast }) => toast.success(`Padrón cargado: ${result.uploaded} animales`))
            } catch (e: any) {
              setConciliacion(prev => ({ ...prev, status: 'mismatch', errorMessage: e.message }))
            }
          }}
        />
      )}

      {/* ── Uploading ─────────────────────────────────────────────────── */}
      {conciliacion.status === 'uploading' && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
          <p className="text-xs font-bold text-blue-700">Subiendo padrón… {conciliacion.fileName}</p>
        </div>
      )}

      {/* ── Éxito ─────────────────────────────────────────────────────── */}
      {(conciliacion.status === 'done' || (conciliacion.status === 'confirmed' && conciliacion.diff === 0)) && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-green-700">
              ✓ {conciliacion.fileName} · {conciliacion.csvRowCount} animales cargados
            </p>
          </div>
          <button onClick={reset} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Preview CSV ───────────────────────────────────────────────── */}
      {conciliacion.rows.length > 0 && conciliacion.status !== 'idle' && (
        <CSVPreview
          rows={conciliacion.rows}
          showAll={showAllRows}
          onToggle={() => setShowAllRows(v => !v)}
        />
      )}
    </div>
  )
}

// ── Conciliación Panel ────────────────────────────────────────────────────────

function ConciliacionPanel({
  herdId,
  conciliacion,
  onUpdate,
  onCancel,
  onConfirm,
}: {
  herdId: string
  conciliacion: CSVConciliacion
  onUpdate: (u: Partial<CSVConciliacion>) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const { csvRowCount, declaredHeadCount, diff, resolution, justification, fileName } = conciliacion
  const absD = Math.abs(diff)
  const isLess = diff < 0

  const canConfirm = !!resolution && justification.trim().length >= 10

  return (
    <div className="border-2 border-amber-300 bg-amber-50 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-amber-800">Diferencia detectada — Conciliación requerida</p>
          <p className="text-[11px] text-amber-700 mt-0.5 font-medium truncate">{fileName}</p>
        </div>
        <button onClick={onCancel} className="text-amber-400 hover:text-amber-700 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* Números */}
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="En sistema" value={declaredHeadCount.toLocaleString('es-AR')} color="gray" />
          <StatBox label="En CSV" value={csvRowCount.toLocaleString('es-AR')} color="amber" />
          <StatBox
            label="Diferencia"
            value={`${diff > 0 ? '+' : ''}${diff}`}
            color={isLess ? 'red' : 'blue'}
          />
        </div>

        <p className="text-xs text-amber-700 font-medium">
          {isLess
            ? `El CSV tiene ${absD} animales menos que el stock declarado.`
            : `El CSV tiene ${absD} animales más que el stock declarado.`}
        </p>

        {/* Opciones de resolución */}
        <div className="space-y-2">
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
            ¿Cómo resolvés esta diferencia?
          </p>
          {(Object.entries(CSV_RESOLUTION_LABELS) as [CSVResolutionAction, string][]).map(([key, label]) => (
            <label
              key={key}
              className={clsx(
                'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                resolution === key
                  ? 'bg-white border-green-400 shadow-sm'
                  : 'bg-white/60 border-gray-200 hover:border-gray-300'
              )}
            >
              <input
                type="radio"
                name="resolution"
                value={key}
                checked={resolution === key}
                onChange={() => onUpdate({ resolution: key })}
                className="mt-0.5 accent-green-600"
              />
              <span className="text-xs font-bold text-gray-700 leading-snug">{label}</span>
            </label>
          ))}
        </div>

        {/* Justificación */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
            Justificación <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={2}
            placeholder="ej: Vendimos 15 novillos el 12/10, pendiente de registrar en el sistema"
            value={justification}
            onChange={e => onUpdate({ justification: e.target.value })}
            className={clsx(
              'w-full border-2 rounded-xl px-3 py-2.5 text-sm outline-none resize-none transition-all',
              justification.trim().length >= 10
                ? 'border-green-300 focus:border-green-500 bg-white'
                : 'border-gray-200 focus:border-amber-400 bg-white'
            )}
          />
          <p className={clsx(
            'text-[10px] font-bold',
            justification.trim().length >= 10 ? 'text-green-600' : 'text-gray-400'
          )}>
            {justification.trim().length}/10 mín. caracteres
          </p>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onCancel}
            className="text-xs font-bold text-gray-500 hover:text-red-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all',
              canConfirm
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            <Check className="w-3.5 h-3.5" />
            Confirmar y subir padrón
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CSV Preview ───────────────────────────────────────────────────────────────

function CSVPreview({ rows, showAll, onToggle }: { rows: AnimalCSVRow[]; showAll: boolean; onToggle: () => void }) {
  const displayRows = showAll ? rows : rows.slice(0, 10)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-black text-gray-600">
          Preview CSV — {rows.length} animales
        </p>
        <FileText className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              {['#', 'Caravana', 'RP', 'Sexo', 'Categoría', 'Peso (kg)', 'Raza'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-black text-gray-500 uppercase tracking-wider text-[9px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={row._rowIndex} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-3 py-2 text-gray-400 tabular-nums">{row._rowIndex}</td>
                <td className="px-3 py-2 font-bold text-gray-800">{row.caravana || '—'}</td>
                <td className="px-3 py-2 text-gray-500">{row.rp || '—'}</td>
                <td className="px-3 py-2 text-gray-500">{row.sexo || '—'}</td>
                <td className="px-3 py-2 text-gray-500">{row.categoria || '—'}</td>
                <td className="px-3 py-2 text-gray-500 tabular-nums">{row.peso_kg ?? '—'}</td>
                <td className="px-3 py-2 text-gray-500">{row.raza || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <button
          onClick={onToggle}
          className="w-full px-4 py-2.5 text-xs font-bold text-gray-500 hover:text-green-600 flex items-center justify-center gap-1 border-t border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', showAll && 'rotate-180')} />
          {showAll ? 'Mostrar menos' : `Ver todas las ${rows.length} filas`}
        </button>
      )}
    </div>
  )
}

// ── StatBox ───────────────────────────────────────────────────────────────────

const STAT_COLORS = {
  gray: 'bg-gray-50 text-gray-700 border-gray-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
} as const

function StatBox({ label, value, color }: { label: string; value: string; color: keyof typeof STAT_COLORS }) {
  return (
    <div className={clsx('border rounded-xl p-3 text-center', STAT_COLORS[color])}>
      <p className="text-xl font-black tabular-nums">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider opacity-70 mt-0.5">{label}</p>
    </div>
  )
}
