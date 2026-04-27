import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, Clock, User, Tag, WifiOff, Smartphone, Database, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Tecnología para el Campo Real: Cómo Digitalizarte sin Depender de Internet | Blog Rodeo',
  description: 'El 65% del territorio ganadero de LATAM tiene conectividad limitada. La arquitectura Offline-First permite digitalizar tu campo independientemente de la señal.',
  keywords: ['app ganadera sin internet', 'digitalización campo rural', 'tecnología agro offline', 'software campo sin señal', 'AgTech zonas rurales', 'conectividad rural Argentina'],
}

export default function BlogPost3() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 via-slate-950 to-gray-950 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al blog
          </Link>
          <div className="flex items-center gap-2 mb-5">
            <Tag className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-black tracking-widest text-green-400">TECNOLOGÍA AGTECH</span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-black text-white leading-tight mb-6">
            Tecnología para el campo real: cómo digitalizarte sin depender de internet
          </h1>
          <div className="flex items-center gap-4 text-gray-400 text-sm">
            <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Equipo Rodeo</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 7 min de lectura</div>
            <span>10 de abril de 2026</span>
          </div>
        </div>
      </section>

      <article className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6">

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mb-10">
            <p className="text-gray-700 text-base italic leading-relaxed">
              "La app no me sirve porque en el campo no tengo señal." Es la objeción más común al hablar
              de digitalización ganadera en LATAM. Y es completamente válida. Salvo que la solución ya existe
              y se llama arquitectura Offline-First.
            </p>
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">El problema real de la conectividad rural</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Según el informe de la Unión Internacional de Telecomunicaciones (UIT) de 2025, el 65%
            del territorio rural de América Latina tiene cobertura celular 4G limitada o inexistente.
            En zonas ganaderas específicas de Argentina (Chaco, Formosa, norte de Corrientes), Uruguay
            (Tacuarembó, Rivera, Artigas) y Brasil (norte de Mato Grosso), la situación es aún más crítica.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Este dato no es una crítica a las empresas de telecomunicaciones. Es simplemente la realidad
            física: cubrir con infraestructura de red decenas de millones de hectáreas con baja densidad
            poblacional no es económicamente viable en el corto plazo.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            Lo que sí es económicamente viable —y técnicamente posible hoy— es diseñar aplicaciones que
            funcionen correctamente en esas condiciones. Ese diseño se llama Offline-First.
          </p>

          <h2 className="text-2xl font-black text-gray-950 mb-4">¿Qué significa Offline-First y por qué importa?</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            La mayoría de las aplicaciones digitales están diseñadas con un supuesto tácito: el usuario
            siempre tiene conexión a internet. Cuando ese supuesto falla, la app falla. Los datos no se
            guardan, las funciones no responden, el usuario pierde lo que estaba haciendo.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Una aplicación Offline-First invierte ese supuesto: asume que el usuario <em>no</em> tiene
            conexión y diseña el sistema para funcionar correctamente en ese estado. La conexión, cuando
            está disponible, se utiliza para sincronizar; pero nunca es un requisito para operar.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <div className="text-xs font-black text-red-600 tracking-widest mb-3">APP TRADICIONAL</div>
              <ul className="space-y-2">
                {[
                  'Requiere conexión para guardar datos',
                  'Sin señal = sin funciones',
                  'Los cambios offline se pierden',
                  'Dependés del proveedor de internet',
                ].map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-5">
              <div className="text-xs font-black text-green-600 tracking-widest mb-3">ARQUITECTURA OFFLINE-FIRST</div>
              <ul className="space-y-2">
                {[
                  'Los datos se guardan localmente primero',
                  'Todas las funciones disponibles sin señal',
                  'Sincronización automática al recuperar conexión',
                  'Nunca perdés un registro',
                ].map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA 1 */}
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6 my-8 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div>
              <p className="font-bold text-gray-900 mb-1">Rodeo funciona 100% offline</p>
              <p className="text-sm text-gray-600">Probalo gratis en cualquier zona del campo, con o sin señal.</p>
            </div>
            <Link href="/register" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all whitespace-nowrap flex-shrink-0">
              Crear cuenta gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">Cómo funciona la arquitectura offline de Rodeo</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            La implementación técnica del Modo Offline de Rodeo tiene tres componentes clave:
          </p>
          <div className="space-y-5 mb-10">
            {[
              {
                Icon: Database,
                title: 'Base de datos local encriptada',
                desc: 'Todos los datos —notas, hacienda, potreros, imágenes, audio— se almacenan en una base de datos SQLite encriptada directamente en el dispositivo del usuario. Esto garantiza velocidad, privacidad y funcionamiento sin red.',
              },
              {
                Icon: WifiOff,
                title: 'Cola de sincronización inteligente',
                desc: 'Cada cambio realizado en modo offline se registra en una cola priorizada. Al detectar conectividad (Wi-Fi o 4G), el sistema sincroniza automáticamente en segundo plano, de menor a mayor prioridad, sin interrumpir el trabajo del usuario.',
              },
              {
                Icon: Zap,
                title: 'Resolución de conflictos',
                desc: 'Si el mismo registro fue modificado en dos dispositivos distintos sin conexión simultánea, el sistema resuelve el conflicto automáticamente usando marcas de tiempo y reglas de negocio predefinidas. Nunca se pierde información.',
              },
              {
                Icon: Smartphone,
                title: 'Preprocesamiento local',
                desc: 'El audio de la Bitácora de Voz se comprime localmente antes de sincronizar. Las imágenes de materia seca se redimensionan y etiquetan con GPS en el dispositivo. El análisis de IA se encola y procesa al sincronizar.',
              },
            ].map(({ Icon, title, desc }, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1 text-sm">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">Qué funciona sin internet en Rodeo</h2>
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6 mb-10">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                'Bitácora de Voz: grabación, almacenamiento local',
                'Fotos de Materia Seca: captura y encolado para IA',
                'Registro de hacienda: altas, bajas, movimientos',
                'Consulta del Planificador Holístico y Gantt',
                'Mapa de potreros y semáforo de pasto',
                'Historial de pesadas y registros sanitarios',
                'Notas de campo con coordenadas GPS',
                'Exportación local de datos en cualquier momento',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <h2 className="text-2xl font-black text-gray-950 mb-4">La digitalización no es un lujo. Es una ventaja competitiva.</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Los productores que ya digitalizaron su campo toman decisiones más rápidas, más informadas
            y más rentables. El gap entre el ganadero digitalizado y el ganadero tradicional se está
            ampliando a un ritmo que no tiene precedente en la historia del sector.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            La falta de internet ya no es una excusa válida para no digitalizarse. La tecnología Offline-First
            existe, funciona y está disponible en Rodeo desde el plan gratuito.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            La pregunta ya no es "¿puedo digitalizar mi campo?" sino "¿cuánto me está costando no hacerlo?"
          </p>

          {/* CTA FINAL */}
          <div className="bg-gray-950 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <WifiOff className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-3">
              Sin señal. Sin excusas. Empezá hoy.
            </h3>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              Descargá Rodeo, creá tu cuenta gratis y empezá a registrar desde cualquier potrero.
              Sin importar si tenés una barra de señal o ninguna.
            </p>
            <Link href="/register" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black px-7 py-3.5 rounded-xl transition-all shadow-xl">
              Crear cuenta gratuita <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-10 pt-8 border-t border-gray-100">
            <Link href="/blog" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Volver al blog
            </Link>
          </div>
        </div>
      </article>
    </>
  )
}
