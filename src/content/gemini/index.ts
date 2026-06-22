import { attachSubmitHook } from '../shared/capture'

// Gemini uses a rich-text-area component with role="textbox".
const getInput = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('rich-textarea div[contenteditable="true"]') ||
  document.querySelector<HTMLElement>('div[role="textbox"][contenteditable="true"]')

attachSubmitHook(getInput, 'gemini')
