import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/dashboard/',
        '/api/',
        '/auth/',
        '/onboarding/',
        '/terms-accept/',
        '/guest-setup/',
        '/logo-preview/',
      ],
    },
    sitemap: 'https://rodeoagtech.com/sitemap.xml',
  }
}
