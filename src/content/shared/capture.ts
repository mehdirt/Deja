import type { CapturedPromptMessage, Platform } from '@/lib/types'

export function sendCapture(text: string, platform: Platform): void {
  const trimmed = text.trim()
  if (trimmed.length < 2) return
  const msg: CapturedPromptMessage = {
    type: 'PROMPT_CAPTURED',
    payload: { text: trimmed, platform, url: location.href },
  }
  chrome.runtime.sendMessage(msg).catch(() => {
    // Background may not be ready; drop silently. We never want to break the host page.
  })
}

// Attach a submit hook to a textarea/contenteditable. Returns a teardown function.
export function attachSubmitHook(
  getElement: () => HTMLElement | null,
  platform: Platform,
): () => void {
  let lastSent = ''
  let lastSentAt = 0

  const readText = (el: HTMLElement): string => {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value
    return el.innerText
  }

  const maybeCapture = (el: HTMLElement) => {
    const text = readText(el)
    const now = Date.now()
    // Debounce: ignore duplicate captures within 2s (prevents double-fire on Enter + Send click).
    if (text === lastSent && now - lastSentAt < 2000) return
    lastSent = text
    lastSentAt = now
    sendCapture(text, platform)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
    const el = e.target as HTMLElement | null
    if (!el) return
    maybeCapture(el)
  }

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    // Heuristic: look for an aria-label or data attribute hinting at "send"
    const btn = target.closest('button')
    if (!btn) return
    const label = (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase()
    if (!/send|submit/.test(label) && btn.getAttribute('data-testid') !== 'send-button') return
    const el = getElement()
    if (el) maybeCapture(el)
  }

  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('click', onClick, true)

  return () => {
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('click', onClick, true)
  }
}
