export type Platform = 'chatgpt' | 'claude' | 'gemini'

export interface Prompt {
  id?: number
  text: string
  platform: Platform
  url: string
  createdAt: number
  usageCount: number
  lastUsedAt: number
  deletedAt?: number | null
}

export type CapturedPromptMessage = {
  type: 'PROMPT_CAPTURED'
  payload: { text: string; platform: Platform; url: string }
}

export type UndoCaptureMessage = {
  type: 'UNDO_CAPTURE'
  id: number
}

export type RuntimeMessage = CapturedPromptMessage | UndoCaptureMessage

export type CaptureResponse = { ok: true; id: number } | { ok: false; error: string }

export const PLATFORM_LABEL: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
}

// Faint per-platform accent dot so the shelf is scannable at a glance.
export const PLATFORM_COLOR: Record<Platform, string> = {
  chatgpt: '#10a37f',
  claude: '#d97757',
  gemini: '#4285f4',
}
