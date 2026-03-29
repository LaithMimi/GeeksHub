import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
