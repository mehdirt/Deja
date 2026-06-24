import { savePrompt, hardDelete, listPrompts } from '@/lib/db'
import { findSimilar } from '@/lib/similarity'
import type { RuntimeMessage } from '@/lib/types'

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === 'PROMPT_CAPTURED') {
    void (async () => {
      try {
        const id = await savePrompt({
          text: message.payload.text,
          platform: message.payload.platform,
          url: message.payload.url,
          createdAt: Date.now(),
        })
        sendResponse({ ok: true, id })
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
        // excludes soft-deleted rows. Threshold 0.4 is the roadmap's start.
        // Scaling ceiling: this re-reads the whole table and trigram-scans it
        // on every debounced keystroke. Fine for hundreds of prompts; at
        // thousands, add a worker-scope pool cache (invalidate on capture/
        // delete) or precomputed trigram sets. Deferred until real use shows it.
        const pool = await listPrompts()
        const hits = findSimilar(message.text, pool, 0.4, 1)
        const top = hits[0]?.item
        const match =
          top && top.id != null
            ? { id: top.id, text: top.text, platform: top.platform }
            : null
        sendResponse({ ok: true, match })
      } catch (err) {
        sendResponse({ ok: false, error: String(err) })
      }
    })()
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
