import type { Metadata } from 'next'
import Link from 'next/link'
import { Footprints, ArrowRight, BarChart3, Scale, Heart, Calendar, Users, TrendingUp } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Gestión de Hacienda Digital | Rodeo AgTech',
  description: 'Gestioná rodeos, pesadas, pariciones, sanidad y Equivalente Vaca desde el celular. La planilla ganadera definitiva para el productor latinoamericano.',
  keywords: ['gestión de hacienda', 'rodeo ganadero', 'inventario bovino', 'equivalente vaca', 'software ganadero', 'manejo de rodeos'],
}

export default function GestionDeHacienda() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <Footprints className="w-3.5 h-3.5" />
            MÓDULO GESTIÓN DE HACIENDA
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Tu rodeo completo,<br />
            <span className="text-emerald-400">siempre al día.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Reemplazá la libreta y la planilla de Excel por una herramienta diseñada para el ganadero
            latinoamericano. Hacienda, pesadas, pariciones, sanidad y cálculo de Equivalente Vaca en un solo panel.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              Empezar gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/landing#precios" className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 text-white font-medium px-7 py-3.5 rounded-xl text-sm transition-all">
              Ver planes y precios
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-green-600 py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: 'EV Auto', label: 'Cálculo en tiempo real' },
              { value: '∞',       label: 'Categorías comerciales' },
              { value: 'Excel',   label: 'Exportación instantánea' },
              { value: '10+',     label: 'Tipos de evento' },
            ].map((m, i) => (
              <div key={i}>
                <div className="text-2xl font-black text-white">{m.value}</div>
                <div className="text-green-200 text-xs font-medium mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              FUNCIONALIDADES CORE
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">Todo lo que necesitás para conocer tu rodeo.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { Icon: Users, title: 'Categorías comerciales con coeficiente EV', desc: 'Vacas, terneros, vaquillonas, novillos, toros y más. Cada categoría tiene su coeficiente de Equivalente Vaca preconfigurado para el cálculo automático de carga animal.' },
              { Icon: BarChart3, title: 'Equivalente Vaca en tiempo real', desc: 'El EV total del establecimiento se calcula automáticamente a medida que editás el stock. Se contrasta con la disponibilidad forrajera para alertarte sobre riesgo de sobrepastoreo.' },
              { Icon: Calendar, title: 'Registro de eventos por rodeo', desc: 'Pesadas, pariciones, destetes, mortandad, compras, ventas, caravanas y más. Cada evento queda registrado con fecha, cantidad, peso y notas en el historial del rodeo.' },
              { Icon: Scale, title: 'Historial de movimientos completo', desc: 'Vista cronológica de todos los eventos del establecimiento: altas, bajas, movimientos entre potreros y variaciones de stock. Exportable a Excel en un clic.' },
              { Icon: TrendingUp, title: 'KPIs de carga animal', desc: 'Stock total en cabezas, consumo diario estimado en kg MS/día y carga en EV. Los tres indicadores que definen la presión forrajera real de tu campo.' },
              { Icon: Heart, title: 'Importación desde Excel', desc: 'Importá tu inventario actual desde cualquier planilla existente con el mapeador de columnas. Migrá toda tu hacienda a Rodeo en minutos, sin perder datos históricos.' },
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

      <section className="py-20 bg-gray-950">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
                LA MÉTRICA CLAVE
              </div>
              <h2 className="text-3xl font-black text-white mb-4">El Equivalente Vaca: la brújula del ganadero moderno.</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                El Equivalente Vaca (EV) es la unidad estándar que permite comparar el requerimiento
                forrajero de distintas categorías de hacienda. En Rodeo, se calcula automáticamente
                y se contrasta con la disponibilidad forrajera en tiempo real.
              </p>
              <div className="space-y-3 mt-6">
                {[
                  { cat: 'Vaca de cría adulta con ternero', ev: '1.00 EV' },
                  { cat: 'Vaca seca', ev: '0.85 EV' },
                  { cat: 'Novillo 18-24 meses', ev: '0.65 EV' },
                  { cat: 'Ternero destete', ev: '0.30 EV' },
                  { cat: 'Toro reproductor', ev: '1.25 EV' },
                ].map(({ cat, ev }, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-gray-400">{cat}</span>
                    <span className="text-sm font-bold text-green-400">{ev}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-2xl p-8">
              <div className="text-xs font-black text-gray-500 tracking-widest mb-5">RESUMEN DE HACIENDA</div>
              <div className="space-y-4">
                {[
                  { cat: 'Vacas de cría', head: 320, ev: '320 EV' },
                  { cat: 'Novillos 18-24', head: 85, ev: '55 EV' },
                  { cat: 'Vaquillonas 1-2', head: 60, ev: '36 EV' },
                  { cat: 'Terneros', head: 280, ev: '84 EV' },
                ].map(({ cat, head, ev }, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{cat}</div>
                      <div className="text-xs text-gray-500">{head} cabezas</div>
                    </div>
                    <div className="text-sm font-black text-green-400">{ev}</div>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-4 flex justify-between">
                  <div className="text-base font-black text-white">Total EV</div>
                  <div className="text-2xl font-black text-green-400">495 EV</div>
                </div>
                <div className="bg-green-600/10 border border-green-600/20 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-xs text-green-400 font-semibold">Campo correctamente cargado — 1.06 EV/ha</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">Conocé tu hacienda como nunca antes.</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Empezá con el plan gratuito y gestioná un rodeo desde el primer día. Escalá a ilimitado cuando tu campo lo necesite.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            Crear cuenta gratuita <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
