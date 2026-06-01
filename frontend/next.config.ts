import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // SW manual en public/sw.js — desactivamos la generación automática de Workbox
  // para evitar que sobreescriba nuestro sw.js custom (necesario con output:standalone)
  disable: true,
});

const nextConfig: NextConfig = {
  output: "standalone", // Required for Cloud Run Docker deployment
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
};

export default withPWA(nextConfig);
