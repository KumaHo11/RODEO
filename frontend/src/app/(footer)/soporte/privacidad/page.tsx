import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidad | Rodeo AgTech',
  description: 'Política de privacidad de Rodeo AgTech. Cómo recopilamos, usamos y protegemos tus datos. Cumplimiento con la Ley 25.326 (Argentina) y RGPD.',
}

export default function Privacidad() {
  return (
    <>
      <section className="bg-gradient-to-br from-gray-950 to-gray-900 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-400 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-8">
            LEGAL
          </div>
          <h1 className="text-4xl font-black text-white mb-4">Política de Privacidad</h1>
          <p className="text-gray-400">Última actualización: 1 de enero de 2026</p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5 mb-10">
            <p className="text-green-800 text-sm leading-relaxed">
              <strong>En resumen:</strong> Tus datos son siempre tuyos. No los vendemos, no los compartimos
              con terceros con fines comerciales. Los usamos únicamente para brindarte el servicio y mejorar
              la plataforma. Podés solicitar la eliminación de tu cuenta y todos tus datos en cualquier momento.
            </p>
          </div>

          {[
            {
              title: '1. Responsable del tratamiento de datos',
              content: `Rodeo AgTech S.A.S. (CUIT 30-XXXXXXXX-X), con domicilio en la Ciudad Autónoma de Buenos Aires, Argentina, es la responsable del tratamiento de los datos personales recopilados a través de la Plataforma, de conformidad con la Ley N.° 25.326 de Protección de Datos Personales y su decreto reglamentario.

Para consultas relacionadas con la privacidad de tus datos, podés contactarnos en: soporte@rodeoagtech.com`,
            },
            {
              title: '2. Datos que recopilamos',
              content: `Recopilamos los siguientes tipos de datos:

Datos de registro: nombre, correo electrónico, país y, opcionalmente, número de teléfono.

Datos de uso de la Plataforma: registros de acceso, módulos utilizados, eventos de interacción dentro de la aplicación.

Datos de producción del usuario: información de potreros, hacienda, notas de campo, grabaciones de voz, imágenes de pasturas y cualquier otro contenido que el usuario ingrese voluntariamente en la Plataforma. Estos datos son propiedad del usuario y Rodeo actúa únicamente como encargado del tratamiento.

Datos técnicos: dirección IP, tipo de dispositivo y navegador, sistema operativo y geolocalización GPS (solo cuando el usuario habilita explícitamente esta función).`,
            },
            {
              title: '3. Finalidad del tratamiento de datos',
              content: `Los datos recopilados se utilizan exclusivamente para:

— Prestar y mejorar los servicios de la Plataforma.
— Procesar pagos y administrar suscripciones.
— Enviar comunicaciones de servicio (actualizaciones, alertas de cuenta, novedades del producto).
— Analizar el uso agregado y anonimizado de la Plataforma con fines de mejora de producto (nunca a nivel individual sin consentimiento).
— Cumplir con obligaciones legales aplicables.

Rodeo no utiliza los datos de producción del usuario (hacienda, potreros, notas) para entrenar modelos de inteligencia artificial sin el consentimiento explícito del usuario.`,
            },
            {
              title: '4. Compartición de datos con terceros',
              content: `Rodeo no vende, alquila ni cede datos personales a terceros con fines comerciales. Podemos compartir datos en las siguientes circunstancias limitadas:

Proveedores de servicios técnicos: trabajamos con proveedores de infraestructura en la nube (Google Cloud Platform) y procesamiento de pagos, quienes actúan como subencargados del tratamiento bajo contratos de protección de datos equivalentes a los estándares de Rodeo.

Requerimientos legales: podemos divulgar información cuando así lo exija una orden judicial o una autoridad competente, notificando al usuario en la medida en que la ley lo permita.

Transferencia de negocio: en caso de fusión, adquisición o venta de activos, los datos serán transferidos únicamente bajo las mismas condiciones de privacidad establecidas en esta política, con notificación previa a los usuarios.`,
            },
            {
              title: '5. Seguridad de los datos',
              content: `Rodeo implementa medidas de seguridad técnicas y organizativas adecuadas para proteger tus datos contra accesos no autorizados, pérdida, alteración o divulgación. Entre ellas:

— Encriptación de datos en tránsito (TLS 1.3) y en reposo (AES-256).
— Autenticación de dos factores disponible para todas las cuentas.
— Almacenamiento local encriptado en el dispositivo para el Modo Offline.
— Auditorías de seguridad periódicas y monitoreo de accesos.
— Acceso a datos de producción restringido únicamente al personal autorizado bajo contrato de confidencialidad.`,
            },
            {
              title: '6. Derechos del usuario',
              content: `De conformidad con la Ley N.° 25.326 y el RGPD (para usuarios en la Unión Europea), tenés los siguientes derechos:

Acceso: podés solicitar una copia de todos los datos personales que conservamos sobre vos.

Rectificación: podés corregir datos incorrectos o incompletos desde el panel de configuración de tu cuenta o mediante solicitud a nuestro equipo.

Eliminación: podés solicitar la eliminación de tu cuenta y todos los datos asociados. La eliminación es efectiva en un plazo máximo de 30 días.

Portabilidad: podés exportar todos tus datos de producción en formato Excel (.xlsx) o JSON desde la configuración de tu cuenta.

Oposición: podés oponerte al tratamiento de tus datos para comunicaciones de marketing.

Para ejercer cualquiera de estos derechos, contactanos en: soporte@rodeoagtech.com`,
            },
            {
              title: '7. Cookies y tecnologías de seguimiento',
              content: `Rodeo utiliza cookies estrictamente necesarias para el funcionamiento de la Plataforma (autenticación, sesión de usuario) y cookies analíticas anonimizadas para entender cómo se usa la aplicación y mejorar la experiencia de usuario.

No utilizamos cookies de publicidad comportamental ni compartimos datos de navegación con redes publicitarias. Podés configurar tu navegador para rechazar todas las cookies, aunque esto puede afectar algunas funcionalidades de la Plataforma.`,
            },
            {
              title: '8. Retención de datos',
              content: `Conservamos los datos de usuario activos mientras la cuenta esté activa y, una vez cancelada, durante un período adicional de 60 días para permitir la exportación de datos. Transcurrido ese período, los datos son eliminados definitivamente de nuestros sistemas.

Los registros de auditoría y facturación se conservan durante el período exigido por la normativa fiscal argentina (10 años).`,
            },
            {
              title: '9. Modificaciones a esta política',
              content: `Rodeo podrá actualizar esta Política de Privacidad periódicamente. Ante cambios sustanciales, notificaremos a los usuarios registrados por correo electrónico con un mínimo de 15 días de anticipación. La versión vigente siempre estará disponible en esta página con la fecha de última actualización.`,
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
              Para ejercer tus derechos o consultas sobre privacidad, escribinos a{' '}
              <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}`} className="text-green-600 font-bold underline">
                {process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@rodeoagtech.com'}
              </a>.
              También podés consultar los{' '}
              <Link href="/soporte/terminos-de-uso" className="text-green-600 font-bold underline">
                Términos de Uso
              </Link>.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
