import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/login',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
