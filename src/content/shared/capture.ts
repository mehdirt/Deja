import type { CaptureResponse, CapturedPromptMessage, Platform } from '@/lib/types'
import { writeHealth } from '@/lib/health'
import { isBlocked } from '@/lib/blocklist'
import { isCapturableField, withinComposer, looksLikeAuthPath, safeCaptureUrl } from '@/lib/sensitive'
import { getBlocklist } from './blocklist'
import { shouldCapture } from './captureGate'
import { showSavedToast, showInfoToast, showActionToast } from './toast'
import { readText, editableFromEvent } from './editable'

// Quiet by default — the host page's console must stay clean, and capture
// activity (even just lengths) shouldn't be narrated on chatgpt.com et al.
const DEBUG = false

function log(...args: unknown[]) {
  if (DEBUG) console.log('[Deja]', ...args)
}

/**
 * Overrule a skip: store a prompt the filter passed on.
 *
 * Reuses SAVE_MANUAL, the same message the in-page hand-save sends, which
 * bypasses the classifier by design — the whole point is that the person
 * disagreed with it. Redaction still happens in the worker, so keeping a prompt
 * by hand never keeps personal details the settings say to hide.
 *
 * Fire-and-forget, like every other content→background call here: it must never
 * throw into the host page, and the toast has already told the user it's kept.
 */
function keepAnyway(text: string, platform: Platform, url: string): void {
  if (!chrome.runtime?.id) return
  try {
    chrome.runtime.sendMessage({ type: 'SAVE_MANUAL', text, platform, url }).catch(() => {})
  } catch {
    /* orphaned context — ignore */
  }
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
          // A DOM-selector probe finding the composer isn't the whole health
          // picture — the message pipeline itself can fail (worker error,
          // storage rejection). Surface that too, the same way the DOM probe
          // failure does, so capture-health isn't blind to this failure mode.
          void writeHealth(platform, false)
          return
        }
        // Successfully processed a capture (stored, duplicate, or deliberately
        // skipped as throwaway) — stronger than merely finding the input.
        void writeHealth(platform, true)
        // Already in the library — no toast, no undo (nothing new was written).
        if (resp.duplicate) return
        // Selective capture: throwaway was not stored. No "saved" toast.
        //
        // A skip is permanent — nothing was written, and there is no row to go
        // back for later — so the strength that makes a *judgment call* offers
        // the call back. 'short' only comes from 'strict', where the prompt was
        // a real if terse ask; one button hand-saves it. 'trivial' is glue, and
        // being asked whether to keep "yes" every time would be its own kind of
        // rude, so that one keeps the quiet one-time explanation.
        if (resp.filtered) {
          if (resp.reason === 'short') {
            showActionToast(
              'Skipped a short one — want to keep it?',
              'Keep it',
              () => keepAnyway(trimmed, platform, msg.payload.url),
              'Kept it ✓',
            )
          } else if (resp.notice) {
            showInfoToast(
              'Skipped a short one — you can change that anytime in Deja’s settings',
            )
          }
          return
        }
        const savedId = resp.id
        if (savedId == null) return
        const bits: string[] = []
        if (resp.redacted > 0) {
          bits.push(
            `${resp.redacted} personal ${resp.redacted === 1 ? 'detail' : 'details'} hidden`,
          )
        }
        if (resp.trimmed && resp.trimmed > 0) {
          bits.push(
            resp.trimmed === 1
              ? 'removed 1 rarely used prompt to stay under your limit'
              : `removed ${resp.trimmed} rarely used prompts to stay under your limit`,
          )
        }
        const note = bits.length ? bits.join(' · ') : undefined
        showSavedToast(() => {
          if (!chrome.runtime?.id) return
          try {
            chrome.runtime.sendMessage({ type: 'UNDO_CAPTURE', id: savedId }).catch(() => {})
          } catch {
            /* orphaned context — ignore */
          }
        }, note)
      })
      .catch((err) => {
        log('sendMessage failed (worker may be asleep):', err)
        void writeHealth(platform, false)
      })
  } catch (err) {
    log('runtime unavailable (orphaned content script):', err)
  }
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
    // One of Deja's own in-page surfaces already claimed this Enter (the `//`
    // picker takes a row with it). This listener is document-capture-phase, so
    // by the time it runs only our own code could have called preventDefault —
    // a site that prevents its own Enter does so later, on its own element.
    // Without this, choosing a row from the picker also saves the half-typed
    // draft as if it had been sent.
    if (e.defaultPrevented) return
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
