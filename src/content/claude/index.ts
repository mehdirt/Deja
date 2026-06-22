import { attachSubmitHook } from '../shared/capture'

// Claude.ai uses a contenteditable ProseMirror editor.
const getInput = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('div.ProseMirror[contenteditable="true"]') ||
  document.querySelector<HTMLElement>('[contenteditable="true"]')

attachSubmitHook(getInput, 'claude')
