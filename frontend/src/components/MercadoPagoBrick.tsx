'use client'

import { useEffect, useState } from 'react'
import { initMercadoPago, Payment } from '@mercadopago/sdk-react'
import { apiFetch } from '@/lib/apiFetch'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// Inicializar MercadoPago con la Public Key
initMercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || '', { locale: 'es-AR' })

interface Props {
  planId: string
  amount: number
  onSuccess: () => void
  onCancel: () => void
}

export function MercadoPagoBrick({ planId, amount, onSuccess, onCancel, hideHeader }: Props & { hideHeader?: boolean }) {
  const [loading, setLoading] = useState(true)

  const initialization = {
    amount: amount,
    preferenceId: undefined, // No usamos preference porque creamos suscripción directa
  }

  const customization = {
    paymentMethods: {
      creditCard: 'all',
      debitCard: 'all',
      ticket: 'all',
      bankTransfer: 'all',
      mercadoPago: 'all',
    },
  }

  const onSubmit = async (
    { selectedPaymentMethod, formData }: any
  ) => {
    // formData trae: token, issuer_id, payment_method_id, transaction_amount, installments, payer...
    try {
      const res = await apiFetch('/api/mercadopago/create-subscription', {
        method: 'POST',
        body: JSON.stringify({
          token: formData.token,
          payerEmail: formData.payer.email,
          documentType: formData.payer.identification.type,
          documentNumber: formData.payer.identification.number,
          planId: planId,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al procesar el pago')
      }

      const data = await res.json()
      if (data.success) {
        toast.success('¡Suscripción creada con éxito!')
        onSuccess()
      } else {
        throw new Error('No se pudo completar la suscripción')
      }
    } catch (error: any) {
      toast.error(error.message || 'Hubo un error al procesar el pago')
    }
  }

  const onError = async (error: any) => {
    console.error('MP Brick Error:', error)
    toast.error('Error al cargar el módulo de pagos')
  }

  const onReady = async () => {
    setLoading(false)
  }

  return (
    <div className={hideHeader ? "w-full mx-auto" : "w-full max-w-md mx-auto bg-white p-4 rounded-2xl"}>
      {!hideHeader && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-gray-900">Completar Pago</h3>
          <button 
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-sm font-bold"
          >
            Cancelar
          </button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-green-600" />
        </div>
      )}

      {/* @ts-ignore - El SDK de MP a veces tiene problemas de tipado con sus callbacks */}
      <Payment
        initialization={initialization}
        customization={customization as any}
        onSubmit={onSubmit}
        onReady={onReady}
        onError={onError}
      />
    </div>
  )
}
