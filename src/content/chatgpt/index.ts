import { attachSubmitHook } from '../shared/capture'

// ChatGPT uses a contenteditable div with id="prompt-textarea" (subject to change).
const getInput = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('#prompt-textarea') ||
  document.querySelector<HTMLElement>('textarea[data-id], textarea[placeholder]')

attachSubmitHook(getInput, 'chatgpt')
