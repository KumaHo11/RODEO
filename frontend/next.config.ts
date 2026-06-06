import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  output: "standalone", // Required for Cloud Run Docker deployment
  // turbopack: {} — requerido en Next.js 16 cuando hay config webpack de plugins
  // (next-pwa inyecta webpack config internamente; esto silencia el error)
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/:path*` : 'http://localhost:3001/:path*'
      },
      {
        source: '/api/parser/:path*',
        destination: process.env.PARSER_URL ? `${process.env.PARSER_URL}/api/parser/:path*` : 'http://localhost:8000/api/parser/:path*'
      },
      {
        source: '/api/insights/:path*',
        destination: process.env.PARSER_URL ? `${process.env.PARSER_URL}/api/insights/:path*` : 'http://localhost:8000/api/insights/:path*'
      },
      {
        source: '/api/predictions/:path*',
        destination: process.env.PARSER_URL ? `${process.env.PARSER_URL}/api/predictions/:path*` : 'http://localhost:8000/api/predictions/:path*'
      }
    ];
  }
};

export default withPWA(nextConfig);
