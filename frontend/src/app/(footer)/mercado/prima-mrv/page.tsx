import type { Metadata } from 'next'
import Link from 'next/link'
import { TrendingUp, ArrowRight, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Prima del 217% por MRV Digital | Rodeo AgTech',
  description: 'La prima del 217%: los datos que multiplican el precio. Multiplicador de valor para tu campo verificado.',
}

const benefits = [
  {
    Icon: TrendingUp,
    title: 'NBS genérico: USD 7/t',
    desc: 'Sin trazabilidad ni verificación satelital. Precio de mercado spot 2026. Fuente: GMF Nature Based Solutions Report Ago-2026.',
  },
  {
    Icon: TrendingUp,
    title: 'NBS con MRV: USD 15/t',
    desc: 'Con trazabilidad RFID, índices satelitales y reporte SHA256. Precio documentado para NBS con metodologías modernas.',
  },
  {
    Icon: TrendingUp,
    title: 'NBS premium: USD 24/t',
    desc: 'Con Verra VM0026, muestras de suelo Tier 2 y registro formal. Precio para créditos premium en mercado voluntario.',
  },
  {
    Icon: TrendingUp,
    title: 'CORSIA: USD 33-53/t',
    desc: 'Con elegibilidad CORSIA (requiere carta soberana). Precio de aviación global. Techo de mercado a 2030.',
  },
]

const useCases = [
  {
    title: 'Decidir si certificar',
    desc: 'Calculá el payback de la inversión en MRV: un campo de 330 ha puede generar USD 1.275-2.820/año de upside solo por la prima.',
  },
  {
    title: 'Negociación con compradores',
    desc: 'Con el reporte SHA256 de Rodeo, tenés evidencia objetiva para rechazar ofertas spot y exigir precio de mercado verificado.',
  },
  {
    title: 'Estrategia de largo plazo',
    desc: 'La prima del MRV no es coyuntural. Cada estándar (CORSIA, SBTi V2.0, EU ETS 2031) exige MRV. La infraestructura de Rodeo es la inversión correcta hoy.',
  },
]

export default function PrimaMrvPage() {
  return (
    <>
      <title>Prima del 217% por MRV Digital | Rodeo AgTech</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <TrendingUp className="w-3.5 h-3.5" />
            MERCADO · PRIMA MRV
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            La prima del 217%:<br />
            <span className="text-green-400">los datos que multiplican el precio.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            El 92% de los productores ganaderos vende carbono sin MRV. Eso significa aceptar USD 7/t cuando el mismo activo verificado vale USD 15-24/t.
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
              { value: '+217%', label: 'Prima documentada' },
              { value: '3.17x', label: 'Multiplicador' },
              { value: 'GMF 2026', label: 'Fuente' },
              { value: 'USD 7→24', label: 'Rango de precio' },
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
                Perder dinero por falta de datos.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Vender créditos de carbono sin datos auditables te relega al piso del mercado. El valor está en la confianza de que el carbono realmente fue secuestrado.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">VALOR AGREGADO</div>
                <div className="text-4xl font-black text-gray-950 mb-1">+217%</div>
                <div className="text-sm text-gray-500 mb-4">Aumento del precio</div>
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
              Los niveles de valor.
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
              Monetizá tu trazabilidad.
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
            Empezá a medir y vendé mejor.
          </h2>
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
