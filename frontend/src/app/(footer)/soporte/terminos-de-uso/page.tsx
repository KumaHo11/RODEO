import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Términos de Uso | Rodeo AgTech',
  description: 'Términos y condiciones de uso de la plataforma Rodeo AgTech. Conocé tus derechos y obligaciones como usuario de la plataforma de gestión ganadera.',
}

export default function TerminosDeUso() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 to-gray-900 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-400 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            LEGAL
          </div>
          <h1 className="text-4xl font-black text-white mb-4">Términos de uso</h1>
          <p className="text-gray-400">Última actualización: 1 de enero de 2026</p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 prose prose-gray max-w-none">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-10">
            <p className="text-amber-800 text-sm leading-relaxed">
              <strong>Resumen ejecutivo:</strong> Rodeo AgTech te brinda acceso a su plataforma de gestión ganadera.
              Tus datos son siempre tuyos y podés exportarlos en cualquier momento. No revendemos tus datos a terceros.
              Podés cancelar tu suscripción cuando quieras, sin penalidades. Para el detalle legal completo, leé los
              términos a continuación.
            </p>
          </div>

          {[
            {
              title: '1. Aceptación de los términos',
              content: `Al acceder y utilizar la plataforma Rodeo AgTech (en adelante, "la Plataforma"), ya sea a través de la aplicación web, la API o cualquier otro medio, aceptás íntegramente los presentes Términos de Uso. Si no estás de acuerdo con alguna de las disposiciones aquí establecidas, debés abstenerte de utilizar la Plataforma.

Rodeo AgTech S.A.S. (CUIT 30-XXXXXXXX-X), con domicilio en la Ciudad Autónoma de Buenos Aires, Argentina (en adelante, "Rodeo" o "la Empresa"), es la titular y responsable de la Plataforma.`,
            },
            {
              title: '2. Descripción del servicio',
              content: `Rodeo es una plataforma de software como servicio (SaaS) orientada a la gestión de establecimientos ganaderos. Los servicios incluyen, pero no se limitan a: cartografía digital de potreros, gestión de hacienda, planificación de pastoreo rotativo, análisis de materia seca mediante inteligencia artificial, bitácora de voz con transcripción automática y reportes de gestión.

La disponibilidad de cada funcionalidad depende del plan de suscripción contratado, tal como se detalla en la página de precios de la Plataforma.`,
            },
            {
              title: '3. Registro y cuenta de usuario',
              content: `Para acceder a la Plataforma es necesario crear una cuenta de usuario. Al registrarte, declarás que la información proporcionada es veraz, exacta y actualizada. Sos responsable de mantener la confidencialidad de tus credenciales de acceso y de todas las actividades que se realicen bajo tu cuenta.

Rodeo se reserva el derecho de suspender o cancelar cuentas que incurran en conductas contrarias a los presentes Términos de Uso, a la legislación vigente o a los derechos de terceros.`,
            },
            {
              title: '4. Planes y condiciones de pago',
              content: `La Plataforma ofrece un plan gratuito y planes de pago. Los planes de pago se cobran en dólares estadounidenses (USD) con periodicidad mensual o anual, según la opción elegida al momento de la contratación.

Los precios publicados en la Plataforma no incluyen impuestos locales aplicables. Rodeo se reserva el derecho de modificar los precios de los planes con un preaviso mínimo de 30 días. Los cambios de precio no afectarán a las suscripciones en curso hasta la finalización del período de facturación vigente.

El incumplimiento en el pago podrá resultar en la suspensión del acceso a las funcionalidades del plan contratado, con retención de los datos por un período mínimo de 60 días.`,
            },
            {
              title: '5. Propiedad intelectual',
              content: `Todos los derechos de propiedad intelectual sobre la Plataforma, incluyendo su código fuente, algoritmos, diseño, marcas, logotipos y contenidos generados por Rodeo, son propiedad exclusiva de Rodeo AgTech S.A.S. y están protegidos por las leyes argentinas e internacionales de propiedad intelectual.

Los datos ingresados por el usuario en la Plataforma —incluyendo información de hacienda, potreros, notas de campo y cualquier otro dato de producción— son propiedad del usuario. Rodeo no reivindica ningún derecho de propiedad sobre dichos datos y se compromete a no utilizarlos para fines distintos a los establecidos en la Política de Privacidad.`,
            },
            {
              title: '6. Privacidad y tratamiento de datos',
              content: `El tratamiento de datos personales de los usuarios se rige por la Política de Privacidad de Rodeo AgTech, disponible en /soporte/privacidad, la cual forma parte integrante de los presentes Términos de Uso. Rodeo cumple con la Ley N.° 25.326 de Protección de Datos Personales de Argentina y, en lo pertinente, con el Reglamento General de Protección de Datos (RGPD) de la Unión Europea.`,
            },
            {
              title: '7. Limitación de responsabilidad',
              content: `La Plataforma se provee "tal como está" y Rodeo no garantiza que su funcionamiento sea ininterrumpido, libre de errores o seguro en todo momento. Rodeo no será responsable por daños directos, indirectos, incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso de la Plataforma, incluyendo pérdidas de datos, lucro cesante o pérdidas de producción.

La responsabilidad total de Rodeo ante el usuario, por cualquier concepto, no excederá en ningún caso el importe abonado por el usuario durante los últimos tres (3) meses previos al evento generador del daño.`,
            },
            {
              title: '8. Cancelación del servicio',
              content: `El usuario puede cancelar su suscripción en cualquier momento desde el panel de configuración de su cuenta, sin costo ni penalidad. La cancelación es efectiva al cierre del período de facturación en curso. Tras la cancelación, el usuario podrá exportar todos sus datos en formato Excel o JSON durante un período de 60 días antes de la eliminación definitiva de la cuenta.`,
            },
            {
              title: '9. Modificaciones a los términos',
              content: `Rodeo se reserva el derecho de modificar los presentes Términos de Uso en cualquier momento. Ante modificaciones sustanciales, notificaremos a los usuarios registrados por correo electrónico con un mínimo de 15 días de anticipación. El uso continuado de la Plataforma tras la entrada en vigor de las modificaciones implica la aceptación de las nuevas condiciones.`,
            },
            {
              title: '10. Legislación aplicable y jurisdicción',
              content: `Los presentes Términos de Uso se rigen por las leyes de la República Argentina. Para cualquier controversia derivada de la interpretación o aplicación de estos términos, las partes se someten a la jurisdicción ordinaria de los Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires, con renuncia expresa a cualquier otro fuero o jurisdicción.`,
            },
          ].map(({ title, content }, i) => (
            <div key={i} className="mb-10">
              <h2 className="text-lg font-black text-gray-950 mb-3">{title}</h2>
              {content.split('\n\n').map((p, j) => (
                <p key={j} className="text-gray-600 text-sm leading-relaxed mb-3">{p}</p>
              ))}
            </div>
          ))}

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mt-10">
            <p className="text-gray-600 text-sm">
              Para consultas sobre estos Términos de Uso, escribinos a{' '}
              <a href="mailto:soporte@rodeoagtech.com" className="text-green-600 font-bold underline">
                soporte@rodeoagtech.com
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
