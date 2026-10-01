'use client'

import Link from 'next/link'
import { ArrowRight, Mail, MessageSquare } from 'lucide-react'

const MAILTO = "/soporte/contacto?asunto=otro&modo=cuenta&mensaje=Hola%2C%20me%20gustar%C3%ADa%20darme%20de%20alta%20para%20tener%20mi%20cuenta%20gratuita%20dentro%20de%20Rodeo."

export default function RegisterPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row bg-white font-sans text-gray-900">

      {/* Visual Side */}
      <div className="hidden lg:flex lg:w-1/2 bg-green-700 items-center justify-center overflow-hidden shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)] relative">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative z-10 w-4/5 flex items-center justify-center px-[10%]">
          <img
            src="/logos/logo-blanco.svg"
            alt="RODEO"
            className="w-full h-auto object-contain"
          />
        </div>
      </div>

      {/* Content Side */}
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-8">
        <div className="w-full max-w-sm mx-auto">

          {/* Logo (mobile only) */}
          <div className="flex lg:hidden justify-center mb-10">
            <img src="/logos/logo-verde.svg" alt="RODEO" className="h-8 w-auto" />
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-green-600" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black tracking-tight text-gray-950 mb-3">
              Registro con atención personalizada
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              El registro automatizado está temporalmente deshabilitado.<br />
              Para crear tu cuenta en RODEO, escribinos directamente y te configuramos todo en menos de 24 hs.
            </p>
          </div>

          {/* CTA Card */}
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                <Mail className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="font-black text-gray-900 text-sm mb-0.5">josorio@rodeoagtech.com</div>
                <div className="text-xs text-gray-500">Respondemos en menos de 24 hs hábiles</div>
              </div>
            </div>
            <a
              href={MAILTO}
              className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-black text-sm transition-all shadow-lg shadow-green-600/20"
            >
              Solicitar mi cuenta
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* What to include */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-8">
            <div className="text-[10px] font-black text-gray-400 tracking-widest mb-3">QUÉ INCLUIR EN TU CORREO</div>
            <ul className="space-y-2">
              {[
                'Tu nombre y establecimiento',
                'País y provincia / estado',
                'Cantidad aproximada de hectáreas',
                'Cantidad de EV (Equivalente Vaca)',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Back to login */}
          <p className="text-center text-xs text-gray-400 font-medium">
            ¿Ya tenés una cuenta?{' '}
            <Link href="/login" className="text-green-600 font-bold hover:underline">
              Iniciar sesión
            </Link>
          </p>

        </div>
      </div>

    </div>
  )
}
