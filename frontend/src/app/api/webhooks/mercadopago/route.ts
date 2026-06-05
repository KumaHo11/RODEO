import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago'
import { mutate } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const topic = url.searchParams.get('topic') || url.searchParams.get('type')
    const id = url.searchParams.get('data.id') || url.searchParams.get('id')

    const body = await req.json()
    const webhookType = body.type || topic
    const entityId = body.data?.id || id

    if (!entityId || !webhookType) {
      return NextResponse.json({ success: true }) // Ignorar webhooks malformados pero responder 200
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })

    if (webhookType === 'payment') {
      const paymentClient = new Payment(client)
      const paymentData = await paymentClient.get({ id: entityId })

      // Si el pago tiene un external_reference (nuestro orgId)
      if (paymentData.external_reference) {
        // Actualizar el estado en base de datos
        // Podemos buscar el payment por provider_payment_id o insertarlo si no existe
        await mutate(
          `UPDATE payments 
           SET status = $1, provider_payment_id = $2 
           WHERE org_id = $3 AND status = 'pending'`,
          [paymentData.status, paymentData.id, paymentData.external_reference]
        )

        // Si el pago es aprobado, podemos actualizar la organización para indicar que está activa
        if (paymentData.status === 'approved') {
           // Lógica para renovar el ciclo de facturación, o actualizar status general.
           // Se asume org_id válido en external_reference
        }
      }
    } else if (webhookType === 'subscription_preapproval' || webhookType === 'preapproval') {
      const preApprovalClient = new PreApproval(client)
      const preApprovalData = await preApprovalClient.get({ id: entityId })
      
      if (preApprovalData.external_reference) {
        await mutate(
          `UPDATE payments 
           SET status = $1 
           WHERE provider_sub_id = $2 AND org_id = $3`,
          [preApprovalData.status, preApprovalData.id, preApprovalData.external_reference]
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Webhook Error:', error)
    // Siempre retornar 200 a Mercado Pago para que no reintente infinitamente si es un error nuestro
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 200 })
  }
}
