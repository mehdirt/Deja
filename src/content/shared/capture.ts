import type { CaptureResponse, CapturedPromptMessage, Platform } from '@/lib/types'
import { showSavedToast } from './toast'

const DEBUG = true

function log(...args: unknown[]) {
  if (DEBUG) console.log('[PromptShelf]', ...args)
}

export function sendCapture(text: string, platform: Platform): void {
  const trimmed = text.trim()
  if (trimmed.length < 2) return
  const msg: CapturedPromptMessage = {
    type: 'PROMPT_CAPTURED',
    payload: { text: trimmed, platform, url: location.href },
  }
  log('capturing', trimmed.length, 'chars on', platform)
  // After an extension reload, an old content script is orphaned and
  // chrome.runtime.sendMessage throws *synchronously*. Bail early and
  // wrap so we never throw into the host page.
  if (!chrome.runtime?.id) return
  try {
    chrome.runtime
      .sendMessage(msg)
      .then((resp: CaptureResponse | undefined) => {
        if (!resp?.ok) return
        const savedId = resp.id
        showSavedToast(() => {
          if (!chrome.runtime?.id) return
          try {
            chrome.runtime.sendMessage({ type: 'UNDO_CAPTURE', id: savedId }).catch(() => {})
          } catch {
            /* orphaned context — ignore */
          }
        })
      })
      .catch((err) => {
        log('sendMessage failed (worker may be asleep):', err)
      })
  } catch (err) {
    log('runtime unavailable (orphaned content script):', err)
  }
}

function readText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value
  return el.innerText
}

export function attachSubmitHook(
  getElement: () => HTMLElement | null,
  platform: Platform,
): () => void {
  let lastSent = ''
  let lastSentAt = 0

  const maybeCapture = () => {
    const el = getElement()
    if (!el) {
      log('input element not found; selector may be stale')
      return
    }
    const text = readText(el)
    const now = Date.now()
    if (text === lastSent && now - lastSentAt < 2000) return
    if (text.trim().length < 2) return
    lastSent = text
    lastSentAt = now
    sendCapture(text, platform)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
    maybeCapture()
  }

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const btn = target.closest('button')
    if (!btn) return
    const label = (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase()
    const testId = btn.getAttribute('data-testid') || ''
    if (!/send|submit/.test(label) && !/send/.test(testId)) return
    maybeCapture()
  }

  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('click', onClick, true)

  log('armed for', platform, '— initial element found:', !!getElement())

  return () => {
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('click', onClick, true)
  }
}
