import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle, BarChart3, Antenna, Droplets, TrendingUp, Layers, Clock, ShieldCheck, AlertTriangle, Map, FileText, ClipboardCheck, Leaf, Shield, Bell, ScanLine, Footprints, WifiOff, Globe, Wind, Sprout, Building2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'MRV Satelital — 10 índices Sentinel-2 | Rodeo AgTech',
  description: 'Sin MRV digital, la única forma de verificar el estado de un campo es mandar un auditor físico cada año. Eso cuesta entre USD 15.000 y USD 50.000 por verificación. Rodeo automatiza ese proceso por potrero, por semana, sin visitas físicas.',
}

export default function Page() {
  return (
    <>
      <title>{'MRV Satelital — 10 índices Sentinel-2 | Rodeo AgTech'}</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <Antenna className="w-3.5 h-3.5" />
            MÓDULO MRV · SATELITAL
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">10 índices Sentinel-2.<br /><span className="text-green-400">Time Machine desde 2020.</span></h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Sin MRV digital, la única forma de verificar el estado de un campo es mandar un auditor físico cada año. Eso cuesta entre USD 15.000 y USD 50.000 por verificación. Rodeo automatiza ese proceso por potrero, por semana, sin visitas físicas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              Crear cuenta gratuita
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/landing#mrv"
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
              { value: '10 índices', label: 'Sentinel-2 + SAR' },
              { value: 'Semanal', label: 'Actualización' },
              { value: '10m', label: 'Resolución espacial' },
              { value: 'Desde 2020', label: 'Time Machine' }
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
                Sin datos satelitales, tu campo no existe para el mercado de carbono.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Sin MRV digital, la única forma de verificar el estado de un campo es mandar un auditor físico cada año. Eso cuesta entre USD 15.000 y USD 50.000 por verificación. Rodeo automatiza ese proceso por potrero, por semana, sin visitas físicas.
              </p>

              <div className="space-y-3">
                {[
                  'Auditorías físicas anuales a USD 15k-50k por campo',
                  'Sin datos históricos para baseline EUDR (2020)',
                  'Imposibilidad de escalar la certificación a múltiples lotes'
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Antenna className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">VERIFICADO</div>
              <div className="text-4xl font-black text-gray-950 mb-1">RODEO</div>
              <div className="text-sm text-gray-500 mb-4">Infraestructura Digital</div>
              <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
                Auditable e Inmutable
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
              BENEFICIOS
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">
              Herramientas de Precisión.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { Icon: BarChart3, title: 'NDVI — Verdor y biomasa', desc: 'Índice de Vegetación de Diferencia Normalizada. Mide la densidad y salud del pasto por potrero.' },
              { Icon: Antenna, title: 'BSI — Suelo desnudo', desc: 'Bare Soil Index: detecta degradación, erosión y compactación. Alerta si supera el umbral EUDR.' },
              { Icon: Droplets, title: 'NDMI — Humedad foliar', desc: 'Normalized Difference Moisture Index: indica estrés hídrico de las pasturas.' },
              { Icon: TrendingUp, title: 'fCover — Cobertura verde', desc: 'Fracción de cobertura vegetal verde: clave para calcular el balance de carbono.' },
              { Icon: Layers, title: 'SAR Sentinel-1 — Humedad de suelo', desc: 'Radar de apertura sintética: penetra nubes. Humedad de suelo incluso en días cubiertos.' },
              { Icon: Clock, title: 'Time Machine 2020→hoy', desc: 'Backfill histórico mensual desde la línea de base EUDR (31/12/2020). Verificación retroactiva.' }
            ].map(({ Icon, title, desc }, i) => (
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
      <section className="py-20 bg-gray-900">
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
            {[
              { title: 'Verificación EUDR', desc: 'El baseline de 2020 es obligatorio para exportar carne a Europa desde 2025. Rodeo construye ese baseline automáticamente.' },
              { title: 'Certificación de carbono', desc: 'Verra VM0026 requiere datos satelitales para calcular el SOC adicional. Los 10 índices de Rodeo son la fuente de datos.' },
              { title: 'Monitoreo de manejo regenerativo', desc: 'Seguí semana a semana si tus cambios de manejo están regenerando el suelo o solo manteniendo el statu quo.' }
            ].map(({ title, desc }, i) => (
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
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">
            Empezá a medir.
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Sumate a la plataforma AgTech de referencia.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            Crear cuenta gratuita
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/landing#mrv"
            className="mt-4 inline-block text-gray-500 hover:text-green-600 font-medium ml-4 transition-all text-base">
            Ver todos los módulos
          </Link>
        </div>
      </section>
    </>
  )
}
