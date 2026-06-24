import { attachSubmitHook } from '../shared/capture'
import { startHealthProbe } from '../shared/health'
import { attachResurface } from '../shared/resurface'
import { startBlocklistSync } from '../shared/blocklist'

const SELECTORS = [
  'div.ProseMirror[contenteditable="true"]',
  'div[contenteditable="true"][role="textbox"]',
  'fieldset div[contenteditable="true"]',
  'div[contenteditable="true"]',
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
void ready.then(() => attachSubmitHook(getInput, 'claude'))
startHealthProbe(getInput, 'claude')
attachResurface(getInput, 'claude')
