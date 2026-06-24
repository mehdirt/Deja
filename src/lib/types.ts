export type Platform = 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'grok'

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

export type RuntimeMessage = CapturedPromptMessage | UndoCaptureMessage | SimilarQueryMessage

export type CaptureResponse = { ok: true; id: number } | { ok: false; error: string }

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
// clear it). The tooltip shows the first and lets the user step through the rest.
export type SimilarResponse =
  | { ok: true; matches: SimilarMatch[] }
  | { ok: false; error: string }

export const PLATFORM_LABEL: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  grok: 'Grok',
}

// Faint per-platform accent dot so the library is scannable at a glance.
export const PLATFORM_COLOR: Record<Platform, string> = {
  chatgpt: '#10a37f',
  claude: '#d97757',
  gemini: '#4285f4',
  deepseek: '#4d6bfe',
  grok: '#71767b',
}
