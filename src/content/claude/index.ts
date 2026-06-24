import { attachSubmitHook } from '../shared/capture'
import { startHealthProbe } from '../shared/health'

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

attachSubmitHook(getInput, 'claude')
startHealthProbe(getInput, 'claude')
