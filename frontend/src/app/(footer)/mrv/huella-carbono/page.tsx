import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle, BarChart3, Antenna, Droplets, TrendingUp, Layers, Clock, ShieldCheck, AlertTriangle, Map, FileText, ClipboardCheck, Leaf, Shield, Bell, ScanLine, Footprints, WifiOff, Globe, Wind, Sprout, Building2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Huella de Carbono Ganadera IPCC Tier 1 | Rodeo AgTech',
  description: 'Sin calcular tu balance de carbono, no sabés si tu campo es sumidero o emisor, ni cuánto vale ese dato en el mercado.',
}

export default function Page() {
  return (
    <>
      <title>{'Huella de Carbono Ganadera IPCC Tier 1 | Rodeo AgTech'}</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-green-400 bg-green-500/10 border-green-500/20 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <Leaf className="w-3.5 h-3.5" />
            MÓDULO MRV · HUELLA DE CARBONO
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">Huella de Carbono<br /><span className="text-green-400">Ganadera IPCC Tier 1</span></h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Sin calcular tu balance de carbono, no sabés si tu campo es sumidero o emisor, ni cuánto vale ese dato en el mercado.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              Crear cuenta gratuita
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/landing#mrv"
              className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 text-white font-medium px-7 py-3.5 rounded-xl text-sm transition-all">
              Ver todos los módulos
            </Link>
          </div>
        </div>
      </section>

      {/* METRIC STRIP */}
      <section className="bg-green-600 py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: 'IPCC 2006', label: 'Metodología' },
              { value: 'GWP100 AR6', label: 'CH₄=27.9 · N₂O=273' },
              { value: 'tCO₂e', label: 'Por potrero y estancia' },
              { value: 'Tier 1', label: 'Punto de partida' }
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
                Sin calcular tu balance de carbono, no sabés si tu campo es sumidero o emisor, ni cuánto vale ese dato en el mercado.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                La huella de carbono es la nueva métrica financiera de la ganadería. Si no la medís, estás dejando dinero en la mesa y cerrando la puerta a mercados internacionales que pronto la exigirán como estándar.
              </p>

              <div className="space-y-3">
                {[
                  'Desconocimiento del impacto real y potencial de secuestro',
                  'Incapacidad de monetizar prácticas regenerativas en el mercado voluntario',
                  'Barreras comerciales ante corporaciones con compromisos Net Zero'
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Leaf className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">VERIFICADO</div>
              <div className="text-4xl font-black text-gray-950 mb-1">RODEO</div>
              <div className="text-sm text-gray-500 mb-4">Infraestructura Digital</div>
              <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
                Auditable e Inmutable
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
              BENEFICIOS
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">
              Herramientas de Precisión.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { Icon: Leaf, title: 'Emisiones CH₄ entérico', desc: 'Factor IPCC 64 kg CH₄/cabeza/año (subtropical/pampa). Convertido con GWP100 AR6 (27.9).' },
              { Icon: Wind, title: 'N₂O de estiércol', desc: 'EF3PRP IPCC: 1% del N excretado. Emisiones de pastoreo directo calculadas por potrero.' },
              { Icon: Sprout, title: 'Secuestro SOC satelital', desc: 'Proxy de carbono orgánico del suelo estimado con Sentinel-2. 0.2 tC/ha/año base, ajustado por estado del suelo.' },
              { Icon: BarChart3, title: 'Balance neto por potrero', desc: 'Emisiones brutas menos secuestro = balance neto en tCO₂e. Identificá qué potreros son sumideros y cuáles son emisores.' },
              { Icon: TrendingUp, title: 'Tendencia anual', desc: 'Seguí la evolución del balance año a año. Documentá la mejora del manejo regenerativo con datos verificables.' },
              { Icon: FileText, title: 'Paso previo a Verra VM0026', desc: 'El IPCC Tier 1 es el punto de entrada. Con muestras de suelo, escalás a Tier 2 y habilitás certificación Verra.' }
            ].map(({ Icon, title, desc }, i) => (
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
              Para cada sistema productivo.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { title: 'Mercado voluntario de carbono', desc: 'NBS a 15-24 USD/t con MRV moderno. Un campo de 500 ha en balance neutro puede generar USD 7.500-12.000/año en créditos.' },
              { title: 'Insetting Scope 3', desc: 'Empresas con metas SBTi V2.0 compran créditos de insetting de sus proveedores de carne. Rodeo es el MRV que habilita esa transacción.' },
              { title: 'CORSIA elegibilidad', desc: 'Con carta soberana argentina y balance verificado, tu campo puede acceder al mercado de aviación CORSIA a 33-53 USD/t.' }
            ].map(({ title, desc }, i) => (
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
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">
            Empezá a medir.
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Sumate a la plataforma AgTech de referencia.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            Crear cuenta gratuita
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/landing#mrv"
            className="mt-4 inline-block text-gray-500 hover:text-green-600 font-medium ml-4 transition-all text-base">
            Ver todos los módulos
          </Link>
        </div>
      </section>
    </>
  )
}
