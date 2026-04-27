/**
 * Stripe Webhook Handler
 * Procesa eventos de Stripe para actualizar suscripciones en la DB.
 * POST /api/payments/stripe/webhooks
 */
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const stripeKey = process.env.STRIPE_SECRET_KEY

  if (!webhookSecret || !stripeKey) {
    console.error('Stripe webhook: missing env vars')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeKey)
  const signature = req.headers.get('stripe-signature') || ''
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`Stripe webhook received: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const orgId  = session.metadata?.org_id
        const planId = session.metadata?.plan_id

        if (orgId && planId) {
          await query(
            `UPDATE organizations
             SET subscription_plan_id = $1,
                 stripe_subscription_id = $2,
                 plan_status = 'active',
                 updated_at = NOW()
             WHERE id = $3`,
            [planId, session.subscription, orgId]
          )
          console.log(`✅ Plan updated for org ${orgId} → plan ${planId}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId  = sub.metadata?.org_id
        const planId = sub.metadata?.plan_id

        const statusMap: Record<string, string> = {
          active:   'active',
          trialing: 'trialing',
          past_due: 'past_due',
          canceled: 'canceled',
          paused:   'paused',
          incomplete: 'past_due',
        }

        if (orgId) {
          await query(
            `UPDATE organizations
             SET plan_status = $1,
                 stripe_subscription_id = $2,
                 ${planId ? 'subscription_plan_id = $4,' : ''}
                 updated_at = NOW()
             WHERE id = ${planId ? '$5' : '$3'}`,
            planId
              ? [statusMap[sub.status] || 'active', sub.id, undefined, planId, orgId]
              : [statusMap[sub.status] || 'active', sub.id, orgId]
          )
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        await query(
          `UPDATE organizations
           SET plan_status = 'canceled',
               updated_at = NOW()
           WHERE stripe_customer_id = $1`,
          [customerId]
        )
        console.log(`⚠️ Subscription canceled for customer ${customerId}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        await query(
          `UPDATE organizations SET plan_status = 'past_due', updated_at = NOW() WHERE stripe_customer_id = $1`,
          [customerId]
        )
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        await query(
          `UPDATE organizations SET plan_status = 'active', updated_at = NOW() WHERE stripe_customer_id = $1`,
          [customerId]
        )
        break
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Stripe webhook processing error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// Disable body parsing (Stripe needs raw body for signature verification)
export const config = {
  api: { bodyParser: false },
}
