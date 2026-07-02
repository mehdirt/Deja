// User-initiated feedback — a friendly way for people to report problems or
// suggest ideas. This is NOT telemetry: nothing is sent automatically or in the
// background. A feedback link just opens a prefilled email (or a hosted form, if
// FEEDBACK_URL is set) that the user reviews and sends themselves.
//
// TODO before going public: point FEEDBACK_EMAIL at a dedicated address, or set
// FEEDBACK_URL to a hosted form (Tally / Google Form / etc.), rather than a
// personal inbox.

export const FEEDBACK_URL = '' // if set, used instead of email
export const FEEDBACK_EMAIL = 'belaporschi@gmail.com'

export type FeedbackKind = 'problem' | 'idea' | 'capture'

const SUBJECT: Record<FeedbackKind, string> = {
  problem: 'a problem',
  idea: 'an idea',
  capture: 'capture not working',
}

/**
 * The href for a feedback action. Prefers a hosted form if configured, else a
 * prefilled mailto. `context` (e.g. "capture broken on ChatGPT") and `version`
 * are appended so a report carries useful, non-personal detail — the user still
 * sees and edits everything before sending.
 */
export function feedbackHref(kind: FeedbackKind, context?: string, version?: string): string {
  if (FEEDBACK_URL) return FEEDBACK_URL
  const subject = `Deja — ${SUBJECT[kind]}`
  const lead = kind === 'idea' ? 'My idea:' : 'What happened:'
  const meta = [context ? `Context: ${context}` : '', version ? `Deja ${version}` : '']
    .filter(Boolean)
    .join('\n')
  const body = `${lead}\n\n\n———\n${meta}`
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
