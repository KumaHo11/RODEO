'use client'

/**
 * /dashboard/planes — Vista de planes disponibles con posibilidad de contratar.
 * Muestra los planes desde la API pública /api/plans y permite iniciar el checkout
 * con Stripe (mensual/anual) o MercadoPago según disponibilidad.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/AuthProvider'
import { usePlan } from '@/hooks/usePlan'
import { apiFetch } from '@/lib/apiFetch'
import { Check, Sparkles, Zap, Crown, Building2, Loader2, ArrowRight, Star } from 'lucide-react'
import { toast } from 'sonner'
import { MercadoPagoBrick } from '@/components/MercadoPagoBrick'
import { Modal } from '@/design-system/molecules/Modal'

interface ApiPlan {
  id: string
  name: string
  slug: string
  description: string
  price: number
  price_yearly: number
  color: string
  is_popular: boolean
  sort_order: number
  stripe_price_id_monthly?: string
  stripe_price_id_yearly?: string
  mp_preapproval_plan_id?: string
  feature_flags: { flag_key: string; flag_value: any; flag_type: string; label: string }[]
}

const PLAN_ICONS: Record<string, any> = {
  brote:        Sparkles,
  campo_libre:  Sparkles,
  planificador: Zap,
  pro_ganadero: Zap,
  holistico:    Star,
  'pro_ganadero+': Star,
  latifundio:   Crown,
  enterprise:   Crown,
}

// Descripción legible de cada flag
const FLAG_LABELS: Record<string, string> = {
  map:              'Mapa de campo y potreros',
  clima:            'Módulo de clima y alertas',
  agenda:           'Agenda y eventos del campo',
  grazing_planner:  'Planificador de pastoreo (Gantt)',
  tareas:           'Gestión de tareas del equipo',
  equipo:           'Gestión de miembros del equipo',
  voice_bitacora:   'Bitácora de voz con transcripción IA',
  ai_insights:      'Módulo Insights IA (Gemini)',
  advanced_reports: 'Reportes avanzados y exportación',
  carbon_module:    'Módulo Carbono (MRV)',
  offline_mode:     'Modo sin conexión (app offline)',
  ndvi_access:      'NDVI satelital (Sentinel Hub)',
  api_access:       'Acceso a API corporativa',
  metrics_module:       'MRV Satelital — 10 índices Sentinel-2',
  deforestation_guard:  'Deforestation Guard EUDR 2023/1115',
  animal_registry:      'Registro individual + RFID (Allflex/Gallagher)',
  carbon_accounting:    'Huella de Carbono IPCC Tier 1 (tCO₂e/potrero)',
  mrv_reports:          'Reportes PDF MRV con hash SHA256',
  compliance_dashboard: 'Compliance Dashboard EUDR / EOV / GRSB',
  time_machine:         'Time Machine histórico 2020→hoy',
  alert_engine:         'Alertas automáticas NDVI/BSI/Deforestación',
  rfid_bluetooth:       'Escaneo RFID Bluetooth (offline)',
  polygon_import:       'Importación KML / KMZ / SHP',
}

function PlanCard({
  plan,
  billing,
  isCurrentPlan,
  onSelect,
  loading,
  exchangeRate,
}: {
  plan: ApiPlan
  billing: 'monthly' | 'annual'
  isCurrentPlan: boolean
  onSelect: (plan: ApiPlan) => void
  loading: boolean
  exchangeRate: number
}) {
  const Icon = PLAN_ICONS[plan.slug] || Sparkles
  const price = Number(billing === 'annual' ? plan.price_yearly : plan.price)
  const basePrice = Number(plan.price)
  const yearlyPrice = Number(plan.price_yearly)
  const annual_saving = basePrice > 0 && yearlyPrice > 0
    ? Math.round((1 - (yearlyPrice / basePrice)) * 100)
    : 0

  // Features habilitadas (booleans en true)
  const enabledFeatures = plan.feature_flags
    .filter(f => f.flag_type === 'boolean' && f.flag_value === true)
    .map(f => FLAG_LABELS[f.flag_key] || f.label || f.flag_key)

  // Límites numéricos
  const limits = plan.feature_flags
    .filter(f => f.flag_type === 'number')
    .map(f => {
      const val = Number(f.flag_value)
      const isUnlimited = val === -1 || val >= 9000
      if (f.flag_key === 'max_paddocks') return isUnlimited ? 'Potreros ilimitados' : `Hasta ${val} potreros`
      if (f.flag_key === 'max_herds') return isUnlimited ? 'Rodeos ilimitados' : `Hasta ${val} rodeos`
      if (f.flag_key === 'max_team_members') return isUnlimited ? 'Equipo ilimitado' : `Hasta ${val} miembros`
      return null
    })
    .filter(Boolean) as string[]

  const allFeatures = [...limits, ...enabledFeatures]

  return (
    <div className={`relative flex flex-col rounded-3xl border-2 transition-all duration-200 overflow-hidden ${
      plan.is_popular
        ? 'border-green-500 shadow-xl shadow-green-100'
        : isCurrentPlan
        ? 'border-gray-900 shadow-lg'
        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
    }`}>
      {plan.is_popular && (
        <div className="bg-green-500 text-white text-[10px] font-black tracking-widest uppercase py-2 text-center">
          Más popular
        </div>
      )}
      {isCurrentPlan && !plan.is_popular && (
        <div className="bg-gray-900 text-white text-[10px] font-black tracking-widest uppercase py-2 text-center">
          Plan actual
        </div>
      )}

      <div className="p-7 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: plan.color + '20' }}
          >
            <Icon className="w-5 h-5" style={{ color: plan.color }} />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900">{plan.name}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{plan.description}</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-6">
          {plan.slug === 'latifundio' || plan.slug === 'enterprise' ? (
            <p className="text-4xl font-black text-gray-900">A medida</p>
          ) : price === 0 ? (
            <p className="text-4xl font-black text-gray-900">Gratis</p>
          ) : (
            <div>
              <div className="flex items-end gap-1.5">
                <span className="text-4xl font-black text-gray-900">USD {price.toFixed(0)}</span>
                <span className="text-sm font-bold text-gray-400 mb-1.5">/EV/mes</span>
              </div>
              <div className="text-sm font-bold text-green-700 mt-1">
                ARS {Math.round(price * exchangeRate).toLocaleString('es-AR')}
                <span className="text-[10px] font-normal text-gray-400 ml-1">(T.C. BNA: ${exchangeRate})</span>
              </div>
              {billing === 'annual' && annual_saving > 0 && (
                <p className="text-xs font-bold text-green-600 mt-1">
                  Ahorrás {annual_saving}% con el plan anual
                </p>
              )}
            </div>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-2.5 flex-1 mb-7">
          {allFeatures.slice(0, 8).map((feat, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center mt-0.5 shrink-0"
                style={{ backgroundColor: plan.color + '20' }}
              >
                <Check className="w-2.5 h-2.5" style={{ color: plan.color }} />
              </div>
              <span className="text-sm text-gray-600 leading-snug">{feat}</span>
            </li>
          ))}
          {allFeatures.length > 8 && (
            <li className="text-xs font-bold text-gray-400 pl-6.5">
              + {allFeatures.length - 8} características más
            </li>
          )}
        </ul>

        {/* CTA */}
        {isCurrentPlan ? (
          <div className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-500 text-sm font-black text-center">
            Plan activo
          </div>
        ) : plan.slug === 'latifundio' || plan.slug === 'enterprise' ? (
          <a
            href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'ventas@rodeoagtech.com'}?subject=Consulta%20sobre%20Plan%20Latifundio`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-all active:scale-95 bg-gray-900 hover:bg-gray-800 text-white"
          >
            Hablar con ventas
            <ArrowRight className="w-4 h-4" />
          </a>
        ) : (
          <button
            onClick={() => onSelect(plan)}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-all active:scale-95 disabled:opacity-60 ${
              plan.is_popular
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200'
                : 'bg-gray-900 hover:bg-gray-800 text-white'
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {price === 0 ? 'Comenzar gratis' : 'Contratar ahora'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default function PlanesPage() {
  const { user } = useAuth()
  const { planSlug } = usePlan()
  const [plans, setPlans] = useState<ApiPlan[]>([])
  const [exchangeRate, setExchangeRate] = useState<number>(1000)
  const [loading, setLoading] = useState(true)
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [mpPlanSelected, setMpPlanSelected] = useState<{ planId: string, amount: number, billing: 'monthly' | 'annual' } | null>(null)

  useEffect(() => {
    if (mpPlanSelected) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mpPlanSelected])

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(d => {
        setPlans(d.plans || [])
        if (d.exchange_rate) setExchangeRate(d.exchange_rate)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = async (plan: ApiPlan) => {
    if (!user) return

    setCheckoutLoading(plan.id)
    try {
      // Intentar Stripe primero
      const stripeId = billing === 'annual'
        ? plan.stripe_price_id_yearly
        : plan.stripe_price_id_monthly

      if (stripeId) {
        const res = await apiFetch('/api/payments/stripe/create-checkout', {
          method: 'POST',
          body: JSON.stringify({
            price_id: stripeId,
            plan_id: plan.id,
            success_url: `${window.location.origin}/dashboard/planes?success=1`,
            cancel_url: `${window.location.origin}/dashboard/planes`,
          }),
        })
        if (res.ok) {
          const { url } = await res.json()
          if (url) { window.location.href = url; return }
        }
      }

      if (plan.mp_preapproval_plan_id || !stripeId) {
        setMpPlanSelected({
           planId: plan.id,
           amount: Math.round(Number(billing === 'annual' ? plan.price_yearly * 12 : plan.price) * exchangeRate),
           billing: billing
        })
        return
      }

      // Sin pasarela configurada — contactar
      toast.info('Para contratar este plan contactá a soporte: soporte@rodeoagtech.com')
    } catch {
      toast.error('No se pudo iniciar el proceso de pago. Intentá de nuevo.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  // Éxito post-checkout
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('success=1')) {
      toast.success('¡Plan actualizado con éxito! Los cambios ya están activos.')
      window.history.replaceState({}, '', '/dashboard/planes')
    }
  }, [])

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="px-6 pt-10 pb-8 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-100 rounded-full px-4 py-1.5 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs font-black text-green-700 tracking-widest uppercase">Planes RODEO</span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-gray-950 mb-3">
          Elegí el plan que mejor se adapta a tu campo
        </h1>
        <p className="text-base text-gray-500 font-medium">
          Todos los planes incluyen cartografía digital, gestión de hacienda y bitácora de campo.
          Cancelá cuando quieras.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 bg-gray-100 rounded-2xl p-1 mt-6">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${
              billing === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-5 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-1.5 ${
              billing === 'annual'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            Anual
            <span className="text-[10px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
        </div>
      ) : (
        <div className="px-4 max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              isCurrentPlan={planSlug === plan.slug}
              onSelect={handleSelect}
              loading={checkoutLoading === plan.id}
              exchangeRate={exchangeRate}
            />
          ))}
        </div>
      )}

      {/* LATIFUNDIO EXPANDED SECTION */}
      <div className="max-w-6xl mx-auto px-4 mt-12">
        <div className="bg-gray-950 rounded-3xl p-8 lg:p-12 text-white">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-12 h-12 bg-green-600/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-xs font-black text-green-400 tracking-widest mb-1">PLAN LATIFUNDIO · MRV COMPLETO</div>
              <h3 className="text-2xl font-black text-white mb-2">Todo lo que incluye LATIFUNDIO</h3>
              <p className="text-gray-400 text-sm max-w-2xl">
                Fases 1-6 del módulo MRV + trazabilidad animal + mercado de carbono. Para operaciones ganaderas que quieren participar del mercado de carbono con datos verificables.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[
              { icon: '🛰️', title: 'MRV Satelital completo', desc: '10 índices Sentinel-2 + SAR semanales por potrero. Time Machine desde 2020.' },
              { icon: '🌲', title: 'Deforestation Guard', desc: 'Global Forest Watch + NDVI heurístico. Alerta EUDR en tiempo real, overlay en mapa.' },
              { icon: '📋', title: 'Compliance Dashboard', desc: 'Scores EUDR / EOV Savory / GRSB por potrero. Semáforo de cumplimiento normativo.' },
              { icon: '📄', title: 'Reportes MRV PDF', desc: 'PDF auditable con hash SHA256. 5 secciones: portada, métricas, deforestación, GRSB, declaración.' },
              { icon: '🐄', title: 'Registro RFID Individual', desc: 'Allflex y Gallagher. Bitácora de vida por animal. Bluetooth offline. CSV import.' },
              { icon: '🌿', title: 'Huella de Carbono', desc: 'IPCC Tier 1: CH₄ + N₂O vs. SOC proxy. Balance neto tCO₂e por potrero y estancia.' },
              { icon: '🗺️', title: 'Importación KML/KMZ/SHP', desc: 'Importá polígonos desde Google Earth, QGIS o cualquier GIS. También disponible en plan Brote.' },
              { icon: '🏪', title: 'Marketplace de datos', desc: 'Otorgá acceso API a certificadoras, compradores o auditores. Control total de permisos.' },
              { icon: '⚡', title: 'API B2B v2', desc: 'Endpoints autenticados con SHA256. CORS habilitado. OpenAPI spec pública.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <div className="font-bold text-white text-sm mb-1">{item.title}</div>
                  <div className="text-gray-500 text-xs leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Normativas row */}
          <div className="border-t border-white/10 pt-6 mb-6">
            <div className="text-[10px] font-black text-gray-500 tracking-widest mb-3">NORMATIVAS CUBIERTAS</div>
            <div className="flex flex-wrap gap-2">
              {['EUDR 2023/1115', 'EOV · Savory Institute', 'GRSB Standard', 'IPCC 2006 Tier 1', 'GWP100 AR6', 'Verra VM0026 (ref.)', 'CORSIA elegibilidad'].map(n => (
                <span key={n} className="text-xs font-semibold text-gray-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">{n}</span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <a
            href={`mailto:ventas@rodeoagtech.com?subject=Consulta%20Plan%20Latifundio`}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-black px-8 py-3.5 rounded-xl text-sm transition-all"
          >
            Hablar con el equipo de ventas
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-gray-400 mt-10 font-medium px-4">
        Los precios se expresan en USD por Equivalente Vaca (EV) por mes.
        Podés cancelar o cambiar de plan en cualquier momento.
        Para consultas: <a href="mailto:josorio@rodeoagtech.com" className="text-green-600 font-bold">soporte@rodeoagtech.com</a>
      </p>

      <Modal
        open={!!mpPlanSelected}
        onClose={() => setMpPlanSelected(null)}
        title="Completar Pago"
        maxWidth="md"
      >
        {mpPlanSelected && (
          <MercadoPagoBrick 
            planId={mpPlanSelected.planId} 
            amount={mpPlanSelected.amount} 
            billing={mpPlanSelected.billing}
            hideHeader={true}
            onCancel={() => setMpPlanSelected(null)}
            onSuccess={() => {
              setMpPlanSelected(null)
              window.location.href = '/dashboard/planes?success=1'
            }}
          />
        )}
      </Modal>
    </div>
  )
}
