import type { Metadata } from 'next'
import Link from 'next/link'
import { Globe, FileText, Shield, Building2, TrendingUp, Zap, ArrowRight, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'API B2B v2 + Marketplace de Datos | Rodeo AgTech',
  description: 'API B2B que convierte tus datos en activos negociables. Endpoints autenticados SHA256, CORS habilitado y OpenAPI spec pública.',
}

const benefits = [
  {
    Icon: Globe,
    title: 'Endpoints autenticados SHA256',
    desc: 'Cada clave API usa firma SHA256. Log de todas las llamadas en el Audit Log del admin.',
  },
  {
    Icon: FileText,
    title: 'OpenAPI spec pública',
    desc: 'Documentación completa de todos los endpoints. Integrá con tu ERP, balanza o sistema contable.',
  },
  {
    Icon: Shield,
    title: 'Control de permisos por recurso',
    desc: 'Otorgá acceso solo a los datos que querés compartir. Revocación instantánea.',
  },
  {
    Icon: Building2,
    title: 'Marketplace de datos satelitales',
    desc: 'Dales acceso a certificadoras Verra o Gold Standard para descargar tus índices Sentinel-2 verificados.',
  },
  {
    Icon: TrendingUp,
    title: 'Webhooks de alertas',
    desc: 'Recibí notificaciones automáticas en tu sistema cuando un índice cae fuera del rango o hay una alerta EUDR.',
  },
  {
    Icon: Zap,
    title: 'Rate limiting inteligente',
    desc: 'Límites por plan. Plan LATIFUNDIO incluye 10.000 requests/mes y acceso al Marketplace.',
  },
]

const useCases = [
  {
    title: 'Integración con ERP ganadero',
    desc: 'Sincronizá animales, potreros y métricas directamente con tu sistema de gestión empresarial.',
  },
  {
    title: 'Certificación Verra remota',
    desc: 'La certificadora accede a tus datos satelitales directamente sin intermediarios. Proceso de verificación 100% digital.',
  },
  {
    title: 'Insetting corporativo automatizado',
    desc: 'Tu comprador corporativo recibe los datos de huella de carbono de tu rodeo directamente en su sistema de reporte Scope 3.',
  },
]

export default function ApiB2bPage() {
  return (
    <>
      <title>API B2B v2 + Marketplace de Datos | Rodeo AgTech</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <Globe className="w-3.5 h-3.5" />
            MÓDULO MRV · API B2B
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            API B2B que convierte tus datos<br />
            <span className="text-green-400">en activos negociables.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Sin API, tus datos de campo quedan encerrados en la plataforma. Certificadoras, compradores y auditores necesitan acceso programático para verificar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              Empezar gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* METRIC STRIP */}
      <section className="bg-green-600 py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: 'SHA256', label: 'Autenticación' },
              { value: 'CORS', label: 'Habilitado' },
              { value: 'OpenAPI', label: 'Spec pública' },
              { value: 'Marketplace', label: 'Control de acceso' },
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
                Tus datos no valen nada si no podés compartirlos.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                La trazabilidad y la huella de carbono son activos valiosos, pero solo si podés integrarlos fluidamente con los sistemas de tus compradores, certificadoras y auditores.
              </p>
              <div className="space-y-3 mt-6">
                {[
                  'Certificaciones trabadas por intercambio manual de datos',
                  'Doble carga de información en sistemas propios y externos',
                  'Incapacidad de monetizar la trazabilidad en mercados premium',
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
                  <Globe className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">INTEGRACIÓN B2B</div>
                <div className="text-4xl font-black text-gray-950 mb-1">100%</div>
                <div className="text-sm text-gray-500 mb-4">Conectividad API</div>
                <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Listo para integrar
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
              Infraestructura para el mercado de carbono.
            </h2>
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
      <section className="py-20 bg-gray-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-400 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
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
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">
            Construí sobre nuestra API.
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Registrate gratis y empezá a interactuar con nuestra plataforma de forma programática.
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
