import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development the frontend calls /api/* on its own origin and Vite
    // forwards the request to the local FastAPI backend. This avoids CORS
    // problems and keeps the API URL out of the source code.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
