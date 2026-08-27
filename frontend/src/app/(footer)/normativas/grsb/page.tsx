import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle, BarChart3, Antenna, Droplets, TrendingUp, Layers, Clock, ShieldCheck, AlertTriangle, Map, FileText, ClipboardCheck, Leaf, Shield, Bell, ScanLine, Footprints, WifiOff, Globe, Wind, Sprout, Building2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'GRSB Standard — Global Roundtable for Sustainable Beef | Rodeo AgTech',
  description: 'Los principales frigoríficos exportadores y sus clientes globales (McDonald\'s, Walmart, JBS) exigen GRSB para sus proveedores de carne bovina.',
}

export default function Page() {
  return (
    <>
      <title>{'GRSB Standard — Global Roundtable for Sustainable Beef | Rodeo AgTech'}</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <Shield className="w-3.5 h-3.5" />
            NORMATIVA
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">El estándar global de sustentabilidad bovina<br /><span className="text-green-400">que el mundo exige.</span></h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Los principales frigoríficos exportadores y sus clientes globales (McDonald's, Walmart, JBS) exigen GRSB para sus proveedores de carne bovina.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/landing#mrv"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              Ir a MRV Digital
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
                Sustentabilidad bovina a nivel global.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Los principales frigoríficos exportadores y sus clientes globales (McDonald's, Walmart, JBS) exigen GRSB para sus proveedores de carne bovina.
              </p>

            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-600" />
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
              { Icon: Shield, title: '5 principios GRSB', desc: 'Natural Resources, People & Community, Animal Health & Welfare, Food Safety, Economic Viability. Rodeo mide los primeros dos con datos satelitales.' },
              { Icon: BarChart3, title: 'Indicadores verificables', desc: 'Cobertura vegetal (Sentinel-2), uso de agua (NDMI), diversidad de pasturas (fCover heterogeneidad).' },
              { Icon: Building2, title: 'Acceso a cadenas globales', desc: 'JBS, Marfrig, Tyson Foods y Cargill exigen GRSB a sus proveedores. El dashboard de Rodeo es la evidencia.' },
              { Icon: FileText, title: 'Reporte anual GRSB', desc: 'Rodeo genera el reporte de indicadores GRSB automáticamente con datos satelitales y de gestión.' }
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
          <Link href="/landing#mrv"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            Ir a MRV Digital
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
