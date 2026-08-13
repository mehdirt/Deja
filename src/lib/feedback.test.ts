import { describe, expect, it } from 'vitest'
import { FEEDBACK_URL, REPO_URL, feedbackHref } from './feedback'

// These links are the only bridge between someone hitting a problem and us
// hearing about it, and they fail silently when wrong: GitHub ignores a query
// param that doesn't match a field id in the form, so a typo or a renamed field
// just quietly loses the prefill. The field ids asserted here must exist in
// .github/ISSUE_TEMPLATE/ — see feedbackFormFields.test.ts, which checks that.

describe('feedbackHref', () => {
  it('opens the matching issue form, not a blank issue', () => {
    const q = new URL(feedbackHref('problem')).searchParams
    expect(FEEDBACK_URL).toBe('')
    expect(feedbackHref('problem').startsWith(`${REPO_URL}/issues/new?`)).toBe(true)
    expect(q.get('template')).toBe('1-something-broken.yml')
    expect(new URL(feedbackHref('idea')).searchParams.get('template')).toBe('3-an-idea.yml')
    expect(new URL(feedbackHref('capture')).searchParams.get('template')).toBe(
      '2-not-saving-on-a-site.yml',
    )
  })

  it('carries the version through for a fault, but not for a wish', () => {
    expect(new URL(feedbackHref('problem', undefined, '0.5.0')).searchParams.get('version')).toBe(
      '0.5.0',
    )
    expect(new URL(feedbackHref('idea', undefined, '0.5.0')).searchParams.get('version')).toBeNull()
  })

  it('preselects the site when the context is exactly one platform', () => {
    const q = new URL(feedbackHref('capture', 'ChatGPT', '0.5.0')).searchParams
    expect(q.get('site')).toBe('ChatGPT')
    expect(q.get('notes')).toBeNull()
  })

  it('falls back to free text when the context is a sentence', () => {
    // A dropdown silently drops a value that isn't one of its options, so
    // anything that isn't a bare platform label must not be aimed at one.
    const q = new URL(feedbackHref('capture', 'capture broken on ChatGPT, Claude')).searchParams
    expect(q.get('site')).toBeNull()
    expect(q.get('notes')).toBe('capture broken on ChatGPT, Claude')
  })

  it('never aims a platform label at the site dropdown on a form without one', () => {
    const q = new URL(feedbackHref('problem', 'ChatGPT')).searchParams
    expect(q.get('site')).toBeNull()
    expect(q.get('notes')).toBe('ChatGPT')
  })

  it('sends nothing about the prompt itself', () => {
    // Feedback is user-initiated and carries only what Deja already showed on
    // screen. If prompt text ever reaches this URL it is a privacy incident,
    // not a formatting bug.
    const href = feedbackHref('capture', 'ChatGPT', '0.5.0')
    expect(href).not.toMatch(/body=/)
    expect([...new URL(href).searchParams.keys()].sort()).toEqual(['site', 'template', 'version'])
  })
})
