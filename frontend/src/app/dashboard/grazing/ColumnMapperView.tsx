import React, { useState } from 'react'
import { AlertTriangle, CheckCircle, ArrowRight, Loader2 } from 'lucide-react'

export interface AmbiguousColumn {
  raw_header: string
  inferred_type: string
  score: number
  top_guess: string | null
  sample_data: string[]
}

interface ColumnMapperViewProps {
  ambiguousColumns: AmbiguousColumn[]
  onResolveComplete: (resolutions: Record<string, string>) => void
  onCancel: () => void
  isProcessing?: boolean
}

const FIELD_DICTIONARY: Record<string, string> = {
  field_size: 'Superficie (Ha)',
  paddock_name: 'Nombre de Potrero',
  herd_name: 'Nombre de Rodeo',
  entry_date: 'Fecha de Entrada',
  exit_date: 'Fecha de Salida',
  cow_equivalent: 'Equivalente Vaca (EV)',
  dry_matter: 'Materia Seca (Kg MS)',
}

export default function ColumnMapperView({
  ambiguousColumns,
  onResolveComplete,
  onCancel,
  isProcessing = false
}: ColumnMapperViewProps) {
  const [resolutions, setResolutions] = useState<Record<string, string>>({})

  const allResolved = ambiguousColumns.length > 0 && 
                      Object.keys(resolutions).length === ambiguousColumns.length

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-black text-amber-900">Revisión de Columnas Requerida</h3>
          <p className="text-xs text-amber-700 mt-1">
            Algunos encabezados de tu archivo Excel/CSV no fueron reconocidos automáticamente o sus datos son ambiguos.
            Por favor, asignalos al dato correcto de RODEO para continuar.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        {/* Header Fila */}
        <div className="flex text-[10px] font-black text-gray-400 bg-gray-50 px-4 py-3 uppercase tracking-widest border-b border-gray-100">
          <div className="w-5/12">Columna en tu archivo</div>
          <div className="w-7/12 pl-2">Mapear a Campo de RODEO</div>
        </div>

        {/* Filas */}
        <div className="divide-y divide-gray-50">
          {ambiguousColumns.map((col, idx) => (
            <div key={idx} className="flex items-center bg-white py-3 px-4 hover:bg-gray-50 transition-colors">
              
              <div className="w-5/12 pr-4">
                <p className="text-sm font-bold text-gray-800 truncate" title={col.raw_header}>
                  {col.raw_header}
                </p>
                <p className="text-[10px] font-medium text-gray-400 mt-0.5 truncate">
                  Ej: {col.sample_data.slice(0, 2).join(', ')}...
                </p>
                <span className="inline-block mt-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold uppercase tracking-wide">
                  Tipo inferido: {col.inferred_type}
                </span>
              </div>

              <div className="w-7/12 pl-2 flex items-center gap-3">
                <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 hidden sm:block" />
                <div className="relative flex-1">
                  <select
                    className={`w-full bg-white border ${
                      resolutions[col.raw_header] ? 'border-green-300 ring-4 ring-green-50' : 'border-gray-300'
                    } text-sm font-medium rounded-lg px-3 py-2.5 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 transition-all appearance-none cursor-pointer`}
                    value={resolutions[col.raw_header] || ''}
                    onChange={(e) => setResolutions(prev => ({ ...prev, [col.raw_header]: e.target.value }))}
                  >
                    <option value="" disabled>Seleccioná el destino...</option>
                    
                    {col.top_guess && (
                      <option value={col.top_guess} className="font-bold text-green-700">
                        ✨ Sugerencia: {FIELD_DICTIONARY[col.top_guess] || col.top_guess}
                      </option>
                    )}
                    
                    <option disabled>──────────</option>
                    {Object.entries(FIELD_DICTIONARY).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                    <option disabled>──────────</option>
                    <option value="ignore">🚫 Ignorar esta columna</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {resolutions[col.raw_header] && (
                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0 transition-all animate-in zoom-in" />
                )}
              </div>
              
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="px-5 py-2.5 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all disabled:opacity-50"
        >
          Atrás
        </button>
        <button
          onClick={() => onResolveComplete(resolutions)}
          disabled={!allResolved || isProcessing}
          className="px-6 py-2.5 bg-green-600 text-white font-black text-sm rounded-xl hover:bg-green-700 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 relative overflow-hidden group"
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 animate-spin hidden sm:block" /> Procesando...</>
          ) : (
            <>Confirmar e Importar <ArrowRight className="w-4 h-4 hidden sm:block group-hover:translate-x-1 transition-transform" /></>
          )}
        </button>
      </div>
    </div>
  )
}
