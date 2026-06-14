'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'

const footerLinks = {
  Producto: [
    { label: 'IA Materia Seca',       href: '/producto/ia-materia-seca' },
    { label: 'Bitácora de Voz',        href: '/producto/bitacora-de-voz' },
    { label: 'Gestión de Hacienda',    href: '/producto/gestion-de-hacienda' },
    { label: 'Planificador Holístico', href: '/producto/planificador-holistico' },
    { label: 'Modo Offline',           href: '/producto/modo-offline' },
  ],
  Empresa: [
    { label: 'Sobre Rodeo',     href: '/empresa/sobre-rodeo' },
    { label: 'Blog',            href: '/blog' },
    { label: 'Prensa',          href: '/empresa/prensa' },
    { label: 'Casos de éxito',  href: '/empresa/casos-de-exito' },
  ],
  Soporte: [
    { label: 'Centro de ayuda',    href: '/soporte/centro-de-ayuda' },
    { label: 'Contacto',           href: '/soporte/contacto' },
    { label: 'Estado del servicio',href: '/soporte/estado-del-servicio' },
  ],
}

function FooterLayout({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-[100dvh] bg-white">
      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/98 backdrop-blur-xl shadow-sm border-b border-gray-100' : 'bg-white border-b border-gray-100'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/landing" className="flex items-center w-[259px] h-[56px] justify-start">
            <Image src="/LogoHeaderVerde.svg" alt="RODEO" width={259} height={56} className="h-full w-full object-contain object-left" priority />
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            {[
              { label: 'Producto', href: '/landing#producto' },
              { label: 'Precios',  href: '/landing#precios' },
              { label: 'Cómo Funciona', href: '/landing#como-funciona' },
              { label: 'Testimonios', href: '/landing#testimonios' },
            ].map(item => (
              <Link key={item.label} href={item.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-950 transition-colors">
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-950 transition-colors px-4 py-2">
              Iniciar sesión
            </Link>
            <Link href="/register"
              className="text-sm font-bold bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-green-900/20 flex items-center gap-2">
              Empezar gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden p-2" aria-label="Abrir menú">
            <div className={`w-5 h-0.5 mb-1 bg-gray-800 transition-all ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <div className={`w-5 h-0.5 mb-1 bg-gray-800 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
            <div className={`w-5 h-0.5 bg-gray-800 transition-all ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </button>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-1">
            {[
              { label: 'Producto', href: '/landing#producto' },
              { label: 'Precios',  href: '/landing#precios' },
              { label: 'Cómo Funciona', href: '/landing#como-funciona' },
              { label: 'Testimonios', href: '/landing#testimonios' },
            ].map(item => (
              <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)}
                className="block text-sm font-medium text-gray-700 py-2.5 border-b border-gray-50 last:border-0">
                {item.label}
              </Link>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <Link href="/login" className="block text-center text-sm font-medium text-gray-600 py-2.5">Iniciar sesión</Link>
              <Link href="/register" className="block text-center text-sm font-bold bg-green-600 text-white px-5 py-3 rounded-xl">Empezar gratis</Link>
            </div>
          </div>
        )}
      </nav>

      {/* CONTENT */}
      <main className="pt-20">
        {children}
      </main>

      {/* FOOTER CTA STRIP */}
      <section className="py-16 bg-green-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute top-8 left-8 w-72 h-72 rounded-full border border-white" />
          <div className="absolute bottom-8 right-8 w-96 h-96 rounded-full border border-white" />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-4">
            Empezá a gestionar tu campo con IA. Gratis.
          </h2>
          <p className="text-green-100 text-base mb-8 max-w-md mx-auto">
            Más de 12.000 productores ya digitalizaron su establecimiento con Rodeo. Sin tarjeta de crédito.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-white text-green-700 font-black px-8 py-3.5 rounded-xl text-base transition-all hover:bg-green-50 shadow-xl">
            Crear cuenta gratuita
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-4 text-green-200/60 text-xs font-medium">
            Sin tarjeta de crédito · Configuración en 10 min · Cancelá cuando quieras
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-950 text-gray-500 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="mb-6">
                <img src="/LogoHeaderBlanco.svg" alt="Rodeo" className="h-6 w-auto" />
              </div>
              <p className="text-sm leading-relaxed text-gray-600">
                Plataforma de gestión ganadera con IA y pastoreo holístico para el productor latinoamericano.
              </p>
            </div>

            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <div className="text-[10px] font-black text-gray-400 tracking-widest mb-4">{title.toUpperCase()}</div>
                <div className="space-y-2.5">
                  {links.map(link => (
                    <Link key={link.href} href={link.href}
                      className="block text-sm text-gray-600 hover:text-gray-200 transition-colors">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700">© 2026 Rodeo AgTech. Hecho en Argentina para toda LATAM.</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-gray-700">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Todos los sistemas operativos
              </div>
              <div className="text-xs text-gray-700 tracking-wider">ARG · URU · BRA · PAR · COL · CHI</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default FooterLayout
