'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calculator, ArrowRight, BarChart3, TrendingUp, CheckCircle, Smartphone, Zap, CheckCircle2 } from 'lucide-react'
import { FormulasTab } from '@/app/dashboard/calculadora/components/FormulasTab'

export default function CalculadoraGanaderaLanding() {
  const [calcTab, setCalcTab] = useState<'formulas'|'proyecciones'>('formulas')

  return (
    <>
      <title>Calculadora Ganadera — Rodeo AgTech</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <Calculator className="w-3.5 h-3.5" />
            HERRAMIENTA ABIERTA · CALCULADORA GANADERA
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Proyectá tus números.<br />
            <span className="text-green-400">Sin hojas de cálculo.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Probá de forma gratuita nuestras fórmulas para calcular Equivalente Vaca, Balance Hídrico, Días de Pastoreo y más. Proyectá el impacto productivo de tu campo con nuestra herramienta integrada.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              Crear cuenta gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/landing#producto"
              className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 text-white font-medium px-7 py-3.5 rounded-xl text-sm transition-all">
              Ver otros módulos
            </Link>
          </div>
        </div>
      </section>

      {/* ── CALCULATOR INTERACTIVE SECTION ── */}
      <section id="calculadora" className="py-24 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              DEMO INTERACTIVA
            </div>
            <h2 className="text-3xl lg:text-4xl font-black text-gray-950 mb-4">Probá la Calculadora</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Experimentá de forma gratuita con las fórmulas base de Rodeo o creá tu cuenta para usar las proyecciones avanzadas.
            </p>
          </div>
          
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-center">
              <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
                <button
                  onClick={() => setCalcTab('formulas')}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${calcTab === 'formulas' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  Fórmulas
                </button>
                <button
                  onClick={() => setCalcTab('proyecciones')}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${calcTab === 'proyecciones' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  Proyecciones
                </button>
              </div>
            </div>
            
            <div className="p-6 md:p-8 bg-gray-50/30 min-h-[400px] relative">
              {calcTab === 'formulas' ? (
                <div className="max-w-3xl mx-auto">
                  <FormulasTab />
                </div>
              ) : (
                <div className="max-w-3xl mx-auto relative h-[400px] overflow-hidden rounded-2xl">
                  {/* Blurred background mockup */}
                  <div className="absolute inset-0 bg-white border border-gray-100 rounded-2xl p-8 blur-sm opacity-50 flex flex-col gap-6 pointer-events-none select-none">
                    <div className="h-8 bg-gray-100 rounded-lg w-1/3"></div>
                    <div className="h-24 bg-gray-50 rounded-xl w-full"></div>
                    <div className="flex gap-4">
                      <div className="h-20 bg-gray-50 rounded-xl w-1/2"></div>
                      <div className="h-20 bg-gray-50 rounded-xl w-1/2"></div>
                    </div>
                  </div>
                  {/* CTA Overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-10">
                    <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-md border border-gray-100">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BarChart3 className="w-6 h-6 text-green-600" />
                      </div>
                      <h3 className="text-xl font-black text-gray-900 mb-2">Proyecciones en tiempo real</h3>
                      <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                        Las proyecciones se calculan en base a los datos climáticos, satelitales (NDVI) y de stock de <strong>tu propio campo</strong>. Necesitás crear una cuenta gratuita para acceder a la herramienta completa.
                      </p>
                      <Link href="/register"
                        className="inline-flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-green-600/30">
                        Crear cuenta gratis
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS GRID */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              VENTAJAS
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">
              Por qué usar la Calculadora de Rodeo.
            </h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              Integrá tus números con el resto de tus herramientas operativas para dejar de depender de planillas de Excel aisladas.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                Icon: TrendingUp,
                title: 'Conversión Automática',
                desc: 'Calculá automáticamente la conversión de pasto en carne basándote en las estimaciones de IA y datos reales del potrero.'
              },
              {
                Icon: Zap,
                title: 'Resultados Instantáneos',
                desc: 'Modificá las variables y observá de inmediato cómo cambia tu planificación forrajera en la proyección general.'
              },
              {
                Icon: Smartphone,
                title: 'Siempre Disponible',
                desc: 'Llevá la calculadora a todas partes con acceso directo desde el celular, incluso sin señal con nuestro modo offline.'
              }
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

      {/* CTA FINAL */}
      <section className="py-20 bg-gray-950 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-black text-white mb-4">
            Mejorá tu rentabilidad ganadera.
          </h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Unite a Rodeo y comenzá a tomar decisiones precisas sobre tu carga animal y plan de pastoreo.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            Crear cuenta gratuita
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
