// Copy ONNX Runtime wasm/.mjs next to the built extension so Transformers.js
// never dynamically imports those files from a CDN (MV3 CSP blocks that).

import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'node_modules', '@huggingface', 'transformers', 'dist')
const destDir = join(root, 'public', 'onnx')

const files = ['ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs']

mkdirSync(destDir, { recursive: true })
for (const name of files) {
  const from = join(srcDir, name)
  if (!existsSync(from)) {
    console.error(`[copy-onnx] missing ${from} — run npm install`)
    process.exit(1)
  }
  copyFileSync(from, join(destDir, name))
}
console.log(`[copy-onnx] ready → public/onnx (${files.join(', ')})`)
