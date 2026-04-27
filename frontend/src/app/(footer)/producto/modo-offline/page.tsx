import type { Metadata } from 'next'
import Link from 'next/link'
import { WifiOff, ArrowRight, Zap, Shield, Database, RefreshCw, Smartphone, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Modo Offline para Ganadería | Rodeo AgTech',
  description: 'Rodeo funciona 100% sin internet. Bitácora de voz, análisis de materia seca y gestión de hacienda disponibles en cualquier rincón del campo. Sincronización automática al recuperar señal.',
  keywords: ['app ganadera offline', 'software ganadero sin internet', 'gestión campo sin señal', 'app rural offline', 'sincronización de datos ganadería'],
}

export default function ModoOffline() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 via-slate-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 text-gray-300 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <WifiOff className="w-3.5 h-3.5" />
            MODO OFFLINE
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Sin señal.<br />
            <span className="text-green-400">Sin excusas.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Rodeo está diseñado con arquitectura Offline-First. Grabá notas de voz, tomá fotos de pasturas,
            registrá movimientos de hacienda y consultá el Planificador sin depender de internet.
            Todo se sincroniza solo cuando hay señal.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              Empezar gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-green-600 py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '100%', label: 'Funciones disponibles offline' },
              { value: 'SQLite', label: 'Base de datos local encriptada' },
              { value: 'Auto', label: 'Sincronización en background' },
              { value: '0', label: 'Datos perdidos desde 2022' },
            ].map((m, i) => (
              <div key={i}>
                <div className="text-2xl font-black text-white">{m.value}</div>
                <div className="text-green-200 text-xs font-medium mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              ARQUITECTURA TÉCNICA
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">
              Diseñado para la realidad del campo latinoamericano.
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              La conectividad en zonas rurales es impredecible. Rodeo no asume que tenés señal;
              asume que no la tenés y funciona igual.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { Icon: Database, title: 'Base de datos local', desc: 'Todos los datos —notas, fotos, hacienda, planificación— se almacenan en una base SQLite encriptada directamente en tu dispositivo. Sin servidor, sin latencia.' },
              { Icon: RefreshCw, title: 'Cola de sincronización', desc: 'Al detectar Wi-Fi o 4G, Rodeo identifica los cambios pendientes y los sincroniza automáticamente en segundo plano. Sin interrumpir tu trabajo.' },
              { Icon: Shield, title: 'Sin pérdida de datos', desc: 'El sistema de resolución de conflictos de Rodeo garantiza que nunca se sobreescriban datos. Cada registro tiene marca de tiempo y origen de dispositivo.' },
              { Icon: Smartphone, title: 'Funciona en cualquier celular', desc: 'No necesitás el último modelo. Rodeo está optimizado para correr con fluidez en dispositivos Android e iOS con más de 3 años de antigüedad.' },
              { Icon: Zap, title: 'Análisis offline', desc: 'El preprocesamiento de audio de la Bitácora y el almacenamiento de imágenes para IA se realizan localmente. El análisis completo se ejecuta al sincronizar.' },
              { Icon: CheckCircle, title: 'Validado en zonas críticas', desc: 'Probado en campos de Corrientes, Mato Grosso y el Chaco paraguayo con conectividad 2G intermitente. Cero pérdida de datos en 3 años de operación.' },
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

      <section className="py-20 bg-gray-950">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-white mb-3">Funciones disponibles sin internet.</h2>
            <p className="text-gray-500">Todo lo que necesitás, incluso en el kilómetro más alejado del establecimiento.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              'Bitácora de voz — grabación y almacenamiento local de audio',
              'Fotos de materia seca — captura y encolado para análisis IA',
              'Registro de hacienda — altas, bajas y movimientos de rodeo',
              'Consulta del Planificador Holístico y Gantt de pastoreo',
              'Mapa de potreros y semáforo de disponibilidad forrajera',
              'Historial de pesadas, pariciones y registros sanitarios',
              'Notas de campo con geolocalización GPS',
              'Sincronización diferida automática al recuperar señal',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/8 rounded-xl p-4">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-400">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">Tu campo nunca pierde un dato.</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            El Modo Offline está disponible en todos los planes de Rodeo, desde el plan gratuito hasta Latifundio.
            Descargá la app y empezá a registrar desde cualquier rincón del campo.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            Crear cuenta gratuita <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
