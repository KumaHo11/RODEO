import type { Metadata } from 'next'
import Link from 'next/link'
import { Map, FileText, TrendingUp, Shield, ArrowRight, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Mercado de Carbono en Argentina | Rodeo AgTech',
  description: 'Argentina y el carbono: oportunidad regulatoria en construcción.',
}

const benefits = [
  {
    Icon: Map,
    title: 'Potencial de carbono argentino',
    desc: 'Pampa húmeda, bosques nativos, Misiones: ecosistemas con alto potencial de secuestro. Argentina podría ser exportador neto de créditos.',
  },
  {
    Icon: FileText,
    title: 'Expte. S-808/26 en Congreso',
    desc: 'El proyecto de ley de Mercados de Carbono Voluntarios define las reglas. Si se aprueba, los créditos argentinos son elegibles para CORSIA.',
  },
  {
    Icon: TrendingUp,
    title: 'Precio proyectado post-aprobación',
    desc: 'Hoy: USD 7-15/t. Post-carta soberana: USD 33-41/t (rango CORSIA). El salto de precio justifica prepararse ahora.',
  },
  {
    Icon: Shield,
    title: 'Rodeo como infraestructura',
    desc: 'Cada campo que digitalice su MRV hoy estará listo el día que Argentina adhiera al Artículo 6.2. No prepararse es perder la ventaja inicial.',
  },
]

const useCases = [
  {
    title: 'Preparación pre-regulatoria',
    desc: 'Construí el historial satelital desde 2020. Cuando la ley pase, tu campo tiene 3+ años de baseline.',
  },
  {
    title: 'Comunidades de práctica',
    desc: 'Los productores argentinos que adopten MRV colectivamente tienen más peso para impulsar la regulación.',
  },
  {
    title: 'Acceso al mercado voluntario hoy',
    desc: 'Mientras Argentina regula, el mercado voluntario (NBS, Verra) ya está abierto. Rodeo te conecta sin esperar.',
  },
]

export default function ArgentinaPage() {
  return (
    <>
      <title>Mercado de Carbono en Argentina | Rodeo AgTech</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <Map className="w-3.5 h-3.5" />
            MERCADO · ARGENTINA
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Argentina y el carbono:<br />
            <span className="text-green-400">oportunidad regulatoria en construcción.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Argentina tiene el potencial de carbono, pero el marco regulatorio está pendiente en el Congreso. La oportunidad es prepararse HOY.
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
              { value: 'NDC', label: 'Sin carta soberana aún' },
              { value: 'S-808/26', label: 'Expte. en Congreso' },
              { value: '6-12 meses', label: 'Plazo estimado' },
              { value: '122 Mt', label: 'Demanda CORSIA' },
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
                El costo de no estar preparado.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Esperar a que la ley se apruebe significa empezar de cero cuando todos los demás ya tienen años de baseline. Perdés el 'first mover advantage'.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Map className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">MARCO LEGAL</div>
                <div className="text-4xl font-black text-gray-950 mb-1">Ley de Carbono</div>
                <div className="text-sm text-gray-500 mb-4">Próxima aprobación</div>
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
              Preparación para el futuro.
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
              Actuá hoy mismo.
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
