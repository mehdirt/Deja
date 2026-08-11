// Copy Literata into public/fonts so in-page overlays can load the wordmark
// face via chrome.runtime.getURL. Shadow DOM can't inherit Figtree/Literata
// from the extension pages, and hashed Vite asset URLs aren't stable enough
// for web_accessible_resources.

import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src', 'assets', 'fonts')
const destDir = join(root, 'public', 'fonts')

const files = ['literata-semibold.woff2', 'literata-bold.woff2']

mkdirSync(destDir, { recursive: true })
for (const name of files) {
  const from = join(srcDir, name)
  if (!existsSync(from)) {
    console.error(`[copy-overlay-fonts] missing ${from}`)
    process.exit(1)
  }
  copyFileSync(from, join(destDir, name))
}
console.log(`[copy-overlay-fonts] ready → public/fonts (${files.join(', ')})`)
