import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// VITE_DEMO=true builds the self-contained demo: the API layer is swapped for
// an in-browser backend and the whole app is inlined into one HTML file.
const demo = process.env.VITE_DEMO === 'true'

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(demo ? [viteSingleFile()] : [])],
  define: {
    'import.meta.env.VITE_DEMO': JSON.stringify(demo ? 'true' : 'false'),
  },
  build: {
    outDir: demo ? 'demo-dist' : 'dist',
    ...(demo ? { assetsInlineLimit: 100_000_000, cssCodeSplit: false } : {}),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    },
  },
})
