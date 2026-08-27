import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle, BarChart3, Antenna, Droplets, TrendingUp, Layers, Clock, ShieldCheck, AlertTriangle, Map, FileText, ClipboardCheck, Leaf, Shield, Bell, ScanLine, Footprints, WifiOff, Globe, Wind, Sprout, Building2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Qué es el MRV Digital y Por Qué Vale Más | Rodeo AgTech',
  description: 'Un crédito de carbono sin MRV vale USD 7/t. El mismo crédito con MRV satelital vale USD 15-24/t. La diferencia es el dato verificable.',
}

export default function Page() {
  return (
    <>
      <title>{'Qué es el MRV Digital y Por Qué Vale Más | Rodeo AgTech'}</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-green-400 bg-green-500/10 border-green-500/20 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <BarChart3 className="w-3.5 h-3.5" />
            MERCADO
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">MRV: Monitoreo, Reporte y Verificación.<br /><span className="text-green-400">El dato que vale dinero.</span></h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Un crédito de carbono sin MRV vale USD 7/t. El mismo crédito con MRV satelital vale USD 15-24/t. La diferencia es el dato verificable.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/landing#mercado"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              Ir a Mercado
              <ArrowRight className="w-4 h-4" />
            </Link>
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
                La diferencia es el dato verificable.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Un crédito de carbono sin MRV vale USD 7/t. El mismo crédito con MRV satelital vale USD 15-24/t. La diferencia es el dato verificable.
              </p>

            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-green-600" />
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
              { Icon: TrendingUp, title: '+217% Prima de precio', desc: 'Datos documentados del mercado GMF agosto 2026: créditos con MRV moderno valen 3.17x más.' },
              { Icon: Clock, title: '50-70% Reducción de costos', desc: 'El MRV digital reemplaza auditorías físicas de USD 15k-50k por procesos satelitales automáticos.' },
              { Icon: Shield, title: 'USD 0 Exposición al precio de carbono', desc: 'Rodeo cobra por tonelada monitoreada, no por tonelada vendida.' },
              { Icon: Globe, title: '122-198 Mt Demanda CORSIA', desc: 'Solo 38 Mt elegibles. La oferta con MRV verificado tiene el mercado para sí.' }
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

      {/* CTA FINAL */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">
            Empezá a medir.
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Sumate a la plataforma AgTech de referencia.
          </p>
          <Link href="/landing#mercado"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            Ir a Mercado
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
