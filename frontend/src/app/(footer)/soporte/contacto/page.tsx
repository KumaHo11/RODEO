'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Mail, Send, CheckCircle, Loader2 } from 'lucide-react'

export default function Contacto() {
  const [form, setForm] = useState({ nombre: '', email: '', asunto: '', mensaje: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      })
      if (res.ok) {
        setStatus('success')
        setForm({ nombre: '', email: '', asunto: '', mensaje: '' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 to-gray-900 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-400 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            SOPORTE
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
            Estamos para ayudarte.
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            ¿Tenés preguntas, necesitás asistencia técnica o querés agendar una demo?
            Completá el formulario y respondemos en menos de 24 horas hábiles.
          </p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16">

            {/* FORMULARIO */}
            <div>
              <h2 className="text-2xl font-black text-gray-950 mb-8">Envianos un mensaje</h2>

              {status === 'success' ? (
                <div className="bg-green-50 border border-green-100 rounded-2xl p-8 text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-7 h-7 text-green-600" />
                  </div>
                  <h3 className="text-lg font-black text-gray-950 mb-2">Mensaje enviado</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Gracias por escribirnos. Respondemos en menos de 24 horas hábiles.
                    Revisá tu bandeja de entrada (y la carpeta de spam, por las dudas).
                  </p>
                  <button
                    onClick={() => setStatus('idle')}
                    className="mt-6 text-sm font-bold text-green-600 hover:text-green-700">
                    Enviar otro mensaje
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="nombre" className="block text-xs font-bold text-gray-700 mb-1.5 tracking-wide">
                        Nombre completo *
                      </label>
                      <input
                        id="nombre"
                        name="nombre"
                        type="text"
                        required
                        value={form.nombre}
                        onChange={handleChange}
                        placeholder="Juan Pérez"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-xs font-bold text-gray-700 mb-1.5 tracking-wide">
                        Correo electrónico *
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="juan@miestancia.com"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="asunto" className="block text-xs font-bold text-gray-700 mb-1.5 tracking-wide">
                      Motivo del contacto *
                    </label>
                    <select
                      id="asunto"
                      name="asunto"
                      required
                      value={form.asunto}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all bg-white"
                    >
                      <option value="">Seleccioná una opción</option>
                      <option value="soporte-tecnico">Soporte técnico</option>
                      <option value="consulta-planes">Consulta sobre planes y precios</option>
                      <option value="demo">Solicitar demostración</option>
                      <option value="ventas-corporativas">Ventas corporativas (Latifundio)</option>
                      <option value="prensa">Prensa y medios</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="mensaje" className="block text-xs font-bold text-gray-700 mb-1.5 tracking-wide">
                      Mensaje *
                    </label>
                    <textarea
                      id="mensaje"
                      name="mensaje"
                      required
                      rows={5}
                      value={form.mensaje}
                      onChange={handleChange}
                      placeholder="Contanos tu consulta con el mayor detalle posible para que podamos ayudarte mejor."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all resize-none"
                    />
                  </div>

                  {status === 'error' && (
                    <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      Hubo un error al enviar el mensaje. Por favor intentá nuevamente o
                      escribinos directamente a{' '}
                      <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}`} className="font-bold underline">{process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}</a>.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-all"
                  >
                    {status === 'loading' ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
                    ) : (
                      <><Send className="w-4 h-4" /> Enviar mensaje</>
                    )}
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    Al enviar este formulario aceptás nuestra{' '}
                    <Link href="/soporte/privacidad" className="text-green-600 underline">Política de Privacidad</Link>.
                  </p>
                </form>
              )}
            </div>

            {/* INFO LATERAL */}
            <div>
              <h2 className="text-2xl font-black text-gray-950 mb-8">Otras formas de contacto</h2>
              <div className="space-y-5">
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 mb-1">Soporte por correo</div>
                      <p className="text-sm text-gray-500 mb-2">Para consultas técnicas y de producto. Respondemos en menos de 24 horas hábiles.</p>
                      <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}`} className="text-sm font-bold text-green-600 hover:text-green-700">
                        {process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ArrowRight className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 mb-1">Preguntas frecuentes</div>
                      <p className="text-sm text-gray-500 mb-2">Puede que tu pregunta ya esté respondida en nuestro Centro de Ayuda.</p>
                      <Link href="/soporte/centro-de-ayuda" className="text-sm font-bold text-green-600 hover:text-green-700">
                        Ir al Centro de Ayuda →
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-950 rounded-2xl p-6">
                  <div className="text-white font-bold mb-2">¿Querés ver Rodeo en acción?</div>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">
                    Agendá una demo personalizada de 30 minutos con nuestro equipo.
                    Te mostramos cómo Rodeo puede transformar la gestión de tu establecimiento.
                  </p>
                  <Link href="/register"
                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">
                    Agendar demo gratuita
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
