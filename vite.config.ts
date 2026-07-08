import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from "@sentry/vite-plugin"

// Only upload source maps when an auth token is present (CI / production).
// Local and token-less builds skip it so `vite build` always works.
const sentryEnabled = !!process.env.SENTRY_AUTH_TOKEN

// https://vite.dev/config/
export default defineConfig({
  // "hidden" emits source maps for Sentry to unminify stack traces without
  // referencing them from the shipped bundles (not exposed to end users).
  build: { sourcemap: "hidden" },
  plugins: [
    react(),
    ...(sentryEnabled
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
        })]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Proxy all /api requests to the FastAPI backend.
      // This makes the browser see both origins as the same (localhost:5173),
      // so the HttpOnly auth_token cookie is always included in requests.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
})
