import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, Clock, User, Tag, Sprout, TrendingUp, Leaf } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Ganadería Regenerativa: Cómo Aumentar tu Carga Animal mientras Regenerás el Suelo | Blog Rodeo',
  description: 'El manejo holístico de pastoreo puede duplicar la carga animal y regenerar suelos degradados al mismo tiempo. Todo sobre ganadería regenerativa y cómo aplicarla con tecnología.',
  keywords: ['ganadería regenerativa', 'pastoreo holístico', 'Allan Savory método', 'carbono ganadería', 'suelo ganadero', 'carga animal sostenible', 'pastizal regenerativo'],
}

export default function BlogPost2() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-950 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al blog
          </Link>
          <div className="flex items-center gap-2 mb-5">
            <Tag className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-black tracking-widest text-green-400">GANADERÍA REGENERATIVA</span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-black text-white leading-tight mb-6">
            Ganadería regenerativa: cómo aumentar tu carga animal mientras regenerás el suelo
          </h1>
          <div className="flex items-center gap-4 text-gray-400 text-sm">
            <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Equipo Rodeo</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 11 min de lectura</div>
            <span>18 de abril de 2026</span>
          </div>
        </div>
      </section>

      <article className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6">

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mb-10">
            <p className="text-gray-700 text-base italic leading-relaxed">
              La ganadería regenerativa no es una moda. Es la respuesta técnica más completa al
              triple desafío del sector: cómo producir más, degradar menos y ser rentable al mismo tiempo.
              Y la tecnología es el habilitador que la hace escalable para el productor promedio.
            </p>
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">El mito que hay que derribar</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Existe un malentendido profundamente arraigado en el sector agropecuario latinoamericano:
            que la ganadería y la sustentabilidad ambiental son incompatibles. Que para ser "verde"
            hay que sacrificar productividad. Que para aumentar la carga animal hay que expandir
            la frontera agropecuaria.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            La ganadería regenerativa —y en particular el manejo holístico de pastoreo desarrollado
            por el biólogo zimbabuense Allan Savory— demuestra exactamente lo contrario. Con el manejo
            correcto, la ganadería puede ser el principal agente de regeneración del suelo, captura de
            carbono y recuperación de la biodiversidad en pastizales naturales.
          </p>

          {/* CTA 1 */}
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6 my-8 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div>
              <p className="font-bold text-gray-900 mb-1">Aplicá el método Savory en tu campo</p>
              <p className="text-sm text-gray-600">El Planificador Holístico de Rodeo está diseñado sobre estos principios.</p>
            </div>
            <Link href="/register" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all whitespace-nowrap flex-shrink-0">
              Probarlo gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">Qué es el manejo holístico y cómo funciona</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            En la década de 1960, Allan Savory observó que los grandes pastizales africanos se degradaban
            incluso cuando se retiraba la presión animal. La causa era contraintuitiva: la ausencia de
            herbivoría. Los pastizales evolucionaron con millones de animales en movimiento constante.
            Sin ese estímulo, el suelo se sella, el material vegetal se acumula sin descomponerse
            y el ciclo hidrológico se rompe.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            La solución de Savory fue reintroducir ese movimiento de forma planificada: concentrar alta
            carga animal en un potrero durante un período corto (generalmente 1 a 4 días), luego mover
            y no volver a ese potrero hasta que se haya recuperado completamente (30 a 120 días, dependiendo
            de la estación y la especie). Es lo opuesto al pastoreo continuo.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            El efecto es radical: el suelo se estimula, las raíces profundizan, la diversidad botánica
            aumenta, la infiltración de agua mejora y la producción total de biomasa puede duplicarse
            en los primeros dos años.
          </p>

          <div className="grid md:grid-cols-3 gap-4 mb-10">
            {[
              { Icon: Sprout, title: 'Principio 1', desc: 'Alta concentración animal durante períodos cortos. La intensidad del pastoreo estimula el rebrote.' },
              { Icon: Leaf, title: 'Principio 2', desc: 'Tiempo de recuperación largo y adaptativo. Cada potrero descansa hasta recuperarse completamente antes del próximo ingreso.' },
              { Icon: TrendingUp, title: 'Principio 3', desc: 'Monitoreo continuo. Las decisiones se ajustan constantemente en función de los datos reales de disponibilidad forrajera.' },
            ].map(({ Icon, title, desc }, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-2">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">El desafío: la planificación es compleja</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Implementar el manejo holístico correctamente es conceptualmente simple pero operativamente
            exigente. Requiere rastrear el estado de recuperación de cada potrero, proyectar el movimiento
            de hacienda con semanas de anticipación, ajustar los días de pastoreo en función de la
            disponibilidad de materia seca real y gestionar la logística de múltiples rodeos simultáneos.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Históricamente, esa complejidad fue la barrera principal para la adopción masiva del método.
            Los ganaderos que lo intentaban sin un sistema de soporte terminaban volviendo al pastoreo
            continuo después de la primera temporada: era demasiado difícil de sostener con libreta y memoria.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            Ese es exactamente el problema que resuelve el Planificador Holístico de Rodeo.
          </p>

          <h2 className="text-2xl font-black text-gray-950 mb-4">La ganadería regenerativa y el mercado de carbono</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Los pastizales bien manejados son los ecosistemas terrestres con mayor potencial de
            secuestro de carbono. Un suelo ganadero en recuperación puede capturar entre 0.5 y 1.5
            toneladas de CO₂ equivalente por hectárea por año, según el tipo de suelo, la latitud y
            la intensidad del manejo.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Este carbono puede monetizarse a través del mercado voluntario de bonos de carbono.
            Con un precio de mercado de entre USD 15 y USD 45 por tonelada de CO₂eq, un establecimiento
            ganadero de 1.000 ha con manejo regenerativo podría generar entre USD 7.500 y USD 67.500
            anuales en ingresos adicionales por venta de bonos.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            Rodeo está desarrollando actualmente el módulo de huella de carbono y MRV (Medición, Reporte
            y Verificación) para facilitar el acceso de los productores latinoamericanos a este mercado.
            La trazabilidad de datos que Rodeo genera hoy es la misma que los verificadores de carbono
            exigen mañana.
          </p>

          <h2 className="text-2xl font-black text-gray-950 mb-4">Resultados documentados en LATAM</h2>
          <div className="space-y-4 mb-10">
            {[
              { region: 'Tacuarembó, Uruguay', result: 'Productor de 1.800 ha aumentó su carga de 0.62 a 0.91 EV/ha en 14 meses implementando el Planificador Holístico de Rodeo.' },
              { region: 'Corrientes, Argentina', result: 'Establecimiento de 920 ha sobre campo natural redujo el error de estimación forrajera del 42% al 9% con el módulo de IA Materia Seca.' },
              { region: 'Mato Grosso do Sul, Brasil', result: 'Fazenda de 3.200 ha mejoró la tasa de preñez en 11% tras implementar el sistema de seguimiento reproductivo integrado en la Bitácora de Voz.' },
            ].map(({ region, result }, i) => (
              <div key={i} className="flex gap-4 bg-gray-50 border border-gray-100 rounded-xl p-5">
                <div className="w-2 bg-green-500 rounded-full flex-shrink-0" />
                <div>
                  <div className="text-xs font-black text-green-600 tracking-widest mb-1">{region}</div>
                  <p className="text-sm text-gray-700 leading-relaxed">{result}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">Por dónde empezar hoy</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            No necesitás reformar todo tu sistema productivo el primer día. La adopción del manejo
            holístico es gradual. El camino más efectivo es:
          </p>
          <ol className="list-none space-y-4 mb-8">
            {[
              'Empezar a medir la materia seca de tus potreros sistemáticamente (una vez por semana, con foto).',
              'Calcular el Equivalente Vaca real de tu rodeo y compararlo con la receptividad estimada del campo.',
              'Identificar los dos o tres potreros con mayor potencial de recuperación e iniciar la rotación planificada en esos lotes.',
              'Respetar los tiempos de recuperación mínimos del sistema. Ese es el 80% del resultado.',
              'Medir y comparar: el primer año es de aprendizaje, el segundo es de resultados.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-black">{i + 1}</span>
                </div>
                <span className="text-sm text-gray-600 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          {/* CTA FINAL */}
          <div className="bg-green-600 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-black text-white mb-3">
              El Planificador Holístico de Rodeo te espera. Gratis.
            </h3>
            <p className="text-green-100 text-sm mb-6 max-w-md mx-auto">
              Implementá los principios del manejo holístico en tu campo con el soporte de la tecnología.
              Empezá hoy, sin tarjeta de crédito.
            </p>
            <Link href="/register" className="inline-flex items-center gap-2 bg-white text-green-700 font-black px-7 py-3.5 rounded-xl transition-all hover:bg-green-50 shadow-xl">
              Crear cuenta gratuita <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-10 pt-8 border-t border-gray-100">
            <Link href="/blog" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Volver al blog
            </Link>
          </div>
        </div>
      </article>
    </>
  )
}
