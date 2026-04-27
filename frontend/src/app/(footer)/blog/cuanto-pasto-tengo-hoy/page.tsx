import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, Clock, User, Tag, Camera, TrendingDown, TrendingUp } from 'lucide-react'

export const metadata: Metadata = {
  title: '¿Cuánto pasto tenés hoy? La decisión que define la rentabilidad de tu campo | Blog Rodeo',
  description: 'El error en la estimación de materia seca le cuesta al ganadero latinoamericano entre el 20% y el 35% de su productividad anual. Descubrí cómo la IA está cambiando esto.',
  keywords: ['materia seca disponible', 'estimación de pasto', 'forraje bovino', 'pasturas rentables', 'manejo ganadero rentable', 'cuánto pasto tiene mi potrero'],
}

export default function BlogPost1() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al blog
          </Link>
          <div className="flex items-center gap-2 mb-5">
            <Tag className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-black tracking-widest text-green-400">FORRAJE Y PASTURAS</span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-black text-white leading-tight mb-6">
            ¿Cuánto pasto tenés hoy? La pregunta que define la rentabilidad de tu campo
          </h1>
          <div className="flex items-center gap-4 text-gray-400 text-sm">
            <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Equipo Rodeo</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 8 min de lectura</div>
            <span>25 de abril de 2026</span>
          </div>
        </div>
      </section>

      <article className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6">

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mb-10">
            <p className="text-gray-700 text-base italic leading-relaxed">
              El productor ganadero promedio subestima o sobreestima la disponibilidad de materia seca
              de sus potreros en un 35%. Eso equivale a entre 2 y 5 semanas de pastoreo mal aprovechado
              por año. Con tecnología disponible hoy, ese margen de error puede caer al 8%.
            </p>
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">El problema que nadie mide —pero que todos padecen</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Preguntale a cualquier ganadero cuál es la decisión más importante que toma cada semana.
            La mayoría responderá: mover la hacienda. ¿Cuándo entro al potrero? ¿Cuántos días me quedo?
            ¿Cuándo salgo? Esas tres preguntas determinan la productividad del establecimiento.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Y todas dependen de una variable central: ¿cuántos kilos de Materia Seca (MS) hay disponibles
            en cada potrero en este momento?
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            El problema es que la inmensa mayoría de los productores latinoamericanos sigue respondiendo
            esa pregunta a ojo. Con experiencia. Con el "ojo del ganadero". Y ese ojo, por bueno que sea,
            tiene un margen de error promedio del 35%, según estudios del INTA y de la Universidad de la República (UDELAR).
          </p>

          {/* CTA 1 */}
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6 my-8 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div>
              <p className="font-bold text-gray-900 mb-1">¿Querés medir tu pasto con IA?</p>
              <p className="text-sm text-gray-600">Empezá gratis con Rodeo y analizá tu primer potrero hoy mismo.</p>
            </div>
            <Link href="/register" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all whitespace-nowrap flex-shrink-0">
              Crear cuenta gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">El costo real del error de estimación</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Un error del 35% en la estimación de MS no es un problema académico. Es plata concreta.
            Veamos qué sucede en la práctica:
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-xs font-black text-red-600 tracking-widest">SOBREESTIMACIÓN</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                Ingresás con más hacienda de la que el potrero puede sostener. Las pasturas se pastorean
                por debajo del punto de corte óptimo, se dañan las raíces, el tiempo de recuperación
                se extiende de 45 a 70 días. Perdiste 25 días de receptividad.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-black text-amber-600 tracking-widest">SUBESTIMACIÓN</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                Postergás el ingreso porque "creés" que el pasto no está a punto. Mientras tanto, el
                forraje sigue creciendo, los tallos se lignifican, la digestibilidad cae del 68% al 52%.
                Perdiste kilos de ganancia de peso potencial.
              </p>
            </div>
          </div>

          <p className="text-gray-600 leading-relaxed mb-8">
            En un establecimiento de 500 ha con una carga animal de 0.8 EV/ha, mejorar la precisión
            de estimación del 65% al 92% puede traducirse en un incremento de la carga efectiva
            del 15 al 22%, sin agregar ni un metro de potrero. Solo gestionando mejor el pasto que ya tenés.
          </p>

          <h2 className="text-2xl font-black text-gray-950 mb-4">Los métodos tradicionales y sus limitaciones</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Existen métodos objetivos para estimar la disponibilidad de materia seca: la estimación visual
            calibrada, el método del disco medidor, el pasture probe, la placa de estimación de altura.
            Todos son más precisos que el ojo. Todos tienen un problema: requieren tiempo, equipamiento
            y capacitación que la mayoría de los productores no tiene.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            El disco medidor requiere al menos 30 lecturas por potrero para ser estadísticamente representativo.
            Con 20 potreros de 25 ha cada uno, eso son 600 lecturas por recorrida. En un establecimiento
            que se recorre cada 7 días, hablamos de más de 2 horas dedicadas exclusivamente a medir pasto.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            La realidad es que casi ningún productor lo hace sistemáticamente. Y los que lo hacen,
            dedican un tiempo que podría emplearse en otras decisiones estratégicas.
          </p>

          <h2 className="text-2xl font-black text-gray-950 mb-4">Cómo la IA resuelve esto en 5 segundos</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            La tecnología de análisis de imágenes con inteligencia artificial cambió radicalmente
            el panorama. Hoy, tomando una foto de un potrero con el celular, un motor de IA entrenado
            específicamente para pasturas latinoamericanas puede estimar los kg de Materia Seca disponibles
            por hectárea con un margen de error del 8 al 12%.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            El módulo de IA Materia Seca de Rodeo va un paso más allá: cruza la foto con el índice
            NDVI del potrero en tiempo real, obtenido de imágenes satelitales de resolución de 10 metros.
            Esto permite corregir variaciones de iluminación, ángulo de toma y condiciones estacionales
            que podrían sesgar el análisis de la imagen sola.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            El resultado: un análisis de disponibilidad forrajera más preciso que el de un técnico
            con disco medidor, en 5 segundos y desde cualquier celular, incluso sin señal de internet.
          </p>

          <div className="bg-gray-950 rounded-2xl p-6 mb-10">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Camera className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-xs font-black text-gray-500 tracking-widest mb-2">CÓMO FUNCIONA EN RODEO</div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Fotografiás el potrero desde la app → la IA analiza la imagen y el NDVI satelital → recibís
                  los kg de MS/ha disponibles en menos de 5 segundos → Rodeo traduce ese dato en el número de
                  EV que puede soportar el lote y los días de pastoreo recomendados.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">El impacto en números reales</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Los productores de Rodeo que adoptan el módulo de IA Materia Seca como herramienta sistemática
            de gestión —al menos una vez por semana por potrero— muestran resultados consistentes
            en sus primeras dos temporadas:
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[
              { value: '−33%', label: 'Error de estimación forrajera' },
              { value: '+22%', label: 'Eficiencia de cosecha de biomasa' },
              { value: '−18%', label: 'Costo de suplementación invernal' },
            ].map(({ value, label }, i) => (
              <div key={i} className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-green-700 mb-1">{value}</div>
                <div className="text-xs text-gray-600">{label}</div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">Por dónde empezar</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Si nunca mediste objetivamente la materia seca de tus potreros, el primer paso no es
            comprar equipamiento ni contratar un técnico. Es empezar a fotografiar un potrero por día
            durante las próximas cuatro semanas.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            En ese período, el sistema construirá una línea de base del comportamiento forrajero de
            tu campo. Verás la correlación entre el NDVI satelital, la foto y el crecimiento real de
            las pasturas. En cuatro semanas tendrás más información sobre tu campo de la que acumulaste
            en los últimos cuatro años.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            Esa información es la base de todas las demás decisiones: el planificador de pastoreo,
            la carga animal óptima, la proyección forrajera para el invierno. Todo parte de saber,
            con precisión, cuánto pasto tenés hoy.
          </p>

          {/* CTA FINAL */}
          <div className="bg-green-600 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-black text-white mb-3">
              Empezá a medir tu pasto con IA. Hoy. Gratis.
            </h3>
            <p className="text-green-100 text-sm mb-6 max-w-md mx-auto">
              Creá tu cuenta gratuita en Rodeo y analizá tu primer potrero en menos de 5 minutos.
              No se requiere tarjeta de crédito.
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
