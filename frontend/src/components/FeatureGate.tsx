'use client'

/**
 * FeatureGate — componente que bloquea el acceso a una sección completa
 * si el plan del usuario no incluye el feature requerido.
 *
 * Uso: Envolver el return de cualquier page.tsx:
 *   <FeatureGate feature="ai_insights" title="Insights IA" description="...">
 *     <InsightsContent />
 *   </FeatureGate>
 */

import { PremiumOverlay } from '@/components/PremiumOverlay'
import { usePlan, FeatureKey } from '@/hooks/usePlan'

interface FeatureGateProps {
  feature: FeatureKey
  title: string
  description: string
  requiredPlan?: string
  children: React.ReactNode
}

export function FeatureGate({
  feature,
  title,
  description,
  requiredPlan = 'superior',
  children,
}: FeatureGateProps) {
  const { hasFeature } = usePlan()

  if (!hasFeature(feature)) {
    return (
      <div className="space-y-6">
        <PremiumOverlay
          title={title}
          description={description}
          requiredPlan={requiredPlan}
        />
      </div>
    )
  }

  return <>{children}</>
}
