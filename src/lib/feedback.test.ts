import { describe, expect, it } from 'vitest'
import { FEEDBACK_URL, REPO_URL, feedbackHref, githubIssueHref } from './feedback'

// These links are the only bridge between someone hitting a problem and us
// hearing about it, and they fail silently when wrong: GitHub ignores a query
// param that doesn't match a field id in the form, so a typo or a renamed field
// just quietly loses the prefill. The field ids asserted here must exist in
// .github/ISSUE_TEMPLATE/ — see feedbackFormFields.test.ts, which checks that.

describe('feedbackHref', () => {
  // The buttons in Settings route through this, and which of the two bridges
  // they open is a product decision rather than an implementation detail: a
  // GitHub issue needs an account most of the people Deja is for do not have.
  // Whichever is configured, the link must never be a dead end.
  it('sends the user to the hosted form when one is configured, else GitHub', () => {
    for (const kind of ['problem', 'idea', 'capture'] as const) {
      const href = feedbackHref(kind, 'ChatGPT', '0.6.0')
      expect(href, kind).toBe(FEEDBACK_URL || githubIssueHref(kind, 'ChatGPT', '0.6.0'))
      expect(href.startsWith('https://'), kind).toBe(true)
    }
  })

  // The hosted form takes no prefill, so context and version are dropped — but
  // that must stay a *loss of convenience*, never a leak. Whatever the config,
  // nothing about the prompt may reach the URL.
  it('never carries prompt text, on either bridge', () => {
    const href = feedbackHref('capture', 'ChatGPT', '0.6.0')
    expect(href).not.toMatch(/body=/)
  })

  it('opens the matching issue form, not a blank issue', () => {
    const q = new URL(githubIssueHref('problem')).searchParams
    expect(githubIssueHref('problem').startsWith(`${REPO_URL}/issues/new?`)).toBe(true)
    expect(q.get('template')).toBe('1-something-broken.yml')
    expect(new URL(githubIssueHref('idea')).searchParams.get('template')).toBe('3-an-idea.yml')
    expect(new URL(githubIssueHref('capture')).searchParams.get('template')).toBe(
      '2-not-saving-on-a-site.yml',
    )
  })

  it('carries the version through for a fault, but not for a wish', () => {
    expect(new URL(githubIssueHref('problem', undefined, '0.5.0')).searchParams.get('version')).toBe(
      '0.5.0',
    )
    expect(new URL(githubIssueHref('idea', undefined, '0.5.0')).searchParams.get('version')).toBeNull()
  })

  it('preselects the site when the context is exactly one platform', () => {
    const q = new URL(githubIssueHref('capture', 'ChatGPT', '0.5.0')).searchParams
    expect(q.get('site')).toBe('ChatGPT')
    expect(q.get('notes')).toBeNull()
  })

  it('falls back to free text when the context is a sentence', () => {
    // A dropdown silently drops a value that isn't one of its options, so
    // anything that isn't a bare platform label must not be aimed at one.
    const q = new URL(githubIssueHref('capture', 'capture broken on ChatGPT, Claude')).searchParams
    expect(q.get('site')).toBeNull()
    expect(q.get('notes')).toBe('capture broken on ChatGPT, Claude')
  })

  it('never aims a platform label at the site dropdown on a form without one', () => {
    const q = new URL(githubIssueHref('problem', 'ChatGPT')).searchParams
    expect(q.get('site')).toBeNull()
    expect(q.get('notes')).toBe('ChatGPT')
  })

  it('sends nothing about the prompt itself', () => {
    // Feedback is user-initiated and carries only what Deja already showed on
    // screen. If prompt text ever reaches this URL it is a privacy incident,
    // not a formatting bug.
    const href = githubIssueHref('capture', 'ChatGPT', '0.5.0')
    expect(href).not.toMatch(/body=/)
    expect([...new URL(href).searchParams.keys()].sort()).toEqual(['site', 'template', 'version'])
  })
})
