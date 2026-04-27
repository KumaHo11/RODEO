import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Clock, User, Tag } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Blog | Rodeo AgTech — Ganadería, Pastoreo y Tecnología',
  description: 'Artículos sobre ganadería regenerativa, planificación holística de pastoreo, tecnología AgTech y gestión eficiente del establecimiento ganadero.',
  keywords: ['blog ganadería', 'ganadería regenerativa blog', 'pastoreo holístico artículos', 'AgTech noticias', 'manejo de campo'],
}

const posts = [
  {
    slug: 'cuanto-pasto-tengo-hoy',
    tag: 'FORRAJE Y PASTURAS',
    title: '¿Cuánto pasto tenés hoy? La pregunta que define la rentabilidad de tu campo',
    excerpt: 'La estimación de materia seca disponible es la decisión más crítica del manejo ganadero. Descubrí por qué el "ojo del ganadero" te está costando plata y cómo la tecnología cambia el juego.',
    author: 'Equipo Rodeo',
    readTime: '8 min',
    date: '25 de abril de 2026',
  },
  {
    slug: 'ganaderia-regenerativa-que-es',
    tag: 'GANADERÍA REGENERATIVA',
    title: 'Ganadería regenerativa: cómo aumentar tu carga animal mientras regenerás el suelo',
    excerpt: 'El manejo holístico de pastoreo demuestra que la ganadería bien gestionada no solo es compatible con la recuperación ambiental, sino que puede ser su principal motor. Todo lo que necesitás saber.',
    author: 'Equipo Rodeo',
    readTime: '11 min',
    date: '18 de abril de 2026',
  },
  {
    slug: 'tecnologia-campo-sin-internet',
    tag: 'TECNOLOGÍA AGTECH',
    title: 'Tecnología para el campo real: cómo digitalizarte sin depender de internet',
    excerpt: 'El 65% del territorio ganadero latinoamericano tiene cobertura celular limitada o nula. Descubrí cómo la arquitectura Offline-First está cambiando las reglas del juego para el productor.',
    author: 'Equipo Rodeo',
    readTime: '7 min',
    date: '10 de abril de 2026',
  },
]

export default function BlogIndex() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-400 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            BLOG
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
            Ideas para el ganadero<br />
            <span className="text-green-400">que decide con datos.</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-xl mx-auto">
            Artículos sobre ganadería regenerativa, pastoreo holístico y tecnología AgTech escritos
            para el productor latinoamericano moderno.
          </p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {posts.map(({ slug, tag, title, excerpt, author, readTime, date }) => (
              <Link key={slug} href={`/blog/${slug}`}
                className="group bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden hover:border-green-100 hover:shadow-lg hover:shadow-green-900/5 transition-all">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Tag className="w-3 h-3 text-green-600" />
                    <span className="text-[10px] font-black tracking-widest text-green-600">{tag}</span>
                  </div>
                  <h2 className="text-base font-black text-gray-950 leading-snug mb-3 group-hover:text-green-700 transition-colors">
                    {title}
                  </h2>
                  <p className="text-sm text-gray-500 leading-relaxed mb-5">{excerpt}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {author}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {readTime}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-green-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{date}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-green-600">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-black text-white mb-3">Aplicá lo que aprendés, desde hoy.</h2>
          <p className="text-green-100 mb-6">
            Creá tu cuenta gratuita y empezá a gestionar tu campo con las herramientas de las que hablamos.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-green-700 font-black px-6 py-3 rounded-xl text-sm transition-all hover:bg-green-50 shadow-xl">
            Crear cuenta gratuita <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
