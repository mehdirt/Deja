import type { CaptureResponse, CapturedPromptMessage, Platform } from '@/lib/types'
import { writeHealth } from '@/lib/health'
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
        if (!resp?.ok) {
          log('background did not store prompt:', resp)
          return
        }
        // A stored prompt is the strongest possible proof capture works —
        // stronger than finding the input. Mark this platform healthy.
        void writeHealth(platform, true)
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

function isEditable(el: Element | null): el is HTMLElement {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return true
  return el instanceof HTMLElement && el.isContentEditable
}

function readText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value
  return el.innerText
}

// Find the editable the user is actually typing in. composedPath() pierces
// Shadow DOM and gives us the real target even when the event is retargeted.
function editableFromEvent(e: Event): HTMLElement | null {
  const path = (e.composedPath?.() ?? []) as Element[]
  for (const node of path) {
    if (isEditable(node as Element)) return node as HTMLElement
  }
  const target = e.target as Element | null
  const closest = target?.closest?.('textarea, input, [contenteditable="true"]')
  if (isEditable(closest ?? null)) return closest as HTMLElement
  return null
}

export function attachSubmitHook(
  getElementFallback: () => HTMLElement | null,
  platform: Platform,
): () => void {
  let lastSent = ''
  let lastSentAt = 0

  const capture = (el: HTMLElement | null, via: string) => {
    if (!el) {
      log('no editable found via', via, '— nothing to capture')
      return
    }
    const text = readText(el)
    const now = Date.now()
    if (text.trim().length < 2) return
    // Debounce duplicates within 2s (Enter + Send-click both fire).
    if (text === lastSent && now - lastSentAt < 2000) return
    lastSent = text
    lastSentAt = now
    log('captured via', via)
    sendCapture(text, platform)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.isComposing) return
    const el = editableFromEvent(e) ?? document.activeElement
    if (isEditable(el as Element)) capture(el as HTMLElement, 'enter')
  }

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    const btn = target?.closest('button, [role="button"]') as HTMLElement | null
    if (!btn) return
    const label = (
      btn.getAttribute('aria-label') ||
      btn.getAttribute('data-testid') ||
      btn.textContent ||
      ''
    ).toLowerCase()
    if (!/send|submit/.test(label)) return
    // The button isn't the editable — find it by focus, then fallback selector.
    const el =
      (isEditable(document.activeElement as Element) ? (document.activeElement as HTMLElement) : null) ??
      getElementFallback()
    capture(el, 'send-button')
  }

  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('click', onClick, true)

  log('armed for', platform, '· document-level capture active')

  return () => {
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('click', onClick, true)
  }
}
