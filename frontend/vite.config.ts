import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const target = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: target,
        changeOrigin: true,
      },
    },
  },
})
