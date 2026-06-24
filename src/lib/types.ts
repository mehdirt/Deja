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

// The closest prior prompt to the in-progress text, or null if nothing clears
// the similarity threshold. Read-only: the resurface tooltip never writes.
export type SimilarMatch = { id: number; text: string; platform: Platform }

export type SimilarResponse =
  | { ok: true; match: SimilarMatch | null }
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
