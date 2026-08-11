import { attachSubmitHook } from '../shared/capture'
import { startHealthProbe } from '../shared/health'
import { attachResurface } from '../shared/resurface'
import { attachPresence } from '../shared/presence'
import { attachPicker, type PickerHandle } from '../shared/picker'
import { startBlocklistSync } from '../shared/blocklist'
import { startCaptureGate } from '../shared/captureGate'
import { resolveComposerShell } from '../shared/anchor'

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
const { ready: blocklistReady } = startBlocklistSync()
const { ready: gateReady } = startCaptureGate('grok')
void Promise.all([blocklistReady, gateReady]).then(() => attachSubmitHook(getInput, 'grok'))
// Grok: tight pill shell (not full-bleed form) — left of Submit/waveform.
const presence = attachPresence(getInput, 'grok', {
  placement: {
    mode: 'beside-send',
    gap: 8,
    sendSelectors: [
      'button[aria-label*="Submit" i]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="Voice" i]',
      'button[type="submit"]',
    ],
    // Tight query-bar pill — never the full-bleed wrapping form.
    getShell: (input) => {
      const bar = input.closest<HTMLElement>('.query-bar, [class*="query-bar"]')
      if (bar) return bar
      return resolveComposerShell(input)
    },
  },
})
// The picker attaches later (it waits for the blocklist), so the tooltip asks
// through this holder rather than holding a reference that isn't there yet.
let picker: PickerHandle | null = null
attachResurface(getInput, 'grok', {
  onMatchCount: presence.setMatchCount,
  isSuppressed: () => picker?.isOpen() ?? false,
})
// The picker reads the library, so it waits for the blocklist snapshot the
// same way capture does — otherwise a "never save from here" domain could
// briefly offer a search over everything saved before the rules load.
void blocklistReady.then(() => {
  picker = attachPicker(getInput, 'grok')
  presence.refresh()
})
// The probe already knew when a selector broke; now the dot hears about it
// too, so the person can keep this one by hand instead of losing it silently.
startHealthProbe(getInput, 'grok', (ok) => presence.setBroken(!ok))
