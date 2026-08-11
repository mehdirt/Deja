export type Platform = 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'grok'

// Categories of personal info Deja can redact from a prompt before storing it.
// Kept here so the pure redactor and the storage/prefs layers share one source.
export type PiiKind =
  | 'secret'
  | 'email'
  | 'card'
  | 'iban'
  | 'ssn'
  | 'phone'
  | 'ip'
  // Legacy placeholders from the postponed on-device NER helper. Still recognised
  // in Fill-in for prompts already saved with [person_N] / [place_N] / [city_N].
  | 'person'
  | 'place'
  | 'city'
/** Kinds the regex redactor can hide (Settings toggles). */
export const PII_KINDS: PiiKind[] = [
  'secret',
  'email',
  'card',
  'iban',
  'ssn',
  'phone',
  'ip',
]
/** @deprecated Alias — structured-only; NER postponed. */
export const PII_STRUCTURED_KINDS: PiiKind[] = PII_KINDS
/** Deferred NER kinds — kept off in prefs; Fill-in still labels legacy tokens. */
export const PII_NER_KINDS: PiiKind[] = ['person', 'place', 'city']

// How aggressively selective capture skips storing "minor" (throwaway) prompts:
//   - 'off'      → filter nothing; save every prompt
//   - 'balanced' → skip obvious throwaways only (default; conservative)
//   - 'strict'   → save only longer / structured / substantial prompts
// Lives here (not prefs.ts) so the pure classifier can import it without
// depending on the storage layer.
export type FilterStrength = 'off' | 'balanced' | 'strict'

export interface Prompt {
  id?: number
  text: string
  platform: Platform
  url: string
  createdAt: number
  usageCount: number
  lastUsedAt: number
  deletedAt?: number | null
  // Light organization (Phase 3). Optional so stored v1 rows and old JSON
  // exports stay valid; treat undefined as [] / false everywhere.
  tags?: string[]
  pinned?: boolean
  // Legacy flag from the old soft-capture era (store-but-hide). New captures
  // never set this — throwaways are skipped entirely. Optional: undefined means
  // a normal prompt. Kept so previously soft-captured rows stay recoverable in
  // the library's "filtered" view. See src/lib/classify.ts.
  minor?: boolean
  // How many times a suggestion of this prompt was waved away (the resurface
  // tooltip's ×). Feeds the suggestion ordering only — never shown to the user,
  // and never a score *of* the user. Optional: undefined means zero.
  // See src/lib/ranking.ts → suggestionRank.
  dismissCount?: number
}

export type CapturedPromptMessage = {
  type: 'PROMPT_CAPTURED'
  payload: { text: string; platform: Platform; url: string }
}

export type UndoCaptureMessage = {
  type: 'UNDO_CAPTURE'
  id: number
}

export type SimilarQueryMessage = {
  type: 'SIMILAR_QUERY'
  text: string
}

// Open the full library (options page) pre-searched with the user's in-progress
// text — fired by the resurface tooltip's "see all" affordance when there are
// more matches than it surfaces inline.
export type OpenLibraryMessage = {
  type: 'OPEN_LIBRARY'
  query: string
}

/** Settings → background: preview redaction with current prefs. */
export type RedactPreviewMessage = {
  type: 'REDACT_PREVIEW'
  text: string
  /** Optional vault snapshot so a multi-prompt scan keeps stable numbers. */
  existingVault?: Record<string, string>
}

// ── In-page library surfaces (the dot's panel and the `//` picker) ───────────
// Content scripts run in the host page's origin, so they can't read the
// extension's IndexedDB. Every library read goes through the worker.

/** One library row, thin enough to cross the message boundary cheaply. */
export type LibraryRow = {
  id: number
  text: string
  platform: Platform
  usageCount: number
  lastUsedAt: number
}

/** Content → background: search the library for an in-page surface. */
export type LibrarySearchMessage = {
  type: 'LIBRARY_SEARCH'
  /** '' means "the most useful ones", not "everything". */
  query: string
  limit?: number
}

// `total` is how many matched overall, so a surface capped at `limit` can offer
// "see all in your library" instead of silently truncating someone's library.
export type LibrarySearchResponse =
  | { ok: true; rows: LibraryRow[]; total: number }
  | { ok: false; error: string }

/** Content → background: the user explicitly kept this one (hand-save). */
export type SaveManualMessage = {
  type: 'SAVE_MANUAL'
  text: string
  platform: Platform
  url: string
}

/** Content → background: a saved prompt was reused from an in-page surface. */
export type PromptUsedMessage = {
  type: 'PROMPT_USED'
  id: number
}

/**
 * Any context → background: the library changed underneath the worker's cache.
 *
 * Fired by the shared db helpers (src/lib/db.ts). The options page writes
 * straight to Dexie from its own context, where the worker's in-memory pool
 * isn't reachable, so without this a prompt you just deleted stays offerable in
 * the chat box until the cache ages out.
 */
export type LibraryChangedMessage = {
  type: 'LIBRARY_CHANGED'
}

/** Content → background: a volunteered suggestion was waved away. */
export type SuggestionDismissedMessage = {
  type: 'SUGGESTION_DISMISSED'
  id: number
}

export type RuntimeMessage =
  | CapturedPromptMessage
  | UndoCaptureMessage
  | SimilarQueryMessage
  | OpenLibraryMessage
  | RedactPreviewMessage
  | LibrarySearchMessage
  | SaveManualMessage
  | PromptUsedMessage
  | SuggestionDismissedMessage
  | LibraryChangedMessage

// `filtered` is true when the prompt was classified "minor" and not stored.
// `notice` is true only the first time that happens, so the content script can
// show a one-time explanation instead of silently skipping (informed, not silent).
// `id` is omitted when filtered — nothing was written.
export type CaptureResponse =
  | {
      ok: true
      id?: number
      filtered: boolean
      notice: boolean
      redacted: number
      duplicate?: boolean
      /** How many least-used prompts were soft-deleted to stay under libraryCap. */
      trimmed?: number
    }
  | { ok: false; error: string }

// A prior prompt close enough to the in-progress text to resurface, carrying
// its similarity score and the meaningful words it shares with the query (so
// the tooltip can show *why* it matched). Read-only: resurface never writes.
export type SimilarMatch = {
  id: number
  text: string
  platform: Platform
  score: number
  terms: string[]
}

// The top candidates above the similarity threshold, best first (empty if none
// clear it). `matches` is capped to the few the tooltip surfaces; `total` is how
// many cleared the threshold overall, so the tooltip can offer "see all" when
// there are more than it shows.
export type SimilarResponse =
  | { ok: true; matches: SimilarMatch[]; total: number }
  | { ok: false; error: string }

export const PLATFORM_LABEL: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  grok: 'Grok',
}

// Faint per-platform accent dot so the library is scannable at a glance.
// ChatGPT is white (its current brand mark) — the UI adds a hairline ring so it
// stays visible on the light card surface.
export const PLATFORM_COLOR: Record<Platform, string> = {
  chatgpt: '#ffffff',
  claude: '#d97757',
  gemini: '#4285f4',
  deepseek: '#4d6bfe',
  grok: '#71767b',
}
