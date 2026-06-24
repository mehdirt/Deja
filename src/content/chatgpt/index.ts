import { attachSubmitHook } from '../shared/capture'
import { startHealthProbe } from '../shared/health'

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

attachSubmitHook(getInput, 'chatgpt')
startHealthProbe(getInput, 'chatgpt')
