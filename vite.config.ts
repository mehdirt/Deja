import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import path from 'node:path'
import manifest from './src/manifest.json' with { type: 'json' }
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  // package.json is the single source of truth for the version; inject it into
  // the manifest at build time so the two can't drift (manifest.json omits it).
  plugins: [
    react(),
    crx({ manifest: { ...manifest, version: pkg.version } }),
    // Transformers.js stamps a jsDelivr wasmPaths default at module load.
    // MV3 CSP forbids executing that remote .mjs — wipe the default so only
    // our explicit chrome.runtime.getURL('onnx/…') paths are used.
    {
      name: 'no-transformers-cdn-wasm',
      transform(code, id) {
        if (!id.includes('@huggingface/transformers')) return null
        if (!code.includes('cdn.jsdelivr.net')) return null
        return {
          code: code.replace(
            /https:\/\/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers@\$\{[^}]+\}\/dist\//g,
            '',
          ),
          map: null,
        }
      },
      // Belt-and-braces: catch minified bundle too.
      generateBundle(_opts, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk' || !chunk.code.includes('cdn.jsdelivr.net')) continue
          chunk.code = chunk.code.replace(
            /https:\/\/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers@[^`"'\s]+\/dist\//g,
            '',
          )
        }
      },
    },
    // Keep the default install lean for *hashed* ONNX assets Vite would otherwise
    // emit into assets/. Runtime files live in public/onnx/ with stable names.
    {
      name: 'strip-onnx-wasm',
      generateBundle(_opts, bundle) {
        for (const fileName of Object.keys(bundle)) {
          if (fileName.endsWith('.wasm')) delete bundle[fileName]
        }
      },
    },
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  // Keep Transformers out of Vite's prebundle cache so our CDN-strip transform
  // always applies in `npm run dev` (otherwise dep optimizer serves a CDN build).
  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web', 'onnxruntime-common'],
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
    // Offscreen NER page isn't referenced from the MV3 manifest as a static
    // HTML entry (created via chrome.offscreen at runtime). Force Vite to
    // bundle it so main.ts + Transformers.js land in dist/.
    rollupOptions: {
      input: {
        offscreen: path.resolve(__dirname, 'src/offscreen/index.html'),
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
