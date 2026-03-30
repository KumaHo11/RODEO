'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Map, Beef, Leaf, CalendarDays, Mic, Target, TrendingUp, Sprout,
  ArrowRight, Check, X, ChevronDown, Building2, CheckCircle2,
  Camera, WifiOff, Brain, BarChart3, Zap, Shield,
} from 'lucide-react'
import RodeoLogo from '@/components/RodeoLogo'

function useCounter(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); observer.disconnect() }
    }, { threshold })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, inView }
}

function StatsSection() {
  const { ref, inView } = useInView()
  const hectares = useCounter(2400000, 2200, inView)
  const ranchers = useCounter(12000, 2000, inView)
  const countries = useCounter(8, 1200, inView)
  const efficiency = useCounter(34, 1800, inView)
  return (
    <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-8">
      {[
        { value: hectares, suffix: 'M', prefix: '', label: 'Hectáreas gestionadas' },
        { value: ranchers, suffix: '+', prefix: '', label: 'Productores activos' },
        { value: countries, suffix: '', prefix: '', label: 'Países en LATAM' },
        { value: efficiency, suffix: '%', prefix: '+', label: 'Aumento de carga animal promedio' },
      ].map((stat, i) => (
        <div key={i} className="text-center">
          <div className="text-4xl lg:text-5xl font-black text-white mb-1">
            {stat.prefix}{stat.value.toLocaleString()}{stat.suffix}
          </div>
          <div className="text-sm text-green-200 font-medium">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
      {children}
    </div>
  )
}

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activePlan, setActivePlan] = useState<'monthly' | 'annual'>('annual')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setActiveFeature(f => (f + 1) % features.length), 4500)
    return () => clearInterval(t)
  }, [])

  const features = [
    {
      Icon: Camera,
      tag: 'NUEVO · IA',
      title: 'IA Ganadera — Materia Seca por Foto',
      subtitle: 'Del ojo del ganadero al análisis científico',
      description: 'Fotografiá cualquier potrero con tu celular y nuestro motor de IA Gemini estimará en segundos los kg de Materia Seca disponible por hectárea. Calibrado con índices NDVI satelitales para máxima precisión.',
      stats: [{ label: 'Resultado', value: '< 5 seg' }, { label: 'Integración', value: 'NDVI + IA' }],
      accent: 'from-emerald-600 to-green-700',
    },
    {
      Icon: Mic,
      tag: 'NUEVO · OFFLINE',
      title: 'Bitácora Multimodal Offline',
      subtitle: 'Registrá sin bajar del caballo',
      description: 'Grabá notas de voz en campo, incluso sin señal. La IA transcribe y categoriza automáticamente tus observaciones (Infraestructura, Sanidad, Plagas, Pasturas) y las asigna al potrero correspondiente. Todo se sincroniza en cuanto hay Wi-Fi o 4G.',
      stats: [{ label: 'Modo', value: '100% Offline' }, { label: 'Categorización', value: 'Automática IA' }],
      accent: 'from-green-600 to-teal-700',
    },
    {
      Icon: Map,
      tag: 'ACTUALIZADO',
      title: 'Mi Campo — Mapa Integrado',
      subtitle: 'Cartografía y potreros en un solo panel',
      description: 'Mapa satelital enmarcado con panel Master-Detail. Dibujá potreros, visualizá el semáforo de disponibilidad de pasto por color y accedé al historial de cada lote con un toque.',
      stats: [{ label: 'Precisión GPS', value: '±2 m' }, { label: 'Potreros', value: 'Ilimitados' }],
      accent: 'from-green-700 to-emerald-800',
    },
    {
      Icon: Beef,
      tag: 'CORE',
      title: 'Gestión de Hacienda',
      subtitle: 'Tu inventario al día, siempre',
      description: 'Registrá rebaños con historial completo de pesadas, pariciones, sanidad y composición corporal. El Equivalente Vaca (EV) se calcula automáticamente: la métrica que alinea tu capacidad de carga con los costos de la plataforma.',
      stats: [{ label: 'Cálculo EV', value: 'Automático' }, { label: 'Historial', value: 'Por animal' }],
      accent: 'from-emerald-700 to-green-800',
    },
    {
      Icon: CalendarDays,
      tag: 'ACTUALIZADO',
      title: 'Planificador Holístico e Insights',
      subtitle: 'Decidí con datos, no con intuición',
      description: 'Visualizá tu cronograma en Gantt anual o por temporada. Obtené recomendaciones inteligentes sobre los próximos movimientos de hacienda basadas en tu historial de materia seca, días de pastoreo y tiempos de recuperación.',
      stats: [{ label: 'Vista Gantt', value: 'Multiescala' }, { label: 'Proyección', value: '12 meses' }],
      accent: 'from-green-600 to-emerald-700',
    },
  ]

  const plans = [
    {
      name: 'Campo Libre',
      description: 'Para empezar a digitalizar tu campo',
      price: { monthly: 0, annual: 0 },
      ev: 'Hasta 50 EV',
      cta: 'Empezar gratis',
      ctaStyle: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
      popular: false,
      features: ['1 establecimiento', 'Cartografía digital básica', '1 rebaño', 'Notas de campo básicas', 'Soporte por correo'],
      missing: ['IA Materia Seca por foto', 'Bitácora de voz', 'Planificador holístico', 'Modo Offline completo', 'NDVI satelital'],
    },
    {
      name: 'Pro Ganadero',
      description: 'Para ganaderos que quieren precisión total',
      price: { monthly: 0.60, annual: 0.50 },
      ev: 'Cobro por EV/mes',
      evExample: 'Ej: 500 EV = USD 250/mes',
      cta: 'Probar 30 días gratis',
      ctaStyle: 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20',
      popular: true,
      features: [
        'Hacienda ilimitada',
        'IA Materia Seca por foto (Gemini)',
        'Integración NDVI satelital',
        'Bitácora de voz con transcripción IA',
        'Modo Offline + sincronización diferida',
        'Planificador holístico dinámico',
        'Semáforo de disponibilidad de pasto',
        'Gantt multiescala',
        'Soporte prioritario',
      ],
      missing: [],
    },
    {
      name: 'Pro Ganadero+',
      description: 'Para operaciones que escalan rápido',
      price: { monthly: 0.45, annual: 0.38 },
      ev: '+1.500 EV · Multi-estancia',
      evExample: 'Precio escala con volumen',
      cta: 'Contactar ventas',
      ctaStyle: 'border border-gray-900 text-gray-900 hover:bg-gray-950 hover:text-white',
      popular: false,
      features: [
        'Todo de Pro Ganadero',
        'Multi-rebaño y multi-estancia',
        'Reportes avanzados de producción',
        'API de integración',
        'Hasta 5 usuarios adicionales',
        'Exportación CSV/Excel',
        'SLA garantizado',
        'Soporte dedicado',
      ],
      missing: [],
    },
  ]

  const testimonials = [
    {
      quote: 'Rodeo nos permitió duplicar la carga animal en el mismo campo. El planificador holístico cambió completamente la lógica de manejo del establecimiento.',
      name: 'Jorge Pereyra',
      role: 'Productor ganadero · Tacuarembó, Uruguay',
      field: '1.800 ha · 620 EV',
    },
    {
      quote: 'La función de materia seca por foto es increíble. Antes tardaba días calculando a ojo. Ahora en 10 segundos sé exactamente cuánto pasto tengo disponible en cada potrero.',
      name: 'Marcelo Rodríguez',
      role: 'Ganadero regenerativo · Corrientes, Argentina',
      field: '920 ha · 380 EV',
    },
    {
      quote: 'Las notas de voz son un cambio de paradigma. Mis capataces registran todo desde el campo sin bajar del caballo. Cero fricción, adopción inmediata por todo el equipo.',
      name: 'Gustavo Alencar',
      role: 'Fazendeiro · Mato Grosso do Sul, Brasil',
      field: '3.200 ha · 1.400 EV',
    },
  ]

  return (
    <div className="min-h-screen bg-white">

      {/* ── NAV ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/98 backdrop-blur-xl shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
            <Link href="/landing">
              <RodeoLogo variant={scrolled ? 'light' : 'dark'} size="md" />
            </Link>
            <span className={`hidden sm:block text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest border ${
              scrolled
                ? 'text-green-600 bg-green-50 border-green-100'
                : 'text-green-300 bg-white/10 border-white/20'
            }`}>v2.0 · IA</span>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            {[
              { label: 'Producto', href: '#producto' },
              { label: 'Precios', href: '#precios' },
              { label: 'Cómo Funciona', href: '#como-funciona' },
              { label: 'Testimonios', href: '#testimonios' },
            ].map(item => (
              <a key={item.label} href={item.href}
                className={`text-sm font-medium transition-colors ${
                  scrolled ? 'text-gray-600 hover:text-gray-950' : 'text-white/80 hover:text-white'
                }`}>
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/login"
              className={`text-sm font-medium transition-colors px-4 py-2 ${
                scrolled ? 'text-gray-600 hover:text-gray-950' : 'text-white/80 hover:text-white'
              }`}>
              Iniciar sesión
            </Link>
            <Link href="/register" className="text-sm font-bold bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-green-900/20">
              Empezar gratis
            </Link>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden p-2" aria-label="Abrir menú">
            <div className={`w-5 h-0.5 mb-1 transition-all ${scrolled ? 'bg-gray-800' : 'bg-white'} ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <div className={`w-5 h-0.5 mb-1 transition-all ${scrolled ? 'bg-gray-800' : 'bg-white'} ${menuOpen ? 'opacity-0' : ''}`} />
            <div className={`w-5 h-0.5 transition-all ${scrolled ? 'bg-gray-800' : 'bg-white'} ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </button>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-1">
            {['Producto', 'Precios', 'Testimonios'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMenuOpen(false)}
                className="block text-sm font-medium text-gray-700 py-2.5 border-b border-gray-50 last:border-0">
                {item}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <Link href="/login" className="block text-center text-sm font-medium text-gray-600 py-2.5">Iniciar sesión</Link>
              <Link href="/register" className="block text-center text-sm font-bold bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl">Empezar gratis</Link>
            </div>
          </div>
        )}
      </nav>


      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-paddocks-v2.png"
            alt="Pastoreo rotativo holístico — vista aérea de potreros con hacienda"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/90 via-gray-950/65 to-gray-950/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/40 via-transparent to-transparent" />
        </div>

        {/* Live badge — hidden on mobile to avoid hero text overlap */}
        <div className="hidden md:block absolute top-24 left-6 lg:left-12 z-20">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-4 py-2 text-white text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            IA Gemini · Análisis NDVI en tiempo real
          </div>
        </div>

        {/* Offline badge — hidden on mobile */}
        <div className="hidden md:block absolute top-36 left-6 lg:left-12 z-20">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-4 py-2 text-white text-xs font-medium">
            <WifiOff className="w-3 h-3 text-green-400" />
            100% Offline · Sincronización diferida
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 sm:pt-32 md:pt-36 pb-20">
          <div className="max-w-2xl">
            <h1 className="text-5xl lg:text-[4.5rem] font-black text-white leading-[1.05] tracking-tight mb-5">
              Digitaliza tu campo.<br />
              <span className="text-green-400">Optimiza tu pastoreo</span><br />
              con Inteligencia Artificial.
            </h1>

            <p className="text-base lg:text-lg text-gray-300 leading-relaxed mb-10 max-w-lg">
              Rodeo unifica el control de hacienda, la cartografía satelital y el cálculo científico de materia seca para un manejo holístico y rentable. <strong className="text-white">Funciona 100% Offline.</strong>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Link href="/register"
                className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
                Regístrate gratis
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#producto"
                className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 text-white font-medium px-7 py-3.5 rounded-xl text-sm transition-all">
                Ver cómo funciona
                <ChevronDown className="w-4 h-4" />
              </a>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-gray-900 bg-green-700 flex items-center justify-center">
                    <span className="text-white text-[8px] font-black">{['JP', 'MR', 'GA', 'LF', 'CR'][i]}</span>
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-400">
                <span className="text-white font-bold">+12.000</span> productores ya digitalizaron su campo
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-white/40">
          <span className="text-[10px] tracking-widest font-bold">SCROLL</span>
          <div className="w-5 h-8 border border-white/20 rounded-full flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 bg-white/40 rounded-full animate-bounce" />
          </div>
        </div>
      </section>


      {/* ── STATS BAR ── */}
      <section className="bg-green-600 py-14">
        <div className="max-w-5xl mx-auto px-6">
          <StatsSection />
        </div>
      </section>


      {/* ── PROBLEMA / SOLUCIÓN ── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <SectionLabel>POR QUÉ RODEO</SectionLabel>
              <h2 className="text-4xl lg:text-5xl font-black text-gray-950 leading-tight mb-5">
                Pasá de la intuición<br />a la <span className="text-green-600">precisión</span>.
              </h2>
              <p className="text-base text-gray-600 leading-relaxed mb-4">
                Deja las planillas de Excel y las libretas de campo. Rodeo te da el control total de tu establecimiento ganadero, <strong>incluso sin señal de internet.</strong>
              </p>
              <p className="text-base text-gray-600 leading-relaxed mb-8">
                Los ganaderos más exitosos saben cuánto pasto tienen hoy, cuánto tendrán en 30 días y qué decisiones tomar ahora. Rodeo entrega esa inteligencia directamente en tu celular.
              </p>

              <div className="space-y-3">
                {[
                  { Icon: Target, title: 'Decisiones basadas en datos', desc: 'Cada movimiento de hacienda respaldado por datos reales de materia seca y NDVI, no por estimaciones.' },
                  { Icon: TrendingUp, title: 'Carga animal optimizada', desc: 'Los productores Pro aumentan su carga un 34% en promedio durante el primer año.' },
                  { Icon: Sprout, title: 'Ganadería regenerativa', desc: 'Pastoreo holístico que regenera el suelo y aumenta la rentabilidad al mismo tiempo.' },
                ].map(({ Icon, title, desc }, i) => (
                  <div key={i} className="flex items-start gap-4 bg-white rounded-2xl p-4 border border-gray-100">
                    <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm mb-0.5">{title}</div>
                      <div className="text-sm text-gray-500 leading-relaxed">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-green-900/20 ring-1 ring-green-900/10">
                <Image
                  src="/aerial-paddocks.png"
                  alt="Vista aérea de potreros en rotación holística"
                  width={700} height={700}
                  className="w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950/70 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="bg-white rounded-xl p-4 shadow-lg">
                    <div className="text-[10px] font-bold text-gray-400 tracking-widest mb-2.5">
                      SEMÁFORO DE DISPONIBILIDAD — POTRERO 4
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5 flex-shrink-0">
                        <div className="w-4 h-4 rounded-full bg-green-600" />
                        <div className="w-4 h-4 rounded-full bg-yellow-400 opacity-35" />
                        <div className="w-4 h-4 rounded-full bg-red-500 opacity-35" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-sm">2.840 kg MS/ha disponibles</div>
                        <div className="text-xs text-green-600 font-semibold flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Listo para ingresar hacienda
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 bg-gray-950 text-white rounded-xl px-4 py-3 shadow-xl">
                <div className="text-2xl font-black text-green-400">+34%</div>
                <div className="text-xs text-gray-400 font-medium leading-snug">Carga animal promedio<br />en el primer año</div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ── FEATURE SHOWCASE ── */}
      <section id="producto" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionLabel>MÓDULOS</SectionLabel>
            <h2 className="text-4xl lg:text-5xl font-black text-gray-950 mb-4">
              Todo lo que tu campo necesita,<br />en un solo lugar.
            </h2>
            <p className="text-base text-gray-500 max-w-lg mx-auto">
              Cinco módulos integrados con IA para el control total de tu operación ganadera, offline y online.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4 space-y-1.5">
              {features.map((f, i) => {
                const active = activeFeature === i
                return (
                  <button key={i} onClick={() => setActiveFeature(i)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl transition-all duration-200 ${active ? 'bg-gray-950 shadow-sm' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-green-600' : 'bg-gray-100'}`}>
                        <f.Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-sm truncate ${active ? 'text-white' : 'text-gray-900'}`}>{f.title}</div>
                        <div className={`text-xs ${active ? 'text-green-400' : 'text-gray-400'}`}>{f.tag}</div>
                      </div>
                      {active && <ArrowRight className="ml-auto w-4 h-4 text-green-400 flex-shrink-0" />}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="lg:col-span-8">
              <div className={`h-full bg-gradient-to-br ${features[activeFeature].accent} rounded-2xl p-8 lg:p-10 text-white min-h-80 flex flex-col shadow-xl`}>
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-[10px] font-black tracking-widest bg-white/15 px-3 py-1 rounded-full">
                    {features[activeFeature].tag}
                  </span>
                </div>
                <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center mb-5">
                  {(() => { const F = features[activeFeature].Icon; return <F className="w-6 h-6 text-white" /> })()}
                </div>
                <h3 className="text-2xl font-black mb-1">{features[activeFeature].title}</h3>
                <p className="text-green-200 text-sm font-medium mb-5">{features[activeFeature].subtitle}</p>
                <p className="text-white/90 text-base leading-relaxed mb-8 flex-1">
                  {features[activeFeature].description}
                </p>

                <div className="flex flex-wrap gap-3">
                  {features[activeFeature].stats.map((stat, i) => (
                    <div key={i} className="bg-white/15 rounded-xl px-4 py-2.5">
                      <div className="text-lg font-black">{stat.value}</div>
                      <div className="text-xs text-white/70 font-medium">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-1.5 mt-8">
                  {features.map((_, i) => (
                    <button key={i} onClick={() => setActiveFeature(i)}
                      className={`h-1 rounded-full transition-all duration-300 ${i === activeFeature ? 'w-8 bg-white' : 'w-4 bg-white/30'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ── OFFLINE FIRST FEATURE STRIP ── */}
      <section className="py-20 bg-gray-950 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              ARQUITECTURA TÉCNICA
            </div>
            <h2 className="text-3xl lg:text-4xl font-black mb-3">
              Diseñado para el campo real.<br />
              <span className="text-green-400">Sin señal. Sin excusas.</span>
            </h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              La conectividad en el campo es un lujo. Rodeo está diseñado con arquitectura Offline-First para que nunca pierdas un dato.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                Icon: WifiOff,
                title: 'Base de datos local',
                desc: 'Bitácora de voz, fotos de materia seca y movimientos de hacienda se guardan localmente con SQLite. Sin conexión, sin problema.',
              },
              {
                Icon: Zap,
                title: 'Cola de sincronización',
                desc: 'Al detectar Wi-Fi o 4G, Rodeo sincroniza automáticamente en segundo plano todos los datos pendientes. Cero intervención manual.',
              },
              {
                Icon: Shield,
                title: 'Datos siempre seguros',
                desc: 'Encriptación local y remota. Tus datos de campo son tuyos. Nunca se pierden, nunca se exponen.',
              },
            ].map(({ Icon, title, desc }, i) => (
              <div key={i} className="bg-white/5 border border-white/8 rounded-2xl p-6">
                <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-base font-bold mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── HOW IT WORKS ── */}
      <section id="como-funciona" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionLabel>CÓMO EMPEZAR</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-black text-gray-950 mb-3">
              De cero a digitalizado en menos de 10 minutos.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Creá tu cuenta', desc: 'Registrate gratis en menos de 2 minutos. Sin tarjeta de crédito requerida.' },
              { step: '02', title: 'Dibujá tu campo', desc: 'Trazá tus potreros sobre el mapa satelital. Rodeo calcula las hectáreas automáticamente.' },
              { step: '03', title: 'Empezá con IA', desc: 'Fotografiá el pasto, grabá notas de voz y activá el planificador holístico. Todo funciona offline.' },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-8xl font-black text-gray-100 absolute -top-6 -left-2 leading-none select-none">{item.step}</div>
                <div className="relative bg-gray-50 border border-gray-100 rounded-2xl p-6 h-full">
                  <div className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-xs font-bold text-gray-400">{item.step}</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-3 z-10 text-gray-300">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/register" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all">
              Empezar gratis ahora
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>


      {/* ── PRICING ── */}
      <section id="precios" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <SectionLabel>PRECIOS</SectionLabel>
            <h2 className="text-4xl lg:text-5xl font-black text-gray-950 mb-4">
              Simple. Justo. Escalable.
            </h2>
            <p className="text-base text-gray-500 mb-2 max-w-lg mx-auto">
              Cobramos por Equivalente Vaca (EV), no por hectárea. Si tu campo crece, Rodeo crece con vos. Un productor con 500 EV paga lo mismo en costo operativo que genera en ahorro de pasto.
            </p>
            <p className="text-sm text-green-600 font-semibold mb-8">El valor que Rodeo entrega es siempre mayor al costo.</p>

            <div className="inline-flex items-center gap-1 bg-gray-200 rounded-full p-1">
              {(['monthly', 'annual'] as const).map((period) => (
                <button key={period} onClick={() => setActivePlan(period)}
                  className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${activePlan === period ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {period === 'monthly' ? 'Mensual' : 'Anual'}
                  {period === 'annual' && <span className="ml-1.5 text-green-600 text-xs font-bold">−2 meses</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5 items-stretch">
            {plans.map((plan, i) => (
              <div key={i}
                className={`relative rounded-2xl p-7 flex flex-col transition-all ${plan.popular ? 'bg-gray-950 text-white shadow-xl ring-1 ring-green-600 md:scale-[1.02]' : 'bg-white border border-gray-200'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full tracking-widest">
                    MÁS POPULAR
                  </div>
                )}

                <div className="mb-5">
                  <div className={`text-[10px] font-black tracking-widest mb-2 ${plan.popular ? 'text-green-400' : 'text-green-600'}`}>
                    {plan.ev}
                  </div>
                  <h3 className={`text-lg font-black mb-1 ${plan.popular ? 'text-white' : 'text-gray-950'}`}>{plan.name}</h3>
                  <p className={`text-sm ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>{plan.description}</p>
                </div>

                <div className="mb-2">
                  <div className={`font-black ${plan.popular ? 'text-white' : 'text-gray-950'}`}>
                    {plan.price[activePlan] === 0 ? (
                      <span className="text-4xl">Gratis</span>
                    ) : (
                      <>
                        <span className="text-4xl">
                          <span className="text-lg font-bold mr-1">USD</span>
                          {plan.price[activePlan].toFixed(2)}
                        </span>
                        <span className={`text-base font-medium ml-1 ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>/EV/mes</span>
                      </>
                    )}
                  </div>
                  {'evExample' in plan && (
                    <div className={`text-xs mt-1 font-semibold ${plan.popular ? 'text-green-400' : 'text-green-600'}`}>
                      {plan.evExample}
                    </div>
                  )}
                </div>

                <Link href="/register"
                  className={`w-full text-center font-bold py-3 rounded-xl text-sm transition-all mb-6 mt-4 block ${plan.ctaStyle}`}>
                  {plan.cta}
                </Link>

                <div className="space-y-2 flex-1">
                  {plan.features.map((feat, j) => (
                    <div key={j} className={`flex items-start gap-2 text-sm ${plan.popular ? 'text-gray-300' : 'text-gray-600'}`}>
                      <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      {feat}
                    </div>
                  ))}
                  {plan.missing.map((feat, j) => (
                    <div key={j} className={`flex items-start gap-2 text-sm ${plan.popular ? 'text-gray-600' : 'text-gray-300'}`}>
                      <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-40" />
                      {feat}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Enterprise */}
          <div className="mt-5 bg-gray-950 rounded-2xl p-7 flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <div className="text-[10px] font-black text-green-400 tracking-widest mb-0.5">ENTERPRISE</div>
                <h3 className="text-base font-black text-white mb-0.5">Para grandes corporaciones y multi-establecimientos</h3>
                <p className="text-gray-500 text-sm">+1.500 EV · Multi-estancia · Soporte dedicado · SLA garantizado · Integraciones a medida</p>
              </div>
            </div>
            <a href="mailto:ventas@rodeoapp.io"
              className="flex-shrink-0 bg-white text-gray-950 font-bold px-6 py-2.5 rounded-xl hover:bg-gray-100 transition-colors text-sm">
              Hablar con ventas →
            </a>
          </div>
        </div>
      </section>


      {/* ── TESTIMONIALS ── */}
      <section id="testimonios" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionLabel>TESTIMONIOS</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-black text-gray-950">Lo que dicen los productores</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col">
                <div className="text-2xl text-gray-200 font-black mb-4 leading-none">"</div>
                <p className="text-gray-700 leading-relaxed flex-1 mb-5 text-sm">{t.quote}</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-black">
                      {t.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{t.name}</div>
                    <div className="text-xs text-gray-500 leading-snug">{t.role}</div>
                    <div className="text-xs text-green-600 font-bold mt-0.5">{t.field}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── AI TRUST SECTION ── */}
      <section className="py-16 bg-gray-950 text-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { Icon: Brain, label: 'Motor IA', value: 'Gemini Pro Vision', sub: 'Google Cloud · Análisis multimodal' },
              { Icon: BarChart3, label: 'Índice satelital', value: 'NDVI en tiempo real', sub: 'Calibración por imagen de potrero' },
              { Icon: Mic, label: 'Voz a texto', value: 'Cloud Speech-to-Text', sub: 'Transcripción + categorización NLP' },
            ].map(({ Icon, label, value, sub }, i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-green-600/15 rounded-full flex items-center justify-center">
                  <Icon className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-[10px] font-black tracking-widest text-gray-500">{label}</div>
                <div className="text-lg font-black text-white">{value}</div>
                <div className="text-xs text-gray-600">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── FINAL CTA ── */}
      <section className="py-24 bg-green-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute top-8 left-8 w-72 h-72 rounded-full border border-white" />
          <div className="absolute top-24 left-24 w-44 h-44 rounded-full border border-white" />
          <div className="absolute bottom-8 right-8 w-96 h-96 rounded-full border border-white" />
          <div className="absolute bottom-16 right-24 w-56 h-56 rounded-full border border-white" />
        </div>

        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-5">
            Regístrate gratis y probá<br />el Planificador Holístico.
          </h2>
          <p className="text-green-100 text-base mb-10 max-w-md mx-auto">
            Sumáte a más de 12.000 productores que ya digitalizaron su campo con Rodeo. Gratis para empezar, sin tarjeta de crédito.
          </p>

          <Link href="/register"
            className="inline-flex items-center gap-2 bg-white text-green-700 font-black px-9 py-4 rounded-xl text-base transition-all hover:bg-green-50 shadow-xl">
            Empezar gratis
            <ArrowRight className="w-4 h-4" />
          </Link>

          <p className="mt-5 text-green-200/60 text-xs font-medium">
            Sin tarjeta de crédito · Configuración en 10 min · Cancelá cuando quieras
          </p>
        </div>
      </section>


      {/* ── FOOTER ── */}
      <footer className="bg-gray-950 text-gray-500 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="text-xl font-black italic text-white tracking-tighter mb-3">RODEO</div>
              <p className="text-sm leading-relaxed text-gray-600">
                Plataforma de gestión ganadera con IA y pastoreo holístico para el productor latinoamericano.
              </p>
              <div className="flex gap-2 mt-5">
                {['Instagram', 'LinkedIn', 'YouTube'].map(s => (
                  <a key={s} href="#"
                    className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors font-medium text-gray-400 hover:text-white">
                    {s}
                  </a>
                ))}
              </div>
            </div>

            {[
              { title: 'Producto', links: ['IA Materia Seca', 'Bitácora de Voz', 'Gestión de Hacienda', 'Planificador Holístico', 'Modo Offline'] },
              { title: 'Empresa', links: ['Sobre Rodeo', 'Blog', 'Prensa', 'Casos de éxito', 'Trabajá con nosotros'] },
              { title: 'Soporte', links: ['Centro de ayuda', 'Contacto', 'Estado del servicio', 'Términos de uso', 'Privacidad'] },
            ].map((col, i) => (
              <div key={i}>
                <div className="text-[10px] font-black text-gray-400 tracking-widest mb-4">{col.title.toUpperCase()}</div>
                <div className="space-y-2.5">
                  {col.links.map(link => (
                    <a key={link} href="#" className="block text-sm text-gray-600 hover:text-gray-200 transition-colors">{link}</a>
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
