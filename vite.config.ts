/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In development the Phoenix backend listens here; Vite serves the SPA on 3000
// and proxies channel/HTTP traffic to it.
const BACKEND = 'http://localhost:3200'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
  // The built SPA is shipped inside the Phoenix release.
  build: {
    outDir: 'backend/priv/static',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    allowedHosts: ["grange.homework.quest"],
    proxy: {
      "/socket": { target: BACKEND, ws: true },
      "/api": { target: BACKEND },
    },
  },
  // `vite preview` doesn't inherit server.proxy, so mirror it so the built SPA
  // can also be exercised locally against a running backend.
  preview: {
    port: 3000,
    proxy: {
      "/socket": { target: BACKEND, ws: true },
      "/api": { target: BACKEND },
    },
  },
})