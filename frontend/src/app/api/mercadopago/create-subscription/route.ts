import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQueryOne, serviceMutate } from '@/lib/db'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token, payerEmail, planId, documentNumber, documentType, amount, billing } = await req.json()

    if (!token || !payerEmail || !planId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // 1. Obtener detalles del plan de nuestra base de datos
    const plan = await serviceQueryOne<{
      id: string
      name: string
      price: number
      billing_period: string
    }>('SELECT id, name, price, billing_period FROM subscriptions_plans WHERE id = $1', [planId])

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // 2. Configurar Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })
    const preApproval = new PreApproval(client)

    const frequency = billing === 'annual' ? 12 : 1
    const frequencyType = 'months'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000'
    const backUrl = appUrl.includes('localhost') 
      ? 'https://rodeoagtech.com/dashboard/planes' 
      : `${appUrl}/billing`

    // 3. Crear suscripción en Mercado Pago
    const subscriptionParams = {
      body: {
        back_url: backUrl,
        card_token_id: token,
        payer_email: payerEmail,
        reason: `RODEO - ${plan.name}`,
        auto_recurring: {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: amount ? Number(amount) : Number(plan.price),
          currency_id: 'ARS', // Asumiendo ARS para la integración inicial
        },
        external_reference: auth.orgId,
      }
    }

    const mpResponse = await preApproval.create(subscriptionParams)

    // 4. Guardar en base de datos inicial (estado pending/authorized)
    await serviceMutate(
      `INSERT INTO payments (
        org_id, provider, provider_sub_id, plan_id, status, amount, currency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        auth.orgId,
        'mercadopago',
        mpResponse.id,
        plan.id,
        mpResponse.status || 'pending',
        amount ? Number(amount) : plan.price,
        'ARS'
      ]
    )

    // 5. Actualizar organización (optimista) para quitar overlay de prueba
    if (mpResponse.status === 'authorized' || mpResponse.status === 'pending') {
      await serviceMutate(
        `UPDATE organizations SET subscription_plan_id = $1, plan_status = 'active', updated_at = NOW() WHERE id = $2`,
        [plan.id, auth.orgId]
      )
    }

    return NextResponse.json({
      success: true,
      subscriptionId: mpResponse.id,
      status: mpResponse.status
    })
  } catch (error: any) {
    console.error('Error creating MP subscription:', error)
    const mpErrorMessage = error.message || error.cause?.message || error.response?.data?.message || 'Error processing the payment with Mercado Pago'
    return NextResponse.json(
      { error: mpErrorMessage, details: error },
      { status: 400 } // Cambiado de 500 a 400 para errores de validación de MercadoPago
    )
  }
}
