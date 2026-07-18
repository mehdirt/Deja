export type Platform = 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'grok'

// Categories of personal info Deja can redact from a prompt before storing it.
// Kept here so the pure redactor and the storage/prefs layers share one source.
export type PiiKind = 'secret' | 'email' | 'card' | 'iban' | 'ssn' | 'phone' | 'ip'
export const PII_KINDS: PiiKind[] = ['secret', 'email', 'card', 'iban', 'ssn', 'phone', 'ip']

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

export type RuntimeMessage =
  | CapturedPromptMessage
  | UndoCaptureMessage
  | SimilarQueryMessage
  | OpenLibraryMessage

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
