'use client'

import { useState } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react'

const faqs = [
  {
    category: 'PRIMEROS PASOS',
    items: [
      {
        q: '¿Rodeo es gratuito?',
        a: 'Sí. El plan Brote es completamente gratuito y permite gestionar hasta 20 potreros y 1 rodeo sin límite de tiempo. No requerís tarjeta de crédito para comenzar. Los planes pagos (Planificador, Holístico y Latifundio) incluyen funcionalidades avanzadas como el Planificador Holístico, IA Materia Seca y análisis NDVI satelital.',
      },
      {
        q: '¿Cuánto tiempo lleva configurar Rodeo?',
        a: 'La mayoría de los usuarios completa la configuración inicial en menos de 10 minutos. El proceso guiado de incorporación te lleva a trazar tus primeros potreros en el mapa satelital e ingresar tu primer rodeo. También podés importar datos desde una planilla Excel si ya tenés registros previos.',
      },
      {
        q: '¿Necesito conocimientos técnicos para usar Rodeo?',
        a: 'No. Rodeo está diseñado para el productor ganadero, no para el técnico de sistemas. La interfaz es intuitiva y todas las funcionalidades tienen tutoriales en video integrados. Si tenés dudas, nuestro Centro de Ayuda y el equipo de soporte están disponibles para asistirte.',
      },
      {
        q: '¿Rodeo funciona en iPhone y Android?',
        a: 'Sí. Rodeo funciona en cualquier dispositivo con navegador moderno (Chrome, Safari, Firefox). No es necesario descargar una app de la tienda. También está optimizado para uso en celulares con pantallas de 5 a 7 pulgadas, que son los más comunes en el campo.',
      },
    ],
  },
  {
    category: 'FUNCIONALIDADES',
    items: [
      {
        q: '¿Cómo funciona el análisis de Materia Seca por foto?',
        a: 'Sacás una foto del potrero desde la app. Nuestro motor de IA (Gemini Pro Vision) analiza la imagen y estima los kg de Materia Seca disponibles por hectárea. El resultado se calibra con el índice NDVI satelital del lote para maximizar la precisión. El análisis completo demora menos de 5 segundos con conexión y se encola para procesar sin señal.',
      },
      {
        q: '¿Qué pasa si no tengo señal de internet en el campo?',
        a: 'Rodeo está diseñado con arquitectura Offline-First. Todas las funciones —Bitácora de Voz, fotos de Materia Seca, registro de hacienda y consulta del Planificador— funcionan sin internet. Los datos se almacenan localmente en tu dispositivo y se sincronizan automáticamente en cuanto recuperás conectividad Wi-Fi o 4G.',
      },
      {
        q: '¿Qué es el Planificador Holístico y para qué sirve?',
        a: 'Es el módulo de planificación de pastoreo rotativo de Rodeo. Permite visualizar el plan de movimiento de hacienda en una vista Gantt anual o por temporada. Incorpora los principios de manejo holístico de Allan Savory: tiempos de recuperación adaptables, alertas de sobrepastoreo y recomendaciones de próximos movimientos basadas en tu historial de datos. Disponible en planes Planificador y superiores.',
      },
      {
        q: '¿Qué es el Equivalente Vaca (EV) y cómo se calcula?',
        a: 'El Equivalente Vaca es la unidad de referencia para comparar el requerimiento forrajero de distintas categorías de hacienda. Se toma como referencia la vaca de cría adulta con ternero al pie (= 1 EV). Rodeo calcula el EV total de tu establecimiento automáticamente a partir de la composición de categorías que ingresás, y lo contrasta con la disponibilidad forrajera estimada para alertarte sobre riesgo de sobrecarga.',
      },
      {
        q: '¿Puedo importar mis datos existentes?',
        a: 'Sí. Rodeo permite importar datos de hacienda y potreros desde archivos Excel (.xlsx y .csv). El proceso de importación incluye un mapeador de columnas que permite adaptar cualquier formato de planilla existente al modelo de datos de Rodeo. Para migraciones complejas, el equipo de soporte puede asistirte sin costo adicional.',
      },
    ],
  },
  {
    category: 'PLANES Y PRECIOS',
    items: [
      {
        q: '¿Cómo se cobra Rodeo? ¿En qué moneda?',
        a: 'Los planes pagos se cobran en dólares estadounidenses (USD). Podés elegir facturación mensual o anual; la facturación anual equivale a 10 meses de precio (2 meses de ahorro). El cobro se realiza automáticamente con tarjeta de crédito o débito internacional. En Argentina también aceptamos pagos en pesos a través de Mercado Pago.',
      },
      {
        q: '¿Puedo cambiar de plan en cualquier momento?',
        a: 'Sí. Podés hacer un upgrade de plan en cualquier momento; el costo adicional se prorratea automáticamente desde el día del cambio. Para bajar de plan, el cambio se aplica al inicio del siguiente período de facturación. No hay contratos de permanencia ni penalidades.',
      },
      {
        q: '¿Qué significa el cálculo por Equivalente Vaca en los planes?',
        a: 'Los planes Planificador y Holístico incluyen un cupo de EV incluidos en el precio base. Si tu rodeo supera ese cupo, se aplica un costo adicional por EV incremental. Este modelo permite que productores pequeños paguen menos y que los establecimientos grandes escalen sin cambiar de plan. El EV total se calcula y monitorea automáticamente en el dashboard.',
      },
      {
        q: '¿El plan gratuito tiene límite de tiempo?',
        a: 'No. El plan Brote es gratuito de forma permanente. No tiene período de prueba ni vencimiento. Las restricciones del plan gratuito son funcionales (hasta 20 potreros y 1 rodeo), no temporales. Podés usar Rodeo gratuitamente para siempre si el plan Brote cubre tus necesidades.',
      },
    ],
  },
  {
    category: 'DATOS Y PRIVACIDAD',
    items: [
      {
        q: '¿Mis datos son privados? ¿Rodeo los comparte con terceros?',
        a: 'Tus datos son tuyos. Rodeo no vende, comparte ni cede datos de usuario a terceros bajo ningún concepto. Los datos de tu establecimiento —potreros, hacienda, registros— se almacenan de forma encriptada y solo son accesibles por vos y los usuarios que vos habilitás. Consultá nuestra Política de Privacidad para el detalle técnico completo.',
      },
      {
        q: '¿Puedo exportar mis datos si decido cancelar?',
        a: 'Sí, siempre. Podés exportar todos tus datos en formato Excel (.xlsx) o JSON desde la configuración de tu cuenta. La exportación está disponible en todos los planes, incluyendo el gratuito. Nunca quedás "rehén" de la plataforma.',
      },
    ],
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-gray-900">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-green-600 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
          {a}
        </div>
      )}
    </div>
  )
}

export default function CentroDeAyuda() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 to-gray-900 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-400 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            SOPORTE
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
            Centro de ayuda
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Respuestas a las preguntas más frecuentes sobre Rodeo. ¿No encontrás lo que buscás?
            Escribinos directamente.
          </p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          {faqs.map(({ category, items }, ci) => (
            <div key={ci} className="mb-12">
              <div className="text-[10px] font-black text-gray-400 tracking-widest mb-5">{category}</div>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <FaqItem key={i} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}

          <div className="bg-gray-950 rounded-2xl p-8 text-center mt-8">
            <div className="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-6 h-6 text-green-400" />
            </div>
            <h2 className="text-xl font-black text-white mb-2">¿No encontraste tu respuesta?</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Nuestro equipo responde en menos de 24 horas hábiles. También podés
              agendar una llamada de soporte gratuita si necesitás ayuda personalizada.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/soporte/contacto"
                className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all">
                Escribir al soporte
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}`}
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-medium px-6 py-3 rounded-xl text-sm transition-all">
                {process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
