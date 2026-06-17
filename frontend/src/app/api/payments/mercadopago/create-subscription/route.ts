/**
 * MercadoPago Subscription Integration
 * POST /api/payments/mercadopago/create-subscription
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQuery, serviceQueryOne } from '@/lib/db'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const mpAccessToken = process.env.MP_ACCESS_TOKEN
  if (!mpAccessToken) {
    return NextResponse.json({ error: 'MercadoPago no está configurado' }, { status: 503 })
  }

  const { planId } = await req.json()

  const plan = await serviceQueryOne<{
    id: string; name: string; price: number; mp_preapproval_plan_id: string
  }>(
    `SELECT id, name, price, mp_preapproval_plan_id FROM subscriptions_plans WHERE id = $1 AND is_active = true`,
    [planId]
  )

  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  if (!plan.mp_preapproval_plan_id) {
    return NextResponse.json({ error: 'Plan sin ID de MercadoPago configurado' }, { status: 400 })
  }

  const profile = await serviceQueryOne<{ organization_id: string; email: string }>(
    `SELECT organization_id, email FROM profiles WHERE firebase_uid = $1`,
    [decoded.uid]
  )

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'No tenés una organización activa' }, { status: 400 })
  }

  const org = await serviceQueryOne<{ id: string; name: string }>(
    `SELECT id, name FROM organizations WHERE id = $1`,
    [profile.organization_id]
  )

  try {
    // Crear suscripción en MercadoPago
    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preapproval_plan_id: plan.mp_preapproval_plan_id,
        payer_email: profile.email,
        reason: `RODEO - ${plan.name}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.price,
          currency_id: 'ARS',
        },
        back_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?mp=success`,
        external_reference: JSON.stringify({
          org_id: org!.id,
          plan_id: planId,
          firebase_uid: decoded.uid,
        }),
        status: 'pending',
      }),
    })

    if (!mpRes.ok) {
      const err = await mpRes.json()
      throw new Error(err.message || 'Error de MercadoPago')
    }

    const mpData = await mpRes.json()

    return NextResponse.json({
      subscriptionId: mpData.id,
      initPoint: mpData.init_point, // URL de pago de MercadoPago
    })
  } catch (err: any) {
    console.error('MercadoPago subscription error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
