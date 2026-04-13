import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    hmr: {
      // In a dev container the browser reaches Vite through a forwarded port.
      // Let the HMR client discover its own host/port from the page URL so the
      // WebSocket connection goes through the same forwarded address.
      clientPort: undefined,   // auto-detect from window.location
    },
    proxy: {
      '/scripts': 'http://localhost:3000',
      '/episodes': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
