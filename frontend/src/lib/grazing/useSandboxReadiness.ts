/**
 * useSandboxReadiness.ts — Hook semántico de habilitación de botones
 * ─────────────────────────────────────────────────────────────────
 * Centraliza la lógica de readiness de la Mesa de Arena.
 * Devuelve flags booleanos listos para usar en `disabled={...}`.
 *
 * Criterios de habilitación:
 *  - canGoToGantt:    ≥1 herd habilitado Y ≥1 potrero habilitado
 *  - canGeneratePlan: igual que arriba Y no está guardando
 *  - canSavePlan:     igual que canGeneratePlan Y hay resultado computado
 */
'use client'
import { useSandboxStore } from './sandboxStore'
import type { SandboxState } from './sandboxStore'

// ── Selector atómico compuesto ────────────────────────────────────────────────
// Devuelve un booleano → Zustand aplica Object.is, nunca causa re-render
// si el valor no cambia (incluso si otras partes del store se actualizan).
const selectHasValidPlanData = (s: SandboxState): boolean =>
  s.herds.some(h => h.enabled) && s.paddockRows.some(p => p.enabled)

// Exportar también como selector nombrado para uso directo en otros contextos
export { selectHasValidPlanData }

// ── Hook principal ────────────────────────────────────────────────────────────

export interface SandboxReadiness {
  /** true cuando hay ≥1 herd Y ≥1 potrero seleccionados */
  canGoToGantt: boolean
  /** true cuando hay datos válidos Y no se está guardando */
  canGeneratePlan: boolean
  /** true cuando hay datos válidos + resultado simulado + no está guardando */
  canSavePlan: boolean
  /** Refleja isSaving del store */
  isSaving: boolean
}

export function useSandboxReadiness(): SandboxReadiness {
  // Cada selector devuelve un primitivo → sin re-renders innecesarios
  const hasValidPlanData = useSandboxStore(selectHasValidPlanData)
  const isSaving         = useSandboxStore(s => s.isSaving)
  const hasResult        = useSandboxStore(s => s.result !== null)

  return {
    canGoToGantt:    hasValidPlanData,
    canGeneratePlan: hasValidPlanData && !isSaving,
    canSavePlan:     hasValidPlanData && hasResult && !isSaving,
    isSaving,
  }
}
