import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/scripts': 'http://localhost:3000',
      '/episodes': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
