import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Download, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Prensa | Rodeo AgTech — Kit de Medios y Contacto',
  description: 'Recursos de prensa de Rodeo AgTech: kit de medios, logotipos, datos de impacto y contacto para periodistas y medios especializados en agrotecnología y ganadería.',
  keywords: ['Rodeo AgTech prensa', 'AgTech Argentina medios', 'notas de prensa ganadería tecnología', 'kit de prensa agtech'],
}

const pressReleases = [
  { date: 'Marzo 2026', title: 'Rodeo lanza versión 2.0 con arquitectura Offline-First completa e integración de IA Gemini Pro Vision para análisis de pasturas.', tag: 'PRODUCTO' },
  { date: 'Noviembre 2025', title: 'Rodeo supera los 10.000 productores activos en LATAM y anuncia expansión a México y Bolivia.', tag: 'EMPRESA' },
  { date: 'Agosto 2025', title: 'Rodeo integra el módulo de huella de carbono MRV, permitiendo a los productores acceder al mercado de bonos de carbono.', tag: 'SOSTENIBILIDAD' },
  { date: 'Abril 2025', title: 'Rodeo lanza el Planificador Holístico con metodología Savory, el primer software de pastoreo rotativo calibrado con IA en Latinoamérica.', tag: 'PRODUCTO' },
]

const keyStats = [
  { value: '12.000+', label: 'Productores activos' },
  { value: '2.4M ha', label: 'Hectáreas gestionadas' },
  { value: '6 países', label: 'Presencia en LATAM' },
  { value: '+34%', label: 'Aumento de carga animal promedio' },
]

export default function Prensa() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 to-gray-900 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-400 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            PRENSA Y MEDIOS
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
            Recursos para periodistas y medios
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Encontrá aquí los comunicados de prensa, el kit de medios y los datos de impacto de Rodeo AgTech.
          </p>
        </div>
      </section>

      <section className="py-16 bg-green-600">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {keyStats.map((m, i) => (
              <div key={i}>
                <div className="text-2xl font-black text-white">{m.value}</div>
                <div className="text-green-200 text-xs font-medium mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <h2 className="text-2xl font-black text-gray-950 mb-8">Comunicados de prensa</h2>
              <div className="space-y-5">
                {pressReleases.map(({ date, title, tag }, i) => (
                  <div key={i} className="border border-gray-100 rounded-2xl p-5 hover:border-green-100 hover:bg-green-50/20 transition-all cursor-pointer">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-black tracking-widest text-green-600 bg-green-50 px-2 py-1 rounded-full">{tag}</span>
                      <span className="text-xs text-gray-400">{date}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 leading-relaxed">{title}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-black text-gray-950 mb-8">Kit de medios</h2>
              <div className="space-y-4">
                {[
                  { label: 'Logotipos en alta resolución (SVG, PNG)', size: '2.4 MB' },
                  { label: 'Imágenes de producto y capturas de pantalla', size: '18 MB' },
                  { label: 'Fotografías del equipo fundador', size: '8.6 MB' },
                  { label: 'Hoja de datos y métricas de impacto (PDF)', size: '1.1 MB' },
                  { label: 'Guía de estilo de marca y paleta de colores', size: '0.9 MB' },
                ].map(({ label, size }, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <Download className="w-4 h-4 text-green-600" />
                      <div>
                        <div className="text-sm font-medium text-gray-800">{label}</div>
                        <div className="text-xs text-gray-400">{size}</div>
                      </div>
                    </div>
                    <button className="text-xs font-bold text-green-600 hover:text-green-700">
                      Descargar
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-10 bg-gray-950 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-2">Contacto de prensa</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  Para entrevistas, información adicional o datos de impacto específicos,
                  contactate directamente con nuestro equipo.
                </p>
                <a href={`mailto:${process.env.NEXT_PUBLIC_PRESS_EMAIL || 'prensa@rodeoagtech.com'}`}
                  className="inline-flex items-center gap-2 text-green-400 text-sm font-bold hover:text-green-300">
                  <Mail className="w-4 h-4" />
                  {process.env.NEXT_PUBLIC_PRESS_EMAIL || 'prensa@rodeoagtech.com'}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
