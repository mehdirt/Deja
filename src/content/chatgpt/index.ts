import { attachSubmitHook } from '../shared/capture'
import { startHealthProbe } from '../shared/health'
import { attachResurface } from '../shared/resurface'
import { startBlocklistSync } from '../shared/blocklist'

const SELECTORS = [
  '#prompt-textarea',
  'div[contenteditable="true"][id*="prompt"]',
  'div.ProseMirror[contenteditable="true"]',
  'textarea[data-id]',
  'main form textarea',
]

const getInput = (): HTMLElement | null => {
  for (const sel of SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel)
    if (el) return el
  }
  return null
}

// Arm capture only once the blocklist's first read lands (or its 1s fallback
// fires), closing the page-load race where a blocklisted prompt could slip
// through before the snapshot loads. Health + resurface stay immediate.
const { ready } = startBlocklistSync()
void ready.then(() => attachSubmitHook(getInput, 'chatgpt'))
startHealthProbe(getInput, 'chatgpt')
attachResurface(getInput, 'chatgpt')
