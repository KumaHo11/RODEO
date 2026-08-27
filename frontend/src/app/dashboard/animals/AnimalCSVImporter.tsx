'use client'

import { useRef, useState } from 'react'
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

interface ImportResult {
  total: number
  inserted: number
  skipped: number
  errors: { row: number; identifier: string; reason: string }[]
}

interface Props {
  onSuccess?: () => void
}

export function AnimalCSVImporter({ onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await apiFetch('/api/animals/import', {
        method: 'POST',
        body: fd,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error ?? `Error ${res.status}`)
        return
      }

      setResult(data)
      if (data.inserted > 0) onSuccess?.()
    } catch (err: any) {
      setError(err?.message ?? 'Error de red')
    } finally {
      setLoading(false)
      // Reset el input para permitir re-subir el mismo archivo
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const close = () => {
    setOpen(false)
    setResult(null)
    setError(null)
  }

  return (
    <>
      {/* Botón que abre el importador */}
      <button
        id="btn-import-csv-animals"
        onClick={() => setOpen(true)}
        className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm"
      >
        <Upload className="w-4 h-4" />
        Importar CSV
      </button>

      {/* Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Importar animales desde CSV"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={close}
          />

          {/* Panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-950">Importar animales desde CSV</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Las filas inválidas se reportan sin abortar la importación.
                </p>
              </div>
              <button
                onClick={close}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guía de columnas */}
            {!result && !loading && (
              <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-1">
                <p className="font-bold text-gray-700 mb-2">Columnas aceptadas (al menos 1 identificador):</p>
                <ul className="grid grid-cols-2 gap-x-4 list-disc list-inside">
                  <li><span className="font-mono text-gray-800">visual_tag</span> / <span className="font-mono">caravana</span></li>
                  <li><span className="font-mono text-gray-800">rfid_code</span> / <span className="font-mono">rfid</span></li>
                  <li><span className="font-mono text-gray-800">name</span> / <span className="font-mono">nombre</span></li>
                  <li><span className="font-mono text-gray-800">sex</span> / <span className="font-mono">sexo</span></li>
                  <li><span className="font-mono text-gray-800">breed</span> / <span className="font-mono">raza</span></li>
                  <li><span className="font-mono text-gray-800">birth_date</span> / <span className="font-mono">nacimiento</span></li>
                  <li><span className="font-mono text-gray-800">category</span> / <span className="font-mono">categoria</span></li>
                  <li><span className="font-mono text-gray-800">notes</span> / <span className="font-mono">notas</span></li>
                </ul>
                <p className="mt-2 text-gray-500">Formatos de fecha aceptados: <span className="font-mono">YYYY-MM-DD</span>, <span className="font-mono">DD/MM/YYYY</span></p>
              </div>
            )}

            {/* Estado: cargando */}
            {loading && (
              <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                <p className="text-sm font-bold">Procesando importación...</p>
              </div>
            )}

            {/* Error de red o validación del archivo */}
            {error && !loading && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-bold">{error}</p>
              </div>
            )}

            {/* Resultado de importación */}
            {result && !loading && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-black text-green-800">
                      {result.inserted} de {result.total} animales importados
                    </p>
                    {result.skipped > 0 && (
                      <p className="text-xs text-green-700 mt-0.5">
                        {result.skipped} fila{result.skipped !== 1 ? 's' : ''} con error (ver detalle abajo)
                      </p>
                    )}
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-red-200 bg-red-50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-red-200 bg-red-100">
                          <th className="px-3 py-2 text-left font-bold text-red-700">Fila</th>
                          <th className="px-3 py-2 text-left font-bold text-red-700">Identificador</th>
                          <th className="px-3 py-2 text-left font-bold text-red-700">Razón</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((e, i) => (
                          <tr key={i} className="border-b border-red-100 last:border-0">
                            <td className="px-3 py-1.5 font-mono text-red-600">{e.row}</td>
                            <td className="px-3 py-1.5 text-red-700 font-bold">{e.identifier}</td>
                            <td className="px-3 py-1.5 text-red-600">{e.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Acciones */}
            {!loading && (
              <div className="flex items-center gap-3 pt-1">
                {!result ? (
                  <>
                    <label
                      htmlFor="csv-file-input"
                      className="flex-1 cursor-pointer bg-green-600 hover:bg-green-700 text-white text-sm font-black px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Seleccionar archivo CSV
                    </label>
                    <input
                      id="csv-file-input"
                      ref={fileRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={handleFile}
                    />
                    <button
                      onClick={close}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={close}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-black px-4 py-2.5 rounded-xl transition-colors"
                    >
                      Listo
                    </button>
                    <label
                      htmlFor="csv-file-input-retry"
                      className="cursor-pointer px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Importar otro
                    </label>
                    <input
                      id="csv-file-input-retry"
                      ref={fileRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={handleFile}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
