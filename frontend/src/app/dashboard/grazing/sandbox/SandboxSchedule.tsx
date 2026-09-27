/**
 * SandboxSchedule.tsx — Resumen del Plan
 * ─────────────────────────────────────────
 * Vista "Por Potrero": una card por potrero activo con todas las pasadas.
 * Vista "Por Vueltas": agrupa los eventos por vuelta cronológica.
 * Muestra demandaMSKg por pasada y advertencia de heterogeneidad extrema.
 */
'use client'

import React, { useMemo, useState } from 'react'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'
import type { PlanEvent } from '@/lib/grazing/types'
import { RefreshCw, Search, X, AlertTriangle, Layers, List, ChevronDown, BarChart3 } from 'lucide-react'
import StockingRateGauge from './StockingRateGauge'

function fmt(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function fmtKg(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg}kg`
}

interface PaddockGroup {
  id:      string
  name:    string
  areaHa:  number
  pasadas: PlanEvent[]
}

interface VueltaGroup {
  vuelta:   number
  eventos:  PlanEvent[]
  fechaInicio: string
  fechaFin:    string
}

// ── Pasada individual ─────────────────────────────────────────────────────────

function PasadaRow({ ev, i, isLast, isClosed }: { ev: PlanEvent; i: number; isLast: boolean; isClosed?: boolean }) {
  const isPrimavera = ev.subtemporada === 'primavera' && !isClosed
  return (
    <div className="px-3 py-2.5">
      {/* Fila superior: etiqueta + días pastoreo */}
      <div className="flex items-start justify-between mb-1.5">
        <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full mt-0.5 ${
          isClosed
            ? 'bg-blue-100 text-blue-800'
            : isPrimavera
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {isClosed ? `${i + 1}ª · Cerrada` : `${i + 1}ª · ${isPrimavera ? 'Primavera' : 'Verano'}`}
        </span>

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[11px] font-black text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
            {ev.diasPastoreo}d pastoreo
          </span>
          {/* En temporada cerrada no hay descanso entre potreros */}
          {!isClosed && !isLast && ev.descansoAlRegresar > 0 && (
            <span className="text-[9px] text-gray-400 font-medium">
              {ev.descansoAlRegresar}d descanso
            </span>
          )}
        </div>
      </div>

      {/* Fechas de entrada y salida */}
      <div className="flex items-center gap-1 text-[12px] font-bold text-gray-800 mb-1">
        <span>{fmt(ev.fechaEntrada)}</span>
        <span className="text-gray-300 mx-0.5">→</span>
        <span>{fmt(ev.fechaSalida)}</span>
      </div>

      {/* Demanda MS */}
      {ev.demandaMSKg > 0 && (
        <div className="text-[10px] text-gray-400 font-medium">
          Demanda: <span className="font-black text-gray-600">{fmtKg(ev.demandaMSKg)}</span> MS
        </div>
      )}
    </div>
  )
}

// ── Advertencia de heterogeneidad extrema ─────────────────────────────────────

function HeterogeneidadWarning({ warning }: {
  warning: { potreroMax: string; potreroMin: string; ratio: number; suggestion: string }
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mx-3 mb-2 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <AlertTriangle size={13} className="text-amber-600 shrink-0" />
        <span className="text-[11px] font-bold text-amber-800 flex-1">
          Heterogeneidad alta ({warning.ratio}×) · {warning.potreroMax}
        </span>
        <span className="text-[10px] text-amber-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-amber-200">
          <p className="text-[11px] text-amber-700 leading-relaxed mt-2">
            Algunos potreros son demasiado grandes con respecto al más chico o al general, quizás sea conveniente dividir el potrero con un boyero, solo eso.
          </p>
        </div>
      )}
    </div>
  )
}

export default function SandboxSchedule() {
  const result  = useSandboxStore(s => s.result)
  const config  = useSandboxStore(s => s.config)
  const herds   = useSandboxStore(s => s.herds)

  const activeHerds    = useMemo(() => herds.filter(h => h.enabled).length, [herds])
  const activePaddocks = useMemo(() => (result?.rows ?? []).filter(r => r.enabled).length, [result])

  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'potrero' | 'vuelta'>('potrero')
  const [showBalance, setShowBalance] = useState(false)

  const isClosed = config.mode === 'closed'

  // ── Agrupar eventos por potrero ───────────────────────────────────────────
  const paddockGroups = useMemo((): PaddockGroup[] => {
    const events = result?.chronogram ?? []
    if (!events.length) return []

    const map = new Map<string, PaddockGroup>()
    for (const ev of events) {
      if (!map.has(ev.paddockId)) {
        map.set(ev.paddockId, { id: ev.paddockId, name: ev.paddockName, areaHa: ev.areaHa, pasadas: [] })
      }
      map.get(ev.paddockId)!.pasadas.push(ev)
    }

    for (const g of map.values()) {
      g.pasadas.sort((a, b) => a.vuelta - b.vuelta)
    }

    return Array.from(map.values()).sort(
      (a, b) => a.pasadas[0].posicion - b.pasadas[0].posicion
    )
  }, [result])

  // ── Agrupar eventos por vuelta ────────────────────────────────────────────
  const vueltaGroups = useMemo((): VueltaGroup[] => {
    const events = result?.chronogram ?? []
    if (!events.length) return []

    const map = new Map<number, VueltaGroup>()
    for (const ev of events) {
      if (!map.has(ev.vuelta)) {
        map.set(ev.vuelta, {
          vuelta: ev.vuelta,
          eventos: [],
          fechaInicio: ev.fechaEntrada,
          fechaFin: ev.fechaSalida,
        })
      }
      const g = map.get(ev.vuelta)!
      g.eventos.push(ev)
      if (ev.fechaEntrada < g.fechaInicio) g.fechaInicio = ev.fechaEntrada
      if (ev.fechaSalida > g.fechaFin)     g.fechaFin    = ev.fechaSalida
    }

    return Array.from(map.values())
      .sort((a, b) => a.vuelta - b.vuelta)
  }, [result])

  const totalPasadas = paddockGroups.reduce((s, g) => s + g.pasadas.length, 0)

  // Fecha real de fin de cobertura (última salida del cronograma) — para modo cerrado
  const chronogramEnd = useMemo(() => {
    const events = result?.chronogram ?? []
    if (!events.length) return ''
    return events.reduce((max, ev) => ev.fechaSalida > max ? ev.fechaSalida : max, events[0].fechaSalida)
  }, [result])

  // ── Gauge + métricas siempre visibles (incluso sin plan) ──────────────────
  const showGauge = activeHerds > 0 && activePaddocks > 0

  const displayedGroups = useMemo(() => {
    if (!search) return paddockGroups
    const term = search.toLowerCase()
    return paddockGroups.filter(g => g.name.toLowerCase().includes(term))
  }, [paddockGroups, search])

  const displayedVueltas = useMemo(() => {
    if (!search) return vueltaGroups
    const term = search.toLowerCase()
    return vueltaGroups.map(v => ({
      ...v,
      eventos: v.eventos.filter(e => e.paddockName.toLowerCase().includes(term)),
    })).filter(v => v.eventos.length > 0)
  }, [vueltaGroups, search])

  const hasPlan = paddockGroups.length > 0


  return (
    <div className="flex flex-col h-full">

      {/* ── Botón "Resumen y Balance" (toggle del gauge) ── */}
      <div className="shrink-0 px-3 pt-2.5 pb-1.5">
        <button
          id="sandbox-balance-toggle"
          type="button"
          onClick={() => setShowBalance(v => !v)}
          className={`flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all w-full ${
            showBalance
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
          aria-expanded={showBalance}
        >
          <BarChart3 size={13} className={showBalance ? 'text-green-600' : 'text-gray-400'} />
          <span>Resumen y Balance</span>
          <ChevronDown
            size={13}
            className={`ml-auto transition-transform duration-200 ${
              showBalance ? 'rotate-180 text-green-500' : 'text-gray-400'
            }`}
          />
        </button>
      </div>

      {/* ── Gauge de carga animal + métricas forrajeras (colapsable) ── */}
      {showGauge && showBalance && (
        <div className="shrink-0 px-3 pt-1 pb-3 border-b border-gray-100 bg-gray-50/60 animate-[fadeSlideDown_0.2s_ease]">
          <StockingRateGauge />
        </div>
      )}

      {/* ── Advertencia heterogeneidad extrema ── */}
      {result?.heterogeneidadExtrema && hasPlan && (
        <div className="shrink-0 pt-2">
          <HeterogeneidadWarning warning={result.heterogeneidadExtrema} />
        </div>
      )}

      {/* ── Barra resumen pasadas + toggle vista + buscador ── */}
      {hasPlan && (
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-100 gap-2 min-h-[36px]">
          {!isSearchOpen && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-semibold text-gray-400 whitespace-nowrap">
                {paddockGroups.length} pot · {totalPasadas} pasadas
              </span>
              {/* Toggle vista */}
              <div className="flex items-center bg-gray-100 p-0.5 rounded-md gap-0.5">
                <button
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${viewMode === 'potrero' ? 'bg-white shadow-sm text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
                  onClick={() => setViewMode('potrero')}
                  title="Ver por potrero"
                >
                  <List size={10} />
                  Potrero
                </button>
                <button
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${viewMode === 'vuelta' ? 'bg-white shadow-sm text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
                  onClick={() => setViewMode('vuelta')}
                  title="Ver por vuelta"
                >
                  <Layers size={10} />
                  Vuelta
                </button>
              </div>
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
                  placeholder="Buscar potrero..."
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
                className="text-gray-400 hover:text-gray-700 p-1 -mr-1"
              >
                <Search size={14} className="text-gray-700" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state (sin plan) ── */}
      {!hasPlan && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-6">
          <RefreshCw size={22} className="text-gray-200 mb-1" />
          <p className="text-sm font-bold text-gray-400">Sin plan calculado</p>
          <p className="text-[11px] text-gray-300 max-w-[180px] leading-relaxed">
            {activeHerds === 0
              ? 'Seleccioná al menos 1 rodeo.'
              // Temporada cerrada: 1 potrero basta (racionamiento estático, no rotación)
              : activePaddocks < 1
              ? 'Seleccioná al menos 1 potrero activo.'
              : isClosed && activePaddocks >= 1
              ? 'Ingresá el aforo de los potreros para calcular el plan.'
              : activePaddocks < 2
              ? 'Seleccioná al menos 2 potreros activos.'
              : 'Configurá los parámetros para generar el plan.'}
          </p>
        </div>
      )}

      {/* ── Vista POR POTRERO ── */}
      {hasPlan && viewMode === 'potrero' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
          {displayedGroups.map(group => (
            <div
              key={group.id}
              className="rounded-xl border border-gray-200 overflow-hidden shadow-sm shrink-0"
            >
              {/* Header del potrero */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-[#008234]">
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-white leading-tight truncate">
                    {group.name}
                  </p>
                  <p className="text-[10px] text-white/80 font-medium mt-0.5 tracking-wide">
                    {group.areaHa.toFixed(1)} ha · {group.pasadas.length} pasada{group.pasadas.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Pasadas */}
              <div className="divide-y divide-gray-100 bg-white">
                {group.pasadas.map((ev, i) => (
                  <PasadaRow
                    key={`${ev.vuelta}-${i}`}
                    ev={ev}
                    i={i}
                    isLast={i === group.pasadas.length - 1}
                    isClosed={isClosed}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Nota al pie */}
          {isClosed ? (
            <p className="text-[10px] text-gray-300 text-center pb-2">
              Cobertura: {config.fechaInicio} → {chronogramEnd || config.fechaFin}
            </p>
          ) : (
            <p className="text-[10px] text-gray-300 text-center pb-2">
              Corte estacional: {fmt(config.fechaCorte)} · Fin de temporada: {fmt(config.fechaFin)}
            </p>
          )}
        </div>
      )}

      {/* ── Vista POR VUELTAS ── */}
      {hasPlan && viewMode === 'vuelta' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
          {displayedVueltas.map(v => (
            <div
              key={v.vuelta}
              className="rounded-xl border border-gray-200 overflow-hidden shadow-sm shrink-0"
            >
              {/* Header de la vuelta */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-gray-700">
                <div>
                  <p className="text-[13px] font-black text-white leading-tight">
                    Vuelta {v.vuelta}
                  </p>
                  <p className="text-[10px] text-white/70 font-medium mt-0.5">
                    {fmt(v.fechaInicio)} → {fmt(v.fechaFin)} · {v.eventos.length} potrero{v.eventos.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                  v.eventos[0]?.subtemporada === 'primavera'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {v.eventos[0]?.subtemporada === 'primavera' ? 'Primavera' : 'Verano'}
                </span>
              </div>

              {/* Eventos de esta vuelta */}
              <div className="divide-y divide-gray-100 bg-white">
                {v.eventos
                  .sort((a, b) => a.posicion - b.posicion)
                  .map((ev, i) => (
                    <div key={`${ev.paddockId}-${i}`} className="px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-black text-gray-800">{ev.paddockName}</span>
                        <span className="text-[11px] font-black text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                          {ev.diasPastoreo}d
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-500 font-medium">
                          {fmt(ev.fechaEntrada)} → {fmt(ev.fechaSalida)}
                        </span>
                        {ev.demandaMSKg > 0 && (
                          <span className="text-[10px] text-gray-400 font-medium">
                            {fmtKg(ev.demandaMSKg)} MS
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          ))}

          {config.mode === 'open' && (
            <p className="text-[10px] text-gray-300 text-center pb-2">
              Corte estacional: {fmt(config.fechaCorte)} · Fin de temporada: {fmt(config.fechaFin)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
