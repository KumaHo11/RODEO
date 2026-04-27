import type { Metadata } from 'next'
import Link from 'next/link'
import { Mic, WifiOff, ArrowRight, CheckCircle, Layers, Tag, ScanText, MapPin } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Bitácora de Voz con IA | Rodeo AgTech',
  description: 'Grabá notas de voz en campo sin internet. La IA transcribe y categoriza automáticamente tus observaciones de pasturas, sanidad, infraestructura y más. 100% offline.',
  keywords: ['bitácora de campo', 'notas de voz ganadería', 'gestión ganadera offline', 'transcripción IA', 'registro ganadero', 'planilla ganadera digital', 'AgTech Argentina Uruguay'],
}

export default function BitacoraDeVoz() {
  return (
    <>
      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-teal-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <Mic className="w-3.5 h-3.5" />
            MÓDULO BITÁCORA DE VOZ
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Registrá el campo<br />
            <span className="text-teal-400">sin bajar del caballo.</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            La Bitácora de Voz de Rodeo convierte tus observaciones de campo en registros estructurados.
            Grabá mientras recorrés el potrero; la IA transcribe, categoriza y asigna cada nota
            al lote correspondiente. Funciona sin señal, en cualquier rincón del campo.
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
              { value: '100%', label: 'Funciona offline' },
              { value: '4 cat.', label: 'Categorías IA automáticas' },
              { value: '< 3 seg', label: 'Transcripción local' },
              { value: 'Sync', label: 'Automático al recuperar señal' },
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
                El papel se moja. La memoria falla. La libreta se pierde.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                El productor ganadero promedio recorre decenas de kilómetros por semana sobre su campo.
                En ese recorrido detecta problemas de aguadas, signos de sanidad en el rodeo, daños en el
                alambrado y cambios en las pasturas. Pero cuando vuelve a la casa, ¿qué queda registrado?
                En el mejor caso, unas notas en una libreta mojada o un mensaje de WhatsApp que nadie va a encontrar.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                La información valiosa del campo se pierde antes de convertirse en decisión.
                Con la Bitácora de Voz de Rodeo, cada observación queda capturada, categorizada y
                vinculada al potrero exacto en el que fue hecha.
              </p>
            </div>

            {/* MOCK BITÁCORA */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-3">
              <div className="text-xs font-black text-gray-400 tracking-widest mb-4">NOTA DE VOZ · POTRERO 7</div>
              {[
                { icon: Tag, color: 'bg-red-50 text-red-600', cat: 'SANIDAD', note: 'Vaca N°342 con cojera leve en mano derecha. Requiere revisión mañana.' },
                { icon: Layers, color: 'bg-amber-50 text-amber-600', cat: 'INFRAESTRUCTURA', note: 'Poste caído en esquina sur del potrero. Alambrado suelto aprox. 8 metros.' },
                { icon: ScanText, color: 'bg-green-50 text-green-600', cat: 'PASTURA', note: 'Pasto a punto de pastorear en sector norte. Estimar 2.500 kg MS/ha.' },
              ].map(({ icon: Icon, color, cat, note }, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black tracking-widest text-gray-400 mb-0.5">{cat}</div>
                    <div className="text-sm text-gray-700 leading-snug">{note}</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2">
                <WifiOff className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-400">Grabado offline · Sincronizado en 14:32</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORÍAS */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              CATEGORIZACIÓN IA
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">
              La IA entiende el lenguaje del ganadero.
            </h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              Hablás naturalmente. Rodeo detecta el contexto y clasifica la observación automáticamente
              en una de las cuatro categorías operativas del establecimiento.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { color: 'bg-red-50 border-red-100 text-red-600', tag: 'SANIDAD', desc: 'Enfermedades, lesiones, partos, tratamientos, vacunaciones y signos clínicos.', Icon: Tag },
              { color: 'bg-amber-50 border-amber-100 text-amber-600', tag: 'INFRAESTRUCTURA', desc: 'Alambrados, aguadas, corrales, bebederos, comederos y callejones.', Icon: MapPin },
              { color: 'bg-green-50 border-green-100 text-green-600', tag: 'PASTURA', desc: 'Estado del pasto, disponibilidad estimada, ingreso y egreso de lotes.', Icon: Layers },
              { color: 'bg-blue-50 border-blue-100 text-blue-600', tag: 'PLAGAS', desc: 'Detección de bicho bolita, salivazo, malezas invasoras y enfermedades fúngicas.', Icon: ScanText },
            ].map(({ color, tag, desc, Icon }, i) => (
              <div key={i} className={`rounded-2xl border p-5 ${color.replace('text-', 'border-').split(' ')[1]} bg-${color.split(' ')[0].replace('bg-', '')}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-xs font-black tracking-widest text-gray-400 mb-2">{tag}</div>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              CÓMO FUNCIONA
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">
              Tres pasos. Sin fricción.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Grabás la nota', desc: 'Presionás el botón de grabación y hablás. "La vaca del lote 4 está renguiando, hay que revisarla mañana." Sin formularios, sin tipeo.' },
              { step: '02', title: 'La IA procesa', desc: 'Rodeo transcribe el audio, detecta la categoría (Sanidad), el potrero (Lote 4) y extrae la tarea pendiente. Todo en segundos, sin conexión.' },
              { step: '03', title: 'Queda registrado', desc: 'La nota aparece en la Bitácora vinculada al potrero correcto, con fecha, hora y coordenadas GPS. Accedés desde cualquier dispositivo.' },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-8xl font-black text-gray-100 absolute -top-6 -left-2 leading-none select-none">{item.step}</div>
                <div className="relative bg-white border border-gray-100 rounded-2xl p-6">
                  <div className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-xs font-bold text-gray-400">{item.step}</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">
            Tu campo merece un registro a la altura.
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            La Bitácora de Voz está disponible en todos los planes de Rodeo, incluyendo el plan gratuito.
            Empezá hoy y construí el historial de campo que tu establecimiento necesita.
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
