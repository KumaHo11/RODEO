import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Sprout, Globe, Zap, Heart } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sobre Rodeo | La Plataforma AgTech de Ganadería Regenerativa',
  description: 'Conocé la historia de Rodeo AgTech: la plataforma latinoamericana de gestión ganadera con IA que está transformando el manejo holístico del campo.',
  keywords: ['Rodeo AgTech', 'empresa AgTech argentina', 'ganadería regenerativa tecnología', 'startups agro LATAM', 'software ganadero latinoamérica'],
}

export default function SobreRodeo() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-400 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            EMPRESA
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Hecho en Argentina.<br />
            <span className="text-green-400">Para toda LATAM.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed max-w-2xl mx-auto">
            Rodeo nació de una pregunta simple: ¿por qué el sector agropecuario latinoamericano,
            que alimenta a cientos de millones de personas, sigue gestionándose con libretas y planillas de Excel?
          </p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
                NUESTRA HISTORIA
              </div>
              <h2 className="text-3xl font-black text-gray-950 mb-4">
                Empezamos en el campo, no en una oficina.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                En 2022, el equipo fundador de Rodeo pasó seis meses trabajando en establecimientos ganaderos
                de la Mesopotamia argentina, Corrientes y Uruguay. Lo que vimos fue claro: los productores
                más exitosos compartían una característica común: tomaban decisiones basadas en datos,
                no en intuición.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                El problema era que recolectar esos datos les llevaba horas por semana, los almacenaban
                de forma dispersa y nunca llegaban a analizarlos de manera sistemática.
                Rodeo existe para cambiar eso.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Hoy, más de 12.000 productores ganaderos de Argentina, Uruguay, Brasil, Paraguay, Colombia
                y Chile usan Rodeo para digitalizar sus establecimientos, optimizar la carga animal y
                adoptar prácticas de ganadería regenerativa respaldadas por datos.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { year: '2022', event: 'Fundación del equipo y primeros 6 meses de investigación en campo.', Icon: Sprout },
                { year: '2023', event: 'Lanzamiento de la versión Beta con los primeros 150 productores piloto en Argentina y Uruguay.', Icon: Zap },
                { year: '2024', event: 'Expansión a Brasil, Paraguay y Colombia. Integración del motor de IA Gemini para análisis de materia seca.', Icon: Globe },
                { year: '2025', event: 'Superamos los 10.000 usuarios activos. Lanzamiento del Planificador Holístico con metodología Savory.', Icon: Heart },
                { year: '2026', event: 'Versión 2.0 con arquitectura Offline-First completa y módulo de huella de carbono para bonos MRV.', Icon: Sprout },
              ].map(({ year, event, Icon }, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    {i < 4 && <div className="w-0.5 flex-1 bg-gray-100 mt-2" />}
                  </div>
                  <div className="pb-6">
                    <div className="text-xs font-black text-green-600 tracking-widest mb-1">{year}</div>
                    <p className="text-sm text-gray-600 leading-relaxed">{event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-green-600">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '12.000+', label: 'Productores activos' },
              { value: '2.4M ha', label: 'Hectáreas gestionadas' },
              { value: '6', label: 'Países en LATAM' },
              { value: '2022', label: 'Año de fundación' },
            ].map((m, i) => (
              <div key={i}>
                <div className="text-3xl font-black text-white mb-1">{m.value}</div>
                <div className="text-green-100 text-sm">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-950">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            MISIÓN
          </div>
          <h2 className="text-3xl font-black text-white mb-4">
            Que la ganadería latinoamericana<br />sea la más eficiente y regenerativa del mundo.
          </h2>
          <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10">
            Creemos que la ganadería bien manejada no solo es compatible con la sostenibilidad ambiental,
            sino que puede ser su principal herramienta. El pastoreo holístico, respaldado por datos e IA,
            regenera suelos, captura carbono y aumenta la rentabilidad al mismo tiempo.
            Esa es la promesa de Rodeo.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { title: 'Tecnología accesible', desc: 'Herramientas de nivel corporativo al alcance del productor familiar.' },
              { title: 'Diseño para el campo', desc: 'Offline-First, interfaz intuitiva, compatible con cualquier celular.' },
              { title: 'Ganadería regenerativa', desc: 'Cada decisión en la plataforma incorpora principios de manejo holístico.' },
            ].map(({ title, desc }, i) => (
              <div key={i} className="bg-white/5 border border-white/8 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-2 text-sm">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">Sumate a la comunidad.</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Más de 12.000 productores ya eligieron Rodeo para digitalizar su campo.
            Empezá gratis, sin tarjeta de crédito, y sé parte del cambio en la ganadería latinoamericana.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            Crear cuenta gratuita <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
