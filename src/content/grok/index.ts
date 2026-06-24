import { attachSubmitHook } from '../shared/capture'
import { startHealthProbe } from '../shared/health'
import { attachResurface } from '../shared/resurface'
import { startBlocklistSync } from '../shared/blocklist'

// Standalone grok.com composer. It has shipped as both a textarea and a
// contenteditable across redesigns, so we try both with broad fallbacks.
const SELECTORS = [
  'textarea[aria-label]',
  'textarea[placeholder]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
  'textarea',
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
void ready.then(() => attachSubmitHook(getInput, 'grok'))
startHealthProbe(getInput, 'grok')
attachResurface(getInput, 'grok')
