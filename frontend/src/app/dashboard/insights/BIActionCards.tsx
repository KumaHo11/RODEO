'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type SemaforoEstado = 'optimo' | 'alerta' | 'critico'

export interface BIInsightCard {
  id: string
  /** Nombre de la métrica */
  titulo: string
  estado: SemaforoEstado
  /** Valor destacado (ARS / USD / %) */
  kpiPrincipal: string
  /** Leyenda breve debajo del KPI */
  subIndicador: string
  /** Cuerpo explicativo (máx. 4 líneas) */
  cuerpo: string
  /** Texto del botón CTA */
  ctaTexto: string
  /** Ruta interna de la app */
  ctaHref: string
}

// ── Paleta semáforo (accesible, hex canónico del design system) ────────────────
const SEMAFORO: Record<SemaforoEstado, {
  dot: string
  label: string
  labelColor: string
  border: string
  kpiColor: string
  ctaBg: string
  ctaText: string
}> = {
  optimo: {
    dot:       'bg-[#2E7D32]',
    label:     'Óptimo',
    labelColor:'text-[#2E7D32]',
    border:    'border-[#2E7D32]/20',
    kpiColor:  'text-[#2E7D32]',
    ctaBg:     'bg-[#2E7D32] hover:bg-[#1B5E20]',
    ctaText:   'text-white',
  },
  alerta: {
    dot:       'bg-[#F57C00]',
    label:     'Alerta',
    labelColor:'text-[#F57C00]',
    border:    'border-[#F57C00]/20',
    kpiColor:  'text-[#F57C00]',
    ctaBg:     'bg-[#F57C00] hover:bg-[#E65100]',
    ctaText:   'text-white',
  },
  critico: {
    dot:       'bg-[#C62828]',
    label:     'Crítico',
    labelColor:'text-[#C62828]',
    border:    'border-[#C62828]/20',
    kpiColor:  'text-[#C62828]',
    ctaBg:     'bg-[#C62828] hover:bg-[#B71C1C]',
    ctaText:   'text-white',
  },
}

// ── Tarjeta individual ─────────────────────────────────────────────────────────
function ActionCard({ card }: { card: BIInsightCard }) {
  const router = useRouter()
  const s = SEMAFORO[card.estado]

  return (
    <article
      className={`bg-white rounded-2xl border ${s.border} border p-5 flex flex-col gap-4 shadow-sm`}
      aria-label={card.titulo}
    >
      {/* Encabezado: semáforo + nombre */}
      <header className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none">
          {card.titulo}
        </p>
        <span className={`inline-flex items-center gap-1.5 text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-50 ${s.labelColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </header>

      {/* KPI principal */}
      <div>
        <p className={`text-2xl font-black leading-tight tabular-nums ${s.kpiColor}`}>
          {card.kpiPrincipal}
        </p>
        <p className="text-xs text-gray-500 font-medium mt-1">
          {card.subIndicador}
        </p>
      </div>

      {/* Cuerpo del insight */}
      <p className="text-xs text-gray-600 leading-relaxed flex-1">
        {card.cuerpo}
      </p>

      {/* CTA */}
      <button
        onClick={() => router.push(card.ctaHref)}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${s.ctaBg} ${s.ctaText}`}
      >
        <span>{card.ctaTexto}</span>
        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
      </button>
    </article>
  )
}

// ── Grid de tarjetas ──────────────────────────────────────────────────────────
export function BIActionCards({ cards }: { cards: BIInsightCard[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {cards.map(c => <ActionCard key={c.id} card={c} />)}
    </div>
  )
}
