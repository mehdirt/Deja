import {
  db,
  savePrompt,
  hardDelete,
  listPrompts,
  findExistingPrompt,
  touchUsage,
  touchDismiss,
  purgeExpiredDeleted,
} from '@/lib/db'
import { findSimilar } from '@/lib/similarity'
import { classifyPrompt } from '@/lib/classify'
import { trimLibraryToCap } from '@/lib/libraryCap'
import { mergePiiVault, readPiiVault } from '@/lib/piiVault'
import { redactPii } from '@/lib/pii'
import { getIndex, getPool, invalidatePool } from '@/background/pool'
import { searchPrompts } from '@/lib/search'
import { suggestionRank, usefulnessScore } from '@/lib/ranking'
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

// How many rows the in-page panel / picker show before offering "see all in
// your library". Six fits the panel's max height without scrolling on a laptop.
const DEFAULT_SEARCH_LIMIT = 6

// Redaction before storage, shared by both write paths.
//
// CLAUDE.md calls this ordering load-bearing: raw personal info must never
// reach IndexedDB, the search index, or the resurface pool, so it happens
// before anything else looks at the text. The hand-save path needs exactly the
// same treatment as a normal capture — someone asking to keep a prompt is not
// asking to keep their card number — so the sequence lives in one place rather
// than being copied and drifting.
async function redactForStorage(
  text: string,
  prefs: Prefs,
): Promise<{ text: string; redacted: number }> {
  if (!prefs.redactPii) return { text, redacted: 0 }
  const vault = prefs.rememberHiddenDetails ? await readPiiVault() : {}
  const redaction = redactPii(text, prefs.piiKinds, {
    existingVault: vault,
  })
  // The vault is what lets Fill-in offer the original back later. Never
  // written into the prompt row, and never into a backup.
  if (prefs.rememberHiddenDetails && redaction.total > 0) {
    void mergePiiVault(redaction.mappings)
  }
  return { text: redaction.text, redacted: redaction.total }
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === 'PROMPT_CAPTURED') {
    void (async () => {
      try {
        const prefs = await readPrefs()
        // Redact personal info BEFORE anything else, so raw PII never reaches
        // IndexedDB, the search index, or the resurface pool. We store (and
        // classify) the redacted text. Optional vault keeps originals privately
        // for Fill-in — never written into the prompt row or backups.
        const { text, redacted: redactedTotal } = await redactForStorage(
          message.payload.text,
          prefs,
        )

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

          // A throwaway is skipped here, before the near-duplicate scan. That
          // scan reads the whole table and trigram-scores it, and glue ("yes",
          // "ok thanks") is the single most frequent thing a person sends — so
          // running it first meant the heaviest work in the capture path fired
          // on the messages guaranteed not to be stored. The exact-match bump
          // above still runs first, so re-sending a prompt already in the
          // library still accrues usage whatever today's filter thinks of it.
          if (minor) return { kind: 'minor' } as const

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

          const id = await savePrompt({
            text,
            platform: message.payload.platform,
            url: message.payload.url,
            createdAt: Date.now(),
          })
          return { kind: 'saved', id } as const
        })
        // Any of the three outcomes can have changed the pool: 'saved' adds a
        // row, 'duplicate' bumped usage on one, and only 'minor' left it alone
        // (cheap enough not to special-case).
        invalidatePool()

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
            if (trimmed > 0) invalidatePool()
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
        const pool = await getPool(prefs.filterStrength === 'off')
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
          ? redactPii(message.text, prefs.piiKinds, {
              existingVault: prefs.rememberHiddenDetails ? await readPiiVault() : {},
            }).text
          : message.text
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
        const queryNorm = norm(queryText)
        const hits = findSimilar(queryText, pool, 0.4, pool.length || 1).filter(
          (h) => h.item.id != null && norm(h.item.text) !== queryNorm,
        )
        // Re-rank what already cleared the threshold by how the person has
        // actually treated each one — used goes up, waved away goes down.
        // Similarity stays dominant (see suggestionRank), and this can only
        // reorder candidates, never introduce one. Turning the preference off
        // leaves the pure similarity order.
        if (prefs.learnFromUse) {
          const now = Date.now()
          hits.sort((a, b) => suggestionRank(b.score, b.item, now) - suggestionRank(a.score, a.item, now))
        }
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

  if (message?.type === 'LIBRARY_SEARCH') {
    void (async () => {
      try {
        const prefs = await readPrefs()
        // Same rule the resurface pool uses: a throwaway the filter chose not
        // to keep shouldn't reappear through a different door.
        const pool = await getPool(prefs.filterStrength === 'off')
        const limit = Math.max(1, Math.min(20, message.limit ?? DEFAULT_SEARCH_LIMIT))
        const q = message.query.trim()

        let ordered: typeof pool
        if (q) {
          // Reuse the library's own search so plural/spelling folding and the
          // everyday-synonym pass apply here too — someone half-remembering
          // their own wording is exactly who this surface is for.
          const index = await getIndex(prefs.filterStrength === 'off')
          const byId = new Map(pool.map((p) => [p.id, p]))
          ordered = searchPrompts(index, q, 100)
            .map((h) => byId.get(h.id as number))
            .filter((p): p is (typeof pool)[number] => p != null)
        } else {
          // No query yet: the most useful ones, which is what someone opening
          // the panel cold most likely wants.
          const now = Date.now()
          ordered = [...pool].sort((a, b) => usefulnessScore(b, now) - usefulnessScore(a, now))
        }

        const rows = ordered.slice(0, limit).map((p) => ({
          id: p.id as number,
          text: p.text,
          platform: p.platform,
          usageCount: p.usageCount ?? 0,
          lastUsedAt: p.lastUsedAt ?? p.createdAt,
        }))
        sendResponse({ ok: true, rows, total: ordered.length })
      } catch (err) {
        sendResponse({ ok: false, error: String(err) })
      }
    })()
    return true
  }

  // A prompt the user kept by hand, because capture couldn't see the box.
  // Deliberately NOT a copy of the PROMPT_CAPTURED path: redaction still runs
  // (they asked to keep the text, not their card number) and duplicate
  // collapsing still runs, but the throwaway classifier does NOT — an explicit
  // click is explicit intent, and filtering it would be overriding the person.
  if (message?.type === 'SAVE_MANUAL') {
    void (async () => {
      try {
        const prefs = await readPrefs()
        const { text, redacted: redactedTotal } = await redactForStorage(
          message.text.trim(),
          prefs,
        )

        const outcome = await db.transaction('rw', db.prompts, async () => {
          const existing = await findExistingPrompt(message.platform, text)
          if (existing?.id != null) {
            await touchUsage(existing.id)
            return { kind: 'duplicate', id: existing.id } as const
          }
          const id = await savePrompt({
            text,
            platform: message.platform,
            url: message.url,
            createdAt: Date.now(),
          })
          return { kind: 'saved', id } as const
        })
        invalidatePool()

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

        let trimmed = 0
        if (prefs.libraryCap > 0) {
          try {
            trimmed = await trimLibraryToCap(prefs.libraryCap)
            invalidatePool()
          } catch {
            /* cap is best-effort — never fail the save itself */
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

  // Reuse and dismissal signals from the in-page surfaces. Both only nudge the
  // order of future suggestions; neither hides anything or is ever shown back
  // to the user. Both invalidate the pool, because the fields they bump are
  // precisely the ones the ordering reads.
  if (message?.type === 'PROMPT_USED') {
    void (async () => {
      try {
        await touchUsage(message.id)
        invalidatePool()
        sendResponse({ ok: true })
      } catch (err) {
        sendResponse({ ok: false, error: String(err) })
      }
    })()
    return true
  }

  if (message?.type === 'SUGGESTION_DISMISSED') {
    void (async () => {
      try {
        await touchDismiss(message.id)
        invalidatePool()
        sendResponse({ ok: true })
      } catch (err) {
        sendResponse({ ok: false, error: String(err) })
      }
    })()
    return true
  }

  // Something outside this worker changed the library (the options page writes
  // straight to Dexie). Drop the cache so the next in-page search is honest.
  if (message?.type === 'LIBRARY_CHANGED') {
    invalidatePool()
    sendResponse({ ok: true })
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
        invalidatePool()
        sendResponse({ ok: true, id: message.id })
      } catch (err) {
        sendResponse({ ok: false, error: String(err) })
      }
    })()
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
        const r = redactPii(message.text, prefs.piiKinds, {
          existingVault: vault,
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
