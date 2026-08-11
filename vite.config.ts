import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import path from 'node:path'
import manifest from './src/manifest.json' with { type: 'json' }
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  // package.json is the single source of truth for the version; inject it into
  // the manifest at build time so the two can't drift (manifest.json omits it).
  plugins: [react(), crx({ manifest: { ...manifest, version: pkg.version } })],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  // CRXJS injects Vite's HMR client into the extension. Without an explicit
  // port, Vite bakes `ws://localhost:undefined` into the client and Chrome
  // throws on construct (crxjs/chrome-extension-tools#696).
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 5173,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Local extension pages don't gain from modulepreload, and Chrome warns
    // when Vite preloads shared chunks (e.g. db) that the entry imports only
    // indirectly — "preloaded … but not used within a few seconds".
    modulePreload: false,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
