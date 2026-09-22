import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/producto/calculadora-ganadera',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
