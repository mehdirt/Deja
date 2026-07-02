import { savePrompt, hardDelete, listPrompts } from '@/lib/db'
import { findSimilar } from '@/lib/similarity'
import { classifyPrompt } from '@/lib/classify'
import { redactPii } from '@/lib/pii'
import { readPrefs, writePrefs, onPrefsChange, isPaused, PAUSE_FOREVER, type Prefs } from '@/lib/prefs'
import type { RuntimeMessage } from '@/lib/types'

// How many matches the resurface tooltip shows inline before offering "see all".
const SURFACED_MATCHES = 3

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === 'PROMPT_CAPTURED') {
    void (async () => {
      try {
        // Selective capture: classify at the user's chosen strength, but ALWAYS
        // store (soft capture — never lose a prompt). A "minor" prompt is saved
        // flagged; at strength 'off' nothing is ever minor.
        const prefs = await readPrefs()
        // Redact personal info BEFORE anything else, so raw PII never reaches
        // IndexedDB, the search index, or the resurface pool. We store (and
        // classify) the redacted text.
        const redaction = prefs.redactPii
          ? redactPii(message.payload.text, prefs.piiKinds)
          : { text: message.payload.text, total: 0 }
        const text = redaction.text
        const { minor } = classifyPrompt(text, prefs.filterStrength)
        const id = await savePrompt({
          text,
          platform: message.payload.platform,
          url: message.payload.url,
          createdAt: Date.now(),
          minor,
        })
        // "Filtered" = stored but hidden. Tell the content script so it skips the
        // normal "remembered" toast, and the FIRST time, asks it to show a
        // one-time explanation. `redacted` lets it note "N redacted".
        const filtered = minor
        let notice = false
        if (filtered && !prefs.minorNoticeSeen) {
          notice = true
          await writePrefs({ minorNoticeSeen: true })
        }
        sendResponse({ ok: true, id, filtered, notice, redacted: redaction.total })
      } catch (err) {
        sendResponse({ ok: false, error: String(err) })
      }
    })()
    return true
  }

  if (message?.type === 'SIMILAR_QUERY') {
    void (async () => {
      try {
        // Content scripts can't read the extension's IndexedDB (isolated
        // world → host-page origin), so they ask us. listPrompts() already
        // excludes soft-deleted rows. Threshold 0.4 is the roadmap's start; we
        // return the top few so the tooltip can let the user step through them.
        // Scaling ceiling: this re-reads the whole table and trigram-scans it
        // on every debounced keystroke. Fine for hundreds of prompts; at
        // thousands, add a worker-scope pool cache (invalidate on capture/
        // delete) or precomputed trigram sets. Deferred until real use shows it.
        // Resurface never suggests minor (filtered) prompts unless the filter is
        // off — short throwaways are exactly the noise it should not surface.
        const prefs = await readPrefs()
        const pool = await listPrompts({ includeMinor: prefs.filterStrength === 'off' })
        // Score the whole pool (already sorted, best first) so we know the true
        // count above threshold; surface only the top few inline and report the
        // rest as `total` so the tooltip can offer "see all in library".
        // Drop any prompt whose text is identical (ignoring case/whitespace) to
        // the query: resurface is for catching a prompt you're *re-asking*, not
        // for echoing one you've already typed out in full — and this is the
        // backstop that guarantees the prompt you just submitted is never
        // suggested back to you, even if a stale query slips through.
        // Redact the query the same way stored prompts were, so PII in the
        // in-progress text matches the placeholders in the pool (and never even
        // gets scored raw).
        const queryText = prefs.redactPii
          ? redactPii(message.text, prefs.piiKinds).text
          : message.text
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
        const queryNorm = norm(queryText)
        const hits = findSimilar(queryText, pool, 0.4, pool.length || 1).filter(
          (h) => h.item.id != null && norm(h.item.text) !== queryNorm,
        )
        const matches = hits.slice(0, SURFACED_MATCHES).map((h) => ({
          id: h.item.id as number,
          text: h.item.text,
          platform: h.item.platform,
          score: h.score,
          terms: h.terms,
        }))
        sendResponse({ ok: true, matches, total: hits.length })
      } catch (err) {
        sendResponse({ ok: false, error: String(err) })
      }
    })()
    return true
  }

  if (message?.type === 'OPEN_LIBRARY') {
    // Open the library (options page) in a new tab, pre-searched with the user's
    // in-progress text. tabs.create needs no extra permission (unlike reading
    // tab contents). The query is read off the URL by the options app.
    const q = message.query ? `?q=${encodeURIComponent(message.query)}` : ''
    try {
      void chrome.tabs.create({ url: chrome.runtime.getURL(`src/options/index.html${q}`) })
      sendResponse({ ok: true })
    } catch (err) {
      sendResponse({ ok: false, error: String(err) })
    }
    return true
  }

  if (message?.type === 'UNDO_CAPTURE') {
    void (async () => {
      try {
        await hardDelete(message.id)
        sendResponse({ ok: true, id: message.id })
      } catch (err) {
        sendResponse({ ok: false, error: String(err) })
      }
    })()
    return true
  }

  return undefined
})

// ── Pause badge ───────────────────────────────────────────────────────────────
// A quiet toolbar badge so a paused state is visible at a glance (and can't be
// forgotten). Capture itself resumes on its own — the content gate checks the
// pause time live — so this is purely cosmetic; the alarm just clears the badge
// punctually when a timed pause ends.

const PAUSE_ALARM = 'deja:pause-expiry'

function paintBadge(prefs: Prefs): void {
  try {
    const paused = isPaused(prefs)
    void chrome.action.setBadgeText({ text: paused ? '||' : '' })
    if (paused) void chrome.action.setBadgeBackgroundColor({ color: '#c98a2b' })
  } catch {
    /* action API unavailable — ignore */
  }
}

// Keep a single alarm aligned with a timed pause. Indefinite pauses
// (PAUSE_FOREVER) need no alarm; resume is manual.
async function syncPauseAlarm(prefs: Prefs): Promise<void> {
  try {
    await chrome.alarms.clear(PAUSE_ALARM)
    if (prefs.pauseUntil > Date.now() && prefs.pauseUntil !== PAUSE_FOREVER) {
      chrome.alarms.create(PAUSE_ALARM, { when: prefs.pauseUntil })
    }
  } catch {
    /* alarms unavailable — badge will still self-correct on the next prefs change */
  }
}

async function refreshPauseState(): Promise<void> {
  const prefs = await readPrefs()
  paintBadge(prefs)
  await syncPauseAlarm(prefs)
}

// React to pause/resume from the popup (and any other prefs write).
onPrefsChange((prefs) => {
  paintBadge(prefs)
  void syncPauseAlarm(prefs)
})

// When a timed pause elapses, clear it for real so the badge and stored state
// agree (the gate had already resumed capture on its own).
try {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== PAUSE_ALARM) return
    void (async () => {
      const prefs = await readPrefs()
      if (!isPaused(prefs)) {
        await writePrefs({ pauseUntil: 0 }) // triggers onPrefsChange → repaint
      }
    })()
  })
} catch {
  /* alarms unavailable — ignore */
}

// Paint on every worker wake (MV3 workers are short-lived and start fresh).
void refreshPauseState()
