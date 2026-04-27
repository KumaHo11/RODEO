'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Check, ChevronDown, X, Search } from 'lucide-react'
import clsx from 'clsx'

interface Paddock {
  id: string
  name: string
  areaHa?: number | null
}

interface PaddockMultiSelectProps {
  selected: string[]
  onChange: (ids: string[]) => void
  label?: string
  placeholder?: string
  required?: boolean
}

export function PaddockMultiSelect({
  selected,
  onChange,
  label = 'Potreros afectados',
  placeholder = 'Seleccionar potreros…',
  required,
}: PaddockMultiSelectProps) {
  const { user }                      = useAuth()
  const [paddocks, setPaddocks]       = useState<Paddock[]>([])
  const [isOpen, setIsOpen]           = useState(false)
  const [search, setSearch]           = useState('')
  const [isLoading, setIsLoading]     = useState(false)

  // Fetch paddocks once
  useEffect(() => {
    if (!user) return
    setIsLoading(true)
    user.getIdToken().then(token =>
      fetch('/api/paddocks', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { paddocks: [] })
        .then(d => setPaddocks(d.paddocks ?? []))
        .catch(() => {})
        .finally(() => setIsLoading(false))
    )
  }, [user])

  const filtered = paddocks.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter(s => s !== id)
        : [...selected, id]
    )
  }

  const removeTag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter(s => s !== id))
  }

  const selectedPaddocks = paddocks.filter(p => selected.includes(p.id))

  return (
    <div className="relative">
      {label && (
        <label className="block text-[10px] font-black tracking-widest text-gray-400 uppercase mb-1.5">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className={clsx(
          'w-full flex items-center gap-2 min-h-[42px] px-3 py-2 rounded-xl text-left',
          'bg-gray-50 border border-gray-200 text-sm transition-all',
          'focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10',
          isOpen && 'border-green-500 ring-2 ring-green-500/10'
        )}
      >
        <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
          {selectedPaddocks.length === 0 ? (
            <span className="text-gray-400 text-sm font-semibold">{placeholder}</span>
          ) : (
            selectedPaddocks.map(p => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-black"
              >
                {p.name}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Quitar ${p.name}`}
                  onClick={e => removeTag(p.id, e as unknown as React.MouseEvent)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') removeTag(p.id, e as unknown as React.MouseEvent) }}
                  className="hover:text-green-900 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={clsx('w-4 h-4 text-gray-400 shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white rounded-xl py-1.5 overflow-hidden"
             style={{ boxShadow: '0 4px 20px 0 rgb(0 0 0 / 0.10)' }}>
          {/* Search */}
          <div className="px-2 pb-1.5">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar potrero…"
                className="flex-1 bg-transparent text-sm font-semibold text-gray-700 placeholder-gray-300 focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto">
            {isLoading ? (
              <p className="text-center py-4 text-xs text-gray-400">Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-4 text-xs text-gray-400">Sin resultados</p>
            ) : (
              filtered.map(p => {
                const isSelected = selected.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50',
                      isSelected && 'bg-green-50/60'
                    )}
                  >
                    <div className={clsx(
                      'w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors',
                      isSelected ? 'bg-green-600 border-green-600' : 'border-gray-300'
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={clsx('text-sm font-bold', isSelected ? 'text-green-700' : 'text-gray-700')}>
                      {p.name}
                    </span>
                    {p.areaHa && (
                      <span className="ml-auto text-[11px] text-gray-400 font-semibold shrink-0">
                        {Number(p.areaHa).toFixed(1)} ha
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {selected.length > 0 && (
            <div className="px-2 pt-1.5 border-t border-gray-100 mt-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full text-center text-[11px] font-bold text-red-400 hover:text-red-600 py-1.5 transition-colors"
              >
                Limpiar selección ({selected.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
