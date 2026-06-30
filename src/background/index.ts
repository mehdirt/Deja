import { savePrompt, hardDelete, listPrompts } from '@/lib/db'
import { findSimilar } from '@/lib/similarity'
import { classifyPrompt } from '@/lib/classify'
import { readPrefs, writePrefs } from '@/lib/prefs'
import type { RuntimeMessage } from '@/lib/types'

// How many matches the resurface tooltip shows inline before offering "see all".
const SURFACED_MATCHES = 3

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === 'PROMPT_CAPTURED') {
    void (async () => {
      try {
        // Selective capture: classify, but ALWAYS store (soft capture — never
        // lose a prompt). A "minor" prompt is saved flagged; whether it's then
        // hidden depends on the user's keepMinor preference.
        const { minor } = classifyPrompt(message.payload.text)
        const prefs = await readPrefs()
        const id = await savePrompt({
          text: message.payload.text,
          platform: message.payload.platform,
          url: message.payload.url,
          createdAt: Date.now(),
          minor,
        })
        // "Filtered" = stored but hidden (minor, and the user keeps the filter
        // on). Tell the content script so it skips the normal "remembered"
        // toast, and the FIRST time, asks it to show a one-time explanation.
        const filtered = minor && !prefs.keepMinor
        let notice = false
        if (filtered && !prefs.minorNoticeSeen) {
          notice = true
          await writePrefs({ minorNoticeSeen: true })
        }
        sendResponse({ ok: true, id, filtered, notice })
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
        // Resurface never suggests minor (filtered) prompts unless the user has
        // turned the filter off — short throwaways are exactly the noise the
        // resurface tooltip should not surface.
        const prefs = await readPrefs()
        const pool = await listPrompts({ includeMinor: prefs.keepMinor })
        // Score the whole pool (already sorted, best first) so we know the true
        // count above threshold; surface only the top few inline and report the
        // rest as `total` so the tooltip can offer "see all in library".
        // Drop any prompt whose text is identical (ignoring case/whitespace) to
        // the query: resurface is for catching a prompt you're *re-asking*, not
        // for echoing one you've already typed out in full — and this is the
        // backstop that guarantees the prompt you just submitted is never
        // suggested back to you, even if a stale query slips through.
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
        const queryNorm = norm(message.text)
        const hits = findSimilar(message.text, pool, 0.4, pool.length || 1).filter(
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
