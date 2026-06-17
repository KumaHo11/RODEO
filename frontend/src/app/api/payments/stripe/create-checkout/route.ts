/**
 * Stripe Integration for RODEO
 * Checkout Session, Customer Portal, and Webhook handler
 */
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQuery, serviceQueryOne } from '@/lib/db'

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key)
}

// ── POST /api/payments/stripe/create-checkout ──────────────────────────────
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { planId, billingPeriod = 'monthly', successUrl, cancelUrl } = await req.json()

  // Obtener el plan
  const plan = await serviceQueryOne<{
    id: string; name: string; stripe_price_id_monthly: string; stripe_price_id_yearly: string
  }>(
    `SELECT id, name, stripe_price_id_monthly, stripe_price_id_yearly FROM subscriptions_plans WHERE id = $1 AND is_active = true`,
    [planId]
  )

  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const priceId = billingPeriod === 'yearly'
    ? plan.stripe_price_id_yearly
    : plan.stripe_price_id_monthly

  if (!priceId) {
    return NextResponse.json({ error: `Plan sin Stripe Price ID configurado para ${billingPeriod}` }, { status: 400 })
  }

  // Obtener o crear Stripe Customer
  const profile = await serviceQueryOne<{ organization_id: string; email: string }>(
    `SELECT organization_id, email FROM profiles WHERE firebase_uid = $1`,
    [decoded.uid]
  )

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'No tenés una organización activa' }, { status: 400 })
  }

  const org = await serviceQueryOne<{ id: string; name: string; stripe_customer_id: string }>(
    `SELECT id, name, stripe_customer_id FROM organizations WHERE id = $1`,
    [profile.organization_id]
  )

  if (!org) return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })

  try {
    const stripe = getStripe()

    let customerId = org.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        name: org.name,
        metadata: {
          org_id: org.id,
          firebase_uid: decoded.uid,
        },
      })
      customerId = customer.id

      await serviceQuery(
        `UPDATE organizations SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2`,
        [customerId, org.id]
      )
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success&plan=${plan.name}`,
      cancel_url:  cancelUrl  || `${process.env.NEXT_PUBLIC_APP_URL}/landing#precios`,
      subscription_data: {
        metadata: {
          org_id: org.id,
          plan_id: planId,
          plan_name: plan.name,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    })

    return NextResponse.json({ checkoutUrl: session.url, sessionId: session.id })
  } catch (err: any) {
    console.error('Stripe create-checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
