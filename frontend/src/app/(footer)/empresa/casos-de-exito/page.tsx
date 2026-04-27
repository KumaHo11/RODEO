import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, TrendingUp, MapPin, Quote } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Casos de Éxito | Productores que Transformaron su Campo con Rodeo',
  description: 'Historias reales de ganaderos latinoamericanos que aumentaron su carga animal, optimizaron sus pasturas y adoptaron ganadería regenerativa con Rodeo AgTech.',
  keywords: ['casos de éxito ganadería', 'testimonios productores ganaderos', 'ganadería regenerativa resultados', 'pastoreo holístico resultados', 'AgTech casos de uso'],
}

const cases = [
  {
    name: 'Jorge Pereyra',
    role: 'Productor ganadero',
    location: 'Tacuarembó, Uruguay',
    field: '1.800 ha · 620 EV',
    tag: 'PLANIFICACIÓN HOLÍSTICA',
    challenge: 'Jorge manejaba su establecimiento con un sistema de pastoreo que había aprendido de su padre. Los potreros se recuperaban lentamente, la carga animal estaba estancada hace cinco años y los costos de suplementación invernal eran cada vez más altos.',
    solution: 'Al implementar el Planificador Holístico de Rodeo, Jorge redefinió sus tiempos de recuperación potrero por potrero. El módulo de IA Materia Seca le permitió ingresar hacienda en el momento exacto de pastoreo óptimo, sin sobre ni subpastorear.',
    results: [
      'Aumentó la carga animal de 0.62 a 0.91 EV/ha en 14 meses',
      'Redujo el costo de suplementación invernal en un 38%',
      'Eliminó el sobrepastoreo en 7 de sus 12 potreros',
    ],
    quote: 'Rodeo nos permitió duplicar la carga animal en el mismo campo. El planificador holístico cambió completamente la lógica de manejo del establecimiento.',
    metric: '+47%', metricLabel: 'Carga animal',
  },
  {
    name: 'Marcelo Rodríguez',
    role: 'Ganadero regenerativo',
    location: 'Corrientes, Argentina',
    field: '920 ha · 380 EV',
    tag: 'IA MATERIA SECA',
    challenge: 'Marcelo producía sobre campo natural en Corrientes, una de las regiones con mayor variabilidad forrajera de Argentina. La estimación de disponibilidad de pasto era su principal dolor de cabeza: siempre llegaba tarde al potrero o lo usaba antes de tiempo.',
    solution: 'La función de IA Materia Seca transformó su rutina de recorrida. Ahora fotografía cada potrero durante la recorrida semanal y obtiene los kg de MS/ha disponibles con integración NDVI satelital. La decisión de movimiento de hacienda dejó de ser subjetiva.',
    results: [
      'Redujo el error de estimación forrajera del 42% al 9%',
      'Aumentó la eficiencia de cosecha de biomasa en un 31%',
      'Acortó los tiempos de recuperación promedio de 65 a 48 días',
    ],
    quote: 'La función de materia seca por foto es increíble. Antes tardaba días calculando a ojo. Ahora en 10 segundos sé exactamente cuánto pasto tengo.',
    metric: '−33%', metricLabel: 'Error de estimación',
  },
  {
    name: 'Gustavo Alencar',
    role: 'Fazendeiro',
    location: 'Mato Grosso do Sul, Brasil',
    field: '3.200 ha · 1.400 EV',
    tag: 'BITÁCORA DE VOZ',
    challenge: 'Con 3.200 ha y un equipo de 8 personas, la comunicación del campo era el mayor cuello de botella de Gustavo. Los capataces anotaban en libretas que nadie leía, los problemas de infraestructura se olvidaban y el seguimiento sanitario era inconsistente.',
    solution: 'La implementación de la Bitácora de Voz de Rodeo cambió la dinámica del equipo. Los capataces graban notas mientras recorren el campo; la IA las categoriza y las asigna al potrero correspondiente. Gustavo monitorea todo en tiempo real desde cualquier dispositivo.',
    results: [
      'Redujo el tiempo de reporte del equipo de campo en un 68%',
      'Detectó y resolvió 14 problemas de infraestructura que hubieran escalado',
      'Mejoró la tasa de preñez del rodeo en un 11% gracias al mejor seguimiento reproductivo',
    ],
    quote: 'Las notas de voz son un cambio de paradigma. Mis capataces registran todo desde el campo sin bajar del caballo. Cero fricción, adopción inmediata.',
    metric: '+11%', metricLabel: 'Tasa de preñez',
  },
]

export default function CasosDeExito() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-400 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            CASOS DE ÉXITO
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
            Los números hablan.<br />
            <span className="text-green-400">Los productores también.</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Historias reales de ganaderos que transformaron la gestión de sus establecimientos
            con Rodeo. Sin trucos de marketing: datos concretos, desafíos reales, resultados verificables.
          </p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6 space-y-16">
          {cases.map(({ name, role, location, field, tag, challenge, solution, results, quote, metric, metricLabel }, i) => (
            <div key={i} className={`grid md:grid-cols-2 gap-12 items-start ${i % 2 === 1 ? 'md:[direction:rtl]' : ''}`}>
              <div className={i % 2 === 1 ? 'md:[direction:ltr]' : ''}>
                <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-5">
                  {tag}
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-black">
                      {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{role} · {location}
                    </div>
                    <div className="text-xs text-green-600 font-bold mt-0.5">{field}</div>
                  </div>
                </div>
                <h2 className="text-xl font-black text-gray-950 mb-4">El desafío</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">{challenge}</p>
                <h3 className="text-base font-black text-gray-950 mb-3">La solución</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{solution}</p>
              </div>

              <div className={i % 2 === 1 ? 'md:[direction:ltr]' : ''}>
                <div className="bg-gray-950 rounded-2xl p-6 mb-5">
                  <div className="text-5xl font-black text-green-400 mb-1">{metric}</div>
                  <div className="text-gray-400 text-sm">{metricLabel}</div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 mb-5 border border-gray-100">
                  <div className="flex items-start gap-3 mb-4">
                    <Quote className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-700 text-sm italic leading-relaxed">{quote}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-black text-gray-400 tracking-widest mb-3">RESULTADOS MEDIBLES</div>
                  {results.map((r, j) => (
                    <div key={j} className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <TrendingUp className="w-3 h-3 text-green-600" />
                      </div>
                      <span className="text-sm text-gray-600">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 bg-green-600">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-white mb-4">Escribí tu propio caso de éxito.</h2>
          <p className="text-green-100 mb-8 leading-relaxed">
            Más de 12.000 productores ya eligieron Rodeo. El próximo resultado podría ser el tuyo.
            Empezá gratis, sin tarjeta de crédito.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-green-700 font-black px-8 py-4 rounded-xl text-base transition-all hover:bg-green-50 shadow-xl">
            Crear cuenta gratuita <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
