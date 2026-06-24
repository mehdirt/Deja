import { attachSubmitHook } from '../shared/capture'
import { startHealthProbe } from '../shared/health'

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

attachSubmitHook(getInput, 'grok')
startHealthProbe(getInput, 'grok')
