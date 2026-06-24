import { attachSubmitHook } from '../shared/capture'
import { startHealthProbe } from '../shared/health'

// DeepSeek's composer is a plain textarea; the broad fallbacks cover a
// redesign toward contenteditable without scattering selectors elsewhere.
const SELECTORS = [
  'textarea#chat-input',
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

attachSubmitHook(getInput, 'deepseek')
startHealthProbe(getInput, 'deepseek')
