import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // Cache Supabase API calls (stale-while-revalidate)
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "supabase-api",
          expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
      // Cache tile images (maps)
      {
        urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "map-tiles",
          expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      // Cache Google Fonts
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  output: "standalone", // Required for Cloud Run Docker deployment
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default withPWA(nextConfig);
