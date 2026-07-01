export type Platform = 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'grok'

// How aggressively selective capture hides "minor" (throwaway) prompts:
//   - 'off'      → filter nothing; keep and show every prompt
//   - 'balanced' → hide obvious throwaways only (default; conservative)
//   - 'strict'   → keep only longer / structured / substantial prompts
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
  // Selective capture. A "minor" prompt is a throwaway one (a one-word
  // follow-up, a bare "yes"/"continue", a tiny fragment) — still stored (soft
  // capture, recoverable) but hidden from the library and resurface by default
  // so they don't add clutter or noise. Optional: undefined means a normal
  // ("major") prompt, so all pre-existing rows and old exports stay visible.
  // See src/lib/classify.ts for how this is decided.
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

// `filtered` is true when the captured prompt was classified "minor" and the
// user hasn't opted to keep minors — i.e. it was saved but kept out of the
// library/resurface by default, so the content script shows no "remembered"
// toast for it. `notice` is true only the first time that happens, so the
// content script can show a one-time explanation instead of silently swallowing
// the prompt (informed, not silent).
export type CaptureResponse =
  | { ok: true; id: number; filtered: boolean; notice: boolean }
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
