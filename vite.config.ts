import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // PORT is the API server's port (server/index.mjs), not Vite's.
  const apiPort = loadEnv(mode, '.', '').PORT || '8787'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': `http://127.0.0.1:${apiPort}`,
      },
    },
  }
})
