import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, TrendingUp, FileText, Leaf, ArrowRight, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'SBTi V2.0 Insetting Scope 3 | Rodeo AgTech',
  description: 'Insetting Scope 3: tu rodeo en la cadena de valor corporativa. Participá del mercado SBTi V2.0.',
}

const benefits = [
  {
    Icon: Building2,
    title: 'Engagement corporativo',
    desc: 'Frigoríficos y traders con metas SBTi necesitan que sus proveedores ganaderos documenten y reduzcan su huella. Rodeo provee esa documentación.',
  },
  {
    Icon: TrendingUp,
    title: '20-80 USD/t según nivel',
    desc: 'SBTi Engaged: 20 USD/t. SBTi Leadership: 80 USD/t. Precio muy superior al mercado voluntario genérico.',
  },
  {
    Icon: FileText,
    title: 'Contrato de 5 años',
    desc: 'El insetting corporativo típico es un contrato plurianual (ejemplo: LDC 5 años × 6.000 t/año). Rodeo provee los datos anuales verificados.',
  },
  {
    Icon: Leaf,
    title: 'Reducción y remoción',
    desc: 'SBTi V2.0 acepta insetting como reducción dentro de la cadena de valor del comprador. Tu manejo regenerativo cuenta directamente.',
  },
]

const useCases = [
  {
    title: 'Negociación con frigoríficos exportadores',
    desc: 'Los grandes exportadores (JBS, Marfrig, NH Foods) tienen metas SBTi. Ofrecé trazabilidad verificada como diferencial de precio.',
  },
  {
    title: 'Acceso a financiamiento verde',
    desc: 'Bancos que financian cadenas SBTi-compliant ofrecen tasas preferenciales a productores con documentación de huella.',
  },
  {
    title: 'Insetting multifinca',
    desc: 'Un grupo de productores puede agregarse para alcanzar los volúmenes mínimos de interés corporativo (típico: 5.000+ t/año).',
  },
]

export default function SbtiPage() {
  return (
    <>
      <title>SBTi V2.0 Insetting Scope 3 | Rodeo AgTech</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <Building2 className="w-3.5 h-3.5" />
            MERCADO · SBTI SCOPE 3
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Insetting Scope 3:<br />
            <span className="text-green-400">tu rodeo en la cadena de valor corporativa.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            El SBTi V2.0 exige que las empresas certifiquen la huella de carbono de sus proveedores, incluyendo productores ganaderos. Tu campo puede ser parte de esa cadena.
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
              { value: '20 USD/t', label: 'SBTi Engaged' },
              { value: '80 USD/t', label: 'SBTi Leadership' },
              { value: 'Feb 2027', label: 'Fecha de vigencia' },
              { value: 'Scope 3', label: 'Categoría' },
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
                El mercado corporativo requiere trazabilidad.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Sin datos auditables, es imposible demostrar el impacto ambiental y acceder a los programas de financiamiento verde y precios premium.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">INSETTING</div>
                <div className="text-4xl font-black text-gray-950 mb-1">SBTi</div>
                <div className="text-sm text-gray-500 mb-4">Scope 3</div>
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
              Integración corporativa transparente.
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
              Soluciones para tu cadena.
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
