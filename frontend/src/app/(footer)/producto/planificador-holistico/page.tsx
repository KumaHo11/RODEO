import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, ArrowRight, BarChart3, Brain, Sprout, TrendingUp, Target, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Planificador Holístico de Pastoreo | Rodeo AgTech',
  description: 'Planificá el pastoreo rotativo de tu establecimiento con vista Gantt anual. IA predictiva basada en Allan Savory para maximizar la recuperación de pasturas y la carga animal.',
  keywords: ['planificador holístico', 'pastoreo rotativo', 'ganado regenerativo', 'Allan Savory', 'planificación forrajera', 'rotación de potreros', 'ganadería sustentable'],
}

export default function PlanificadorHolistico() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <CalendarDays className="w-3.5 h-3.5" />
            MÓDULO PLANIFICADOR HOLÍSTICO
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Planificá tu pastoreo<br />
            <span className="text-green-400">con 12 meses de visión.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            El Planificador Holístico de Rodeo es el único software de pastoreo rotativo en LATAM calibrado
            con los principios de manejo de Allan Savory e integrado con datos reales de materia seca satelital.
            Tomá decisiones de movimiento de hacienda con semanas de anticipación.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              Empezar gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/landing#precios" className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 text-white font-medium px-7 py-3.5 rounded-xl text-sm transition-all">
              Ver planes
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-green-600 py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: 'Gantt', label: 'Vista anual multiescala' },
              { value: '12 m', label: 'Proyección predictiva' },
              { value: 'NDVI', label: 'Calibración satelital' },
              { value: 'IA', label: 'Recomendaciones inteligentes' },
            ].map((m, i) => (
              <div key={i}>
                <div className="text-2xl font-black text-white">{m.value}</div>
                <div className="text-green-200 text-xs font-medium mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
                EL PROBLEMA
              </div>
              <h2 className="text-3xl font-black text-gray-950 mb-4">
                Sin planificación, el pastoreo es azar.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                El 78% de los productores ganaderos de LATAM toman decisiones de movimiento de hacienda
                de forma reactiva: mueven cuando ven el pasto bajo. Eso es tarde. El daño a la pastura ya
                está hecho, la recuperación se retrasó y la carga animal efectiva cayó.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                La ganadería holística, tal como la concibió Allan Savory, exige planificar los movimientos
                con semanas de anticipación, respetando los tiempos de recuperación de cada lote.
                Rodeo hace exactamente eso, de forma automática.
              </p>
              {[
                'Proyectá el próximo movimiento de hacienda con 2-4 semanas de anticipación',
                'Respetá los tiempos de recuperación mínimos para cada potrero',
                'Visualizá el plan completo de 12 meses en una sola pantalla',
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-gray-700 mb-2">
                  <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-green-600 rounded-full" />
                  </div>
                  {t}
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="text-xs font-black text-gray-400 tracking-widest mb-4">GANTT DE PASTOREO — TEMPORADA</div>
              <div className="space-y-2">
                {[
                  { lote: 'Potrero 1', days: [1, 4],   color: 'bg-green-500', status: 'Pastoreando' },
                  { lote: 'Potrero 2', days: [5, 9],   color: 'bg-blue-400',  status: 'En descanso' },
                  { lote: 'Potrero 3', days: [10, 13], color: 'bg-yellow-400', status: 'Próximo' },
                  { lote: 'Potrero 4', days: [14, 18], color: 'bg-gray-200',  status: 'Recuperando' },
                ].map(({ lote, color, status }, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-20 text-xs font-medium text-gray-500 flex-shrink-0">{lote}</div>
                    <div className="flex-1 bg-gray-50 rounded-lg h-7 overflow-hidden relative">
                      <div className={`absolute top-0 bottom-0 ${color} rounded-md`}
                        style={{ left: `${i * 22}%`, width: '35%' }} />
                    </div>
                    <div className="text-xs text-gray-400 w-24 flex-shrink-0">{status}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-sm" />
                  <span className="text-xs text-gray-400">Pastoreando</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-blue-400 rounded-sm" />
                  <span className="text-xs text-gray-400">Descanso</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm" />
                  <span className="text-xs text-gray-400">Próximo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              FUNCIONALIDADES
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">El planificador más completo del sector.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { Icon: CalendarDays, title: 'Vista Gantt multiescala', desc: 'Visualizá tu plan de pastoreo en vista de plan abierto, plan cerrado o plan anual. Tres escalas de tiempo para el control táctico del día a día y la visión estratégica de toda la temporada.' },
              { Icon: Brain, title: 'Recomendaciones IA', desc: 'El motor predictivo analiza tu historial de materia seca, días de pastoreo y tiempos de recuperación para sugerirte el próximo movimiento óptimo.' },
              { Icon: Sprout, title: 'Método Savory integrado', desc: 'El algoritmo de planificación incorpora los principios de manejo holístico: tiempo de recuperación adaptativo según calidad de pastura y carga animal.' },
              { Icon: BarChart3, title: 'Balance bio-económico', desc: 'Ratio R: la relación entre EV demandados y EV disponibles según la materia seca proyectada. El indicador que resume la salud económica del sistema.' },
              { Icon: Target, title: 'Alertas predictivas', desc: 'Rodeo te avisa con 7 días de anticipación cuando un potrero está a punto de agotarse o cuando el tiempo de recuperación mínimo no se está respetando.' },
              { Icon: TrendingUp, title: 'Proyección a 12 meses', desc: 'Simulá distintos escenarios de carga animal y distribución de potreros para proyectar el comportamiento forrajero del establecimiento durante todo el año.' },
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
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            GANADERÍA HOLÍSTICA
          </div>
          <h2 className="text-3xl font-black text-white mb-4">
            El método Savory, ahora en tu celular.
          </h2>
          <p className="text-gray-400 leading-relaxed mb-12 max-w-2xl mx-auto">
            El manejo holístico de pastoreo, desarrollado por Allan Savory, demostró que la ganadería bien
            manejada puede regenerar suelos degradados, secuestrar carbono y aumentar simultáneamente la
            rentabilidad. El Planificador Holístico de Rodeo hace posible aplicar estos principios sin
            ser un experto en ecología de pastizales.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { Icon: Sprout, title: '+34%', sub: 'Carga animal promedio en el primer año' },
              { Icon: Zap, title: '−28%', sub: 'Reducción del pastoreo en zonas críticas' },
              { Icon: TrendingUp, title: '+41%', sub: 'Recuperación de biomasa radicular en 2 años' },
            ].map(({ Icon, title, sub }, i) => (
              <div key={i} className="bg-white/5 border border-white/8 rounded-2xl p-6 text-center">
                <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-3xl font-black text-green-400 mb-1">{title}</div>
                <div className="text-xs text-gray-500 leading-snug">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">
            Empezá a planificar tu campo con inteligencia.
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            El Planificador Holístico está disponible en los planes Planificador y Holístico.
            Registrate gratis y explorá la herramienta sin límites durante los primeros 30 días.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            Probar 30 días gratis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
