import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, AlertCircle, Clock, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Estado del Servicio | Rodeo AgTech',
  description: 'Monitoreo en tiempo real de todos los servicios de Rodeo AgTech: plataforma web, sincronización offline, análisis de IA y datos satelitales NDVI.',
}

const services = [
  { name: 'Plataforma web',             status: 'operational', uptime: '99.97%' },
  { name: 'Sincronización offline',     status: 'operational', uptime: '99.95%' },
  { name: 'IA Materia Seca (Gemini)',    status: 'operational', uptime: '99.82%' },
  { name: 'Datos satelitales NDVI',     status: 'operational', uptime: '99.91%' },
  { name: 'Bitácora de Voz (STT)',      status: 'operational', uptime: '99.88%' },
  { name: 'Autenticación',              status: 'operational', uptime: '99.99%' },
  { name: 'API pública (plan Corp.)',   status: 'operational', uptime: '99.94%' },
]

const incidents = [
  {
    date: '18 abril 2026',
    title: 'Demora en análisis de IA Materia Seca',
    status: 'resolved',
    detail: 'Entre las 14:20 y las 15:45 (UTC-3) se registraron tiempos de respuesta elevados en el módulo de análisis de imágenes por sobrecarga en los servidores de Gemini Pro Vision. El servicio se restableció completamente a las 15:45. No se perdieron datos ni análisis: fueron encolados y procesados en orden una vez normalizado el sistema.',
  },
  {
    date: '3 marzo 2026',
    title: 'Actualización de infraestructura · Mantenimiento programado',
    status: 'resolved',
    detail: 'Ventana de mantenimiento programado de 2 horas (02:00 a 04:00 UTC-3). Se migró la base de datos principal a una instancia de mayor capacidad. El servicio estuvo disponible en modo solo-lectura durante la ventana.',
  },
]

export default function EstadoDelServicio() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 to-gray-900 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-400 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            ESTADO DEL SERVICIO
          </div>
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <h1 className="text-4xl lg:text-5xl font-black text-white">Todos los sistemas operativos</h1>
          </div>
          <p className="text-gray-400 text-base">
            Última verificación: hace menos de 1 minuto · 27 de abril de 2026, 09:38 ART
          </p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          {/* ESTADO ACTUAL */}
          <div className="mb-12">
            <div className="text-xs font-black text-gray-400 tracking-widest mb-5">ESTADO ACTUAL DE SERVICIOS</div>
            <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
              {services.map(({ name, status, uptime }, i) => (
                <div key={i} className={`flex items-center justify-between px-5 py-4 ${i < services.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className="flex items-center gap-3">
                    {status === 'operational'
                      ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      : <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                    <span className="text-sm text-gray-800 font-medium">{name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">Uptime 90 días: {uptime}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      status === 'operational' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {status === 'operational' ? 'Operativo' : 'Degradado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HISTORIAL DE INCIDENTES */}
          <div>
            <div className="text-xs font-black text-gray-400 tracking-widest mb-5">HISTORIAL DE INCIDENTES — ÚLTIMOS 90 DÍAS</div>
            <div className="space-y-4">
              {incidents.map(({ date, title, status, detail }, i) => (
                <div key={i} className="border border-gray-100 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">{date}</div>
                      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 flex items-center gap-1 ${
                      status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {status === 'resolved'
                        ? <><CheckCircle className="w-3 h-3" /> Resuelto</>
                        : <><Clock className="w-3 h-3" /> En curso</>}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{detail}</p>
                </div>
              ))}
              <div className="text-center py-4 text-xs text-gray-400">
                Sin más incidentes en los últimos 90 días.
              </div>
            </div>
          </div>

          {/* SUSCRIPCIÓN */}
          <div className="mt-12 bg-gray-950 rounded-2xl p-6 text-center">
            <h2 className="text-white font-bold mb-2">¿Problemas no reportados?</h2>
            <p className="text-gray-400 text-sm mb-5">
              Si detectás algún problema que no aparece en esta página, escribinos de inmediato.
            </p>
            <Link href="/soporte/contacto"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all">
              Reportar un problema
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
