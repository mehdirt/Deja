import {
  db,
  savePrompt,
  hardDelete,
  listPrompts,
  findExistingPrompt,
  touchUsage,
  purgeExpiredDeleted,
} from '@/lib/db'
import { findSimilar } from '@/lib/similarity'
import { classifyPrompt } from '@/lib/classify'
import { trimLibraryToCap } from '@/lib/libraryCap'
import { mergePiiVault, readPiiVault } from '@/lib/piiVault'
import { loadNerModel, redactPiiFull } from '@/background/nerBridge'
import {
  readPrefs,
  writePrefs,
  onPrefsChange,
  isPaused,
  PAUSE_FOREVER,
  type Prefs,
} from '@/lib/prefs'
import type { RuntimeMessage } from '@/lib/types'

// How many matches the resurface tooltip shows inline before offering "see all".
const SURFACED_MATCHES = 3

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === 'PROMPT_CAPTURED') {
    void (async () => {
      try {
        const prefs = await readPrefs()
        // Redact personal info BEFORE anything else, so raw PII never reaches
        // IndexedDB, the search index, or the resurface pool. We store (and
        // classify) the redacted text. Optional vault keeps originals privately
        // for Fill-in — never written into the prompt row or backups.
        let text = message.payload.text
        let redactedTotal = 0
        if (prefs.redactPii) {
          const vault = prefs.rememberHiddenDetails ? await readPiiVault() : {}
          const redaction = await redactPiiFull(message.payload.text, prefs.piiKinds, {
            existingVault: vault,
            nerNamesPlaces: prefs.nerNamesPlaces,
          })
          text = redaction.text
          redactedTotal = redaction.total
          if (prefs.rememberHiddenDetails && redaction.total > 0) {
            void mergePiiVault(redaction.mappings)
          }
        }

        // Selective capture: skip storing throwaways at the user's strength.
        // At 'off' nothing is ever skipped. (Legacy rows may still carry
        // `minor` from the old soft-capture era — library can reveal those.)
        // Computed up front — it's pure and doesn't touch the DB, so it can't
        // widen the transaction below; only its result is used, and only in
        // the branch where no duplicate was found.
        const { minor } = classifyPrompt(text, prefs.filterStrength)

        // The duplicate/near-duplicate check-then-write sequence below reads
        // the table, decides, then writes — two PROMPT_CAPTURED messages
        // arriving close together (e.g. a stray double-submit, or two tabs on
        // the same platform) could otherwise both pass the checks before
        // either write lands, creating a duplicate row instead of collapsing
        // to a usage bump. Wrapping it in one Dexie transaction makes
        // IndexedDB serialize overlapping handlers on the `prompts` table.
        const outcome = await db.transaction('rw', db.prompts, async () => {
          // Re-submitting an already-stored prompt (e.g. paste a resurfaced
          // match and hit Enter) should not create a duplicate row — bump
          // usage instead. Checked before the throwaway filter so a prompt
          // the user already kept still accrues usage even if today's filter
          // would skip it as new.
          const existing = await findExistingPrompt(message.payload.platform, text)
          if (existing?.id != null) {
            await touchUsage(existing.id)
            return { kind: 'duplicate', id: existing.id } as const
          }

          // If there's an already-saved prompt on this platform whose body is
          // very similar to what the user just submitted, treat it as the
          // same prompt and bump its usage instead of creating a near-duplicate row.
          const pool = await listPrompts({ includeMinor: true })
          const samePlatform = pool.filter(
            (p) => p.platform === message.payload.platform && p.id != null,
          )
          const fuzzyHits = findSimilar(
            text,
            samePlatform,
            0.75, // 75%+ similarity counts as "already stored"
            1,
          )
          const fuzzy = fuzzyHits[0]
          if (fuzzy?.item.id != null) {
            await touchUsage(fuzzy.item.id)
            return { kind: 'duplicate', id: fuzzy.item.id } as const
          }

          if (minor) return { kind: 'minor' } as const

          const id = await savePrompt({
            text,
            platform: message.payload.platform,
            url: message.payload.url,
            createdAt: Date.now(),
          })
          return { kind: 'saved', id } as const
        })

        if (outcome.kind === 'duplicate') {
          sendResponse({
            ok: true,
            id: outcome.id,
            filtered: false,
            notice: false,
            redacted: redactedTotal,
            duplicate: true,
          })
          return
        }

        if (outcome.kind === 'minor') {
          let notice = false
          if (!prefs.minorNoticeSeen) {
            notice = true
            await writePrefs({ minorNoticeSeen: true })
          }
          sendResponse({
            ok: true,
            filtered: true,
            notice,
            redacted: redactedTotal,
          })
          return
        }

        // Soft size cap after a new row — least-used / oldest tucked away.
        // Runs outside the save transaction; favorites are never touched.
        let trimmed = 0
        if (prefs.libraryCap > 0) {
          try {
            trimmed = await trimLibraryToCap(prefs.libraryCap)
          } catch {
            /* cap is best-effort — never fail the capture itself */
          }
        }

        sendResponse({
          ok: true,
          id: outcome.id,
          filtered: false,
          notice: false,
          redacted: redactedTotal,
          trimmed,
        })
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
          ? (
              await redactPiiFull(message.text, prefs.piiKinds, {
                existingVault: prefs.rememberHiddenDetails ? await readPiiVault() : {},
                nerNamesPlaces: prefs.nerNamesPlaces,
              })
            ).text
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
      chrome.tabs
        .create({ url: chrome.runtime.getURL(`src/options/index.html${q}`) })
        .catch(() => {})
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

  if (message?.type === 'NER_LOAD') {
    void loadNerModel().then((result) => sendResponse(result))
    return true
  }

  if (message?.type === 'REDACT_PREVIEW') {
    void (async () => {
      try {
        const prefs = await readPrefs()
        if (!prefs.redactPii) {
          sendResponse({
            ok: true,
            text: message.text,
            total: 0,
            counts: {},
            mappings: {},
          })
          return
        }
        const vault = {
          ...(prefs.rememberHiddenDetails ? await readPiiVault() : {}),
          ...(message.existingVault ?? {}),
        }
        const r = await redactPiiFull(message.text, prefs.piiKinds, {
          existingVault: vault,
          nerNamesPlaces: prefs.nerNamesPlaces,
        })
        sendResponse({
          ok: true,
          text: r.text,
          total: r.total,
          counts: r.counts,
          mappings: r.mappings,
        })
      } catch (err) {
        sendResponse({ ok: false, error: String(err) })
      }
    })()
    return true
  }

  return undefined
})

// ── First run ─────────────────────────────────────────────────────────────────
// Deja does its work invisibly, so the failure mode after install isn't a
// confusing setup screen — it's nothing happening and the extension being
// forgotten. Open the welcome view once, on install only (never on update).

try {
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason !== 'install') return
    try {
      chrome.tabs
        .create({ url: chrome.runtime.getURL('src/options/index.html?welcome=1') })
        .catch(() => {})
    } catch {
      /* tabs unavailable — skip; the extension still works */
    }
  })
} catch {
  /* onInstalled unavailable — ignore */
}

// ── Pause badge ───────────────────────────────────────────────────────────────
// A quiet toolbar badge so a paused state is visible at a glance (and can't be
// forgotten). Capture itself resumes on its own — the content gate checks the
// pause time live — so this is purely cosmetic; the alarm just clears the badge
// punctually when a timed pause ends.

const PAUSE_ALARM = 'deja:pause-expiry'

function paintBadge(prefs: Prefs): void {
  try {
    const paused = isPaused(prefs)
    chrome.action.setBadgeText({ text: paused ? '||' : '' }).catch(() => {})
    if (paused) chrome.action.setBadgeBackgroundColor({ color: '#c98a2b' }).catch(() => {})
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
      await chrome.alarms.create(PAUSE_ALARM, { when: prefs.pauseUntil })
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

// Soft-deletes only last for a short Undo window. Sweep leftovers on wake so a
// closed options page can't leave forever-tombstones on disk.
void purgeExpiredDeleted().catch(() => {})
