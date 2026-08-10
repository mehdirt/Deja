import { attachSubmitHook } from '../shared/capture'
import { startHealthProbe } from '../shared/health'
import { attachResurface } from '../shared/resurface'
import { attachPresence } from '../shared/presence'
import { attachPicker, type PickerHandle } from '../shared/picker'
import { startBlocklistSync } from '../shared/blocklist'
import { startCaptureGate } from '../shared/captureGate'

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
const { ready: blocklistReady } = startBlocklistSync()
const { ready: gateReady } = startCaptureGate('claude')
void Promise.all([blocklistReady, gateReady]).then(() => attachSubmitHook(getInput, 'claude'))
// The dot and the tooltip share one debounced similarity query: resurface
// runs it, presence just reads the count off the response.
const presence = attachPresence(getInput, 'claude')
// The picker attaches later (it waits for the blocklist), so the tooltip asks
// through this holder rather than holding a reference that isn't there yet.
let picker: PickerHandle | null = null
attachResurface(getInput, 'claude', {
  onMatchCount: presence.setMatchCount,
  isSuppressed: () => picker?.isOpen() ?? false,
})
// The picker reads the library, so it waits for the blocklist snapshot the
// same way capture does — otherwise a "never save from here" domain could
// briefly offer a search over everything saved before the rules load.
void blocklistReady.then(() => {
  picker = attachPicker(getInput, 'claude')
  presence.refresh()
})
// The probe already knew when a selector broke; now the dot hears about it
// too, so the person can keep this one by hand instead of losing it silently.
startHealthProbe(getInput, 'claude', (ok) => presence.setBroken(!ok))
