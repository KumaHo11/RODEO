import type { Metadata } from 'next'
import Link from 'next/link'
import { Camera, Brain, Satellite, Zap, CheckCircle, ArrowRight, TrendingUp, Clock, BarChart3 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'IA Materia Seca por Foto | Rodeo AgTech',
  description: 'Estimá los kg de Materia Seca disponibles por hectárea con una simple foto desde el celular. Motor de IA Gemini calibrado con índices NDVI satelitales. Resultado en menos de 5 segundos.',
  keywords: ['materia seca', 'forraje disponible', 'pasturas', 'NDVI', 'inteligencia artificial ganadera', 'estimación de pasto', 'ganadería regenerativa', 'AgTech Argentina'],
}

const benefits = [
  {
    Icon: Clock,
    title: 'Resultado en menos de 5 segundos',
    desc: 'Fotografiá el potrero y obtené los kg de MS/ha disponibles al instante. Sin laboratorio, sin planillas, sin esperas.',
  },
  {
    Icon: Satellite,
    title: 'Calibración satelital con NDVI',
    desc: 'Nuestro motor cruza la foto del potrero con el índice NDVI en tiempo real para corregir variaciones estacionales y de nubosidad.',
  },
  {
    Icon: Brain,
    title: 'Motor Gemini Pro Vision',
    desc: 'Entrenado con miles de imágenes de pasturas latinoamericanas. Reconoce pastizales naturales, praderas implantadas y coberturas mixtas.',
  },
  {
    Icon: TrendingUp,
    title: 'Historial de evolución forrajera',
    desc: 'Cada análisis queda guardado con fecha y coordenadas GPS. Visualizá cómo evoluciona la disponibilidad de pasto potrero por potrero a lo largo del año.',
  },
  {
    Icon: BarChart3,
    title: 'Carga animal automática',
    desc: 'Rodeo traduce los kg de MS al número de Equivalentes Vaca (EV) que puede soportar el lote según tus días objetivo de pastoreo.',
  },
  {
    Icon: Zap,
    title: 'Funciona offline',
    desc: 'Tomá las fotos en campo sin señal. El análisis se encola y procesa automáticamente en cuanto recuperás conectividad.',
  },
]

const useCases = [
  {
    title: 'Productores con pasturas implantadas',
    desc: 'Detectá el momento exacto de ingreso al lote basándote en datos reales, no en el ojo. Optimizá el punto de pastoreo de alfalfas, festucas y ryegrass.',
  },
  {
    title: 'Ganadería sobre campo natural',
    desc: 'El sistema reconoce la heterogeneidad de los pastizales nativos y ajusta la estimación según la composición botánica dominante.',
  },
  {
    title: 'Establecimientos con planificación holística',
    desc: 'Integrá los datos de MS directamente en el Planificador Holístico de Rodeo para calcular tus días de pastoreo y tiempos de recuperación con precisión científica.',
  },
]

export default function IaMateriaSeca() {
  return (
    <>
      <title>IA Materia Seca por Foto — Rodeo AgTech</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <Camera className="w-3.5 h-3.5" />
            MÓDULO IA · MATERIA SECA
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Sabé cuánto pasto tenés<br />
            <span className="text-green-400">con una sola foto.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            El módulo de IA Materia Seca de Rodeo analiza la imagen de tu potrero y estima en segundos
            los kilogramos de forraje disponible por hectárea. Tecnología Gemini Pro Vision integrada con
            datos satelitales NDVI para el manejo ganadero más preciso de LATAM.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              Empezar gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/landing#producto"
              className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 text-white font-medium px-7 py-3.5 rounded-xl text-sm transition-all">
              Ver todos los módulos
            </Link>
          </div>
        </div>
      </section>

      {/* METRIC STRIP */}
      <section className="bg-green-600 py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '< 5 seg', label: 'Tiempo de análisis' },
              { value: 'NDVI + IA', label: 'Calibración dual' },
              { value: '±8%', label: 'Margen de error' },
              { value: '100% Offline', label: 'Disponibilidad' },
            ].map((m, i) => (
              <div key={i}>
                <div className="text-2xl font-black text-white">{m.value}</div>
                <div className="text-green-200 text-xs font-medium mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EL PROBLEMA */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
                EL PROBLEMA
              </div>
              <h2 className="text-3xl font-black text-gray-950 mb-4">
                El "ojo del ganadero" te está costando plata.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Estimar la disponibilidad de materia seca a ojo es la decisión más crítica —y más imprecisa— del
                manejo ganadero. Ingresar hacienda antes de tiempo destruye la pastura. Ingresar tarde desperdicia
                kilos de forraje que podrían convertirse en carne o leche.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                Los ganaderos que confían en el ojo propio o en la experiencia heredada incurren en un error
                promedio del 35% en la estimación de disponibilidad forrajera, según estudios de la INTA.
                Con Rodeo, ese error cae al 8%.
              </p>
              <div className="space-y-3">
                {[
                  'Pastoreo prematuro que daña raíces y retrasa la recuperación',
                  'Sobrecarga animal en lotes con baja disponibilidad real',
                  'Subaprovechamiento del 20-30% del forraje en pasturas otoño-invernales',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Camera className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">ANÁLISIS DE POTRERO</div>
                <div className="text-4xl font-black text-gray-950 mb-1">2.840</div>
                <div className="text-sm text-gray-500 mb-4">kg de MS/ha disponibles</div>
                <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Listo para ingresar hacienda
                </div>
              </div>
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Índice NDVI</span>
                  <span className="font-bold text-gray-900">0.74 — Óptimo</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Días de pastoreo estimados</span>
                  <span className="font-bold text-gray-900">4 días (120 EV)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Tiempo de recuperación sugerido</span>
                  <span className="font-bold text-gray-900">45 días</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Análisis procesado en</span>
                  <span className="font-bold text-green-600">3.2 segundos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS GRID */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              FUNCIONALIDADES
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">
              Mucho más que una estimación de pasto.
            </h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              La IA Materia Seca es el motor central del sistema de toma de decisiones de Rodeo.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {benefits.map(({ Icon, title, desc }, i) => (
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

      {/* USE CASES */}
      <section className="py-20 bg-gray-950">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              CASOS DE USO
            </div>
            <h2 className="text-3xl font-black text-white mb-3">
              Para cada sistema productivo.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {useCases.map(({ title, desc }, i) => (
              <div key={i} className="bg-white/5 border border-white/8 rounded-2xl p-6">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-white text-xs font-black">0{i + 1}</span>
                </div>
                <h3 className="text-white font-bold mb-2 text-sm">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">
            Dejá de adivinar. Empezá a medir.
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Registrate gratis y usá el análisis de Materia Seca por foto desde el primer día.
            Sin límite de análisis en el plan Holístico. Sin tarjeta de crédito para comenzar.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            Crear cuenta gratuita
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-4 text-xs text-gray-400">
            ¿Tenés preguntas? Escribinos a{' '}
            <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}`} className="text-green-600 underline">{process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}</a>
          </p>
        </div>
      </section>
    </>
  )
}
