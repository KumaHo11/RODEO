/**
 * HerdCards.tsx — Columna 1: Cards de rodeos (Demanda)
 */
'use client'

import React, { useState } from 'react'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'
import { Check, Search, X } from 'lucide-react'

export default function HerdCards() {
  const herds           = useSandboxStore(s => s.herds)
  const config          = useSandboxStore(s => s.config)
  const toggleHerdEnabled = useSandboxStore(s => s.toggleHerdEnabled)

  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  if (herds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-[13px] text-center gap-1">
        <p>Sin rodeos.</p>
        <p className="text-[11px] text-gray-300">Cargá rodeos en el módulo de Hacienda.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-2 h-full">
      <div className="flex items-start justify-between mb-1 shrink-0 min-h-[32px]">
        {!isSearchOpen && (
          <div>
            <h3 className="text-xs font-black text-gray-500 tracking-wider uppercase">
              Seleccionar Rodeos
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Activá los rodeos a planificar</p>
          </div>
        )}
        
        {/* Buscador expandible */}
        <div className={`relative ${isSearchOpen ? 'w-full' : 'w-auto'}`}>
          {isSearchOpen ? (
            <>
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Search size={12} className="text-gray-600" />
              </div>
              <input
                autoFocus
                type="text"
                className="w-full pl-7 pr-8 py-1.5 text-[11px] font-medium text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:bg-white transition-colors placeholder-gray-500"
                placeholder="Buscar rodeos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button 
                onClick={() => { setIsSearchOpen(false); setSearch('') }}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-700"
              >
                <X size={12} />
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="text-gray-400 hover:text-gray-700 p-1 -mt-1 -mr-1"
            >
              <Search size={14} className="text-gray-700" />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto pb-4">
        {herds
          .filter(h => !search || h.name.toLowerCase().includes(search.toLowerCase()))
          .map(h => {
          const demanda = h.totalEV * config.dailyAllocationKgEv
          const isOn = h.enabled

          return (
            <div
              key={h.id}
              className={
                isOn
                  ? "flex items-center justify-between px-4 py-3 rounded-xl border-2 border-green-500 bg-green-50 transition-all cursor-pointer shadow-xs"
                  : "flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white opacity-60 hover:opacity-100 transition-all cursor-pointer"
              }
              aria-pressed={isOn}
              onClick={() => toggleHerdEnabled(h.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleHerdEnabled(h.id) }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={
                    isOn
                      ? "w-5 h-5 rounded-lg border-2 bg-green-600 border-green-600 text-white flex items-center justify-center shrink-0"
                      : "w-5 h-5 rounded-lg border-2 border-gray-300 bg-white shrink-0"
                  }
                >
                  {isOn && <Check size={14} strokeWidth={4} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{h.name || 'Sin nombre'}</p>
                  <p className="text-[10px] text-gray-400">
                    {h.headCount.toLocaleString('es-AR')} cab. ·{' '}
                    <span className={isOn ? "font-black text-green-700" : "font-black"}>
                      {h.totalEV.toFixed(1)} EV
                    </span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg uppercase">
                  {demanda.toFixed(0)} <span className="lowercase">kg ms/día</span>
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
