// Safe, user-facing NER failure copy. Never surface raw exception text,
// chrome-extension URLs, signed CDN query strings, or tokens in the UI.

export type NerErrorKind = 'network' | 'setup' | 'space' | 'unknown'

export interface SafeNerError {
  kind: NerErrorKind
  /** Short plain-language line for Settings. */
  message: string
  /**
   * Optional scrubbed detail for “What went wrong?” — no secrets, truncated.
   * Prefer empty when there's nothing helpful left after scrubbing.
   */
  detail?: string
}

const MAX_DETAIL = 240

/** Strip URLs/tokens/extension ids so a detail string can't leak signed links. */
export function scrubNerErrorDetail(raw: string): string {
  let s = String(raw ?? '')
  s = s.replace(/chrome-extension:\/\/[a-z]+/gi, 'chrome-extension://…')
  s = s.replace(/https?:\/\/[^\s)'"`]+/gi, (url) => {
    try {
      const u = new URL(url)
      return `${u.origin}/…`
    } catch {
      return 'https://…'
    }
  })
  s = s.replace(/\bBearer\s+\S+/gi, 'Bearer …')
  s = s.replace(/\bhf_[A-Za-z0-9]+/g, 'hf_…')
  s = s.replace(/\b(AKIA|sk-|ghp_|xox[baprs]-)[A-Za-z0-9_-]+/g, '[redacted]')
  s = s.replace(/\s+/g, ' ').trim()
  if (s.length > MAX_DETAIL) s = `${s.slice(0, MAX_DETAIL - 1)}…`
  return s
}

/**
 * Map any thrown value to a safe UI error. Raw message never returned as-is.
 */
export function toSafeNerError(raw: unknown): SafeNerError {
  const msg = String((raw as Error)?.message ?? raw ?? '')
  const lower = msg.toLowerCase()

  // CSP / WASM setup before generic "failed to fetch" (dynamic import errors
  // often include both phrases).
  if (
    /dynamically imported module|content security policy|csp|no available backend|wasm|import\.meta|not allowed/i.test(
      lower,
    )
  ) {
    return {
      kind: 'setup',
      message: 'The helper couldn’t start in this browser. Reload the extension and try again.',
      detail: scrubNerErrorDetail(msg) || undefined,
    }
  }

  if (
    /failed to fetch|networkerror|net::err_|load failed|aborted|timeout|econnreset|enotfound|offline/i.test(
      lower,
    )
  ) {
    return {
      kind: 'network',
      message: 'Couldn’t reach the download server. Check your connection and try again.',
      detail: scrubNerErrorDetail(msg) || undefined,
    }
  }

  if (/quota|storage|disk|space|cache/i.test(lower)) {
    return {
      kind: 'space',
      message: 'Not enough space to finish downloading. Free some storage and try again.',
      detail: scrubNerErrorDetail(msg) || undefined,
    }
  }

  return {
    kind: 'unknown',
    message: 'Something went wrong while getting the helper ready. Try again in a moment.',
    detail: scrubNerErrorDetail(msg) || undefined,
  }
}
