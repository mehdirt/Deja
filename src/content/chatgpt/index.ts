import { attachSubmitHook } from '../shared/capture'
import { startHealthProbe } from '../shared/health'
import { attachResurface } from '../shared/resurface'
import { attachPresence } from '../shared/presence'
import { attachPicker, type PickerHandle } from '../shared/picker'
import { startBlocklistSync } from '../shared/blocklist'
import { startCaptureGate } from '../shared/captureGate'

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
const { ready: blocklistReady } = startBlocklistSync()
const { ready: gateReady } = startCaptureGate('chatgpt')
void Promise.all([blocklistReady, gateReady]).then(() => attachSubmitHook(getInput, 'chatgpt'))
// ChatGPT: single-row bar — sit left of Send / Voice (sibling of ProseMirror).
const presence = attachPresence(getInput, 'chatgpt', {
  placement: {
    mode: 'beside-send',
    gap: 8,
    sendSelectors: [
      'button[data-testid="send-button"]',
      'button[data-testid="composer-speech-button"]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="Voice" i]',
    ],
  },
})
// The picker attaches later (it waits for the blocklist), so the tooltip asks
// through this holder rather than holding a reference that isn't there yet.
let picker: PickerHandle | null = null
attachResurface(getInput, 'chatgpt', {
  onMatchCount: presence.setMatchCount,
  isSuppressed: () => picker?.isOpen() ?? false,
})
// The picker reads the library, so it waits for the blocklist snapshot the
// same way capture does — otherwise a "never save from here" domain could
// briefly offer a search over everything saved before the rules load.
void blocklistReady.then(() => {
  picker = attachPicker(getInput, 'chatgpt')
  presence.refresh()
})
// The probe already knew when a selector broke; now the dot hears about it
// too, so the person can keep this one by hand instead of losing it silently.
startHealthProbe(getInput, 'chatgpt', (ok) => presence.setBroken(!ok))
