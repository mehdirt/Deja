// User-initiated feedback — a friendly way for people to report problems or
// suggest ideas. This is NOT telemetry: nothing is sent automatically or in the
// background. A feedback link opens a prefilled GitHub issue (or a hosted form,
// if FEEDBACK_URL is set) that the user reviews and submits themselves.
//
// Optionally set FEEDBACK_URL to a hosted form (Tally / Google Form / etc.) to
// use instead of GitHub Issues.

/** Canonical public repo — keep in sync with `git remote`. */
export const REPO_URL = 'https://github.com/mehdirt/Deja'

/** Optional hosted-form override. When set, used instead of GitHub Issues. */
export const FEEDBACK_URL = ''

export type FeedbackKind = 'problem' | 'idea' | 'capture'

const SUBJECT: Record<FeedbackKind, string> = {
  problem: 'a problem',
  idea: 'an idea',
  capture: 'capture not working',
}

/**
 * The href for a feedback action. Prefers a hosted form if configured, else a
 * prefilled GitHub new-issue URL. `context` (e.g. "capture broken on ChatGPT")
 * and `version` are appended so a report carries useful, non-personal detail —
 * the user still sees and edits everything before submitting.
 */
export function feedbackHref(kind: FeedbackKind, context?: string, version?: string): string {
  if (FEEDBACK_URL) return FEEDBACK_URL
  const title = `Deja — ${SUBJECT[kind]}`
  const lead = kind === 'idea' ? 'My idea:' : 'What happened:'
  const meta = [context ? `Context: ${context}` : '', version ? `Deja ${version}` : '']
    .filter(Boolean)
    .join('\n')
  const body = `${lead}\n\n\n———\n${meta}`
  const params = new URLSearchParams({ title, body })
  return `${REPO_URL}/issues/new?${params.toString()}`
}
