// User-initiated feedback — a friendly way for people to report problems or
// suggest ideas. This is NOT telemetry: nothing is sent automatically or in the
// background. A feedback link opens a prefilled GitHub issue (or a hosted form,
// if FEEDBACK_URL is set) that the user reviews and submits themselves.
//
// WHY THIS POINTS AT ISSUE FORMS. A blank `issues/new?body=…` gets us "it
// doesn't work" and a week of round-trips. The forms in
// `.github/ISSUE_TEMPLATE/` ask the two or three things that make a report
// actionable, in plain language, and carry the "don't paste your prompt text"
// warning that a free-form box can't. The field ids below must match the `id:`
// keys in those files — GitHub silently ignores a query param that doesn't
// match a field, so a rename breaks prefill without any error.
//
// Optionally set FEEDBACK_URL to a hosted form (Tally / Google Form / etc.) to
// use instead of GitHub Issues. That is the escape hatch for the real gap here:
// filing an issue needs a GitHub account, which most of the people Deja is for
// do not have.

import { PLATFORM_LABEL } from './types'

/** Canonical public repo — keep in sync with `git remote`. */
export const REPO_URL = 'https://github.com/mehdirt/Deja'

/** Optional hosted-form override. When set, used instead of GitHub Issues. */
export const FEEDBACK_URL = ''

export type FeedbackKind = 'problem' | 'idea' | 'capture'

/** Which issue form each entry point opens. Filenames, not titles. */
const TEMPLATE: Record<FeedbackKind, string> = {
  problem: '1-something-broken.yml',
  idea: '3-an-idea.yml',
  capture: '2-not-saving-on-a-site.yml',
}

/**
 * The href for a feedback action. Prefers a hosted form if configured, else the
 * matching prefilled GitHub issue form.
 *
 * `context` is what Deja already knows about the situation (e.g. the platform a
 * capture-health warning is about) and `version` the running build — both are
 * non-personal, and the user still sees and edits everything before submitting.
 * Deliberately never includes prompt text.
 */
export function feedbackHref(kind: FeedbackKind, context?: string, version?: string): string {
  if (FEEDBACK_URL) return FEEDBACK_URL
  const params = new URLSearchParams({ template: TEMPLATE[kind] })
  // Which build you were running matters for a fault and not at all for a
  // wish, so the idea form doesn't ask and this doesn't send it.
  if (version && kind !== 'idea') params.set('version', version)
  if (context) {
    // A dropdown only prefills when the value is EXACTLY one of its options, so
    // route by what `context` actually is rather than by which form we're
    // opening: a bare platform label can preselect the site, while anything
    // else ("capture broken on ChatGPT, Claude") goes to a free-text field
    // where being wrong costs nothing. Guessing wrong on a dropdown silently
    // drops the value instead.
    const isPlatformLabel = Object.values(PLATFORM_LABEL).includes(
      context as (typeof PLATFORM_LABEL)[keyof typeof PLATFORM_LABEL],
    )
    params.set(isPlatformLabel && kind === 'capture' ? 'site' : 'notes', context)
  }
  return `${REPO_URL}/issues/new?${params.toString()}`
}
