/**
 * lib/prisma.ts
 * Singleton del Prisma Client para uso en routes y funciones de servidor.
 * Siguiendo el patrón recomendado de Next.js para evitar múltiples instancias
 * en desarrollo con hot-reload.
 *
 * Uso: import prisma from '@/lib/prisma'
 */
import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined
}

const prisma: PrismaClient =
  globalThis._prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis._prisma = prisma
}

export default prisma
