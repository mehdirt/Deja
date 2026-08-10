import { attachSubmitHook } from '../shared/capture'
import { startHealthProbe } from '../shared/health'
import { attachResurface } from '../shared/resurface'
import { attachPresence } from '../shared/presence'
import { startBlocklistSync } from '../shared/blocklist'
import { startCaptureGate } from '../shared/captureGate'

const SELECTORS = [
  'rich-textarea div.ql-editor[contenteditable="true"]',
  'rich-textarea div[contenteditable="true"]',
  'div.ql-editor[contenteditable="true"]',
  'div[role="textbox"][contenteditable="true"]',
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
const { ready: blocklistReady } = startBlocklistSync()
const { ready: gateReady } = startCaptureGate('gemini')
void Promise.all([blocklistReady, gateReady]).then(() => attachSubmitHook(getInput, 'gemini'))
startHealthProbe(getInput, 'gemini')
// The dot and the tooltip share one debounced similarity query: resurface
// runs it, presence just reads the count off the response.
const presence = attachPresence(getInput, 'gemini')
attachResurface(getInput, 'gemini', { onMatchCount: presence.setMatchCount })
