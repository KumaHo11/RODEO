import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Cloud Run Docker deployment
  // Packages that must NOT be bundled — they use Node.js internals incompatible with
  // the Next.js server bundler. Adding them here keeps them as external node_modules.
  serverExternalPackages: ['resend'],
  turbopack: {},
  images: {
    remotePatterns: [
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

export default nextConfig;
