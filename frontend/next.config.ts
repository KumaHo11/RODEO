import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  // No recargar automáticamente al volver online — la sincronización manual evita perder datos
  reloadOnOnline: false,
  disable: false,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // ── Upload, auth, and transcription APIs: NEVER cache (NetworkOnly) ──────
      // These must always hit the network — caching them causes silent failures offline.
      {
        urlPattern: /\/api\/(upload|auth|transcribe-audio|webhooks)\/.*/,
        handler: "NetworkOnly",
      },
      // ── Other API calls (NetworkFirst: fresh data, fallback to cache offline) ─
      {
        urlPattern: /\/api\/.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "next-api",
          expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
          networkTimeoutSeconds: 8,
        },
      },
      // ── Map tiles ────────────────────────────────────────────────────────────
      {
        urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "map-tiles",
          expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      // ── Firebase Storage images ───────────────────────────────────────────────
      {
        urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "firebase-storage",
          expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      // ── Google Cloud Storage images ───────────────────────────────────────────
      {
        urlPattern: /^https:\/\/storage\.googleapis\.com\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "gcs-storage",
          expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      // ── Google Fonts ─────────────────────────────────────────────────────────
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
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
};

export default withPWA(nextConfig);
