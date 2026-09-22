import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/soporte/centro-de-ayuda',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
