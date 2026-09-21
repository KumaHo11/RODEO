/**
 * GET /api/join-wa/[token]
 * Endpoint PÚBLICO — no requiere autenticación.
 * Devuelve los datos necesarios para mostrar la landing de invitación WhatsApp.
 * El token es un hex-64 generado criptográficamente (32 bytes → 64 chars hex).
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Validar formato: hex de exactamente 64 caracteres
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }

  const link = await prisma.whatsAppLink.findFirst({
    where: {
      activationToken: token,
      isActive:        false,
    },
    select: {
      id:             true,
      operatorName:   true,
      role:           true,
      tokenExpiresAt: true,
      organization:   { select: { name: true } },
    },
  })

  if (!link) {
    return NextResponse.json(
      { error: 'Invitación no encontrada o ya utilizada.' },
      { status: 404 }
    )
  }

  if (link.tokenExpiresAt && link.tokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: 'Invitación expirada. Pedí un nuevo link al administrador.' },
      { status: 410 }
    )
  }

  const WA_NUMBER     = process.env.NEXT_PUBLIC_WA_BOT_NUMBER!
  const fieldName     = link.organization.name?.trim() || 'RODEO'
  const activationMsg = `¡Hola! Envía este mensaje para vincularte al campo ${fieldName}. (Código de seguridad: TOKEN_${token})`
  // La landing muestra el botón "Conectar mi WhatsApp" que abre el bot con el mensaje listo
  const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(activationMsg)}`

  return NextResponse.json({
    orgName:      link.organization.name,
    operatorName: link.operatorName,
    role:         link.role,
    waLink,
    expiresAt:    link.tokenExpiresAt,
  })
}
