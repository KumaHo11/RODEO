import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, Leaf, TrendingUp, FileText, ArrowRight, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'IPCC Tier 1 / AR6 — Metodología de Huella de Carbono | Rodeo AgTech',
  description: 'IPCC Tier 1: el método que el mundo acepta. El piso mínimo aceptado para cálculo de huella de carbono con factores AR6.',
}

const benefits = [
  {
    Icon: BarChart3,
    title: 'Factores de emisión IPCC',
    desc: 'CH₄ entérico: 64 kg/cab/año (subtropical). N₂O estiércol: EF3PRP 1% del N excretado.',
  },
  {
    Icon: Leaf,
    title: 'GWP100 AR6 (2021)',
    desc: 'Rodeo usa los valores más recientes: CH₄=27.9, N₂O=273. Los mercados premium exigen AR6 vs. AR5.',
  },
  {
    Icon: TrendingUp,
    title: 'Escalera Tier 1→2→3',
    desc: 'Tier 1 es el inicio. Con muestras de suelo propias escalás a Tier 2 y desbloqueás Verra VM0026.',
  },
  {
    Icon: FileText,
    title: 'Documentación transparente',
    desc: 'Cada cálculo muestra los factores usados, la fuente y el año. Auditable por cualquier verificador.',
  },
]

const useCases = [
  {
    title: 'Primer balance de carbono',
    desc: 'Sin datos propios, el Tier 1 ya te da una estimación útil para entender si tu campo es emisor o sumidero.',
  },
  {
    title: 'Baseline para mejora continua',
    desc: 'Calculá el Tier 1 año a año y compará. Demostrá la tendencia de mejora que el mercado paga.',
  },
  {
    title: 'Punto de partida Verra VM0026',
    desc: 'La metodología Verra exige un baseline IPCC antes de calcular la adicionalidad. Rodeo lo genera automáticamente.',
  },
]

export default function IpccPage() {
  return (
    <>
      <title>IPCC Tier 1 / AR6 — Metodología de Huella de Carbono | Rodeo AgTech</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <BarChart3 className="w-3.5 h-3.5" />
            NORMATIVA · IPCC
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            IPCC Tier 1:<br />
            <span className="text-green-400">el método que el mundo acepta.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Sin una metodología reconocida, el cálculo de huella de carbono no vale nada para el mercado. El IPCC Tier 1 es el piso mínimo aceptado.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              Empezar gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* METRIC STRIP */}
      <section className="bg-green-600 py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: 'Tier 1', label: 'Punto de entrada' },
              { value: 'GWP100 AR6', label: 'CH₄=27.9 · N₂O=273' },
              { value: '2006/2019', label: 'Edición aplicada' },
              { value: 'tCO₂e', label: 'Unidad estándar' },
            ].map((m, i) => (
              <div key={i}>
                <div className="text-2xl font-black text-white">{m.value}</div>
                <div className="text-green-200 text-xs font-medium mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EL PROBLEMA */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
                EL PROBLEMA
              </div>
              <h2 className="text-3xl font-black text-gray-950 mb-4">
                Cálculos sin sustento no sirven.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Inventar metodologías o usar datos de fuentes secundarias desactualizadas no funciona en los mercados de carbono regulados o premium.
              </p>
              <div className="space-y-3 mt-6">
                {[
                  'Rechazo por parte de certificadoras de carbono',
                  'Invalidez de las estimaciones en negociaciones con compradores corporativos',
                  'Desalineación con estándares científicos aceptados globalmente',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">METODOLOGÍA GLOBAL</div>
                <div className="text-4xl font-black text-gray-950 mb-1">IPCC</div>
                <div className="text-sm text-gray-500 mb-4">Estándar internacional</div>
                <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Validez garantizada
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS GRID */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              FUNCIONALIDADES
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">
              Cálculos precisos y auditables.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {benefits.map(({ Icon, title, desc }, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-green-100 hover:bg-green-50/30 transition-all">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              CASOS DE USO
            </div>
            <h2 className="text-3xl font-black text-white mb-3">
              Aplicaciones prácticas en tu campo.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {useCases.map(({ title, desc }, i) => (
              <div key={i} className="bg-white/5 border border-white/8 rounded-2xl p-6">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-white text-xs font-black">0{i + 1}</span>
                </div>
                <h3 className="text-white font-bold mb-2 text-sm">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">
            Empezá a medir de verdad.
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Unite a Rodeo y validá tu huella de carbono con los estándares aceptados por el mercado.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            Crear cuenta gratuita
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
