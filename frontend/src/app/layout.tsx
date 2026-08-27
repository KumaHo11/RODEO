import type { Metadata, Viewport } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import { OfflineManager } from '@/components/OfflineManager'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import { Toaster } from 'sonner'

const inter = Inter({ 
  subsets: ['latin'], 
  display: 'swap',
  variable: '--font-inter'
})

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['600', '700', '800']
})

import { GA_MEASUREMENT_ID } from '@/lib/analytics'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://rodeoagtech.com'),
  alternates: {
    canonical: './',
  },
  title: 'RODEO — Gestión Ganadera Regenerativa',
  description: 'Plataforma AgTech para ganadería holística y regenerativa. Gestión de potreros, rodeos, pastoreo rotacional y bitácora de campo con IA.',
  keywords: ['ganadería regenerativa', 'ganadería holística', 'agtech', 'pastoreo rotacional', 'software ganadero', 'gestión de potreros', 'RODEO'],
  authors: [{ name: 'RODEO AgTech' }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
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
  viewportFit: 'cover',
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
        <link rel="apple-touch-icon" href="/icons/icon-180.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png?v=2" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png?v=2" />
        <link rel="apple-touch-startup-image" href="/icons/icon-512.png?v=2" />
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
        {GA_MEASUREMENT_ID && process.env.NEXT_PUBLIC_APP_URL === 'https://rodeoagtech.com' && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <Script
              id="gtag-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_MEASUREMENT_ID}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}
      </head>
      <body className={`${inter.variable} ${montserrat.variable} ${inter.className} font-sans overflow-x-hidden`}>
        {/* Global Native Splash Screen (Immediately visible, removed by AuthProvider) */}
        <div 
          id="global-native-splash" 
          suppressHydrationWarning
          style={{ 
            position: 'fixed', inset: 0, backgroundColor: '#16a34a', zIndex: 999999, 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
            transition: 'opacity 0.5s ease-out', color: 'white'
          }}
        >
          <img src="/LogoLoginBlanco.svg" alt="RODEO" style={{ width: '220px', height: 'auto', marginBottom: '32px' }} />
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ marginTop: '24px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.15em', opacity: 0.9 }}>PREPARANDO ENTORNO...</p>
        </div>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var isPwa = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
                var path = window.location.pathname;
                if (!isPwa || path === '/landing' || path === '/login' || path === '/') {
                  document.getElementById('global-native-splash').style.display = 'none';
                }
              } catch(e) {}
            })();
          `
        }} />

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
