'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Antenna, ShieldCheck, ScanLine, Leaf } from 'lucide-react'
import Image from 'next/image'

const footerLinks = {
  Producto: [
    { label: 'IA materia seca',          href: '/producto/ia-materia-seca' },
    { label: 'Bitácora de voz',           href: '/producto/bitacora-de-voz' },
    { label: 'Gestión de hacienda',       href: '/producto/gestion-de-hacienda' },
    { label: 'Planificador holístico',    href: '/producto/planificador-holistico' },
    { label: 'Calculadora ganadera',      href: '/producto/calculadora-ganadera' },
    { label: 'Modo offline',              href: '/producto/modo-offline' },
    { label: 'MRV satelital Sentinel-2',  href: '/producto/mrv-satelital' },
    { label: 'Deforestation Guard EUDR',  href: '/producto/deforestation-guard' },
    { label: 'Compliance Dashboard',      href: '/producto/compliance' },
    { label: 'Registro RFID + animales',  href: '/producto/registro-rfid' },
    { label: 'Huella de carbono IPCC',    href: '/producto/huella-carbono' },
    { label: 'API B2B corporativa',       href: '/producto/api-b2b' },
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
  Normativas: [
    { label: 'EUDR 2023/1115',        href: '/normativas/eudr' },
    { label: 'EOV · Savory Institute', href: '/normativas/eov' },
    { label: 'GRSB Standard',         href: '/normativas/grsb' },
    { label: 'IPCC Tier 1 / AR6',     href: '/normativas/ipcc' },
    { label: 'Verra VM0026',          href: '/normativas/verra' },
    { label: 'CORSIA Fase 1',         href: '/normativas/corsia' },
  ],
  Mercado: [
    { label: 'Qué es el MRV digital',   href: '/mercado/mrv-digital' },
    { label: 'Prima del 217% por MRV',   href: '/mercado/prima-mrv' },
    { label: 'Elegibilidad CORSIA',      href: '/mercado/corsia' },
    { label: 'NBS voluntario',           href: '/mercado/nbs-voluntario' },
    { label: 'SBTi insetting Scope 3',   href: '/mercado/sbti-insetting' },
    { label: 'Mercado argentino',        href: '/mercado/argentina' },
  ],
}


function FooterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)

  // Scroll to top on every route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-[100dvh] bg-white">
      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-gray-100' : 'bg-white border-b border-gray-100'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/landing" className="flex items-center w-[259px] h-[56px] justify-start">
            <Image src="/RODEO.LogoHeader.svg" alt="RODEO" width={259} height={56} className="h-full w-full object-contain object-left" priority />
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            {[
              { label: 'Producto', href: '/landing#producto' },
              { label: 'MRV & Carbono', href: '/landing#mrv' },
              { label: 'Precios',  href: '/landing#precios' },
              { label: 'Cómo funciona', href: '/landing#como-funciona' },
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
              { label: 'MRV & Carbono', href: '/landing#mrv' },
              { label: 'Precios',  href: '/landing#precios' },
              { label: 'Cómo funciona', href: '/landing#como-funciona' },
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
            Más de 800 productores ya digitalizaron su establecimiento con Rodeo. Sin tarjeta de crédito.
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

      {/* MÓDULOS EXPLICADOS */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-5">
              MÓDULOS LATIFUNDIO
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">MRV Digital: el negocio del dato verificable</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Cada módulo resuelve un problema real del productor ganadero y abre una puerta al mercado de carbono.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                iconName: 'Antenna',
                title: 'MRV Satelital',
                href: '/mrv/satelital',
                problem: 'Sin datos, tu campo no existe para el mercado de carbono.',
                solution: 'Sentinel-2 calcula 10 índices semanales por potrero: NDVI, BSI, SOC, Humedad y más.',
                economic: 'Prima del 217% en el precio del crédito vs. campos sin MRV.',
                norma: 'EUDR · GRSB · EOV',
              },
              {
                iconName: 'ShieldCheck',
                title: 'Deforestation Guard',
                href: '/mrv/deforestation-guard',
                problem: 'Un campo deforestado post-2020 no puede vender créditos ni exportar carne a Europa.',
                solution: 'Verificación automática contra Global Forest Watch. Alerta inmediata si hay riesgo de incumplimiento EUDR.',
                economic: 'Evita multas de hasta EUR 4% de facturación bajo EUDR 2023/1115.',
                norma: 'EUDR 2023/1115',
              },
              {
                iconName: 'ScanLine',
                title: 'Registro RFID',
                href: '/mrv/registro-rfid',
                problem: 'Sin trazabilidad individual, no podés probar qué animal estuvo en qué potrero ni cuánto emitió.',
                solution: 'RFID + bitácora digital. Compatible con Gallagher HR5 y Allflex. 100% offline en el campo.',
                economic: 'Habilita insetting Scope 3: frigoríficos y exportadores pagan por la trazabilidad de tu rodeo.',
                norma: 'SBTi · GRSB',
              },
              {
                iconName: 'Leaf',
                title: 'Huella de Carbono',
                href: '/mrv/huella-carbono',
                problem: 'Sin calcular tu balance de carbono no sabés si tu campo es sumidero o emisor, ni cuánto vale.',
                solution: 'IPCC Tier 1: CH₄ entérico + N₂O estiércol vs. secuestro SOC. Balance neto en tCO₂e por potrero.',
                economic: 'Primer paso para certificar créditos bajo Verra VM0026. A 15-33 USD/t, un campo de 500 ha vale USD 4.000-18.000/año.',
                norma: 'IPCC 2006 · Verra VM0026',
              },
            ].map((item, i) => {
              const icons: Record<string, any> = { Antenna, ShieldCheck, ScanLine, Leaf }
              const Icon = icons[item.iconName]
              return (
                <Link key={i} href={item.href} className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-green-200 hover:shadow-md transition-all group">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-black text-gray-950 text-base mb-3 group-hover:text-green-700 transition-colors">{item.title}</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-[10px] font-black text-gray-400 tracking-widest mb-1">EL PROBLEMA</div>
                      <p className="text-gray-600 leading-relaxed">{item.problem}</p>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-gray-400 tracking-widest mb-1">CÓMO LO RESUELVE RODEO</div>
                      <p className="text-gray-600 leading-relaxed">{item.solution}</p>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-gray-400 tracking-widest mb-1">VALOR ECONÓMICO</div>
                      <p className="font-bold text-green-700 leading-relaxed">{item.economic}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <span className="text-[9px] font-black text-gray-400 tracking-wider">{item.norma}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-950 text-gray-500 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-8 mb-12">
            <div className="lg:col-span-1">
              <div className="mb-6">
                <img src="/RODEO.LogoHeaderBlanco.svg" alt="Rodeo" className="h-6 w-auto" />
              </div>
              <p className="text-sm leading-relaxed text-gray-600">
                Plataforma MRV ganadera con IA y pastoreo holístico. Monitoreo satelital, registro RFID, compliance EUDR y huella de carbono para el productor latinoamericano.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {['EUDR', 'EOV', 'GRSB', 'IPCC Tier 1'].map(n => (
                  <span key={n} className="text-[9px] font-black text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full tracking-wider">{n}</span>
                ))}
              </div>
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
