import { attachSubmitHook } from '../shared/capture'

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

attachSubmitHook(getInput, 'gemini')
