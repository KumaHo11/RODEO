import type { Metadata } from 'next'
import Link from 'next/link'
import { Globe, CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Elegibilidad CORSIA para Productores Ganaderos | Rodeo AgTech',
  description: 'Accedé a CORSIA con el MRV que ya tenés. Requisitos para el mercado de aviación.',
}

const benefits = [
  {
    Icon: CheckCircle,
    title: 'Campo sin deforestación post-2020',
    desc: 'Verificado por el Deforestation Guard de Rodeo contra Global Forest Watch.',
  },
  {
    Icon: CheckCircle,
    title: 'Balance de carbono verificado',
    desc: 'Cálculo automatizado con metodología IPCC Tier 1 provisto por Rodeo.',
  },
  {
    Icon: AlertTriangle,
    title: 'Registro Verra',
    desc: 'Requiere validación externa usando la data provista por nuestra plataforma.',
  },
]

const useCases = [
  {
    title: 'Preparación de datos',
    desc: 'Rodeo automatiza la recopilación de datos necesarios para CORSIA.',
  },
]

export default function CorsiaMercadoPage() {
  return (
    <>
      <title>Elegibilidad CORSIA para Productores Ganaderos | Rodeo AgTech</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <Globe className="w-3.5 h-3.5" />
            MERCADO · CORSIA ELEGIBILIDAD
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Accedé a CORSIA<br />
            <span className="text-green-400">con el MRV que ya tenés.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            La mayoría de los productores no sabe que pueden acceder a CORSIA. Los requisitos son claros: campo sin deforestación post-2020 + balance de carbono verificado + registro Verra.
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
              { value: '15-53 USD/t', label: 'Rango de precio' },
              { value: '122-198 Mt', label: 'Demanda 2024-2026' },
              { value: '38 Mt', label: 'Oferta elegible' },
              { value: 'ICAO', label: 'Organización' },
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
                La oportunidad desperdiciada.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Por no saber cómo acceder, los ganaderos pierden la oportunidad de vender a precios de aviación global.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">MERCADO</div>
                <div className="text-4xl font-black text-gray-950 mb-1">CORSIA</div>
                <div className="text-sm text-gray-500 mb-4">Requisitos de entrada</div>
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
              CHECKLIST
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">
              Checklist de elegibilidad.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
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

      {/* CTA FINAL */}
      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
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
