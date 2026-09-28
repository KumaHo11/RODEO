import React from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Sprout, Star } from 'lucide-react'

// --- Types ---
export interface DashboardMetricsData {
  totalMs: number
  totalEV: number
  targetRecoveryDays: number
  avgQuality: number | null
}

interface Props {
  data: DashboardMetricsData
}

// ─── Barra de Estado del Campo ────────────────────────────────────────────────
// Una sola línea compacta que reemplaza los 3 cards grandes.
// Principio: mostrar el estado como una "oración", no como un dashboard técnico.
export function DashboardMetricsBar({ data }: Props) {
  // ── A. Balance de Carga (Regla del 50%) ───────────────────────────────────
  const ofertaUtil  = data.totalMs * 0.5          // kg MS aprovechables (50% queda en suelo)
  const capacidad   = ofertaUtil / 4380            // EV que el campo puede sostener por año
  const ratio       = capacidad > 0 ? data.totalEV / capacidad : 0

  let balanceIcon = <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
  let balanceText = ''
  let balanceSub  = ''

  if (ratio < 0.8) {
    balanceIcon = <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
    balanceText = 'El campo produce más pasto del que consume tu hacienda'
    balanceSub  = `Margen de seguridad: ${((1 - ratio) * 100).toFixed(0)}% de excedente`
  } else if (ratio <= 1.0) {
    balanceIcon = <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
    balanceText = 'Carga equilibrada — hacienda y campo en balance'
    balanceSub  = 'El consumo está en línea con lo que produce el campo'
  } else if (ratio <= 1.25) {
    balanceIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
    balanceText = 'Carga levemente alta — revisá la rotación'
    balanceSub  = `Tu hacienda consume un ${((ratio - 1) * 100).toFixed(0)}% más de lo que el campo produce`
  } else {
    balanceIcon = <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
    balanceText = 'Sobrecarga — el campo no puede sostener esta hacienda'
    balanceSub  = 'A este ritmo, el pasto no puede recuperarse entre pastoreos'
  }

  // ── B. Reserva de Días (Autonomía) ────────────────────────────────────────
  const reservaDias = data.totalEV > 0
    ? Math.floor(ofertaUtil / (data.totalEV * 12))
    : 0
  const reservaColor = reservaDias >= 90
    ? 'text-green-700'
    : reservaDias >= 45
    ? 'text-amber-600'
    : 'text-red-600'

  // ── C. Calidad de Pasto ───────────────────────────────────────────────────
  const qColor = data.avgQuality == null
    ? 'text-gray-400'
    : data.avgQuality >= 7
    ? 'text-green-700'
    : data.avgQuality >= 4
    ? 'text-amber-600'
    : 'text-red-600'

  const qLabel = data.avgQuality == null
    ? 'Sin datos de calidad'
    : data.avgQuality >= 7
    ? 'Pasto de buena calidad'
    : data.avgQuality >= 4
    ? 'Calidad de pasto media'
    : 'Pasto de baja calidad'

  // Spec 3.3: Color indicator solo en texto (no en fondo del card completo)
  const balanceStatusColor = ratio < 0.8 ? 'text-green-700' : ratio <= 1.0 ? 'text-blue-700' : ratio <= 1.25 ? 'text-amber-700' : 'text-red-600'

  return (
    // Spec 3.1: flex-col en mobile, flex-row en xl — evita overflow horizontal
    <div className="flex flex-col xl:flex-row gap-3 mb-5">

      {/* ── Balance de Carga ────────────────────────────────────────────────── */}
      <div className="flex-[1.2] flex flex-col justify-center px-5 py-4 rounded-2xl border border-gray-100 bg-white transition-all hover:shadow-md cursor-default relative group">
        <div className="flex items-center gap-2 mb-1">
          {balanceIcon}
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Balance de carga</span>
        </div>
        <div className="pr-16">
          <p className={`text-sm font-black ${balanceStatusColor} leading-tight`}>{balanceText}</p>
          <p className="text-[11px] text-gray-400 mt-1 font-medium italic">{balanceSub}</p>
        </div>
        {ratio > 1.0 && (
          <a
            href="/dashboard/insights"
            className="absolute bottom-4 right-4 text-[10px] font-black text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200 hover:bg-white transition-colors"
          >
            Insights ↗
          </a>
        )}
      </div>

      {/* ── Autonomía de Pastoreo ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-5 py-4 rounded-2xl border border-gray-100 bg-white transition-all hover:shadow-md cursor-default relative group">
        <div className="flex items-center gap-2 mb-1">
          <Sprout className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Autonomía de pastoreo</span>
        </div>
        <div className="pr-16">
          <p className="text-sm font-black text-gray-900 leading-tight">
            Comida para <span className={reservaColor}>{reservaDias > 0 ? reservaDias : '---'} días</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">
            El campo necesita <span className="font-bold text-gray-600">90 días</span> para recuperarse
          </p>
        </div>
        {reservaDias < 90 && (
          <a
            href="/dashboard/insights"
            className="absolute bottom-4 right-4 text-[10px] font-black text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200 hover:bg-white transition-colors"
          >
            Ver medidas ↗
          </a>
        )}
      </div>

      {/* ── Calidad Nutritiva ────────────────────────────────────────────────── */}
      <div className="flex-[0.8] flex flex-col justify-center px-5 py-4 rounded-2xl border border-gray-100 bg-white transition-all hover:shadow-md cursor-default">
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Calidad nutritiva</span>
        </div>
        <div>
          <p className={`text-sm font-black leading-tight ${qColor}`}>
            {data.avgQuality != null ? `${data.avgQuality.toFixed(1)}/10` : '---'}
          </p>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">
            {qLabel}
          </p>
        </div>
      </div>
    </div>
  )
}
