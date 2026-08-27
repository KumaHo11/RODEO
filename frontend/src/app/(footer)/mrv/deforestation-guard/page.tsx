import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle, BarChart3, Antenna, Droplets, TrendingUp, Layers, Clock, ShieldCheck, AlertTriangle, Map, FileText, ClipboardCheck, Leaf, Shield, Bell, ScanLine, Footprints, WifiOff, Globe, Wind, Sprout, Building2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Deforestation Guard EUDR 2023/1115 | Rodeo AgTech',
  description: 'Un campo que deforestó post-2020 no puede vender créditos de carbono ni exportar carne a Europa.',
}

export default function Page() {
  return (
    <>
      <title>{'Deforestation Guard EUDR 2023/1115 | Rodeo AgTech'}</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <ShieldCheck className="w-3.5 h-3.5" />
            MÓDULO MRV · DEFORESTATION GUARD
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">Deforestation Guard<br /><span className="text-green-400">EUDR 2023/1115</span></h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Un campo que deforestó post-2020 no puede vender créditos de carbono ni exportar carne a Europa.
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
              { value: '31/12/2020', label: 'Fecha de corte EUDR' },
              { value: 'GFW', label: 'Global Forest Watch' },
              { value: 'Tiempo real', label: 'Alertas automáticas' },
              { value: 'EUDR 2023/1115', label: 'Norma aplicada' }
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
                Un campo que deforestó post-2020 no puede vender créditos de carbono ni exportar carne a Europa.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                La reglamentación de la Unión Europea y los estándares de carbono requieren evidencia innegable de la ausencia de deforestación desde el 31/12/2020. No cumplirlo te deja fuera de los mercados más rentables.
              </p>

              <div className="space-y-3">
                {[
                  'Pérdida de elegibilidad para mercados premium y de exportación',
                  'Riesgos de multas y bloqueos por incumplimiento normativo',
                  'Desvalorización de los productos ganaderos en la cadena de suministro'
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
                <ShieldCheck className="w-8 h-8 text-green-600" />
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
              { Icon: ShieldCheck, title: 'Verificación Global Forest Watch', desc: 'Cruzamos el polígono de cada potrero con la capa Hansen de pérdida de bosque. Resolución 30m.' },
              { Icon: AlertTriangle, title: 'Alertas en tiempo real', desc: 'Si GLAD Alerts detecta una perturbación en tu campo, recibís una notificación en 48hs.' },
              { Icon: Map, title: 'Overlay visual en el mapa', desc: 'Los potreros se colorean: verde (OK), naranja (verificar), rojo (incumplimiento EUDR). Directo en el mapa.' },
              { Icon: FileText, title: 'Declaración de debida diligencia', desc: 'Generamos automáticamente el borrador de la declaración EUDR con los datos verificados del campo.' },
              { Icon: Clock, title: 'Baseline histórico 2020', desc: 'Reconstruimos el estado del campo al 31/12/2020 usando datos de archivo. Cumplís el baseline sin datos propios previos.' },
              { Icon: TrendingUp, title: 'Score de riesgo por potrero', desc: 'Cada potrero recibe un score de 0-100 de riesgo de deforestación. Priorizá verificaciones en campo.' }
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
              { title: 'Exportación de carne a Europa', desc: 'El EUDR exige due diligence de deforestación para carne, cuero y soja. Rodeo genera el reporte automático.' },
              { title: 'Elegibilidad para créditos de carbono', desc: 'Todos los estándares de carbono (Verra, Gold Standard) exigen ausencia de deforestación post-2020. Rodeo lo certifica.' },
              { title: 'Insetting corporativo Scope 3', desc: 'Empresas que compran créditos de insetting exigen verificación EUDR del campo productor. Rodeo es el proveedor de esa verificación.' }
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
