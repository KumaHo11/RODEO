import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import { OfflineManager } from '@/components/OfflineManager'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], preload: false })

export const metadata: Metadata = {
  title: 'RODEO — Gestión Ganadera Regenerativa',
  description: 'Plataforma AgTech para ganadería holística y regenerativa. Gestión de potreros, rodeos, pastoreo rotacional y bitácora de campo con IA.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RODEO',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'RODEO',
    title: 'RODEO — Gestión Ganadera Regenerativa',
    description: 'Plataforma AgTech para ganadería holística y regenerativa',
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/LogoInstallapp.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RODEO" />
        {/* Anti-ServiceWorker para desarrollo: Muerte súbita a cachés corruptas */}
        <Script
          id="sw-unregister"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (location.hostname === 'localhost' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(rs) {
                  rs.forEach(function(r) { r.unregister() })
                });
              }
            `,
          }}
        />
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=G-WNEFPKRP9B`}
        />
        <Script
          id="gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-WNEFPKRP9B', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <OfflineManager>
            {children}
          </OfflineManager>
          <ServiceWorkerRegistrar />
        </AuthProvider>
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            style: { fontFamily: 'inherit' },
            classNames: {
              success: 'border-green-200',
              error: 'border-red-200',
            },
          }}
        />
      </body>
    </html>
  )
}
