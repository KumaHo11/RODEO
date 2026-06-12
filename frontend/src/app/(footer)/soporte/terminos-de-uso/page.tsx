import type { Metadata } from 'next'
import Link from 'next/link'
import { queryOne } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Términos de Uso | Rodeo AgTech',
  description: 'Términos y condiciones de uso de la plataforma Rodeo AgTech. Conocé tus derechos y obligaciones como usuario de la plataforma de gestión ganadera.',
}

export default async function TerminosDeUso() {
  const activeVersion = await queryOne<{ content: string, version_number: string }>(
    `SELECT content, version_number FROM terms_and_conditions_versions WHERE is_active = true LIMIT 1`
  )

  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 to-gray-900 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-400 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            LEGAL
          </div>
          <h1 className="text-4xl font-black text-white mb-4">Términos de uso</h1>
          {activeVersion?.version_number ? (
            <p className="text-gray-400">Versión: {activeVersion.version_number}</p>
          ) : (
            <p className="text-gray-400">Última actualización: 1 de enero de 2026</p>
          )}
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 prose prose-gray max-w-none">
          {activeVersion ? (
            <div dangerouslySetInnerHTML={{ __html: activeVersion.content }} />
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-10 text-center">
              <p className="text-amber-800 text-sm leading-relaxed">
                Los términos y condiciones no están disponibles en este momento.
              </p>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mt-10">
            <p className="text-gray-600 text-sm">
              Para consultas sobre estos Términos de Uso, escribinos a{' '}
              <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}`} className="text-green-600 font-bold underline">
                {process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}
              </a>{' '}
              o visitá nuestro{' '}
              <Link href="/soporte/centro-de-ayuda" className="text-green-600 font-bold underline">
                Centro de Ayuda
              </Link>.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

