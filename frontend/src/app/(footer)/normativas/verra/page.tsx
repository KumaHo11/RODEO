import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, BarChart3, Globe, FileText, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Verra VM0026 — Certificación de Carbono Ganadera | Rodeo AgTech',
  description: 'Verra VM0026: de la huella al crédito vendible. La metodología estándar para pastizales mejorados.',
}

const benefits = [
  {
    Icon: CheckCircle,
    title: 'Improved Grassland Management',
    desc: 'VM0026 aplica a establecimiento de pasturas mejoradas, manejo de pastoreo rotativo y recuperación de pastizales degradados.',
  },
  {
    Icon: BarChart3,
    title: 'De Tier 1 a Tier 2',
    desc: 'Rodeo provee el Tier 1. Con muestras de suelo propias (cada 5 años), escalás a Tier 2 y aumentás la precisión y el precio del crédito.',
  },
  {
    Icon: Globe,
    title: 'Retiro en Verra Registry',
    desc: 'Los créditos VM0026 se retiran en el Verra Carbon Registry, el más liquido del mundo voluntario. Compradores: Microsoft, Delta, corporativos SBTi.',
  },
  {
    Icon: FileText,
    title: 'Proceso de validación',
    desc: 'Duración 12-18 meses. Costo USD 15k-50k por metodología (compartido entre proyectos). Rodeo provee todos los datos necesarios para el dossier.',
  },
]

const useCases = [
  {
    title: 'Productores con pasturas implantadas',
    desc: 'Detectá el momento exacto de ingreso al lote basándote en datos reales, no en el ojo.',
  },
  {
    title: 'Ganadería sobre campo natural',
    desc: 'El sistema reconoce la heterogeneidad de los pastizales nativos y ajusta la estimación.',
  },
  {
    title: 'Establecimientos con planificación',
    desc: 'Integrá los datos de MS directamente en el Planificador Holístico de Rodeo.',
  },
]

export default function VerraPage() {
  return (
    <>
      <title>Verra VM0026 — Certificación de Carbono Ganadera | Rodeo AgTech</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <CheckCircle className="w-3.5 h-3.5" />
            NORMATIVA · VERRA VM0026
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Verra VM0026:<br />
            <span className="text-green-400">de la huella al crédito vendible.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Un cálculo de carbono sin registro Verra no puede generar créditos vendibles. VM0026 es la metodología estándar para pastizales mejorados.
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
              { value: 'VM0026', label: 'Metodología Verra' },
              { value: 'Tier 2', label: 'Muestras de suelo' },
              { value: 'AFOLU', label: 'Categoría' },
              { value: '15-24 USD/t', label: 'Precio NBS' },
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
                La falta de certificación te quita valor.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Podés tener el mejor manejo de pastizales y secuestrar muchísimo carbono, pero sin una certificación oficial como Verra, tu impacto ambiental no se monetiza.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">ESTÁNDAR GLOBAL</div>
                <div className="text-4xl font-black text-gray-950 mb-1">Verra</div>
                <div className="text-sm text-gray-500 mb-4">Mercado Premium</div>
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
              Certificación respaldada por datos.
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
              Acelerá tu certificación.
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
            Empezá hoy tu camino a la certificación.
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
