/**
 * BalanceCard.tsx — Resumen del ciclo de rotación
 * ───────────────────────────────────────────────
 * Temporada Abierta: vuelta primavera · vuelta verano · warnings
 * Temporada Cerrada: % cobertura forrajera · días cubiertos
 *
 * Fix v2: Labels claros — "Vuelta Xd (Yd desc.)" en lugar de "Xd ciclo"
 */
'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'

export default function BalanceCard() {
  const result = useSandboxStore(s => s.result)
  const config = useSandboxStore(s => s.config)
  const mode   = useSandboxStore(s => s.mode)

  if (!result) {
    return (
      <div className="balance-card balance-card--empty">
        <span className="balance-label">Configurá los parámetros para ver el resumen</span>
      </div>
    )
  }

  const { balance, warnings } = result

  return (
    <div className="balance-card">
      <div className="balance-main">
        {mode === 'open' ? (
          // ── Temporada Abierta: vueltas con descanso explícito ──────────────
          <div className="balance-metrics">
            {balance.cicloPrimavera > 0 && (
              <>
                <div className="balance-metric" title={`Vuelta de ${balance.cicloPrimavera} días: ${config.descansosPrimavera}d de descanso garantizado para el lote base`}>
                  <span className="balance-metric-value">{balance.cicloPrimavera}d</span>
                  <span className="balance-metric-label">Vuelta primavera ({config.descansosPrimavera}d desc.)</span>
                </div>
              </>
            )}
            {balance.cicloVerano > 0 && (
              <>
                <div className="balance-metric-divider" />
                <div className="balance-metric" title={`Vuelta de ${balance.cicloVerano} días: ${config.descansosVerano}d de descanso garantizado para el lote base`}>
                  <span className="balance-metric-value">{balance.cicloVerano}d</span>
                  <span className="balance-metric-label">Vuelta verano ({config.descansosVerano}d desc.)</span>
                </div>
              </>
            )}
          </div>
        ) : (
          // ── Temporada Cerrada: cobertura forrajera ─────────────────────
          <div className="balance-metrics">
            <div className="balance-metric">
              <span className="balance-metric-value">{balance.diasPeriodo}d</span>
              <span className="balance-metric-label">Período</span>
            </div>
            {balance.ofertaKgMs > 0 && (
              <>
                <div className="balance-metric-divider" />
                <div className="balance-metric">
                  <span className="balance-metric-value">{(balance.ofertaKgMs / 1000).toFixed(1)}t</span>
                  <span className="balance-metric-label">Oferta MS</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="balance-warnings">
          <AlertTriangle size={13} className="text-amber-600" />
          <span className="balance-warnings-text">
            {warnings.length === 1 ? warnings[0] : `${warnings.length} advertencias`}
          </span>
        </div>
      )}
    </div>
  )
}
