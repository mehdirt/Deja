import type { CaptureResponse, CapturedPromptMessage, Platform } from '@/lib/types'
import { writeHealth } from '@/lib/health'
import { isBlocked } from '@/lib/blocklist'
import { isCapturableField, withinComposer, looksLikeAuthPath, safeCaptureUrl } from '@/lib/sensitive'
import { getBlocklist } from './blocklist'
import { shouldCapture } from './captureGate'
import { showSavedToast, showInfoToast } from './toast'

// Quiet by default — the host page's console must stay clean, and capture
// activity (even just lengths) shouldn't be narrated on chatgpt.com et al.
const DEBUG = false

function log(...args: unknown[]) {
  if (DEBUG) console.log('[Deja]', ...args)
}

export function sendCapture(text: string, platform: Platform): void {
  const trimmed = text.trim()
  if (trimmed.length < 2) return
  // Honor the capture controls first (pause, per-site switch, incognito
  // auto-pause). Synchronous, fail-open snapshot — no latency added. When paused
  // or switched off we capture nothing: no write, no toast, no health change.
  if (!shouldCapture()) {
    log('capture paused or disabled — skipping on', platform)
    return
  }
  // Honor the capture blocklist (privacy-critical). Read the cached snapshot
  // synchronously — no latency added. If blocked, silently skip: capture
  // nothing, no toast, no health write. isBlocked is pure and never throws.
  if (isBlocked(location.href, trimmed, getBlocklist())) {
    log('blocked by blocklist — skipping capture on', platform)
    return
  }
  const msg: CapturedPromptMessage = {
    type: 'PROMPT_CAPTURED',
    // Store only origin+path — query/hash can carry OAuth/magic-link tokens.
    payload: { text: trimmed, platform, url: safeCaptureUrl(location.href) },
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
        // stronger than finding the input. Mark this platform healthy. (The
        // prompt is always stored, even when filtered, so this holds.)
        void writeHealth(platform, true)
        // Selective capture: a "filtered" prompt was a short throwaway, saved
        // but kept out of the library/resurface. Don't show the "remembered"
        // toast for it (that would be noise on every "yes"/"continue"); the
        // first time it happens, show a one-time explanation so it's never
        // silent. A kept prompt gets the usual toast with undo.
        if (resp.filtered) {
          if (resp.notice) showInfoToast('skipped a short prompt · change in deja settings')
          return
        }
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
  if (el instanceof HTMLTextAreaElement) return el.value
  return el.innerText
}

// Find the capturable editable the user is actually typing in. composedPath()
// pierces Shadow DOM and gives us the real target even when the event is
// retargeted. isCapturableField excludes <input> entirely (so password/email/
// search fields can never match) and refuses credential/OTP/payment fields.
function editableFromEvent(e: Event): HTMLElement | null {
  const path = (e.composedPath?.() ?? []) as Element[]
  for (const node of path) {
    if (isCapturableField(node as Element)) return node as HTMLElement
  }
  const target = e.target as Element | null
  // Note: no bare "input" in this selector — inputs are never the composer.
  const closest = target?.closest?.('textarea, [contenteditable="true"]')
  if (isCapturableField(closest ?? null)) return closest as HTMLElement
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

  // Only capture an editable that belongs to the site's known composer. If the
  // composer can't be found (login page, selector drift), `withinComposer`
  // returns true and we rely on isCapturableField alone — which already refuses
  // inputs and credential fields, so a login screen captures nothing.
  const captureIfComposer = (el: Element | null, via: string) => {
    if (!isCapturableField(el)) return
    const composer = getElementFallback()
    // If we can't find the composer and the page looks like a login/auth
    // screen, refuse — don't fall back to capturing a stray editable there.
    if (!composer && looksLikeAuthPath(location.pathname)) return
    if (!withinComposer(el, composer)) return
    capture(el, via)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.isComposing) return
    const el = editableFromEvent(e) ?? document.activeElement
    captureIfComposer(el, 'enter')
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
    const focused = document.activeElement
    const el = isCapturableField(focused) ? (focused as HTMLElement) : getElementFallback()
    captureIfComposer(el, 'send-button')
  }

  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('click', onClick, true)

  log('armed for', platform, '· document-level capture active')

  return () => {
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('click', onClick, true)
  }
}
